import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_SETTINGS, Favorite, Pending, Settings, Snapshot } from './types';

const K = {
  settings: 'masareef.settings.v1',
  queue: 'masareef.queue.v1',
  favorites: 'masareef.favorites.v1',
  snapshot: (sheetId: string) => `masareef.snapshot.v1.${sheetId}`,
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — the in-memory state still works */
  }
}

export const store = {
  loadSettings: () => readJson<Settings>(K.settings, EMPTY_SETTINGS),
  saveSettings: (s: Settings) => writeJson(K.settings, s),

  loadQueue: () => readJson<Pending[]>(K.queue, []),
  saveQueue: (q: Pending[]) => writeJson(K.queue, q),

  loadFavorites: () => readJson<Favorite[]>(K.favorites, []),
  saveFavorites: (f: Favorite[]) => writeJson(K.favorites, f),

  loadSnapshot: (sheetId: string) =>
    readJson<Snapshot | null>(K.snapshot(sheetId), null),
  saveSnapshot: (sheetId: string, snap: Snapshot) =>
    writeJson(K.snapshot(sheetId), snap),
};
