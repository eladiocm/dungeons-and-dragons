import type { PublicSession } from '../game/session-types';

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('valdumbria-v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('cache');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function cached<T>(key: string): Promise<T | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('cache').objectStore('cache').get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function cacheValue(key: string, value: unknown): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite'),
        store = tx.objectStore('cache');
      store.put(value, key);
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        if (keys.result.length > 24)
          for (const old of keys.result.slice(0, keys.result.length - 24))
            if (old !== key) store.delete(old);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export const cacheProjection = (session: PublicSession) =>
  cacheValue('last-session', { ...session, events: session.events.slice(-40) });
