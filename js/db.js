// IndexedDB. Solo recibe registros ya cifrados: { id, col, iv, ct }.
const DB_NAME = 'despacho';
const VERSION = 1;
let dbp;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
        if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out;
    Promise.resolve(fn(t)).then((v) => { out = v; }, reject);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transacción cancelada'));
  });
}

export const getMeta = (k) => tx('meta', 'readonly', (t) => req(t.objectStore('meta').get(k)));
export const setMeta = (obj) => tx('meta', 'readwrite', (t) => { t.objectStore('meta').put(obj); });
export const getAllData = () => tx('data', 'readonly', (t) => req(t.objectStore('data').getAll()));

export const putData = (rows) => tx('data', 'readwrite', (t) => {
  const s = t.objectStore('data');
  rows.forEach((r) => s.put(r));
});

export const deleteData = (ids) => tx('data', 'readwrite', (t) => {
  const s = t.objectStore('data');
  ids.forEach((id) => s.delete(id));
});

// Sustituye todos los datos (y opcionalmente la metadata de la clave) en una sola transacción.
export const replaceAll = (rows, kdf) => tx(['data', 'meta'], 'readwrite', (t) => {
  const s = t.objectStore('data');
  s.clear();
  rows.forEach((r) => s.put(r));
  if (kdf) t.objectStore('meta').put(kdf);
});

export const wipe = () => tx(['data', 'meta'], 'readwrite', (t) => {
  t.objectStore('data').clear();
  t.objectStore('meta').clear();
});
