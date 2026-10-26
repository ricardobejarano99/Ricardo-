import { state } from '../store.js';
import * as store from '../store.js';
import { esc, todayISO, fmtFecha, fmtFechaLarga, MESES } from '../util.js';
import { addDays, weekday } from '../plazos.js';
import { rowAudiencia, rowPlazo, empty, section, addBtn, byFechaHora, expById, infoPlazo, calendario, notFound } from './common.js';
import { calButtons } from './calui.js';
import { editarAudiencia } from './forms.js';
import { register } from '../actions.js';
import { icon } from '../icons.js';

const vista = { modo: '7dias', mes: todayISO().slice(0, 7), dia: todayISO() };

function proximos7() {
  const hoy = todayISO();
  const fin = addDays(hoy, 6);
  const auds = state.audiencias.filter((a) => a.fecha >= hoy && a.fecha <= fin).sort(byFechaHora);
  if (!auds.length) return empty('Sin audiencias en los próximos 7 días.');
  const porDia = new Map();
  auds.forEach((a) => { if (!porDia.has(a.fecha)) porDia.set(a.fecha, []); porDia.get(a.fecha).push(a); });
  return [...porDia].map(([f, list]) => `<h3 class="day-head">${f === hoy ? 'Hoy · ' : f === addDays(hoy, 1) ? 'Mañana · ' : ''}${esc(fmtFechaLarga(f))}</h3>
    <div class="list">${list.map((a) => rowAudiencia(a, { showDate: false })).join('')}</div>`).join('');
}

function todas() {
  const hoy = todayISO();
  const prox = state.audiencias.filter((a) => a.fecha >= hoy).sort(byFechaHora);
  const pas = state.audiencias.filter((a) => a.fecha < hoy).sort(byFechaHora).reverse();
  return `${prox.length ? `<div class="list">${prox.map((a) => rowAudiencia(a)).join('')}</div>` : empty('Sin audiencias próximas.')}
    ${pas.length ? `<details class="past"><summary>Anteriores (${pas.length})</summary><div class="list">${pas.map((a) => rowAudiencia(a)).join('')}</div></details>` : ''}`;
}

function calendarioMes() {
  const [y, m] = vista.mes.split('-').map(Number);
  const primero = `${vista.mes}-01`;
  const offset = (weekday(primero) + 6) % 7; // semana inicia en lunes
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const hoy = todayISO();
  const cal = calendario();
  const venc = new Map();
  state.plazos.filter((p) => p.estatus !== 'cumplido').forEach((p) => {
    const v = infoPlazo(p).calc?.vencimiento;
    if (v) venc.set(v, (venc.get(v) || 0) + 1);
  });
  const auds = new Map();
  state.audiencias.forEach((a) => auds.set(a.fecha, (auds.get(a.fecha) || 0) + 1));

  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span class="cal-cell blank"></span>';
  for (let d = 1; d <= diasMes; d++) {
    const f = `${vista.mes}-${String(d).padStart(2, '0')}`;
    const cls = ['cal-cell', f === hoy ? 'today' : '', f === vista.dia ? 'sel' : '', cal.esHabil(f) ? '' : 'inhabil'].filter(Boolean).join(' ');
    const marks = `${auds.get(f) ? `<span class="mk aud" title="Audiencias">${auds.get(f)}</span>` : ''}${venc.get(f) ? '<span class="mk venc" title="Vencimiento de plazo"></span>' : ''}`;
    cells += `<button type="button" class="${cls}" data-action="cal-dia" data-fecha="${f}" aria-label="${esc(fmtFechaLarga(f))}"><span class="n">${d}</span><span class="mks">${marks}</span></button>`;
  }
  const dSel = vista.dia;
  const audsDia = state.audiencias.filter((a) => a.fecha === dSel).sort(byFechaHora);
  const plazosDia = state.plazos.filter((p) => p.estatus !== 'cumplido' && infoPlazo(p).calc?.vencimiento === dSel);
  const motivo = cal.motivo(dSel);
  const listaDia = [...audsDia.map((a) => rowAudiencia(a, { showDate: false })), ...plazosDia.map(rowPlazo)];
  return `<div class="month">
    <div class="month-nav"><button type="button" class="iconbtn" data-action="cal-mes" data-delta="-1" aria-label="Mes anterior">${icon('back')}</button>
    <h2>${esc(MESES[m - 1])} ${y}</h2><button type="button" class="iconbtn flip" data-action="cal-mes" data-delta="1" aria-label="Mes siguiente">${icon('back')}</button></div>
    <div class="cal-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cal-dow">${d}</span>`).join('')}${cells}</div>
    <p class="legend"><span class="mk aud">1</span> audiencias <span class="mk venc"></span> vencimiento <span class="sw inhabil"></span> inhábil</p>
  </div>
  <h3 class="day-head">${esc(fmtFechaLarga(dSel))}${motivo ? ` · <span class="muted">${esc(motivo)}</span>` : ''}</h3>
  ${listaDia.length ? `<div class="list">${listaDia.join('')}</div>` : empty('Nada programado este día.')}
  <div class="btn-row"><button type="button" class="btn" data-action="nueva-audiencia-dia" data-fecha="${dSel}">${icon('plus')}<span>Audiencia este día</span></button></div>`;
}

export function renderLista() {
  const tab = (k, l) => `<label><input type="radio" name="aud-vista" data-action="aud-vista" value="${k}"${vista.modo === k ? ' checked' : ''}><span>${l}</span></label>`;
  const body = vista.modo === 'calendario' ? calendarioMes() : vista.modo === 'todas' ? todas() : proximos7();
  const html = `<div class="page">
    <div class="toolbar"><div class="segmented grow">${tab('7dias', 'Próximos 7 días')}${tab('calendario', 'Calendario')}${tab('todas', 'Todas')}</div>${addBtn('nueva-audiencia', 'Nueva')}</div>
    ${body}</div>`;
  return { title: 'Agenda', html };
}

export function renderDetalle(id) {
  const a = store.get('audiencias', id);
  if (!a) return notFound('#/agenda');
  const e = expById(a.expedienteId);
  const html = `<div class="page">
    <div class="detail-head"><div><div class="eyebrow">Audiencia</div><h1>${esc(a.tipo)}</h1></div>
      <button type="button" class="btn" data-action="editar-audiencia" data-id="${esc(a.id)}">${icon('edit')}<span>Editar</span></button></div>
    <section class="card"><dl class="kvs">
      <div class="kv"><dt>Fecha</dt><dd>${esc(fmtFechaLarga(a.fecha))}</dd></div>
      <div class="kv"><dt>Hora</dt><dd>${esc(a.hora || '—')}${a.duracion ? ` · ${esc(a.duracion)} min` : ''}</dd></div>
      ${a.sede ? `<div class="kv"><dt>Sede</dt><dd>${esc(a.sede)}</dd></div>` : ''}
      <div class="kv"><dt>Expediente</dt><dd>${e ? `<a href="#/expediente/${esc(e.id)}">${esc(e.numero)}</a> · ${esc(e.cliente || '')}` : 'Sin expediente'}</dd></div>
    </dl>${a.notas ? `<div class="notes">${esc(a.notas)}</div>` : ''}</section>
    ${calButtons('audiencia', a.id)}
  </div>`;
  return { title: fmtFecha(a.fecha), back: '#/agenda', html };
}

register({
  'aud-vista': (el) => { vista.modo = el.value; window.dispatchEvent(new Event('rerender')); },
  'cal-mes': (el) => {
    const [y, m] = vista.mes.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + Number(el.dataset.delta), 1));
    vista.mes = d.toISOString().slice(0, 7);
    vista.dia = vista.mes === todayISO().slice(0, 7) ? todayISO() : `${vista.mes}-01`;
    window.dispatchEvent(new Event('rerender'));
  },
  'cal-dia': (el) => { vista.dia = el.dataset.fecha; window.dispatchEvent(new Event('rerender')); },
  'nueva-audiencia-dia': (el) => editarAudiencia(null, '', el.dataset.fecha),
});
