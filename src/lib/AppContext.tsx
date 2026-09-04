import NetInfo from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { api, ApiError, MIN_REMOVE_VERSION, RemoveTarget } from './api';
import { uid } from './format';
import { store } from './storage';
import {
  EMPTY_SETTINGS,
  Favorite,
  Pending,
  Settings,
  SheetRef,
  Snapshot,
} from './types';

type Ctx = {
  ready: boolean;
  online: boolean;
  settings: Settings;
  activeSheet: SheetRef | null;
  snapshot: Snapshot | null;
  queue: Pending[];
  pendingHere: Pending[];
  favorites: Favorite[];
  refreshing: boolean;
  syncing: boolean;
  removing: boolean;
  error: string | null;

  configured: boolean;
  /** False until the deployed Code.gs is new enough to delete rows. */
  canRemove: boolean;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  addSheet: (label: string, url: string) => Promise<string>;
  updateSheet: (id: string, patch: Partial<SheetRef>) => Promise<void>;
  removeSheet: (id: string) => Promise<void>;
  setActiveSheet: (id: string) => Promise<void>;

  refresh: () => Promise<void>;
  addEntry: (e: { date: string; category: string; cost: number; note: string }) => Promise<boolean>;
  flush: () => Promise<void>;
  discardPending: (clientId: string) => Promise<void>;
  removeEntries: (
    targets: RemoveTarget[]
  ) => Promise<{ ok: true } | { ok: false; message: string }>;

  addFavorite: (f: Omit<Favorite, 'id'>) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export const useApp = () => {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [queue, setQueue] = useState<Pending[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flushing = useRef(false);
  const latest = useRef({ settings, queue });
  latest.current = { settings, queue };

  /* ---------------------------- boot ---------------------------- */

  useEffect(() => {
    (async () => {
      const [s, q, f] = await Promise.all([
        store.loadSettings(),
        store.loadQueue(),
        store.loadFavorites(),
      ]);
      setSettings(s);
      setQueue(q);
      setFavorites(f);
      if (s.activeSheetId) {
        const snap = await store.loadSnapshot(s.activeSheetId);
        if (snap) setSnapshots((m) => ({ ...m, [s.activeSheetId!]: snap }));
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const isUp = !!state.isConnected;
      setOnline(isUp);
      if (isUp) void flush();
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void flush();
    });
    return () => {
      unsub();
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSheet = useMemo(
    () => settings.sheets.find((s) => s.id === settings.activeSheetId) ?? null,
    [settings]
  );

  const snapshot = activeSheet ? snapshots[activeSheet.id] ?? null : null;
  const pendingHere = useMemo(
    () => (activeSheet ? queue.filter((q) => q.sheetId === activeSheet.id) : []),
    [queue, activeSheet]
  );

  const configured = !!(settings.scriptUrl && settings.token && activeSheet);
  const canRemove = (snapshot?.scriptVersion ?? 0) >= MIN_REMOVE_VERSION;

  /* -------------------------- settings -------------------------- */

  const persist = useCallback(async (next: Settings) => {
    setSettings(next);
    await store.saveSettings(next);
  }, []);

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      await persist({ ...latest.current.settings, ...patch });
    },
    [persist]
  );

  const addSheet = useCallback(
    async (label: string, url: string) => {
      const s = latest.current.settings;
      const ref: SheetRef = { id: uid(), label: label.trim() || 'Sheet', url: url.trim() };
      await persist({
        ...s,
        sheets: [...s.sheets, ref],
        activeSheetId: s.activeSheetId ?? ref.id,
      });
      return ref.id;
    },
    [persist]
  );

  const updateSheet = useCallback(
    async (id: string, patch: Partial<SheetRef>) => {
      const s = latest.current.settings;
      await persist({
        ...s,
        sheets: s.sheets.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      });
    },
    [persist]
  );

  const removeSheet = useCallback(
    async (id: string) => {
      const s = latest.current.settings;
      const sheets = s.sheets.filter((x) => x.id !== id);
      await persist({
        ...s,
        sheets,
        activeSheetId: s.activeSheetId === id ? sheets[0]?.id ?? null : s.activeSheetId,
      });
    },
    [persist]
  );

  const setActiveSheet = useCallback(
    async (id: string) => {
      await persist({ ...latest.current.settings, activeSheetId: id });
      const cached = await store.loadSnapshot(id);
      if (cached) setSnapshots((m) => ({ ...m, [id]: cached }));
    },
    [persist]
  );

  /* --------------------------- syncing -------------------------- */

  const applySnapshot = useCallback(async (sheetId: string, snap: Snapshot) => {
    setSnapshots((m) => ({ ...m, [sheetId]: snap }));
    await store.saveSnapshot(sheetId, snap);
  }, []);

  const refresh = useCallback(async () => {
    const s = latest.current.settings;
    const sheet = s.sheets.find((x) => x.id === s.activeSheetId);
    if (!sheet || !s.scriptUrl || !s.token) return;
    setRefreshing(true);
    setError(null);
    try {
      const snap = await api.bootstrap(s.scriptUrl, s.token, sheet.url);
      await applySnapshot(sheet.id, snap);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : String(e?.message || e));
    } finally {
      setRefreshing(false);
    }
  }, [applySnapshot]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const { settings: s, queue: q } = latest.current;
    if (!q.length || !s.scriptUrl || !s.token) return;

    flushing.current = true;
    setSyncing(true);
    try {
      const bySheet = q.reduce<Record<string, Pending[]>>((acc, item) => {
        (acc[item.sheetId] ||= []).push(item);
        return acc;
      }, {});

      for (const sheetId of Object.keys(bySheet)) {
        const sheet = s.sheets.find((x) => x.id === sheetId);
        if (!sheet) {
          // The sheet was deleted — drop its orphaned entries.
          setQueue((cur) => {
            const next = cur.filter((i) => i.sheetId !== sheetId);
            void store.saveQueue(next);
            return next;
          });
          continue;
        }
        const batch = bySheet[sheetId];
        try {
          const res = await api.append(s.scriptUrl, s.token, sheet.url, batch);
          const done = new Set(batch.map((b) => b.clientId));
          setQueue((cur) => {
            const next = cur.filter((i) => !done.has(i.clientId));
            void store.saveQueue(next);
            return next;
          });

          const prev = snapshots[sheetId];
          if (prev) {
            await applySnapshot(sheetId, {
              ...prev,
              buckets: res.buckets,
              summary: res.summary,
              entries: res.entries,
              entryTab: res.entryTab,
              fetchedAt: new Date().toISOString(),
            });
          } else {
            await refresh();
          }
          setError(null);
        } catch (e: any) {
          const msg = e instanceof ApiError ? e.message : String(e?.message || e);
          setError(msg);
          setQueue((cur) => {
            const next = cur.map((i) =>
              batch.some((b) => b.clientId === i.clientId) ? { ...i, lastError: msg } : i
            );
            void store.saveQueue(next);
            return next;
          });
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [applySnapshot, refresh, snapshots]);

  const addEntry = useCallback(
    async (e: { date: string; category: string; cost: number; note: string }) => {
      const s = latest.current.settings;
      if (!s.activeSheetId) return false;
      const item: Pending = {
        clientId: uid(),
        sheetId: s.activeSheetId,
        date: e.date,
        category: e.category,
        cost: e.cost,
        note: e.note,
        createdAt: new Date().toISOString(),
      };
      const next = [...latest.current.queue, item];
      setQueue(next);
      await store.saveQueue(next);
      latest.current.queue = next;
      void flush();
      return true;
    },
    [flush]
  );

  /**
   * Deletions are never queued. Adding works offline because the phone is the
   * only source of truth for a new row, so it can be replayed verbatim later.
   * A deletion is the opposite: its whole safety model is verifying against
   * the sheet's state at the moment of writing, and a delete queued for days
   * would verify against something long stale. So this needs a connection.
   */
  const removeEntries = useCallback(
    async (targets: RemoveTarget[]): Promise<{ ok: true } | { ok: false; message: string }> => {
      const s = latest.current.settings;
      const sheet = s.sheets.find((x) => x.id === s.activeSheetId);
      if (!sheet || !s.scriptUrl || !s.token) {
        return { ok: false, message: 'Not connected. Open Settings first.' };
      }
      if (!online) {
        return {
          ok: false,
          message: 'Deleting needs a connection. Try again once you are back online.',
        };
      }
      if (!targets.length) return { ok: true };

      setRemoving(true);
      try {
        const res = await api.remove(s.scriptUrl, s.token, sheet.url, targets);
        const prev = snapshots[sheet.id];

        // Either way the script hands back a fresh read, so take it — after an
        // abort it is exactly what the user needs to see to understand why.
        if (prev && res.entries) {
          await applySnapshot(sheet.id, {
            ...prev,
            ...(res.aborted
              ? {}
              : {
                  buckets: res.buckets ?? prev.buckets,
                  summary: res.summary ?? prev.summary,
                  entryTab: res.entryTab ?? prev.entryTab,
                }),
            entries: res.entries,
            fetchedAt: new Date().toISOString(),
          });
        } else if (!prev) {
          await refresh();
        }

        if (res.aborted) {
          const n = res.skipped.length;
          const one = res.skipped[0];
          return {
            ok: false,
            message:
              n === 1 && one?.reason === 'mismatch'
                ? `Row ${one.row} now reads "${one.found?.category} ${one.found?.cost}" — it changed in the sheet since your last refresh, so nothing was deleted. The list has been refreshed; check it and try again.`
                : `${n} of the selected rows changed in the sheet since your last refresh, so nothing was deleted. The list has been refreshed; check it and try again.`,
          };
        }
        return { ok: true };
      } catch (e: any) {
        return {
          ok: false,
          message: e instanceof ApiError ? e.message : String(e?.message || e),
        };
      } finally {
        setRemoving(false);
      }
    },
    [applySnapshot, online, refresh, snapshots]
  );

  const discardPending = useCallback(async (clientId: string) => {
    setQueue((cur) => {
      const next = cur.filter((i) => i.clientId !== clientId);
      void store.saveQueue(next);
      return next;
    });
  }, []);

  /* -------------------------- favorites ------------------------- */

  const addFavorite = useCallback(async (f: Omit<Favorite, 'id'>) => {
    setFavorites((cur) => {
      const next = [...cur, { ...f, id: uid() }];
      void store.saveFavorites(next);
      return next;
    });
  }, []);

  const removeFavorite = useCallback(async (id: string) => {
    setFavorites((cur) => {
      const next = cur.filter((f) => f.id !== id);
      void store.saveFavorites(next);
      return next;
    });
  }, []);

  const value: Ctx = {
    ready,
    online,
    settings,
    activeSheet,
    snapshot,
    queue,
    pendingHere,
    favorites,
    refreshing,
    syncing,
    removing,
    error,
    configured,
    canRemove,
    saveSettings,
    addSheet,
    updateSheet,
    removeSheet,
    setActiveSheet,
    refresh,
    addEntry,
    flush,
    discardPending,
    removeEntries,
    addFavorite,
    removeFavorite,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
