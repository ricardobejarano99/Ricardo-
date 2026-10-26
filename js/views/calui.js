// Botones "Agregar a Google Calendar" / "Descargar .ics" y la lista de pendientes de envío.
import * as store from '../store.js';
import { state } from '../store.js';
import { esc, toast, fmtMomento, fmtFecha, shareOrDownload } from '../util.js';
import { eventoAudiencia, eventosPlazo, googleUrl, ics, eventHash } from '../calendar.js';
import { expById, calendario, infoPlazo, section } from './common.js';
import { register } from '../actions.js';
import { icon } from '../icons.js';

const VARIANTES = {
  audiencia: 'Audiencia',
  venc: 'Vencimiento',
  aviso: 'Aviso del día hábil anterior',
  rec2: 'Recordatorio 2 días hábiles antes',
};

function eventos(kind, id) {
  const s = state.settings;
  if (kind === 'audiencia') {
    const a = store.get('audiencias', id);
    if (!a) return null;
    return { rec: a, col: 'audiencias', evs: { audiencia: eventoAudiencia(a, expById(a.expedienteId), s) } };
  }
  const p = store.get('plazos', id);
  if (!p) return null;
  const { calc } = infoPlazo(p);
  if (!calc) return null;
  return { rec: p, col: 'plazos', evs: eventosPlazo(p, expById(p.expedienteId), s, calendario(), calc) };
}

const icsVariant = (kind) => (kind === 'audiencia' ? 'audiencia' : 'venc');

async function marcarEnviado(r, variant, ev, via) {
  const calEnviado = { ...(r.rec.calEnviado || {}), [`${variant}:${via}`]: { at: new Date().toISOString(), hash: eventHash(ev) } };
  await store.save(r.col, { ...r.rec, calEnviado });
}

function estadoEnvio(kind, r) {
  const sent = r.rec.calEnviado || {};
  const lines = [];
  for (const [k, v] of Object.entries(sent)) {
    const [variant, via] = k.split(':');
    const ev = r.evs[variant];
    if (!ev) continue;
    const cambiado = eventHash(ev) !== v.hash;
    const nombre = kind === 'audiencia' ? '' : `${VARIANTES[variant]} · `;
    lines.push(cambiado
      ? `<li class="warn">${icon('alert')}<span>${esc(nombre)}Modificado desde el último envío (${via === 'ics' ? '.ics' : 'Google'}, ${esc(fmtMomento(v.at))}). Vuelve a enviarlo.</span></li>`
      : `<li>${esc(nombre)}Enviado por ${via === 'ics' ? 'archivo .ics' : 'Google Calendar'} el ${esc(fmtMomento(v.at))}</li>`);
  }
  const pend = state.pendientes.filter((p) => p.refId === r.rec.id);
  if (pend.length) lines.push(`<li class="warn">${icon('alert')}<span>${pend.length} pendiente(s) de enviar a Google Calendar.</span></li>`);
  return lines.length ? `<ul class="cal-status">${lines.join('')}</ul>` : '';
}

export function calButtons(kind, id) {
  const r = eventos(kind, id);
  if (!r) return '';
  const g = (variant, label) => `<button type="button" class="btn" data-action="cal-google" data-kind="${kind}" data-id="${esc(id)}" data-variant="${variant}">${icon('external')}<span>${esc(label)}</span></button>`;
  const google = kind === 'audiencia'
    ? g('audiencia', 'Agregar a Google Calendar')
    : [g('venc', 'Google: vencimiento'), g('aviso', 'Google: aviso día anterior'), r.evs.rec2 ? g('rec2', 'Google: recordatorio 2 días') : ''].join('');
  const nota = kind === 'audiencia'
    ? 'El archivo .ics incluye las alertas configuradas. Google Calendar usará tus notificaciones predeterminadas.'
    : 'El .ics trae el aviso del día hábil anterior como alerta del evento. En Google, el aviso es un evento aparte: agrégalo con su botón.';
  return `<div class="cal-box">
    <div class="cal-head"><h3>Calendario</h3><span class="tag ${state.settings.modoDiscreto ? 'ok' : 'warn'}">${state.settings.modoDiscreto ? 'Modo discreto' : 'Incluye datos del cliente'}</span></div>
    <div class="btn-row">${google}<button type="button" class="btn" data-action="cal-ics" data-kind="${kind}" data-id="${esc(id)}">${icon('download')}<span>Descargar .ics</span></button></div>
    <p class="hint">${esc(nota)}</p>${estadoEnvio(kind, r)}</div>`;
}

function agregarPendiente(kind, refId, variant) {
  if (state.pendientes.some((p) => p.kind === kind && p.refId === refId && p.variant === variant)) return Promise.resolve();
  return store.save('pendientes', { kind, refId, variant });
}

function enviarGoogle(kind, id, variant) {
  const r = eventos(kind, id);
  const ev = r?.evs[variant];
  if (!ev) { toast('No se pudo generar el evento.'); return false; }
  if (!navigator.onLine) return null;
  // Abrir en el mismo toque: Safari bloquea ventanas que no nacen de un gesto.
  window.open(googleUrl(ev), '_blank', 'noopener');
  marcarEnviado(r, variant, ev, 'google');
  return true;
}

async function descargarIcs(kind, id) {
  const r = eventos(kind, id);
  if (!r) { toast('No se pudo generar el evento.'); return; }
  const variant = icsVariant(kind);
  const ev = r.evs[variant];
  const exp = expById(r.rec.expedienteId);
  const nombre = `${kind === 'audiencia' ? 'audiencia' : 'plazo'}-${(exp?.numero || 'despacho').replace(/[^\w-]+/g, '-')}-${ev.fecha}.ics`;
  const res = await shareOrDownload(nombre, ics([ev]), 'text/calendar');
  if (res === 'cancel') return;
  await marcarEnviado(r, variant, ev, 'ics');
  if (res === 'download') toast('Archivo .ics descargado. Ábrelo para añadirlo a Calendario.');
}

register({
  'cal-google': async (el) => {
    const { kind, id, variant } = el.dataset;
    const res = enviarGoogle(kind, id, variant);
    if (res === null) {
      await agregarPendiente(kind, id, variant);
      toast('Sin conexión. El evento quedó en "Pendientes de enviar al calendario".', { timeout: 5000 });
    }
  },
  'cal-ics': (el) => descargarIcs(el.dataset.kind, el.dataset.id),
  'pend-enviar': async (el) => {
    const p = store.get('pendientes', el.dataset.id);
    if (!p) return;
    const res = enviarGoogle(p.kind, p.refId, p.variant);
    if (res === null) { toast('Sigues sin conexión.'); return; }
    await store.remove('pendientes', p.id);
  },
  'pend-ics': async (el) => {
    const p = store.get('pendientes', el.dataset.id);
    if (p) await descargarIcs(p.kind, p.refId);
  },
  'pend-quitar': async (el) => store.remove('pendientes', el.dataset.id),
});

export function pendientesCard() {
  const items = state.pendientes.map((p) => {
    const r = eventos(p.kind, p.refId);
    const ev = r?.evs[p.variant];
    if (!ev) {
      return `<div class="row"><span class="row-main"><span class="row-title">Evento no disponible</span><span class="row-sub">El registro se eliminó o le faltan datos.</span></span>
        <span class="row-actions"><button type="button" class="btn small" data-action="pend-quitar" data-id="${esc(p.id)}">Quitar</button></span></div>`;
    }
    return `<div class="row"><span class="row-main"><span class="row-title">${esc(ev.title)}</span><span class="row-sub">${esc(VARIANTES[p.variant])} · ${esc(fmtFecha(ev.fecha))}${ev.hora && !ev.allDay ? ` ${esc(ev.hora)}` : ''}</span></span>
      <span class="row-actions"><button type="button" class="btn small primary" data-action="pend-enviar" data-id="${esc(p.id)}">Enviar</button>
      <button type="button" class="btn small" data-action="pend-ics" data-id="${esc(p.id)}" aria-label="Descargar .ics">.ics</button>
      <button type="button" class="btn small ghost" data-action="pend-quitar" data-id="${esc(p.id)}" aria-label="Quitar">${icon('trash')}</button></span></div>`;
  });
  const aviso = navigator.onLine ? '' : '<p class="hint">Sin conexión: podrás enviarlos cuando vuelvas a tener internet. El .ics funciona sin conexión.</p>';
  return section(`Pendientes de enviar al calendario (${items.length})`, `${aviso}<div class="list">${items.join('')}</div>`);
}
