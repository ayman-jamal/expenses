/**
 * Masareef — Google Sheets bridge
 * ---------------------------------------------------------------
 * Deploy this once as a Web App (Execute as: Me, Access: Anyone).
 * The mobile app then talks to it and can write to ANY spreadsheet
 * that your Google account has editor access to — you just paste
 * the sheet's share link into the app.
 *
 * The script never hardcodes your layout. It discovers:
 *   - which tab holds the entries (the one with Date/Category/Cost/Note)
 *   - which categories exist, by reading the SUMIF criteria your own
 *     formulas use, so the strings it writes always match the sheet
 *   - which budget buckets exist, from the BUCKETS tab
 *
 * SET YOUR TOKEN BELOW before deploying.
 */

var TOKEN = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

var HEADER_ALIASES = {
  date: ['date', 'التاريخ', 'تاريخ'],
  category: ['category', 'الفئة', 'التصنيف', 'البند'],
  cost: ['cost', 'amount', 'value', 'المبلغ', 'التكلفة'],
  note: ['note', 'notes', 'comment', 'ملاحظة', 'ملاحظات', 'البيان']
};

var MAX_ENTRIES_RETURNED = 600;

/* ============================ ROUTING ============================ */

function doGet(e) {
  return route(readRequest(e));
}

function doPost(e) {
  return route(readRequest(e));
}

function readRequest(e) {
  var req = {};
  if (e && e.parameter) {
    for (var k in e.parameter) req[k] = e.parameter[k];
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var j in body) req[j] = body[j];
    } catch (err) {
      req.__parseError = String(err);
    }
  }
  return req;
}

function route(req) {
  try {
    if (req.__parseError) return fail('Could not read the request body: ' + req.__parseError);
    if (String(req.token || '') !== String(TOKEN)) return fail('Bad token. Check Settings in the app.');

    var action = String(req.action || 'ping');

    if (action === 'ping') {
      return ok({ pong: true, version: 3, user: safeUser() });
    }
    if (action === 'bootstrap') {
      return ok(bootstrap(req));
    }
    if (action === 'append') {
      return ok(append(req));
    }
    return fail('Unknown action: ' + action);
  } catch (err) {
    return fail(err && err.message ? err.message : String(err));
  }
}

function ok(payload) {
  payload = payload || {};
  payload.ok = true;
  return json(payload);
}

function fail(message) {
  return json({ ok: false, error: String(message) });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function safeUser() {
  try {
    return Session.getEffectiveUser().getEmail();
  } catch (e) {
    return '';
  }
}

/* ============================ ACTIONS ============================ */

function bootstrap(req) {
  var ss = openSheet(req.sheetUrl);
  var entryTab = findEntryTab(ss, req.tabName);
  var buckets = readBuckets(ss, entryTab);
  var entries = readEntries(entryTab);
  var categories = discoverCategories(ss, entryTab, buckets, entries);
  var summary = readSummary(ss);

  return {
    spreadsheetId: ss.getId(),
    spreadsheetTitle: ss.getName(),
    entryTab: entryTab.sheet.getName(),
    tabs: ss.getSheets().map(function (s) {
      return s.getName();
    }),
    columns: entryTab.columns,
    categories: categories,
    buckets: buckets,
    summary: summary,
    entries: entries,
    fetchedAt: new Date().toISOString()
  };
}

function append(req) {
  var items = req.entries || [];
  if (!items.length) return { written: 0, rows: [] };

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var ss = openSheet(req.sheetUrl);
    var entryTab = findEntryTab(ss, req.tabName);
    var sheet = entryTab.sheet;
    var col = entryTab.columns;

    var maxCol = Math.max(col.date, col.category, col.cost, col.note);
    var startRow = lastUsedRow(sheet, maxCol) + 1;
    if (startRow < entryTab.headerRow + 1) startRow = entryTab.headerRow + 1;

    var needed = startRow + items.length - 1;
    if (needed > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows() + 20);
    }

    // Carry the formatting of the previous data row onto the new rows.
    var templateRow = startRow - 1;
    if (templateRow >= entryTab.headerRow + 1) {
      sheet
        .getRange(templateRow, 1, 1, maxCol)
        .copyTo(
          sheet.getRange(startRow, 1, items.length, maxCol),
          SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
          false
        );
    }

    var written = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      var row = startRow + i;

      var d = parseDate(it.date);
      if (d) sheet.getRange(row, col.date).setValue(d);

      sheet.getRange(row, col.category).setValue(String(it.category == null ? '' : it.category));

      var amount = Number(it.cost);
      sheet.getRange(row, col.cost).setValue(isNaN(amount) ? '' : amount);

      var note = it.note == null ? '' : String(it.note);
      if (note !== '' && col.note) sheet.getRange(row, col.note).setValue(note);

      written.push({ clientId: it.clientId || null, row: row });
    }

    SpreadsheetApp.flush();

    var buckets = readBuckets(ss, entryTab);
    return {
      written: written.length,
      rows: written,
      entryTab: sheet.getName(),
      buckets: buckets,
      summary: readSummary(ss),
      entries: readEntries(entryTab)
    };
  } finally {
    lock.releaseLock();
  }
}

/* ========================= SHEET DISCOVERY ======================== */

function openSheet(sheetUrl) {
  var url = String(sheetUrl || '').trim();
  if (!url) throw new Error('No sheet link provided.');
  var id = extractId(url);
  if (!id) throw new Error('That does not look like a Google Sheets link.');
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(
      'Cannot open that sheet. Make sure the Google account that deployed this script has editor access to it.'
    );
  }
}

function extractId(url) {
  var m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(url)) return url;
  return null;
}

/**
 * Finds the tab that holds expense rows by looking for a header row
 * containing Date / Category / Cost (Note optional) in the first 5 rows.
 */
function findEntryTab(ss, preferredName) {
  var sheets = ss.getSheets();
  var candidates = [];

  for (var i = 0; i < sheets.length; i++) {
    var found = detectHeader(sheets[i]);
    if (found) candidates.push(found);
  }

  if (!candidates.length) {
    throw new Error(
      'No tab with Date / Category / Cost headers was found in "' + ss.getName() + '".'
    );
  }
  if (preferredName) {
    for (var j = 0; j < candidates.length; j++) {
      if (candidates[j].sheet.getName() === preferredName) return candidates[j];
    }
  }
  // Prefer a tab that actually has data rows.
  candidates.sort(function (a, b) {
    return b.dataRows - a.dataRows;
  });
  return candidates[0];
}

function detectHeader(sheet) {
  var name = sheet.getName();
  if (/^buckets$/i.test(name) || /^analysis$/i.test(name)) return null;

  var scanRows = Math.min(5, sheet.getMaxRows());
  var scanCols = Math.min(12, sheet.getMaxColumns());
  if (scanRows < 1 || scanCols < 1) return null;

  var values = sheet.getRange(1, 1, scanRows, scanCols).getValues();

  for (var r = 0; r < values.length; r++) {
    var cols = { date: 0, category: 0, cost: 0, note: 0 };
    for (var c = 0; c < values[r].length; c++) {
      var label = String(values[r][c] || '').trim().toLowerCase();
      if (!label) continue;
      for (var key in HEADER_ALIASES) {
        if (cols[key]) continue;
        if (HEADER_ALIASES[key].indexOf(label) !== -1) cols[key] = c + 1;
      }
    }
    if (cols.date && cols.category && cols.cost) {
      var headerRow = r + 1;
      return {
        sheet: sheet,
        headerRow: headerRow,
        columns: cols,
        dataRows: Math.max(0, lastUsedRow(sheet, Math.max(cols.date, cols.category, cols.cost, cols.note)) - headerRow)
      };
    }
  }
  return null;
}

/**
 * Last row that has anything in columns 1..maxCol. Deliberately ignores
 * the summary formulas parked in columns further right (G/H/J in your
 * sheet) so appending never lands on top of them.
 */
function lastUsedRow(sheet, maxCol) {
  var rows = sheet.getMaxRows();
  if (rows < 1) return 0;
  var values = sheet.getRange(1, 1, rows, maxCol).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    for (var c = 0; c < values[i].length; c++) {
      var v = values[i][c];
      if (v !== '' && v !== null && v !== undefined) return i + 1;
    }
  }
  return 0;
}

/* ============================ READING ============================ */

function readEntries(entryTab) {
  var sheet = entryTab.sheet;
  var col = entryTab.columns;
  var maxCol = Math.max(col.date, col.category, col.cost, col.note);
  var last = lastUsedRow(sheet, maxCol);
  var first = entryTab.headerRow + 1;
  if (last < first) return [];

  var values = sheet.getRange(first, 1, last - first + 1, maxCol).getValues();
  var out = [];
  var lastDate = null;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rawDate = col.date ? row[col.date - 1] : '';
    var category = col.category ? String(row[col.category - 1] || '').trim() : '';
    var cost = col.cost ? row[col.cost - 1] : '';
    var note = col.note ? String(row[col.note - 1] || '') : '';

    if (!category && (cost === '' || cost === null) && !note) continue;

    var iso = null;
    if (rawDate instanceof Date) {
      iso = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      lastDate = iso;
    } else if (rawDate) {
      var parsed = parseDate(rawDate);
      if (parsed) {
        iso = Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        lastDate = iso;
      }
    } else {
      // Your sheet leaves the date blank on repeat days — inherit it.
      iso = lastDate;
    }

    out.push({
      row: first + i,
      date: iso,
      dateExplicit: !!rawDate,
      category: category,
      cost: typeof cost === 'number' ? cost : Number(cost) || 0,
      note: note
    });
  }

  if (out.length > MAX_ENTRIES_RETURNED) out = out.slice(out.length - MAX_ENTRIES_RETURNED);
  return out;
}

function bucketsSheet(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (/buckets|budget|الميزانية/i.test(sheets[i].getName())) return sheets[i];
  }
  return null;
}

/**
 * Reads the budget buckets. For each labelled row it finds the planned
 * amount, the actual amount, and — by parsing the SUMIF criteria in the
 * "actual" formula — exactly which category strings feed that bucket.
 */
function readBuckets(ss, entryTab) {
  var bs = bucketsSheet(ss);
  if (!bs) return [];

  var rows = Math.min(bs.getMaxRows(), 200);
  var cols = Math.min(bs.getMaxColumns(), 12);
  var values = bs.getRange(1, 1, rows, cols).getValues();
  var formulas = bs.getRange(1, 1, rows, cols).getFormulas();

  var out = [];

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      // Only real text labels — skips checkbox booleans and stray numbers.
      if (typeof values[r][c] !== 'string') continue;
      var label = values[r][c].trim();
      if (!label || !/[A-Za-z؀-ۿ]/.test(label)) continue;
      if (/^(categories|total|base salary|total expenses|remain)$/i.test(label)) continue;
      if (label.length > 40) continue;

      // A bucket row = a label with a numeric/formula "actual" cell to its right.
      var planned = null;
      var actual = null;
      var actualFormula = '';

      for (var k = c + 1; k < cols; k++) {
        var v = values[r][k];
        var f = formulas[r][k];
        if (typeof v === 'number' || (f && /SUMIF|IMPORTRANGE|=/.test(f))) {
          if (planned === null && !f) {
            planned = Number(v) || 0;
          } else if (planned === null && f && !/SUMIF/i.test(f)) {
            planned = typeof v === 'number' ? v : 0;
          } else if (actual === null && f) {
            actual = typeof v === 'number' ? v : 0;
            actualFormula = f;
          } else if (actual === null && typeof v === 'number' && planned !== null) {
            actual = v;
          }
        }
      }

      if (actual === null && planned === null) continue;
      if (!actualFormula) continue;

      var cats = criteriaFrom(actualFormula, ss, bs);

      out.push({
        name: label,
        budget: planned === null ? 0 : Number(planned) || 0,
        spent: actual === null ? 0 : Number(actual) || 0,
        categories: cats,
        row: r + 1
      });
      break;
    }
  }

  return out;
}

/**
 * Pulls the criteria strings out of SUMIF formulas. If the formula just
 * points at another cell (your "Daily budget" bucket points at Aug!J20),
 * it follows that reference one hop and parses there instead.
 */
function criteriaFrom(formula, ss, currentSheet, depth) {
  depth = depth || 0;
  var out = [];
  if (!formula) return out;

  var re = /SUMIFS?\s*\(\s*[^,()]*(?:\([^()]*\))?[^,()]*,\s*"([^"]+)"/gi;
  var m;
  while ((m = re.exec(formula)) !== null) {
    if (out.indexOf(m[1]) === -1) out.push(m[1]);
  }
  if (out.length || depth >= 2) return out;

  // Follow a plain cell reference, e.g. "=Aug!J20"
  var ref = formula.match(/=\s*(?:'([^']+)'|([A-Za-z0-9 _]+))?!?\$?([A-Z]{1,3})\$?(\d+)\s*$/);
  if (!ref) return out;
  var tabName = ref[1] || ref[2];
  var target = tabName ? ss.getSheetByName(String(tabName).trim()) : currentSheet;
  if (!target) return out;

  var cell = target.getRange(ref[3] + ref[4]);
  return criteriaFrom(cell.getFormula(), ss, target, depth + 1);
}

/**
 * The definitive category list: every criteria string the sheet's own
 * formulas already use, plus anything that has actually been typed in
 * the Category column. Order = buckets first, then sheet totals, then
 * whatever else exists.
 */
function discoverCategories(ss, entryTab, buckets, entries) {
  var seen = {};
  var out = [];

  function push(name, bucket) {
    var raw = String(name || '').trim();
    if (!raw) return;
    var key = raw.toLowerCase();
    if (seen[key]) {
      if (bucket && !seen[key].bucket) seen[key].bucket = bucket;
      return;
    }
    var item = { name: raw, bucket: bucket || null };
    seen[key] = item;
    out.push(item);
  }

  for (var i = 0; i < buckets.length; i++) {
    var b = buckets[i];
    for (var c = 0; c < b.categories.length; c++) push(b.categories[c], b.name);
  }

  // Totals block on the entry tab (your G/H columns).
  var sheet = entryTab.sheet;
  var rows = Math.min(sheet.getMaxRows(), 120);
  var cols = Math.min(sheet.getMaxColumns(), 20);
  var fs = sheet.getRange(1, 1, rows, cols).getFormulas();
  for (var r = 0; r < fs.length; r++) {
    for (var k = 0; k < fs[r].length; k++) {
      if (!fs[r][k]) continue;
      var found = criteriaFrom(fs[r][k], ss, sheet);
      for (var q = 0; q < found.length; q++) push(found[q], null);
    }
  }

  for (var e = 0; e < entries.length; e++) push(entries[e].category, null);

  return out;
}

function readSummary(ss) {
  var bs = bucketsSheet(ss);
  var summary = { salary: null, totalExpenses: null, remain: null, currency: '' };
  if (!bs) return summary;

  var rows = Math.min(bs.getMaxRows(), 60);
  var cols = Math.min(bs.getMaxColumns(), 12);
  var values = bs.getRange(1, 1, rows, cols).getValues();

  function findLabel(patterns) {
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var label = String(values[r][c] || '').trim();
        if (!label) continue;
        for (var p = 0; p < patterns.length; p++) {
          if (patterns[p].test(label)) {
            for (var k = c + 1; k < cols; k++) {
              if (typeof values[r][k] === 'number') return values[r][k];
            }
          }
        }
      }
    }
    return null;
  }

  summary.salary = findLabel([/^base salary$/i, /salary/i]);
  summary.totalExpenses = findLabel([/^total expenses$/i]);
  summary.remain = findLabel([/^remain/i]);
  return summary;
}

/* ============================ HELPERS ============================ */

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  var s = String(value).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
