// Town storage in this browser: every town you build is kept in IndexedDB
// (room for many large towns), saved automatically as you edit. Each record:
// { id, name, updated (ms), data (the city file) }. The last opened town's id
// is remembered so the app reopens it. If the browser blocks storage, towns
// live in memory for this visit only (save them as files).

const DB = 'tiny-city-builder';
const STORE = 'towns';
const LAST = 'tcb.lastTown';
const memory = new Map();
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return db().then((d) => new Promise((resolve) => {
    if (!d) return resolve(fn(null));
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => resolve(undefined);
  }));
}

/** Is storage working (false = towns last only until the page closes)? */
export const storageWorks = () => db().then(Boolean);

export const newId = () => `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** All towns, newest first, without their (large) data. */
export async function listTowns() {
  const all = (await run('readonly', (s) => (s ? s.getAll() : null))) ?? [...memory.values()];
  return all.map(({ id, name, updated, data }) => ({ id, name, updated, blocks: data?.blocks?.length ?? 0 }))
    .sort((a, b) => b.updated - a.updated);
}

export async function getTown(id) {
  return (await run('readonly', (s) => (s ? s.get(id) : null))) ?? memory.get(id) ?? null;
}

/** Save (create or replace) a town; returns the record. */
export async function putTown({ id = newId(), name, data }) {
  const rec = { id, name: name || data?.meta?.name || 'Untitled town', updated: Date.now(), data };
  rec.data = { ...data, meta: { ...(data.meta ?? {}), name: rec.name } };
  memory.set(id, rec);
  await run('readwrite', (s) => s?.put(rec));
  return rec;
}

export async function deleteTown(id) {
  memory.delete(id);
  await run('readwrite', (s) => s?.delete(id));
}

export const lastTownId = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
export const setLastTownId = (id) => { try { localStorage.setItem(LAST, id); } catch { /* ignore */ } };
