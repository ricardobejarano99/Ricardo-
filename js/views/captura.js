// Captura rápida en lenguaje natural: texto o dictado -> vista previa editable -> guardar.
import * as store from '../store.js';
import { state } from '../store.js';
import { openModal, esc, toast, fieldHTML, $ } from '../util.js';
import { interpretar, faltantes, claveCausa, hoyMX } from '../interprete.js';
import { TIPOS_AUD, PRIORIDADES } from '../catalogos.js';
import { calendario } from './common.js';
import { register, registerInput } from '../actions.js';
import { icon } from '../icons.js';

const EJEMPLO = 'audiencia intermedia causa 375/2025 el 5 de noviembre a las 10';
let borrador = '';

export function campoInicio() {
  return `<form class="quick card" data-quick novalidate>
    <label for="quick-input" class="quick-label">${icon('plus')}<span>Captura rápida</span></label>
    <div class="quick-row">
      <input id="quick-input" type="text" lang="es-MX" autocomplete="off" autocapitalize="sentences" enterkeyhint="go"
        data-oninput="quick-borrador" value="${esc(borrador)}" placeholder="Escribe o dicta un pendiente" aria-label="Captura rápida">
      <button class="btn primary" type="submit">Interpretar</button>
    </div>
    <p class="hint">Ej. «${esc(EJEMPLO)}». Toca el micrófono del teclado para dictar; antes de guardar verás lo que entendí.</p></form>`;
}

const TIPOS = [['audiencia', 'Audiencia'], ['plazo', 'Plazo'], ['tarea', 'Tarea'], ['nota', 'Nota']];

function expOptions(none) {
  const opts = state.expedientes.slice()
    .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }))
    .map((e) => [e.id, `${e.numero} — ${e.tipo}`]);
  return [['', none], ...opts];
}

function campos(v) {
  const exp = { name: 'expedienteId', label: 'Expediente', type: 'select', options: expOptions(v.tipo === 'nota' ? '— Bandeja de entrada —' : '— Sin expediente —') };
  const defs = {
    audiencia: [
      { name: 'tipoAudiencia', label: 'Tipo de audiencia', type: 'select', options: TIPOS_AUD },
      { name: 'fecha', label: 'Fecha', type: 'date' },
      { name: 'hora', label: 'Hora', type: 'time' },
      { name: 'sede', label: 'Sede', placeholder: 'Opcional' },
      exp,
    ],
    plazo: [
      { name: 'titulo', label: 'Actuación', hint: 'En modo discreto aparece en el calendario: no incluyas nombres.' },
      { name: 'fecha', label: 'Fecha de vencimiento', type: 'date', hint: 'Se guarda como vencimiento conocido, sin cómputo. Si tienes la notificación, edítalo después para calcularlo.' },
      exp,
    ],
    tarea: [
      { name: 'titulo', label: 'Tarea' },
      { name: 'fecha', label: 'Fecha límite', type: 'date' },
      { name: 'hora', label: 'Hora (opcional)', type: 'time' },
      { name: 'prioridad', label: 'Prioridad', type: 'select', options: PRIORIDADES },
      exp,
    ],
    nota: [{ name: 'notaTexto', label: 'Nota', type: 'textarea', rows: 4 }, exp],
  };
  const lista = defs[v.tipo];
  let html = lista.map((f) => fieldHTML(f, v[f.name])).join('');
  const existe = v.causa && state.expedientes.some((e) => claveCausa(e.numero) === v.causa);
  if (v.causa && !existe && !v.expedienteId && v.tipo !== 'nota') {
    html += fieldHTML({ name: 'crearExp', label: `Crear el expediente ${v.causa} y vincularlo`, type: 'checkbox' }, v.crearExp);
  }
  return html;
}

function avisosHTML(v) {
  const lista = [...v.avisos, ...faltantes(v).map((f) => f.msg)];
  if (v.tipo === 'plazo' && v.fecha && !calendario().esHabil(v.fecha)) {
    lista.push(`La fecha de vencimiento cae en día inhábil (${calendario().motivo(v.fecha)}). Revísala.`);
  }
  if (!lista.length) return `<div class="cap-ok">${icon('check')}<span>Entendí todo. Revisa y guarda.</span></div>`;
  return `<div class="banner warn small">${icon('alert')}<ul class="cap-avisos">${lista.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
}

function leer(body, v) {
  body.querySelectorAll('[data-campos] [name]').forEach((el) => {
    v[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
}

function marcarFaltantes(body, v) {
  const falta = new Set(faltantes(v).filter((f) => f.requerido).map((f) => f.campo));
  body.querySelectorAll('[data-campos] .field').forEach((w) => w.classList.toggle('missing', falta.has(w.dataset.name)));
}

async function guardar(v) {
  const req = faltantes(v).filter((f) => f.requerido);
  if (v.tipo === 'nota' && !v.notaTexto) req.push({ campo: 'notaTexto', msg: 'Escribe la nota.' });
  if (req.length) {
    toast(req[0].msg);
    return false;
  }
  let { expedienteId } = v;
  if (!expedienteId && v.crearExp && v.causa) {
    const e = await store.save('expedientes', {
      numero: v.causa, tipo: 'Causa penal', organo: '', cliente: '', contraparte: '', etapa: '', estatus: 'Activo', notas: 'Creado desde la captura rápida.',
    });
    expedienteId = e.id;
  }
  const origen = `Captura rápida: «${v.texto}»`;
  let col, rec, ruta, msg;
  if (v.tipo === 'audiencia') {
    col = 'audiencias';
    rec = { tipo: v.tipoAudiencia || 'Otra', fecha: v.fecha, hora: v.hora, duracion: state.settings.duracionAudiencia, sede: v.sede, expedienteId, notas: origen };
    ruta = (id) => `#/audiencia/${id}`;
    msg = 'Audiencia guardada';
  } else if (v.tipo === 'plazo') {
    col = 'plazos';
    rec = {
      actuacion: v.titulo, vencimientoFijo: v.fecha, notificacion: null, dias: null, tipoDias: 'habiles', surte: 'siguiente',
      recorrer: true, recordatorio2: false, estatus: 'pendiente', expedienteId, notas: origen,
    };
    ruta = (id) => `#/plazo/${id}`;
    msg = 'Plazo guardado';
  } else if (v.tipo === 'tarea') {
    col = 'tareas';
    rec = { titulo: v.titulo, fechaLimite: v.fecha || null, hora: v.hora || '', prioridad: v.prioridad || 'media', completada: false, expedienteId, notas: '' };
    ruta = () => '#/tareas';
    msg = 'Tarea guardada';
  } else {
    col = 'notas';
    rec = { texto: v.notaTexto, expedienteId: expedienteId || null };
    ruta = () => (expedienteId ? `#/expediente/${expedienteId}` : '#/inicio');
    msg = expedienteId ? 'Nota guardada en el expediente' : 'Nota guardada en la bandeja';
  }
  borrador = '';
  const saved = await store.save(col, rec);
  toast(msg, { actionLabel: 'Ver', onAction: () => { location.hash = ruta(saved.id); } });
  return true;
}

export function abrirCaptura(texto = '') {
  const m = openModal(`<form class="form" novalidate>
    <div class="modal-head"><button type="button" class="btn ghost" data-close>Cancelar</button>
    <h2 class="modal-title">Captura rápida</h2><button type="submit" class="btn primary" data-submit>Interpretar</button></div>
    <div class="modal-body" data-body></div></form>`);
  const form = m.el.querySelector('form');
  const body = form.querySelector('[data-body]');
  const btn = form.querySelector('[data-submit]');
  let v = null;

  function paso1(t) {
    v = null;
    btn.textContent = 'Interpretar';
    body.innerHTML = `<div class="field"><label for="cap-texto">¿Qué hay que anotar?</label>
      <textarea id="cap-texto" rows="4" lang="es-MX" autocapitalize="sentences" placeholder="Ej. ${esc(EJEMPLO)}">${esc(t)}</textarea>
      <p class="hint">Escribe o dicta con el micrófono del teclado. Ejemplos: «vence plazo para amparo causa 150/2026 el viernes», «llamar a cliente mañana», «revisar carpeta de investigación pasado mañana 4 pm».</p></div>`;
    const ta = body.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function pintar() {
    body.innerHTML = `<div class="cap-dijiste"><span class="label">Escribiste</span>
        <blockquote class="quote">${esc(v.texto)}</blockquote>
        <button type="button" class="btn small ghost" data-cap="editar">${icon('edit')}<span>Editar texto</span></button></div>
      <div class="field"><span class="label">Tipo</span><div class="segmented">${TIPOS.map(([k, l]) =>
        `<label><input type="radio" name="cap-tipo" value="${k}"${v.tipo === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <div data-avisos>${avisosHTML(v)}</div>
      <div data-campos>${campos(v)}</div>`;
    marcarFaltantes(body, v);
  }

  function paso2(t) {
    const r = interpretar(t, { hoy: hoyMX(), expedientes: state.expedientes });
    v = { ...r, notaTexto: t.trim(), crearExp: false };
    btn.textContent = 'Guardar';
    pintar();
  }

  body.addEventListener('click', (e) => {
    if (e.target.closest('[data-cap="editar"]')) paso1(v.texto);
  });
  body.addEventListener('change', (e) => {
    if (!v) return;
    if (e.target.name === 'cap-tipo') {
      leer(body, v);
      v.tipo = e.target.value;
      pintar();
      return;
    }
    leer(body, v);
    if (e.target.name === 'expedienteId') { body.querySelector('[data-campos]').innerHTML = campos(v); }
    body.querySelector('[data-avisos]').innerHTML = avisosHTML(v);
    marcarFaltantes(body, v);
  });
  body.addEventListener('input', () => {
    if (!v) return;
    leer(body, v);
    marcarFaltantes(body, v);
  });

  let ocupado = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ocupado) return;
    if (!v) {
      const t = body.querySelector('textarea').value.trim();
      if (!t) { toast('Escribe o dicta algo primero.'); return; }
      paso2(t);
      return;
    }
    leer(body, v);
    ocupado = true;
    try {
      if (await guardar(v)) m.close();
      else marcarFaltantes(body, v);
    } catch (err) {
      console.error(err);
      toast(`No se pudo guardar: ${err.message}`);
    } finally {
      ocupado = false;
    }
  });

  if (texto.trim()) paso2(texto); else paso1('');
  return m;
}

register({ captura: () => abrirCaptura() });
registerInput({ 'quick-borrador': (el) => { borrador = el.value; } });

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-quick]');
  if (!form) return;
  e.preventDefault();
  const input = $('#quick-input', form);
  if (!input.value.trim()) { input.focus(); return; }
  abrirCaptura(input.value);
});
