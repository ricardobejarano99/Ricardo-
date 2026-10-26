// Buscador global: expedientes, notas, tareas, plazos y audiencias. Ignora acentos y mayúsculas.
import { state } from './store.js';
import { esc, $, fmtFecha } from './util.js';
import { registerInput } from './actions.js';
import { icon } from './icons.js';

const MARCAS = /[̀-ͯ]/g;
export const norm = (s) => String(s ?? '').normalize('NFD').replace(MARCAS, '').toLowerCase();

// Normaliza conservando, para cada carácter resultante, su posición en el texto original.
function mapa(texto) {
  let n = '';
  const idx = [];
  for (let i = 0; i < texto.length; i++) {
    const c = norm(texto[i]);
    for (let k = 0; k < c.length; k++) { n += c[k]; idx.push(i); }
  }
  return { n, idx };
}

function fragmento(texto, token) {
  const { n, idx } = mapa(texto);
  const p = n.indexOf(token);
  if (p < 0) return esc(texto.length > 140 ? `${texto.slice(0, 140)}…` : texto);
  const ini = idx[p];
  const fin = idx[p + token.length - 1] + 1;
  const a = Math.max(0, ini - 60);
  const b = Math.min(texto.length, fin + 80);
  return `${a > 0 ? '…' : ''}${esc(texto.slice(a, ini))}<mark>${esc(texto.slice(ini, fin))}</mark>${esc(texto.slice(fin, b))}${b < texto.length ? '…' : ''}`;
}

const FUENTES = [
  { col: 'expedientes', label: 'Expedientes', href: (x) => `#/expediente/${x.id}`, title: (x) => x.numero,
    campos: (x) => [x.numero, x.tipo, x.organo, x.cliente, x.contraparte, x.etapa, x.estatus, x.notas] },
  { col: 'notas', label: 'Notas', action: 'editar-nota', title: (x) => (x.texto || '').split('\n')[0].slice(0, 80), campos: (x) => [x.texto] },
  { col: 'tareas', label: 'Tareas', action: 'editar-tarea', title: (x) => x.titulo, campos: (x) => [x.titulo, x.notas] },
  { col: 'plazos', label: 'Plazos', href: (x) => `#/plazo/${x.id}`, title: (x) => x.actuacion, campos: (x) => [x.actuacion, x.notas] },
  { col: 'audiencias', label: 'Audiencias', href: (x) => `#/audiencia/${x.id}`, title: (x) => `${x.tipo} · ${fmtFecha(x.fecha)}`, campos: (x) => [x.tipo, x.sede, x.notas] },
];

export function buscar(q) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const f of FUENTES) {
    const hits = [];
    for (const x of state[f.col]) {
      const campos = f.campos(x).filter(Boolean).map(String);
      const todo = norm(campos.join(' \n '));
      if (!tokens.every((t) => todo.includes(t))) continue;
      const campo = campos.find((c) => norm(c).includes(tokens[0])) || campos[0] || '';
      hits.push({ x, snippet: fragmento(campo, tokens[0]) });
    }
    if (hits.length) out.push({ f, hits });
  }
  return out;
}

let ultima = '';

function resultados(q) {
  if (!q.trim()) return '<p class="empty">Escribe para buscar en expedientes, notas, tareas, plazos y audiencias.</p>';
  const grupos = buscar(q);
  if (!grupos.length) return '<p class="empty">Sin resultados.</p>';
  return grupos.map(({ f, hits }) => `<section class="card"><div class="card-head"><h2>${esc(f.label)} (${hits.length})</h2></div><div class="list">
    ${hits.slice(0, 50).map(({ x, snippet }) => {
      const inner = `<span class="row-main"><span class="row-title">${esc(f.title(x))}</span><span class="row-sub snippet">${snippet}</span></span>${icon('chevron', 'chev')}`;
      return f.href
        ? `<a class="row" href="${esc(f.href(x))}">${inner}</a>`
        : `<button type="button" class="row linklike" data-action="${f.action}" data-id="${esc(x.id)}">${inner}</button>`;
    }).join('')}</div></section>`).join('');
}

export function render() {
  const html = `<div class="page">
    <input type="search" id="buscar" class="search-input big" placeholder="Buscar…" value="${esc(ultima)}" data-oninput="buscar" aria-label="Buscar" autocomplete="off">
    <div id="search-results">${resultados(ultima)}</div></div>`;
  return {
    title: 'Buscar',
    html,
    after: (root) => {
      const input = $('#buscar', root);
      if (!input.dataset.focused) { input.focus(); input.dataset.focused = '1'; }
    },
  };
}

registerInput({
  buscar: (el) => { ultima = el.value; $('#search-results').innerHTML = resultados(ultima); },
});
