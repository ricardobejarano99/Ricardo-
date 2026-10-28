// Arranque, bloqueo con PIN, navegación y despacho de acciones.
import * as store from './store.js';
import { state } from './store.js';
import { $, esc, toast, closeAllModals } from './util.js';
import { actions, changeActions, inputActions } from './actions.js';
import { icon } from './icons.js';
import { cargarEjemplo } from './seed.js';
import * as inicio from './views/inicio.js';
import * as expedientes from './views/expedientes.js';
import * as audiencias from './views/audiencias.js';
import * as plazos from './views/plazos.js';
import * as tareas from './views/tareas.js';
import * as ajustes from './views/ajustes.js';
import * as busqueda from './search.js';
import './views/forms.js';
import './views/captura.js';
import './views/calui.js';
import './backup.js';

const NAV = [
  ['#/inicio', 'Inicio', 'home'],
  ['#/expedientes', 'Expedientes', 'folder'],
  ['#/agenda', 'Agenda', 'calendar'],
  ['#/plazos', 'Plazos', 'clock'],
  ['#/tareas', 'Tareas', 'check'],
];

const ROUTES = [
  [/^#\/inicio$/, () => inicio.render(), '#/inicio'],
  [/^#\/expedientes$/, () => expedientes.renderLista(), '#/expedientes'],
  [/^#\/expediente\/(.+)$/, (id) => expedientes.renderDetalle(id), '#/expedientes'],
  [/^#\/agenda$/, () => audiencias.renderLista(), '#/agenda'],
  [/^#\/audiencia\/(.+)$/, (id) => audiencias.renderDetalle(id), '#/agenda'],
  [/^#\/plazos$/, () => plazos.renderLista(), '#/plazos'],
  [/^#\/plazo\/(.+)$/, (id) => plazos.renderDetalle(id), '#/plazos'],
  [/^#\/tareas$/, () => tareas.render(), '#/tareas'],
  [/^#\/ajustes$/, () => ajustes.render(), '#/ajustes'],
  [/^#\/buscar$/, () => busqueda.render(), '#/buscar'],
];

let navCount = 0;
let lastHash = null;

// --- Tema --------------------------------------------------------------------
function applyTheme(tema) {
  const t = tema === 'light' || tema === 'dark' ? tema : '';
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('despacho-tema', t); } catch { /* sin almacenamiento local */ }
}

try { applyTheme(localStorage.getItem('despacho-tema') || ''); } catch { /* sin almacenamiento local */ }

// --- Interfaz principal ------------------------------------------------------
function shellHTML() {
  const tabs = NAV.map(([href, label, ic]) => `<a class="tab" href="${href}" data-tab="${href}">${icon(ic)}<span>${label}</span></a>`).join('');
  return `<header class="topbar">
      <div class="topbar-left" id="tb-left"></div>
      <h1 class="topbar-title" id="tb-title"></h1>
      <div class="topbar-right">
        <a class="iconbtn" href="#/buscar" aria-label="Buscar">${icon('search')}</a>
        <a class="iconbtn" href="#/ajustes" aria-label="Ajustes">${icon('settings')}</a>
        <button type="button" class="iconbtn" data-action="bloquear" aria-label="Bloquear">${icon('lock')}</button>
      </div></header>
    <nav class="tabs" aria-label="Secciones"><div class="side-brand">Despacho</div>${tabs}
      <a class="tab side-only" href="#/buscar" data-tab="#/buscar">${icon('search')}<span>Buscar</span></a>
      <a class="tab side-only" href="#/ajustes" data-tab="#/ajustes">${icon('settings')}<span>Ajustes</span></a></nav>
    <main id="view" tabindex="-1"></main>
    <button type="button" class="fab" data-action="captura" aria-label="Captura rápida">${icon('plus')}</button>`;
}

function render() {
  if (!store.isUnlocked() || !$('#view')) return;
  const hash = location.hash || '#/inicio';
  let r = null;
  let tabKey = '';
  for (const [re, fn, tab] of ROUTES) {
    const m = hash.match(re);
    if (m) { r = fn(...m.slice(1).map(decodeURIComponent)); tabKey = tab; break; }
  }
  if (!r) { location.replace('#/inicio'); return; }
  $('#tb-title').textContent = r.title;
  $('#tb-left').innerHTML = r.back
    ? `<button type="button" class="iconbtn back" data-action="atras" data-back="${esc(r.back)}" aria-label="Regresar">${icon('back')}</button>`
    : '<span class="brand">Despacho</span>';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tabKey));
  const main = $('#view');
  main.innerHTML = r.html;
  r.after?.(main);
  document.title = r.title === 'Inicio' ? 'Despacho' : `${r.title} · Despacho`;
}

function rerender() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

store.onChange(rerender);
window.addEventListener('rerender', rerender);
window.addEventListener('hashchange', () => {
  if (location.hash !== lastHash) navCount++;
  lastHash = location.hash;
  closeAllModals();
  render();
  window.scrollTo(0, 0);
});

// --- Despacho de acciones ----------------------------------------------------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  Promise.resolve(fn(el, e)).catch((err) => { console.error(err); toast(`Error: ${err.message}`); });
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-onchange]');
  const fn = el && changeActions[el.dataset.onchange];
  if (fn) Promise.resolve(fn(el, e)).catch((err) => { console.error(err); toast(`Error: ${err.message}`); });
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-oninput]');
  const fn = el && inputActions[el.dataset.oninput];
  if (fn) fn(el, e);
});

Object.assign(actions, {
  bloquear: () => showLock(),
  atras: (el) => {
    if (navCount > 0) history.back();
    else location.hash = el.dataset.back;
  },
});

// --- Bloqueo -----------------------------------------------------------------
function lockHTML(setup) {
  const logo = '<img src="icons/icon-192.png" class="lock-logo" alt="" width="72" height="72">';
  if (setup) {
    return `<div class="lock-card">${logo}<h1>Despacho</h1>
      <p class="muted">Crea un código de acceso. Con él se cifran todos tus datos en este dispositivo.</p>
      <form id="lock-form" novalidate>
        <label class="label" for="pin">Código de acceso (6 dígitos o más recomendado)</label>
        <input id="pin" type="password" inputmode="numeric" class="pin-input" autocomplete="new-password" required>
        <label class="label" for="pin2">Confírmalo</label>
        <input id="pin2" type="password" inputmode="numeric" class="pin-input" autocomplete="new-password" required>
        <label class="check"><input type="checkbox" id="seed" checked><span>Cargar datos de ejemplo ficticios (se borran con un botón)</span></label>
        <div class="banner warn small">${icon('alert')}<div>Si olvidas el código no hay manera de recuperar los datos. Nadie, ni siquiera quien programó la app, puede abrirlos.</div></div>
        <button type="submit" class="btn primary block">Crear y entrar</button>
      </form><p class="lock-msg" id="lock-msg" role="alert"></p></div>`;
  }
  return `<div class="lock-card">${logo}<h1>Despacho</h1>
    <p class="muted">Ingresa tu código de acceso</p>
    <form id="lock-form" novalidate>
      <input id="pin" type="password" inputmode="numeric" class="pin-input" autocomplete="current-password" aria-label="Código de acceso" required>
      <button type="submit" class="btn primary block">Desbloquear</button>
    </form><p class="lock-msg" id="lock-msg" role="alert"></p></div>`;
}

async function showLock() {
  closeAllModals();
  store.lock();
  $('#app').hidden = true;
  $('#app').innerHTML = '';
  const setup = !(await store.isSetup());
  const root = $('#lock');
  root.hidden = false;
  root.innerHTML = lockHTML(setup);
  const form = $('#lock-form');
  const msg = $('#lock-msg');
  const btn = form.querySelector('[type=submit]');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const pin = $('#pin').value;
    msg.textContent = '';
    if (setup) {
      if (pin.length < 4) { msg.textContent = 'El código debe tener al menos 4 caracteres.'; return; }
      if (pin !== $('#pin2').value) { msg.textContent = 'Los códigos no coinciden.'; return; }
    } else if (!pin) return;
    btn.disabled = true;
    btn.textContent = setup ? 'Preparando cifrado…' : 'Verificando…';
    try {
      if (setup) {
        await store.setup(pin);
        if ($('#seed').checked) await cargarEjemplo();
        enterApp();
        return;
      }
      const r = await store.unlock(pin);
      if (r.ok) { enterApp(); return; }
      $('#pin').value = '';
      msg.textContent = r.espera
        ? `Demasiados intentos. Espera ${Math.ceil(r.espera / 1000)} segundos.`
        : `Código incorrecto${r.intentos >= 3 ? ` (${r.intentos} intentos)` : ''}.`;
    } catch (err) {
      console.error(err);
      msg.textContent = `No se pudo abrir: ${err.message}`;
    }
    btn.disabled = false;
    btn.textContent = setup ? 'Crear y entrar' : 'Desbloquear';
  };
}

function enterApp() {
  $('#lock').hidden = true;
  $('#lock').innerHTML = '';
  const app = $('#app');
  app.innerHTML = shellHTML();
  app.hidden = false;
  applyTheme(state.settings.tema);
  if (!location.hash || location.hash === '#') location.replace('#/inicio');
  lastHash = location.hash;
  navCount = 0;
  render();
  navigator.storage?.persist?.().catch(() => {});
}

// Al salir de la app se oculta el contenido (vista previa del selector de apps) y se bloquea
// según el ajuste de bloqueo automático.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    document.body.classList.add('privacy');
    if (store.isUnlocked() && state.settings.bloqueoMin === 0) showLock();
  } else {
    document.body.classList.remove('privacy');
    if (store.isUnlocked() && Date.now() - hiddenAt > state.settings.bloqueoMin * 60000) showLock();
  }
});

window.addEventListener('online', () => {
  if (store.isUnlocked() && state.pendientes.length) {
    toast(`Conexión recuperada: ${state.pendientes.length} evento(s) pendiente(s) de enviar al calendario.`, {
      actionLabel: 'Ver', onAction: () => { location.hash = '#/inicio'; }, timeout: 8000,
    });
  }
});

// --- Service worker ----------------------------------------------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const avisar = (w) => toast('Hay una nueva versión de Despacho.', {
      actionLabel: 'Actualizar', timeout: 15000, onAction: () => w.postMessage('skipWaiting'),
    });
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) avisar(w);
      });
    });
  }).catch((err) => console.warn('Service worker no registrado', err));
  // Solo recarga cuando una versión nueva sustituye a otra (no en la primera instalación).
  const habiaControlador = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando || !habiaControlador) return;
    recargando = true;
    location.reload();
  });
}

if (!window.indexedDB || !window.crypto?.subtle) {
  $('#lock').hidden = false;
  $('#lock').innerHTML = '<div class="lock-card"><h1>Despacho</h1><p>Este navegador no permite el almacenamiento cifrado que requiere la app. Ábrela en Safari actualizado.</p></div>';
} else {
  showLock();
}
