export type Category = { name: string; bucket: string | null };

export type Bucket = {
  name: string;
  budget: number;
  spent: number;
  categories: string[];
  row: number;
};

export type Entry = {
  row: number;
  date: string | null;
  dateExplicit: boolean;
  category: string;
  cost: number;
  note: string;
};

export type Summary = {
  salary: number | null;
  totalExpenses: number | null;
  remain: number | null;
  currency: string;
};

export type Snapshot = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  entryTab: string;
  tabs: string[];
  columns: { date: number; category: number; cost: number; note: number };
  categories: Category[];
  buckets: Bucket[];
  summary: Summary;
  entries: Entry[];
  fetchedAt: string;
  /** Absent on deployments older than v4, and on snapshots cached before it. */
  scriptVersion?: number;
};

/** A month's spreadsheet, as the user pasted it in. */
export type SheetRef = {
  id: string;
  label: string;
  url: string;
};

export type Pending = {
  clientId: string;
  sheetId: string;
  date: string;
  category: string;
  cost: number;
  note: string;
  createdAt: string;
  lastError?: string;
};

export type Favorite = {
  id: string;
  label: string;
  category: string;
  cost: number | null;
  note: string;
};

export type Settings = {
  scriptUrl: string;
  token: string;
  sheets: SheetRef[];
  activeSheetId: string | null;
  currency: string;
};

export const EMPTY_SETTINGS: Settings = {
  scriptUrl: '',
  token: '',
  sheets: [],
  activeSheetId: null,
  currency: 'JD',
};
