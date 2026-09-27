/**
 * Browser persistence adapter. One current save plus rotating backups in an
 * IndexedDB transaction, with localStorage and memory fallbacks. Desktop and
 * mobile adapters will implement the same interface with temp-and-rename.
 */
export interface SaveStore {
  readonly kind: string;
  get(key: string): Promise<string | null>;
  put(entries: Record<string, string>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export const CURRENT = 'current';
export const PRE_RESET = 'pre-reset';
export const backupKey = (i: number) => `backup-${i}`;

class IdbStore implements SaveStore {
  readonly kind = 'IndexedDB';
  private constructor(private db: IDBDatabase) {}

  static open(): Promise<IdbStore> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('sisyphus-unchained', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => resolve(new IdbStore(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  get(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const req = this.db.transaction('saves', 'readonly').objectStore('saves').get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  }

  put(entries: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('saves', 'readwrite');
      const store = tx.objectStore('saves');
      for (const [k, v] of Object.entries(entries)) store.put(v, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  remove(keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('saves', 'readwrite');
      for (const k of keys) tx.objectStore('saves').delete(k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

class LocalStore implements SaveStore {
  readonly kind = 'localStorage';
  private prefix = 'sisyphus-unchained:';
  async get(key: string) {
    return localStorage.getItem(this.prefix + key);
  }
  async put(entries: Record<string, string>) {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(this.prefix + k, v);
  }
  async remove(keys: string[]) {
    for (const k of keys) localStorage.removeItem(this.prefix + k);
  }
}

class MemoryStore implements SaveStore {
  readonly kind = 'memory (progress will not persist)';
  private map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async put(entries: Record<string, string>) {
    for (const [k, v] of Object.entries(entries)) this.map.set(k, v);
  }
  async remove(keys: string[]) {
    for (const k of keys) this.map.delete(k);
  }
}

export async function openSaveStore(): Promise<SaveStore> {
  try {
    if (typeof indexedDB !== 'undefined') return await IdbStore.open();
  } catch {
    /* fall through */
  }
  try {
    localStorage.setItem('sisyphus-unchained:probe', '1');
    localStorage.removeItem('sisyphus-unchained:probe');
    return new LocalStore();
  } catch {
    return new MemoryStore();
  }
}
