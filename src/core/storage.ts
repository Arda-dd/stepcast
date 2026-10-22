import type { Demo } from './types';

/**
 * Demos and screenshots live in IndexedDB in the browser (or in the extension), so nothing is uploaded anywhere.
 * Works in pages and in the extension's service worker.
 */
const DB_NAME = 'stepcast';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('demos')) db.createObjectStore('demos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run<T>(store: 'demos' | 'images', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const saveDemo = (demo: Demo) => run('demos', 'readwrite', (s) => s.put(demo)).then(() => demo);
export const getDemo = (id: string) => run<Demo | undefined>('demos', 'readonly', (s) => s.get(id));
export const deleteDemoRecord = (id: string) => run('demos', 'readwrite', (s) => s.delete(id));

export async function listDemos(): Promise<Demo[]> {
  const demos = await run<Demo[]>('demos', 'readonly', (s) => s.getAll());
  return demos.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const saveImage = (id: string, blob: Blob) => run('images', 'readwrite', (s) => s.put(blob, id)).then(() => id);
export const getImage = (id: string) => run<Blob | undefined>('images', 'readonly', (s) => s.get(id));
export const deleteImage = (id: string) => run('images', 'readwrite', (s) => s.delete(id));

/** Deletes a demo and all of its screenshots. */
export async function deleteDemo(demo: Demo): Promise<void> {
  await Promise.all(demo.steps.map((s) => deleteImage(s.imageId)));
  await deleteDemoRecord(demo.id);
}
