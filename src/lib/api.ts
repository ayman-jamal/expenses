import { Pending, Snapshot } from './types';

export class ApiError extends Error {}

type CallOptions = { timeoutMs?: number };

/**
 * Talks to the Apps Script web app.
 *
 * Content-Type is text/plain on purpose: it keeps the request "simple" so no
 * CORS preflight is issued (Apps Script does not answer OPTIONS). Apps Script
 * answers an exec POST with a 302 to googleusercontent; fetch follows it and
 * returns the JSON the script already produced.
 */
async function call<T>(
  scriptUrl: string,
  body: Record<string, unknown>,
  opts: CallOptions = {}
): Promise<T> {
  const url = scriptUrl.trim();
  if (!url) throw new ApiError('No script URL set. Open Settings first.');
  if (!/^https:\/\/script\.google\.com\/.*\/exec/.test(url)) {
    throw new ApiError(
      'That script URL looks wrong. It should end in /exec and start with https://script.google.com/'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') throw new ApiError('The sheet took too long to answer.');
    throw new ApiError('No connection to Google. Your entry is saved and will sync later.');
  }
  clearTimeout(timer);

  const text = await res.text();

  if (text.trim().startsWith('<')) {
    throw new ApiError(
      'Google returned a sign-in page instead of data. Re-deploy the script with "Who has access: Anyone".'
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError('Unreadable answer from the script: ' + text.slice(0, 120));
  }

  if (!parsed.ok) throw new ApiError(parsed.error || 'The script reported an error.');
  return parsed as T;
}

export const api = {
  ping: (scriptUrl: string, token: string) =>
    call<{ pong: boolean; user: string }>(scriptUrl, { token, action: 'ping' }, { timeoutMs: 20000 }),

  bootstrap: (scriptUrl: string, token: string, sheetUrl: string, tabName?: string) =>
    call<Snapshot>(scriptUrl, { token, action: 'bootstrap', sheetUrl, tabName }),

  append: (
    scriptUrl: string,
    token: string,
    sheetUrl: string,
    entries: Pending[],
    tabName?: string
  ) =>
    call<{
      written: number;
      rows: { clientId: string | null; row: number }[];
      entryTab: string;
      buckets: Snapshot['buckets'];
      summary: Snapshot['summary'];
      entries: Snapshot['entries'];
    }>(scriptUrl, {
      token,
      action: 'append',
      sheetUrl,
      tabName,
      entries: entries.map((e) => ({
        clientId: e.clientId,
        date: e.date,
        category: e.category,
        cost: e.cost,
        note: e.note,
      })),
    }),
};
