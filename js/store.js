// Estado en memoria (descifrado solo mientras la app está desbloqueada) y persistencia cifrada.
import * as db from './db.js';
import * as cr from './crypto.js';
import { ART19_LA } from './plazos.js';
import { uid } from './util.js';

export const COLS = ['expedientes', 'audiencias', 'plazos', 'tareas', 'notas', 'pendientes'];

export const state = { settings: null };
COLS.forEach((c) => { state[c] = []; });

let key = null;
let salt = null;
let iterations = cr.ITERATIONS;

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

export function defaultSettings() {
  return {
    modoDiscreto: true,
    tema: 'auto',
    bloqueoMin: 1,
    semaforo: { ambar: 5, rojo: 1 },
    alertasAudiencia: [1440, 120],
    duracionAudiencia: 120,
    horaAviso: '09:00',
    ultimoRespaldo: null,
    inhabiles: { anuales: ART19_LA.map((a) => ({ ...a })), fechas: [], rangos: [] },
  };
}

function mergeDefaults(s) {
  const d = defaultSettings();
  if (!s) return d;
  return {
    ...d,
    ...s,
    semaforo: { ...d.semaforo, ...s.semaforo },
    inhabiles: { ...d.inhabiles, ...s.inhabiles },
  };
}

const aadOf = (col, id) => `${col}:${id}`;

async function encRow(k, col, obj) {
  return { id: obj.id, col, ...(await cr.encryptJSON(k, obj, aadOf(col, obj.id))) };
}

async function encryptAll(k) {
  const rows = [];
  for (const c of COLS) for (const o of state[c]) rows.push(await encRow(k, c, o));
  rows.push(await encRow(k, 'config', { ...state.settings, id: 'settings' }));
  return rows;
}

export const isSetup = async () => !!(await db.getMeta('kdf'));
export const isUnlocked = () => !!key;

export async function setup(pin) {
  salt = cr.randomBytes(16);
  iterations = cr.ITERATIONS;
  key = await cr.deriveKey(pin, salt, iterations);
  const verifier = await cr.encryptJSON(key, 'despacho-ok', 'verifier');
  COLS.forEach((c) => { state[c] = []; });
  state.settings = defaultSettings();
  await db.replaceAll(await encryptAll(key), { k: 'kdf', salt: cr.b64(salt), iterations, verifier });
}

export async function lockoutRemaining() {
  const a = await db.getMeta('intentos');
  return a?.hasta ? Math.max(0, a.hasta - Date.now()) : 0;
}

export async function unlock(pin) {
  const espera = await lockoutRemaining();
  if (espera > 0) return { ok: false, espera };
  const kdf = await db.getMeta('kdf');
  const s = cr.unb64(kdf.salt);
  const k = await cr.deriveKey(pin, s, kdf.iterations);
  try {
    if ((await cr.decryptJSON(k, kdf.verifier, 'verifier')) !== 'despacho-ok') throw new Error();
  } catch {
    const a = (await db.getMeta('intentos')) || { k: 'intentos', n: 0 };
    a.n += 1;
    a.hasta = a.n >= 5 ? Date.now() + Math.min(30000 * 2 ** (a.n - 5), 15 * 60000) : 0;
    await db.setMeta(a);
    return { ok: false, intentos: a.n, espera: a.hasta ? a.hasta - Date.now() : 0 };
  }
  await db.setMeta({ k: 'intentos', n: 0, hasta: 0 });
  await loadAll(k);
  key = k;
  salt = s;
  iterations = kdf.iterations;
  return { ok: true };
}

async function loadAll(k) {
  const rows = await db.getAllData();
  const fresh = {};
  COLS.forEach((c) => { fresh[c] = []; });
  let settings = null;
  for (const r of rows) {
    const obj = await cr.decryptJSON(k, r, aadOf(r.col, r.id));
    if (r.col === 'config') settings = obj;
    else if (fresh[r.col]) fresh[r.col].push(obj);
  }
  COLS.forEach((c) => { state[c] = fresh[c]; });
  state.settings = mergeDefaults(settings);
}

export function lock() {
  key = null;
  COLS.forEach((c) => { state[c] = []; });
  state.settings = null;
}

export const get = (col, id) => state[col].find((x) => x.id === id);

function stamp(obj) {
  const now = new Date().toISOString();
  if (!obj.id) obj.id = uid();
  if (!obj.createdAt) obj.createdAt = now;
  obj.updatedAt = now;
  return obj;
}

function upsertLocal(col, obj) {
  const arr = state[col];
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
}

export async function save(col, obj) {
  return (await saveMany(col, [obj]))[0];
}

export async function saveMany(col, objs) {
  const rows = [];
  for (const o of objs) rows.push(await encRow(key, col, stamp(o)));
  await db.putData(rows);
  objs.forEach((o) => upsertLocal(col, o));
  emit();
  return objs;
}

export async function saveSettings() {
  await db.putData([await encRow(key, 'config', { ...state.settings, id: 'settings' })]);
  emit();
}

// items: [[col, id], ...]
export async function removeMany(items) {
  if (!items.length) return;
  await db.deleteData(items.map(([, id]) => id));
  for (const [col, id] of items) state[col] = state[col].filter((x) => x.id !== id);
  emit();
}

export const remove = (col, id) => removeMany([[col, id]]);

// Lo vinculado a un expediente (audiencias, plazos, tareas, notas) y sus pendientes de calendario.
export function vinculados(expId) {
  const items = [];
  for (const c of ['audiencias', 'plazos', 'tareas', 'notas']) {
    for (const x of state[c]) if (x.expedienteId === expId) items.push([c, x.id]);
  }
  const ids = new Set(items.map(([, id]) => id));
  for (const p of state.pendientes) if (ids.has(p.refId)) items.push(['pendientes', p.id]);
  return items;
}

export const removeExpediente = (id) => removeMany([['expedientes', id], ...vinculados(id)]);

export function seedItems() {
  const items = [];
  for (const c of COLS) for (const x of state[c]) if (x.seed) items.push([c, x.id]);
  const ids = new Set(items.map(([, id]) => id));
  for (const p of state.pendientes) if (ids.has(p.refId) && !p.seed) items.push(['pendientes', p.id]);
  return items;
}

export async function changePin(oldPin, newPin) {
  const kdf = await db.getMeta('kdf');
  const k = await cr.deriveKey(oldPin, cr.unb64(kdf.salt), kdf.iterations);
  try { await cr.decryptJSON(k, kdf.verifier, 'verifier'); } catch { return false; }
  const ns = cr.randomBytes(16);
  const nk = await cr.deriveKey(newPin, ns, cr.ITERATIONS);
  const rows = await encryptAll(nk);
  const verifier = await cr.encryptJSON(nk, 'despacho-ok', 'verifier');
  await db.replaceAll(rows, { k: 'kdf', salt: cr.b64(ns), iterations: cr.ITERATIONS, verifier });
  key = nk;
  salt = ns;
  iterations = cr.ITERATIONS;
  return true;
}

// Respaldo: se cifra con la misma clave del dispositivo; el archivo lleva la sal para poder
// derivarla de nuevo con el PIN en otro iPhone o iPad.
export async function exportBackup() {
  const payload = { collections: Object.fromEntries(COLS.map((c) => [c, state[c]])), settings: state.settings };
  const enc = await cr.encryptJSON(key, payload, 'despacho-backup');
  return {
    format: 'despacho-respaldo',
    version: 1,
    creado: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: cr.b64(salt) },
    ...enc,
  };
}

export const isBackup = (o) => !!(o && o.format === 'despacho-respaldo' && o.kdf?.salt && o.kdf?.iterations && o.iv && o.ct);

export async function decryptBackup(obj, pin) {
  const k = await cr.deriveKey(pin, cr.unb64(obj.kdf.salt), obj.kdf.iterations);
  return cr.decryptJSON(k, obj, 'despacho-backup');
}

const keyInh = {
  anuales: (x) => x.md,
  fechas: (x) => x.fecha,
  rangos: (x) => `${x.desde}|${x.hasta}`,
};

// mode: 'combinar' conserva la versión más reciente de cada registro; 'reemplazar' sustituye todo.
export async function importPayload(payload, mode) {
  const incoming = payload.collections || {};
  let nuevos = 0, actualizados = 0;
  if (mode === 'reemplazar') {
    COLS.forEach((c) => { state[c] = (incoming[c] || []).filter((o) => o && o.id); nuevos += state[c].length; });
    const ult = [state.settings.ultimoRespaldo, payload.settings?.ultimoRespaldo].filter(Boolean).sort().pop() || null;
    state.settings = { ...mergeDefaults(payload.settings), ultimoRespaldo: ult };
    await db.replaceAll(await encryptAll(key));
  } else {
    const rows = [];
    for (const c of COLS) {
      for (const o of incoming[c] || []) {
        if (!o || !o.id) continue;
        const cur = state[c].find((x) => x.id === o.id);
        if (!cur) { nuevos++; } else if ((o.updatedAt || '') > (cur.updatedAt || '')) { actualizados++; } else continue;
        upsertLocal(c, o);
        rows.push(await encRow(key, c, o));
      }
    }
    const inh = state.settings.inhabiles;
    const otro = payload.settings?.inhabiles || {};
    for (const t of Object.keys(keyInh)) {
      const seen = new Set(inh[t].map(keyInh[t]));
      for (const x of otro[t] || []) if (!seen.has(keyInh[t](x))) { inh[t].push(x); seen.add(keyInh[t](x)); }
    }
    rows.push(await encRow(key, 'config', { ...state.settings, id: 'settings' }));
    await db.putData(rows);
  }
  emit();
  return { nuevos, actualizados };
}

export const wipe = () => db.wipe();
