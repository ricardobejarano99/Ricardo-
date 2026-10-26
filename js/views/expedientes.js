import { state } from '../store.js';
import * as store from '../store.js';
import { esc, $, todayISO } from '../util.js';
import { TIPOS_EXP, ESTATUS_CERRADOS } from '../catalogos.js';
import { rowAudiencia, rowPlazo, rowTarea, rowNota, section, empty, addBtn, byFechaHora, byTarea, infoPlazo, notFound } from './common.js';
import { register, registerChange, registerInput } from '../actions.js';
import { icon } from '../icons.js';
import { norm } from '../search.js';

const filtro = { q: '', tipo: '', estatus: 'abiertos' };

function lista() {
  const q = norm(filtro.q);
  const items = state.expedientes
    .filter((e) => !filtro.tipo || e.tipo === filtro.tipo)
    .filter((e) => filtro.estatus === 'todos'
      || (filtro.estatus === 'abiertos' ? !ESTATUS_CERRADOS.includes(e.estatus) : ESTATUS_CERRADOS.includes(e.estatus)))
    .filter((e) => !q || norm([e.numero, e.cliente, e.organo, e.contraparte, e.etapa].join(' ')).includes(q))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (!items.length) return empty(state.expedientes.length ? 'Ningún expediente coincide con el filtro.' : 'Aún no hay expedientes.');
  return `<div class="list">${items.map((e) => `<a class="row" href="#/expediente/${esc(e.id)}">
    <span class="row-main"><span class="row-title">${esc(e.numero)} <span class="tag">${esc(e.tipo)}</span></span>
    <span class="row-sub">${esc([e.cliente, e.organo].filter(Boolean).join(' · '))}</span>
    <span class="row-meta"><span>${esc(e.etapa || 'Sin etapa')}</span><span class="tag ${ESTATUS_CERRADOS.includes(e.estatus) ? '' : 'ok'}">${esc(e.estatus || '')}</span></span></span>
    ${icon('chevron', 'chev')}</a>`).join('')}</div>`;
}

export function renderLista() {
  const chips = [['', 'Todos'], ...TIPOS_EXP.map((t) => [t, t])]
    .map(([v, l]) => `<button type="button" class="chip${filtro.tipo === v ? ' on' : ''}" data-action="exp-tipo" data-tipo="${esc(v)}">${esc(l)}</button>`).join('');
  const html = `<div class="page">
    <div class="toolbar">
      <input type="search" class="search-input" placeholder="Filtrar por número, cliente u órgano" value="${esc(filtro.q)}" data-oninput="exp-filtrar" aria-label="Filtrar expedientes">
      <select data-onchange="exp-estatus" aria-label="Estatus">
        <option value="abiertos"${filtro.estatus === 'abiertos' ? ' selected' : ''}>Abiertos</option>
        <option value="cerrados"${filtro.estatus === 'cerrados' ? ' selected' : ''}>Concluidos y archivados</option>
        <option value="todos"${filtro.estatus === 'todos' ? ' selected' : ''}>Todos</option>
      </select>
      ${addBtn('nuevo-expediente', 'Nuevo')}
    </div>
    <div class="chips">${chips}</div>
    <div id="exp-list">${lista()}</div></div>`;
  return { title: 'Expedientes', html };
}

function dato(label, value) {
  return value ? `<div class="kv"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : '';
}

export function renderDetalle(id) {
  const e = store.get('expedientes', id);
  if (!e) return notFound('#/expedientes');
  const hoy = todayISO();
  const data = `data-exp="${esc(e.id)}"`;
  const auds = state.audiencias.filter((a) => a.expedienteId === id).sort(byFechaHora);
  const prox = auds.filter((a) => a.fecha >= hoy);
  const pas = auds.filter((a) => a.fecha < hoy).reverse();
  const plazos = state.plazos.filter((p) => p.expedienteId === id)
    .map((p) => ({ p, v: infoPlazo(p).calc?.vencimiento || '9999' }))
    .sort((a, b) => (a.p.estatus === 'cumplido') - (b.p.estatus === 'cumplido') || a.v.localeCompare(b.v)).map((x) => x.p);
  const tareas = state.tareas.filter((t) => t.expedienteId === id).sort(byTarea);
  const notas = state.notas.filter((n) => n.expedienteId === id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const html = `<div class="page">
    <div class="detail-head">
      <div><div class="eyebrow">${esc(e.tipo)}</div><h1>${esc(e.numero)}</h1></div>
      <button type="button" class="btn" data-action="editar-expediente" data-id="${esc(e.id)}">${icon('edit')}<span>Editar</span></button>
    </div>
    <section class="card"><dl class="kvs">
      ${dato('Órgano jurisdiccional', e.organo)}${dato('Cliente', e.cliente)}${dato('Contraparte / autoridad responsable', e.contraparte)}
      ${dato('Etapa procesal', e.etapa)}${dato('Estatus', e.estatus)}
    </dl>${e.notas ? `<div class="notes">${esc(e.notas)}</div>` : ''}</section>
    <div class="grid">
      ${section('Audiencias', (prox.length || pas.length)
        ? `<div class="list">${prox.map((a) => rowAudiencia(a)).join('')}</div>${pas.length ? `<details class="past"><summary>Anteriores (${pas.length})</summary><div class="list">${pas.map((a) => rowAudiencia(a)).join('')}</div></details>` : ''}`
        : empty('Sin audiencias.'), addBtn('nueva-audiencia', 'Agregar', data))}
      ${section('Plazos', plazos.length ? `<div class="list">${plazos.map(rowPlazo).join('')}</div>` : empty('Sin plazos.'), addBtn('nuevo-plazo', 'Agregar', data))}
      ${section('Tareas', tareas.length ? `<div class="list">${tareas.map(rowTarea).join('')}</div>` : empty('Sin tareas.'), addBtn('nueva-tarea', 'Agregar', data))}
      ${section('Notas', notas.length ? `<div class="list">${notas.map((n) => rowNota(n)).join('')}</div>` : empty('Sin notas.'), addBtn('nueva-nota', 'Agregar', data))}
    </div></div>`;
  return { title: e.numero, back: '#/expedientes', html };
}

register({
  'exp-tipo': (el) => { filtro.tipo = el.dataset.tipo; window.dispatchEvent(new Event('rerender')); },
});
registerChange({
  'exp-estatus': (el) => { filtro.estatus = el.value; $('#exp-list').innerHTML = lista(); },
});
registerInput({
  'exp-filtrar': (el) => { filtro.q = el.value; $('#exp-list').innerHTML = lista(); },
});
