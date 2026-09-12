import { Entry } from './types';

/**
 * Fuel refills follow the sheet's own convention: category "Transportation",
 * note "liters, km" where km is the distance driven since the previous refill.
 * The sheet's Cons column divides one by the other; everything here mirrors it.
 */

export const isFuelCategory = (name: string | null | undefined) =>
  String(name || '').trim().toLowerCase() === 'transportation';

/** Same regexes as the Cons formula: liters = first number, km = number after a comma. */
export function parseFuelNote(note: string | null | undefined) {
  const s = String(note || '');
  const l = s.match(/([\d.]+)/);
  const k = s.match(/,\s*([\d.]+)/);
  if (!l || !k) return null;
  const liters = Number(l[1]);
  const km = Number(k[1]);
  if (!(liters > 0) || !(km > 0)) return null;
  return { liters, km };
}

export const formatFuelNote = (liters: number, km: number) => `${liters}, ${km}`;

export type Refill = {
  row: number;
  date: string | null;
  cost: number;
  note: string;
  liters: number | null;
  km: number | null;
  /** The sheet's Cons value when it has one, otherwise km ÷ liters. */
  kmPerL: number | null;
  costPerKm: number | null;
};

export function refillsFrom(entries: Entry[]): Refill[] {
  return entries
    .filter((e) => isFuelCategory(e.category))
    .map((e) => {
      const f = parseFuelNote(e.note);
      const fromSheet = typeof e.cons === 'number' && e.cons > 0 ? e.cons : null;
      return {
        row: e.row,
        date: e.date,
        cost: e.cost,
        note: e.note,
        liters: f?.liters ?? null,
        km: f?.km ?? null,
        kmPerL: fromSheet ?? (f ? f.km / f.liters : null),
        costPerKm: f && e.cost > 0 ? e.cost / f.km : null,
      };
    });
}

/** Month totals. The average is total km ÷ total liters, as the sheet computes it. */
export function fuelTotals(refills: Refill[]) {
  const measured = refills.filter((r) => r.liters != null && r.km != null);
  const liters = measured.reduce((s, r) => s + r.liters!, 0);
  const km = measured.reduce((s, r) => s + r.km!, 0);
  const measuredCost = measured.reduce((s, r) => s + r.cost, 0);
  return {
    liters,
    km,
    cost: refills.reduce((s, r) => s + r.cost, 0),
    avgKmPerL: liters > 0 ? km / liters : null,
    costPerKm: km > 0 ? measuredCost / km : null,
    measured: measured.length,
  };
}
