// Cifrado local: clave AES-GCM de 256 bits derivada del PIN con PBKDF2-SHA-256.
const enc = new TextEncoder();
const dec = new TextDecoder();

export const ITERATIONS = 310000;

export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export function b64(bytes) {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function unb64(str) {
  const s = atob(str);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export async function deriveKey(pin, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// aad liga cada texto cifrado a su registro: no se puede mover un registro cifrado a otro lugar.
export async function encryptJSON(key, value, aad) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(value)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptJSON(key, { iv, ct }, aad) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc.encode(aad) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt));
}
