export const money = (n: number | null | undefined, currency = '') => {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  const s = v.toLocaleString(undefined, {
    minimumFractionDigits: Math.abs(v % 1) > 0.0001 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return currency ? `${s} ${currency}` : s;
};

export const pct = (n: number) =>
  `${(isFinite(n) ? n * 100 : 0).toFixed(n >= 0.1 ? 0 : 1)}%`;

export const todayISO = () => {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const toISO = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const prettyDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = fromISO(iso);
  const t = todayISO();
  if (iso === t) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === toISO(y)) return 'Yesterday';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const monthLabel = (iso: string) => {
  const d = fromISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/** Notes are often Arabic — let the platform lay them out right-to-left. */
export const isRTL = (s: string) => /[؀-ۿݐ-ݿ]/.test(s || '');
