import { state } from '../store.js';
import * as store from '../store.js';
import { esc, fmtFechaLarga, fmtFecha } from '../util.js';
import { desglose, prevHabil } from '../plazos.js';
import { rowPlazo, empty, addBtn, expById, infoPlazo, calendario, restanteTexto, SEM_LABEL, notFound } from './common.js';
import { calButtons } from './calui.js';
import { register } from '../actions.js';
import { icon } from '../icons.js';

const vista = { estado: 'pendientes' };

export function renderLista() {
  const items = state.plazos
    .filter((p) => vista.estado === 'todos' || (vista.estado === 'cumplidos' ? p.estatus === 'cumplido' : p.estatus !== 'cumplido'))
    .map((p) => ({ p, v: infoPlazo(p).calc?.vencimiento || '9999' }))
    .sort((a, b) => (vista.estado === 'cumplidos' ? b.v.localeCompare(a.v) : a.v.localeCompare(b.v)))
    .map((x) => x.p);
  const tab = (k, l) => `<label><input type="radio" name="pl-vista" data-action="pl-vista" value="${k}"${vista.estado === k ? ' checked' : ''}><span>${l}</span></label>`;
  const html = `<div class="page">
    <div class="toolbar"><div class="segmented grow">${tab('pendientes', 'Pendientes')}${tab('cumplidos', 'Cumplidos')}${tab('todos', 'Todos')}</div>${addBtn('nuevo-plazo', 'Nuevo')}</div>
    ${items.length ? `<div class="list">${items.map(rowPlazo).join('')}</div>` : empty('No hay plazos en esta vista.')}
    <p class="footnote">Semáforo: verde con más de ${state.settings.semaforo.ambar} días restantes, ámbar hasta ${state.settings.semaforo.ambar}, rojo con ${state.settings.semaforo.rojo} o menos. Ajustable en Ajustes.</p>
  </div>`;
  return { title: 'Plazos', html };
}

export function renderDetalle(id) {
  const p = store.get('plazos', id);
  if (!p) return notFound('#/plazos');
  const e = expById(p.expedienteId);
  const { calc, rest, sem } = infoPlazo(p);
  const cal = calendario();
  let cuerpo = empty('Faltan datos para calcular el vencimiento.');
  if (calc) {
    const aviso = prevHabil(cal, calc.vencimiento);
    const rec2 = prevHabil(cal, aviso);
    const dias = desglose(cal, calc).map((d) => `<li class="${d.n ? 'cuenta' : 'no-cuenta'}${d.fecha === calc.vencimiento ? ' venc' : ''}">
      <span class="d">${esc(fmtFecha(d.fecha))}</span><span class="n">${d.n ? `Día ${d.n}` : d.fecha === calc.vencimiento ? 'Vence (recorrido)' : ''}</span>
      <span class="m">${d.motivo ? esc(d.motivo) : ''}</span></li>`).join('');
    cuerpo = `<div class="calc big sem-border-${sem}">
      <div class="calc-label">Vencimiento</div>
      <div class="calc-date">${esc(fmtFechaLarga(calc.vencimiento))}</div>
      <div class="calc-row"><span class="dot sem-${sem}"></span><span class="sem-text sem-${sem}">${esc(p.estatus === 'cumplido' ? 'Cumplido' : restanteTexto(rest, p.tipoDias))} · ${SEM_LABEL[sem]}</span></div>
      <div class="calc-warn">Verificar cómputo</div>
    </div>
    <section class="card"><dl class="kvs">
      <div class="kv"><dt>Notificación</dt><dd>${esc(fmtFechaLarga(p.notificacion))}</dd></div>
      <div class="kv"><dt>Surte efectos</dt><dd>${esc(fmtFechaLarga(calc.efectos))}</dd></div>
      <div class="kv"><dt>Primer día del cómputo</dt><dd>${esc(fmtFechaLarga(calc.inicio))}</dd></div>
      <div class="kv"><dt>Plazo</dt><dd>${esc(p.dias)} días ${p.tipoDias === 'naturales' ? 'naturales' : 'hábiles'}${calc.recorrido ? ' · recorrido al siguiente hábil' : ''}</dd></div>
      <div class="kv"><dt>Aviso</dt><dd>${esc(fmtFechaLarga(aviso))}, ${esc(state.settings.horaAviso)} h</dd></div>
      ${p.recordatorio2 ? `<div class="kv"><dt>Recordatorio</dt><dd>${esc(fmtFechaLarga(rec2))}, ${esc(state.settings.horaAviso)} h</dd></div>` : ''}
      <div class="kv"><dt>Expediente</dt><dd>${e ? `<a href="#/expediente/${esc(e.id)}">${esc(e.numero)}</a>` : 'Sin expediente'}</dd></div>
    </dl>${p.notas ? `<div class="notes">${esc(p.notas)}</div>` : ''}</section>
    <details class="card desglose"><summary>Ver día por día</summary><ol class="days">${dias}</ol>
      <p class="hint">Calculado con tu lista de días inhábiles. Si falta un día declarado inhábil, el vencimiento saldrá adelantado.</p></details>
    ${calButtons('plazo', p.id)}`;
  }
  const html = `<div class="page">
    <div class="detail-head"><div><div class="eyebrow">Plazo</div><h1>${esc(p.actuacion)}</h1></div>
      <div class="btn-row tight"><button type="button" class="btn" data-action="toggle-plazo" data-id="${esc(p.id)}">${p.estatus === 'cumplido' ? 'Marcar pendiente' : 'Marcar cumplido'}</button>
      <button type="button" class="btn" data-action="editar-plazo" data-id="${esc(p.id)}">${icon('edit')}<span>Editar</span></button></div></div>
    ${cuerpo}</div>`;
  return { title: 'Plazo', back: '#/plazos', html };
}

register({
  'pl-vista': (el) => { vista.estado = el.value; window.dispatchEvent(new Event('rerender')); },
});
