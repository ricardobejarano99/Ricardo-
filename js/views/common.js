// Piezas compartidas entre vistas: búsquedas en el estado y renglones de listas.
import { state } from '../store.js';
import { esc, fmtFecha, todayISO } from '../util.js';
import { makeCalendar, calcularPlazo, diasRestantes, semaforo } from '../plazos.js';
import { PRIORIDADES, PRIORIDAD_ORDEN } from '../catalogos.js';
import { icon } from '../icons.js';

export const expById = (id) => (id ? state.expedientes.find((e) => e.id === id) : null);

let calCache = { key: null, cal: null };
export function calendario() {
  const key = JSON.stringify(state.settings.inhabiles);
  if (calCache.key !== key) calCache = { key, cal: makeCalendar(state.settings.inhabiles) };
  return calCache.cal;
}

export function infoPlazo(p) {
  const calc = calcularPlazo(calendario(), {
    notificacion: p.notificacion, dias: Number(p.dias), tipo: p.tipoDias, surte: p.surte, recorrer: p.recorrer,
  });
  if (!calc) return { calc: null, rest: null, sem: 'gris' };
  const rest = diasRestantes(calendario(), todayISO(), calc.vencimiento, p.tipoDias);
  const sem = p.estatus === 'cumplido' ? 'gris' : semaforo(rest, state.settings.semaforo);
  return { calc, rest, sem };
}

export function restanteTexto(rest, tipo) {
  if (rest == null) return 'Datos incompletos';
  if (rest < 0) return `Vencido hace ${-rest} día${rest === -1 ? '' : 's'}`;
  if (rest === 0) return 'Vence hoy';
  const unidad = tipo === 'naturales' ? (rest === 1 ? 'natural' : 'naturales') : (rest === 1 ? 'hábil' : 'hábiles');
  return `${rest} día${rest === 1 ? '' : 's'} ${unidad} restante${rest === 1 ? '' : 's'}`;
}

export const SEM_LABEL = { verde: 'En tiempo', ambar: 'Próximo a vencer', rojo: 'Urgente', gris: 'Cumplido' };

export const byFechaHora = (a, b) => `${a.fecha} ${a.hora || ''}`.localeCompare(`${b.fecha} ${b.hora || ''}`);

export function byTarea(a, b) {
  if (!!a.completada !== !!b.completada) return a.completada ? 1 : -1;
  const pa = PRIORIDAD_ORDEN[a.prioridad] ?? 1;
  const pb = PRIORIDAD_ORDEN[b.prioridad] ?? 1;
  if (pa !== pb) return pa - pb;
  return (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999');
}

export const empty = (msg) => `<p class="empty">${esc(msg)}</p>`;

export function section(title, body, action = '') {
  return `<section class="card"><div class="card-head"><h2>${esc(title)}</h2>${action}</div>${body}</section>`;
}

export const addBtn = (actionName, label, data = '') =>
  `<button type="button" class="btn small" data-action="${actionName}" ${data}>${icon('plus')}<span>${esc(label)}</span></button>`;

export function rowAudiencia(a, { showDate = true } = {}) {
  const e = expById(a.expedienteId);
  const sub = [showDate ? fmtFecha(a.fecha) : '', e?.numero, a.sede].filter(Boolean).join(' · ');
  return `<a class="row" href="#/audiencia/${esc(a.id)}">
    <span class="row-lead time">${esc(a.hora || '—')}</span>
    <span class="row-main"><span class="row-title">${esc(a.tipo || 'Audiencia')}</span><span class="row-sub">${esc(sub)}</span></span>
    ${icon('chevron', 'chev')}</a>`;
}

export function rowPlazo(p) {
  const { calc, rest, sem } = infoPlazo(p);
  const e = expById(p.expedienteId);
  const sub = [e?.numero, calc ? `vence ${fmtFecha(calc.vencimiento)}` : ''].filter(Boolean).join(' · ');
  const estado = p.estatus === 'cumplido' ? 'Cumplido' : restanteTexto(rest, p.tipoDias);
  return `<a class="row" href="#/plazo/${esc(p.id)}">
    <span class="row-lead"><span class="dot sem-${sem}" title="${SEM_LABEL[sem]}"></span></span>
    <span class="row-main"><span class="row-title">${esc(p.actuacion || 'Plazo')}</span><span class="row-sub">${esc(sub)}</span>
    <span class="row-meta"><span class="sem-text sem-${sem}">${esc(estado)}</span>${p.estatus === 'cumplido' ? '' : '<span class="tag warn">verificar cómputo</span>'}</span></span>
    ${icon('chevron', 'chev')}</a>`;
}

export function rowTarea(t) {
  const e = expById(t.expedienteId);
  const hoy = todayISO();
  const prio = PRIORIDADES.find(([v]) => v === t.prioridad)?.[1] || 'Media';
  const vencida = !t.completada && t.fechaLimite && t.fechaLimite < hoy;
  const meta = [
    `<span class="tag prio-${esc(t.prioridad || 'media')}">${esc(prio)}</span>`,
    e ? `<span>${esc(e.numero)}</span>` : '',
    t.fechaLimite ? `<span class="${vencida ? 'overdue' : ''}">${vencida ? 'Venció' : 'Límite'} ${esc(fmtFecha(t.fechaLimite))}</span>` : '',
  ].join('');
  return `<div class="row tarea${t.completada ? ' done' : ''}">
    <label class="row-lead checkwrap"><input type="checkbox" data-action="toggle-tarea" data-id="${esc(t.id)}"${t.completada ? ' checked' : ''} aria-label="Marcar como completada"></label>
    <button type="button" class="row-main linklike" data-action="editar-tarea" data-id="${esc(t.id)}">
      <span class="row-title">${esc(t.titulo)}</span><span class="row-meta">${meta}</span></button></div>`;
}

export function rowNota(n, { inbox = false } = {}) {
  const fecha = n.createdAt ? new Date(n.createdAt) : null;
  const when = fecha ? `${fecha.getDate()}/${fecha.getMonth() + 1} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}` : '';
  const acciones = inbox
    ? `<button type="button" class="btn small primary" data-action="asignar-nota" data-id="${esc(n.id)}">Asignar</button>`
    : '';
  return `<div class="row nota">
    <button type="button" class="row-main linklike" data-action="editar-nota" data-id="${esc(n.id)}">
      <span class="nota-texto">${esc(n.texto)}</span><span class="row-sub">${esc(when)}</span></button>
    <span class="row-actions">${acciones}</span></div>`;
}

export function notFound(back) {
  return { title: 'No encontrado', back, html: `<div class="page">${empty('Este registro ya no existe.')}</div>` };
}
