// Utilidades de interfaz y formato de fechas.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
}

const pad = (n) => String(n).padStart(2, '0');

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function partes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function fmtFecha(iso) {
  if (!iso) return '';
  const { y, m, d, w } = partes(iso);
  return `${DIAS[w].slice(0, 3)} ${d} ${MESES[m - 1].slice(0, 3)} ${y}`;
}

export function fmtFechaLarga(iso) {
  if (!iso) return '';
  const { y, m, d, w } = partes(iso);
  return `${DIAS[w]} ${d} de ${MESES[m - 1]} de ${y}`;
}

export function fmtCorta(iso) {
  if (!iso) return '';
  const { y, m, d } = partes(iso);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export function fmtMomento(isoTs) {
  if (!isoTs) return '';
  const d = new Date(isoTs);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// --- Avisos breves ---------------------------------------------------------
let toastTimer;
export function toast(msg, { actionLabel, onAction, timeout = 3800 } = {}) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
  if (actionLabel) el.querySelector('button').onclick = () => { el.classList.remove('show'); onAction?.(); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), timeout);
}

// --- Ventanas modales ------------------------------------------------------
export function openModal(inner, { onClose, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${inner}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.remove();
    if (!$('.modal-backdrop')) document.body.classList.remove('modal-open');
    onClose?.();
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  wrap._close = close;
  return { el: wrap.firstElementChild, close };
}

export const closeAllModals = () => $$('.modal-backdrop').forEach((m) => m._close?.());

export function confirmDialog(msg, { ok = 'Aceptar', danger = false, detail = '' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal(
      `<div class="modal-body"><h2 class="modal-title">${esc(msg)}</h2>${detail ? `<p class="muted">${esc(detail)}</p>` : ''}
       <div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button>
       <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div></div>`,
      { onClose: () => { if (!answered) resolve(false); } },
    );
    m.el.querySelector('[data-ok]').onclick = () => { answered = true; resolve(true); m.close(); };
  });
}

export function promptPin(title, detail = '') {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal(
      `<form class="modal-body" novalidate><h2 class="modal-title">${esc(title)}</h2>${detail ? `<p class="muted">${esc(detail)}</p>` : ''}
       <input type="password" inputmode="numeric" class="pin-input" autocomplete="off" aria-label="Código de acceso" required>
       <div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button>
       <button type="submit" class="btn primary">Continuar</button></div></form>`,
      { onClose: () => { if (!answered) resolve(null); } },
    );
    const form = m.el.querySelector('form');
    const input = form.querySelector('input');
    input.focus();
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!input.value) return;
      answered = true;
      resolve(input.value);
      m.close();
    };
  });
}

// --- Formularios -----------------------------------------------------------
const optPair = (o) => (Array.isArray(o) ? o : [o, o]);

export function fieldHTML(f, v) {
  const id = `f_${f.name}`;
  const val = v ?? f.default ?? '';
  const hint = f.hint ? `<p class="hint">${esc(f.hint)}</p>` : '';
  if (f.type === 'checkbox') {
    return `<div class="field"><label class="check"><input type="checkbox" id="${id}" name="${f.name}"${val ? ' checked' : ''}><span>${esc(f.label)}</span></label>${hint}</div>`;
  }
  if (f.type === 'segmented') {
    const opts = f.options.map((o) => {
      const [ov, ol] = optPair(o);
      return `<label><input type="radio" name="${f.name}" value="${esc(ov)}"${String(ov) === String(val) ? ' checked' : ''}><span>${esc(ol)}</span></label>`;
    }).join('');
    return `<div class="field"><span class="label">${esc(f.label)}</span><div class="segmented">${opts}</div>${hint}</div>`;
  }
  const req = f.required ? ' required' : '';
  let input;
  if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"${req} placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  } else if (f.type === 'select') {
    input = `<select id="${id}" name="${f.name}"${req}>${f.options.map((o) => {
      const [ov, ol] = optPair(o);
      return `<option value="${esc(ov)}"${String(ov) === String(val) ? ' selected' : ''}>${esc(ol)}</option>`;
    }).join('')}</select>`;
  } else {
    const attrs = [
      f.min != null ? ` min="${f.min}"` : '',
      f.max != null ? ` max="${f.max}"` : '',
      f.inputmode ? ` inputmode="${f.inputmode}"` : '',
      f.list ? ` list="${f.list}"` : '',
    ].join('');
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}"${req}${attrs} placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${input}${hint}</div>`;
}

export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    if (!f.name) continue;
    if (f.type === 'segmented') { out[f.name] = form.querySelector(`input[name="${f.name}"]:checked`)?.value ?? ''; continue; }
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === 'checkbox') out[f.name] = el.checked;
    else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
    else out[f.name] = el.value.trim();
  }
  return out;
}

export function openForm({ title, fields, values = {}, submitLabel = 'Guardar', onSubmit, onDelete, preview, extra = '' }) {
  const body = fields.map((f) => (f.html != null ? f.html : fieldHTML(f, values[f.name]))).join('');
  const m = openModal(`<form class="form" novalidate>
    <div class="modal-head"><button type="button" class="btn ghost" data-close>Cancelar</button>
    <h2 class="modal-title">${esc(title)}</h2><button type="submit" class="btn primary">${esc(submitLabel)}</button></div>
    <div class="modal-body">${body}${preview ? '<div class="preview" data-preview aria-live="polite"></div>' : ''}${extra}
    ${onDelete ? '<button type="button" class="btn danger block" data-delete>Eliminar</button>' : ''}</div></form>`);
  const form = m.el.querySelector('form');
  const update = () => { if (preview) form.querySelector('[data-preview]').innerHTML = preview(readForm(form, fields)); };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const data = readForm(form, fields);
    const missing = fields.find((f) => f.required && (data[f.name] === '' || data[f.name] == null));
    if (missing) {
      toast(`Falta: ${missing.label}`);
      form.elements[missing.name]?.focus?.();
      return;
    }
    busy = true;
    try {
      if ((await onSubmit(data)) !== false) m.close();
    } catch (err) {
      console.error(err);
      toast(`No se pudo guardar: ${err.message}`);
    } finally {
      busy = false;
    }
  });
  if (onDelete) form.querySelector('[data-delete]').onclick = async () => { if (await onDelete()) m.close(); };
  return { ...m, form };
}

// --- Archivos --------------------------------------------------------------
// Llamar directamente desde un toque: iOS exige que la hoja de compartir nazca de un gesto.
export async function shareOrDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return 'share';
    }
  } catch (e) {
    if (e.name === 'AbortError') return 'cancel';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'download';
}
