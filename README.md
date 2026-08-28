# Masareef — expense entry for your Google Sheet

A mobile app that writes into the expense sheet you already keep, in the columns
you already use, with the category names your own formulas already expect. It
does not restructure anything, does not create its own database, and does not
change a single formula.

- **Add** — amount, category, date, note → one tap, straight into the sheet
- **Budget** — live buckets from your BUCKETS tab, with over-budget flags
- **History** — every row in the month tab, newest first, plus anything queued
- **Analysis** — where the money goes, day by day, budget vs actual
- **Offline** — entries are queued on the phone and pushed when signal returns

---

## Why there's a script step

A Google share link lets *people* edit a sheet. It does not let an app write to
it — Google requires an authenticated identity for any write, always. The
lightest way to get one is a small Apps Script that lives in your own Google
account and acts on your behalf.

You do this **once**. After that the app works the way you asked: paste a month's
share link, and it writes.

---

## Setup

### 1. Deploy the script (once, ~5 minutes, on a computer)

1. Open any of your expense sheets → **Extensions → Apps Script**.
2. Delete everything in the editor and paste in the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs).
3. On line 24, replace `CHANGE_ME_TO_A_LONG_RANDOM_STRING` with a long random
   password you invent. This is your token — the app will need the same string.
4. **Deploy → New deployment → ⚙ → Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
5. Click **Deploy**, then **Authorize access** and accept the Google warning
   screen ("Advanced → Go to … (unsafe)" — it says that for every personal
   script that isn't published to the Google Marketplace).
6. Copy the **Web app URL**. It ends in `/exec`.

> "Anyone" only means the URL is reachable. Your token is the actual lock, and
> the script can only ever touch spreadsheets your own Google account can
> already open.

**Adding a new month later needs none of this.** The script opens sheets by
link, so a new month is just a new link pasted into the app.

### 2. Run the app

**Option A — Expo Go (fastest)**

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone. Your phone and computer must be on
the same Wi-Fi (or add `--tunnel` if they aren't).

**Option B — an installable APK, built in the cloud (no Android Studio)**

Push this folder to a GitHub repo, then open **Actions → Build Android APK →
Run workflow**. When it finishes (~10 minutes), download `masareef-apk` from the
run's Artifacts, move the `.apk` to your phone and open it. Android will ask you
to allow installing from unknown sources.

**Option C — an APK via EAS** (needs a free Expo account)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

EAS gives you a download link when the build finishes.

### 3. Point the app at your sheet

In the app's **Settings** tab:

- paste the **Web app URL** and your **token**, then tap **Test connection**
- add your month sheet: give it a name ("August 2026") and paste its share link
- pull down on the Budget tab to load

---

## How it protects your sheet

| Concern | What the script does |
|---|---|
| Where new rows go | Finds the last row with anything in **A:D** and writes to the next one. Your totals in G/H/J are never scanned or touched. |
| Column mapping | Detects `Date / Category / Cost / Note` from the header row — it is not hardcoded to A/B/C/D, so a reordered sheet still works. |
| Category names | Read out of the **SUMIF criteria in your own formulas**, so the string written is byte-identical to what your totals match on (`Saving`, not `Savings`; `fast food`, not `Fast Food`). |
| Bucket relations | `BUCKETS` rows are read with their planned/actual pair. `Daily budget` points at `Aug!J20`, so the script follows that reference and picks up all five sub-categories behind it. |
| Formatting | New rows inherit the formatting of the row above, so dates and numbers keep looking the way they do now. |
| Concurrent writes | A script lock serialises appends, so two phones (or a retry) can't land on the same row. |
| Blank date rows | Your sheet leaves the date blank on repeat days; the reader inherits the previous row's date rather than dropping the entry. |

## Adding a new month

Duplicate your month tab in Google Sheets as usual (or start a new spreadsheet),
then paste its link into Settings. The script re-reads the categories and buckets
from whatever sheet you point it at, so renamed or added buckets appear in the
app on the next refresh — no rebuild.

## Project layout

```
apps-script/Code.gs        the Google side — deploy this once
App.tsx                    tab shell
src/lib/api.ts             calls to the script
src/lib/AppContext.tsx     state, offline queue, sync
src/lib/storage.ts         AsyncStorage
src/screens/               Add · Budget · History · Analysis · Settings
src/components/charts/     donut + bar charts (react-native-svg)
src/theme.ts               colours (validated for colour-blind separation)
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Google returned a sign-in page" | The deployment's *Who has access* isn't **Anyone**. Re-deploy. |
| "Bad token" | The token in Settings doesn't match the `TOKEN` line in Code.gs. |
| "Cannot open that sheet" | The Google account that deployed the script needs editor access to that spreadsheet. |
| "No tab with Date / Category / Cost headers" | The month tab's header row must contain those three words. |
| Entries stuck in the queue | Settings → **Sync now**. The badge on the History tab shows how many are waiting. |
| Changed the script after deploying | Deploy → **Manage deployments** → edit → Version: **New version**. The `/exec` URL stays the same. |
# expenses
