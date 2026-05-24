import type { HistoryEntry } from '../types';

const DB_NAME = 'provvigioni_auto';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const HISTORY_KEY = 'history';
const LOCAL_STORAGE_HISTORY_KEY = 'app_history';

interface StoredValue<T> {
  key: string;
  value: T;
}

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readValue<T>(key: string): Promise<T | null> {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as StoredValue<T> | undefined;
      resolve(result?.value ?? null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    store.put({ key, value });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function readLocalStorageHistory(): HistoryEntry[] {
  const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const indexedHistory = await readValue<HistoryEntry[]>(HISTORY_KEY);
    if (indexedHistory) {
      return indexedHistory;
    }

    const localHistory = readLocalStorageHistory();
    if (localHistory.length > 0 && isIndexedDBAvailable()) {
      await writeValue(HISTORY_KEY, localHistory);
      localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    }

    return localHistory;
  } catch (error) {
    console.warn('IndexedDB history load failed, falling back to localStorage:', error);
    return readLocalStorageHistory();
  }
}

export async function saveHistory(history: HistoryEntry[]): Promise<void> {
  try {
    if (isIndexedDBAvailable()) {
      await writeValue(HISTORY_KEY, history);
      localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
      return;
    }
  } catch (error) {
    console.warn('IndexedDB history save failed, falling back to localStorage:', error);
  }

  localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
}
