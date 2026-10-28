import * as store from '../store.js';
import { state } from '../store.js';
import { esc, toast, confirmDialog, openModal, fmtFecha, fmtFechaLarga, fmtMomento, todayISO, MESES } from '../util.js';
import { ART19_LA, addDays, weekday, isISODate } from '../plazos.js';
import { ALERTAS } from '../catalogos.js';
import { calendario, section } from './common.js';
import { register, registerChange } from '../actions.js';
import { cargarEjemplo } from '../seed.js';
import { icon } from '../icons.js';

export const APP_VERSION = '1.1.0';

const opt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`;

function fila(label, control, hint = '') {
  return `<div class="setting"><div class="setting-text"><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</div><div class="setting-ctl">${control}</div></div>`;
}

function proximosInhabiles() {
  const cal = calendario();
  const out = [];
  let d = todayISO();
  for (let i = 0; i < 400 && out.length < 8; i++) {
    const w = weekday(d);
    if (w !== 0 && w !== 6 && !cal.esHabil(d)) out.push(`<li><span>${esc(fmtFechaLarga(d))}</span><small>${esc(cal.motivo(d))}</small></li>`);
    d = addDays(d, 1);
  }
  return out.length ? `<ul class="simple">${out.join('')}</ul>` : '<p class="empty">Ninguno en el próximo año.</p>';
}

function editorInhabiles() {
  const inh = state.settings.inhabiles;
  const quitar = (tipo, i) => `<button type="button" class="iconbtn small" data-action="inh-quitar" data-tipo="${tipo}" data-i="${i}" aria-label="Quitar">${icon('trash')}</button>`;
  const anuales = inh.anuales.map((a, i) => ({ a, i })).sort((x, y) => x.a.md.localeCompare(y.a.md)).map(({ a, i }) => {
    const [m, d] = a.md.split('-').map(Number);
    return `<li><span>${d} de ${MESES[m - 1]}</span><small>${esc(a.desc || '')}</small>${quitar('anuales', i)}</li>`;
  }).join('');
  const fechas = inh.fechas.map((f, i) => ({ f, i })).sort((x, y) => x.f.fecha.localeCompare(y.f.fecha)).map(({ f, i }) =>
    `<li><span>${esc(fmtFecha(f.fecha))}</span><small>${esc(f.desc || '')}</small>${quitar('fechas', i)}</li>`).join('');
  const rangos = inh.rangos.map((r, i) => ({ r, i })).sort((x, y) => x.r.desde.localeCompare(y.r.desde)).map(({ r, i }) =>
    `<li><span>${esc(fmtFecha(r.desde))} – ${esc(fmtFecha(r.hasta))}</span><small>${esc(r.desc || '')}</small>${quitar('rangos', i)}</li>`).join('');
  const meses = MESES.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
  return `
    <p class="hint">Sábados y domingos siempre son inhábiles. La app no conoce los acuerdos del CJF ni de tu tribunal: agrega aquí los periodos vacacionales y las suspensiones de labores.</p>
    <h3 class="sub">Fechas fijas cada año</h3>
    <ul class="editlist">${anuales || '<li class="empty">Ninguna</li>'}</ul>
    <form class="inline-form" data-form="anual">
      <input type="number" name="dia" min="1" max="31" placeholder="Día" inputmode="numeric" required aria-label="Día">
      <select name="mes" aria-label="Mes">${meses}</select>
      <input type="text" name="desc" placeholder="Descripción (opcional)" aria-label="Descripción">
      <button class="btn small" type="submit">Agregar</button></form>
    <button type="button" class="btn small ghost" data-action="inh-restaurar">Restaurar fechas del art. 19 LA</button>
    <h3 class="sub">Días específicos</h3>
    <ul class="editlist">${fechas || '<li class="empty">Ninguno</li>'}</ul>
    <form class="inline-form" data-form="fecha">
      <input type="date" name="fecha" required aria-label="Fecha">
      <input type="text" name="desc" placeholder="Ej. Suspensión de labores (acuerdo CJF)" aria-label="Descripción">
      <button class="btn small" type="submit">Agregar</button></form>
    <h3 class="sub">Periodos (vacaciones, suspensiones)</h3>
    <ul class="editlist">${rangos || '<li class="empty">Ninguno</li>'}</ul>
    <form class="inline-form" data-form="rango">
      <input type="date" name="desde" required aria-label="Desde">
      <input type="date" name="hasta" required aria-label="Hasta">
      <input type="text" name="desc" placeholder="Ej. Primer periodo vacacional" aria-label="Descripción">
      <button class="btn small" type="submit">Agregar</button></form>
    <h3 class="sub">Próximos días inhábiles entre semana</h3>
    ${proximosInhabiles()}`;
}

export function render() {
  const s = state.settings;
  const al = s.alertasAudiencia || [];
  const alertSel = (i) => `<select data-onchange="alertas" data-i="${i}" aria-label="Alerta ${i + 1}">${ALERTAS.map(([v, l]) => opt(v, l, al[i] ?? 0)).join('')}</select>`;
  const nSeed = store.seedItems().length;
  const ult = s.ultimoRespaldo;

  const html = `<div class="page narrow">
    ${section('Seguridad', `
      ${fila('Bloqueo automático', `<select data-onchange="setting" data-key="bloqueoMin" data-type="number">
        ${[[0, 'Al salir de la app'], [1, 'Tras 1 minuto fuera'], [5, 'Tras 5 minutos fuera'], [15, 'Tras 15 minutos fuera']].map(([v, l]) => opt(v, l, s.bloqueoMin)).join('')}</select>`,
        'También se bloquea siempre que la app se cierra.')}
      <div class="btn-row"><button type="button" class="btn" data-action="cambiar-pin">Cambiar código de acceso</button>
      <button type="button" class="btn" data-action="bloquear">${icon('lock')}<span>Bloquear ahora</span></button></div>
      <p class="hint">Los datos se cifran en este dispositivo con AES-GCM y una clave derivada de tu código (PBKDF2, ${(310000).toLocaleString('es-MX')} iteraciones). Si olvidas el código, no hay forma de recuperarlos.</p>`)}

    ${section('Calendario', `
      ${fila('Modo discreto', `<label class="switch"><input type="checkbox" data-onchange="setting" data-key="modoDiscreto"${s.modoDiscreto ? ' checked' : ''}><span></span></label>`,
        'Los eventos llevan solo el tipo y el número de causa, sin nombres de clientes ni contrapartes.')}
      ${fila('Primera alerta de audiencias (.ics)', alertSel(0))}
      ${fila('Segunda alerta de audiencias (.ics)', alertSel(1))}
      ${fila('Duración predeterminada de audiencias', `<select data-onchange="setting" data-key="duracionAudiencia" data-type="number">${[30, 60, 90, 120, 180, 240].map((m) => opt(m, `${m} min`, s.duracionAudiencia)).join('')}</select>`)}
      ${fila('Hora del aviso de plazos', `<input type="time" value="${esc(s.horaAviso)}" data-onchange="setting" data-key="horaAviso">`, 'El aviso suena el día hábil anterior al vencimiento.')}
      <p class="hint">El enlace de Google Calendar no permite fijar alertas: usa tus notificaciones predeterminadas de Google. Lo que envíes a Google sale del dispositivo; el archivo .ics se genera aquí mismo.</p>`)}

    ${section('Plazos', `
      ${fila('Semáforo ámbar con', `<select data-onchange="setting" data-key="semaforo.ambar" data-type="number">${[2, 3, 4, 5, 6, 7, 10].map((n) => opt(n, `${n} días o menos`, s.semaforo.ambar)).join('')}</select>`)}
      ${fila('Semáforo rojo con', `<select data-onchange="setting" data-key="semaforo.rojo" data-type="number">${[0, 1, 2, 3].map((n) => opt(n, n === 0 ? 'Solo el día del vencimiento' : `${n} día${n === 1 ? '' : 's'} o menos`, s.semaforo.rojo)).join('')}</select>`)}
    `)}

    ${section('Días inhábiles', editorInhabiles())}

    ${section('Respaldo', `
      <p>${ult ? `Último respaldo: <strong>${esc(fmtMomento(ult))}</strong>` : '<strong>Aún no has hecho ningún respaldo.</strong>'}</p>
      <div class="btn-row"><button type="button" class="btn primary" data-action="exportar">${icon('download')}<span>Exportar respaldo cifrado</span></button>
      <label class="btn">Importar respaldo<input type="file" accept=".json,application/json" data-onchange="importar-archivo" hidden></label></div>
      <p class="hint">Para pasar tus datos entre iPhone e iPad: exporta en uno, envía el archivo por AirDrop o guárdalo en iCloud Drive, e impórtalo en el otro con el mismo código de acceso.</p>`)}

    ${section('Datos de ejemplo', `
      <p>${nSeed ? `Hay ${nSeed} registros de ejemplo (ficticios).` : 'No hay datos de ejemplo cargados.'}</p>
      <div class="btn-row">${nSeed ? '<button type="button" class="btn danger" data-action="borrar-ejemplo">Borrar datos de ejemplo</button>' : '<button type="button" class="btn" data-action="cargar-ejemplo">Cargar datos de ejemplo</button>'}</div>`)}

    ${section('Apariencia', fila('Tema', `<select data-onchange="setting" data-key="tema">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => opt(v, l, s.tema)).join('')}</select>`))}

    ${section('Zona de riesgo', `<p class="hint">Borra todos los datos y el código de acceso de este dispositivo. Exporta un respaldo antes.</p>
      <button type="button" class="btn danger" data-action="borrar-todo">Borrar todo y reiniciar</button>`)}

    <p class="footnote">Despacho ${APP_VERSION} · Funciona sin conexión · Sin servidores: nada se envía a internet salvo lo que mandes tú a Google Calendar.</p>
  </div>`;
  return { title: 'Ajustes', back: '#/inicio', html };
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

async function guardar(msg = 'Ajuste guardado') {
  await store.saveSettings();
  toast(msg);
}

registerChange({
  setting: async (el) => {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.type === 'number') v = Number(v);
    if (el.dataset.key === 'horaAviso' && !/^\d{2}:\d{2}$/.test(v)) return;
    setPath(state.settings, el.dataset.key, v);
    const sem = state.settings.semaforo;
    if (sem.rojo >= sem.ambar) sem.ambar = sem.rojo + 1;
    await guardar();
  },
  alertas: async (el) => {
    const al = [...(state.settings.alertasAudiencia || [0, 0])];
    al[Number(el.dataset.i)] = Number(el.value);
    state.settings.alertasAudiencia = al;
    await guardar();
  },
});

// Formularios en línea del editor de días inhábiles.
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const inh = state.settings.inhabiles;
  const f = Object.fromEntries(new FormData(form));
  const desc = (f.desc || '').trim();
  if (form.dataset.form === 'anual') {
    const dia = Number(f.dia);
    const md = `${f.mes}-${String(dia).padStart(2, '0')}`;
    if (!dia || !isISODate(`2024-${md}`) || new Date(`2024-${md}T00:00:00Z`).getUTCDate() !== dia) { toast('Fecha no válida'); return; }
    if (inh.anuales.some((a) => a.md === md)) { toast('Esa fecha ya está en la lista'); return; }
    inh.anuales.push({ md, desc });
  } else if (form.dataset.form === 'fecha') {
    if (!isISODate(f.fecha)) { toast('Fecha no válida'); return; }
    if (inh.fechas.some((x) => x.fecha === f.fecha)) { toast('Esa fecha ya está en la lista'); return; }
    inh.fechas.push({ fecha: f.fecha, desc });
  } else if (form.dataset.form === 'rango') {
    if (!isISODate(f.desde) || !isISODate(f.hasta) || f.desde > f.hasta) { toast('Revisa el periodo: la fecha inicial debe ser anterior a la final'); return; }
    inh.rangos.push({ desde: f.desde, hasta: f.hasta, desc });
  }
  await guardar('Día inhábil agregado. Los plazos se recalcularon.');
});

register({
  'inh-quitar': async (el) => {
    const lista = state.settings.inhabiles[el.dataset.tipo];
    lista.splice(Number(el.dataset.i), 1);
    await guardar('Día inhábil quitado. Los plazos se recalcularon.');
  },
  'inh-restaurar': async () => {
    const inh = state.settings.inhabiles;
    const tiene = new Set(inh.anuales.map((a) => a.md));
    ART19_LA.forEach((a) => { if (!tiene.has(a.md)) inh.anuales.push({ ...a }); });
    await guardar('Fechas del art. 19 LA restauradas');
  },
  'cargar-ejemplo': async () => { await cargarEjemplo(); toast('Datos de ejemplo cargados'); },
  'borrar-ejemplo': async () => {
    const items = store.seedItems();
    if (!(await confirmDialog('¿Borrar los datos de ejemplo?', { ok: 'Borrar', danger: true, detail: `Se eliminarán ${items.length} registros ficticios. Tus datos no se tocan.` }))) return;
    await store.removeMany(items);
    toast('Datos de ejemplo borrados');
  },
  'cambiar-pin': () => {
    const m = openModal(`<form class="modal-body" novalidate><h2 class="modal-title">Cambiar código de acceso</h2>
      <label class="label" for="pin-old">Código actual</label><input id="pin-old" type="password" inputmode="numeric" class="pin-input" autocomplete="current-password">
      <label class="label" for="pin-new">Código nuevo (mínimo 6 dígitos recomendado)</label><input id="pin-new" type="password" inputmode="numeric" class="pin-input" autocomplete="new-password">
      <label class="label" for="pin-new2">Confirma el código nuevo</label><input id="pin-new2" type="password" inputmode="numeric" class="pin-input" autocomplete="new-password">
      <p class="hint">Los respaldos anteriores seguirán abriéndose con el código anterior.</p>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">Cambiar</button></div></form>`);
    const form = m.el.querySelector('form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const [o, n, n2] = ['#pin-old', '#pin-new', '#pin-new2'].map((s) => form.querySelector(s).value);
      if (n.length < 4) { toast('El código nuevo debe tener al menos 4 caracteres'); return; }
      if (n !== n2) { toast('Los códigos nuevos no coinciden'); return; }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Cifrando…';
      const ok = await store.changePin(o, n);
      btn.disabled = false;
      btn.textContent = 'Cambiar';
      if (!ok) { toast('El código actual es incorrecto'); return; }
      m.close();
      toast('Código de acceso actualizado');
    };
  },
  'borrar-todo': () => {
    const m = openModal(`<form class="modal-body" novalidate><h2 class="modal-title">Borrar todo</h2>
      <p>Se eliminarán todos los expedientes, audiencias, plazos, tareas, notas y el código de acceso. No se puede deshacer.</p>
      <label class="label" for="conf-borrar">Escribe BORRAR para confirmar</label><input id="conf-borrar" type="text" autocomplete="off" autocapitalize="characters">
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn danger">Borrar todo</button></div></form>`);
    const form = m.el.querySelector('form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (form.querySelector('#conf-borrar').value.trim().toUpperCase() !== 'BORRAR') { toast('Escribe BORRAR para confirmar'); return; }
      await store.wipe();
      location.hash = '';
      location.reload();
    };
  },
});
