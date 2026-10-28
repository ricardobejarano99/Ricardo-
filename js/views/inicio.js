import { state } from '../store.js';
import { esc, todayISO, fmtFechaLarga, plural } from '../util.js';
import { addDays } from '../plazos.js';
import { rowAudiencia, rowPlazo, rowTarea, rowNota, infoPlazo, empty, section, byFechaHora, byTarea } from './common.js';
import { pendientesCard } from './calui.js';
import { campoInicio } from './captura.js';
import { icon } from '../icons.js';

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function bannerRespaldo() {
  const ult = state.settings.ultimoRespaldo;
  const dias = ult ? Math.floor((Date.now() - Date.parse(ult)) / 86400000) : null;
  if (dias !== null && dias <= 7) return '';
  const msg = dias === null ? 'Aún no has hecho ningún respaldo.' : `Han pasado ${dias} días desde tu último respaldo.`;
  return `<div class="banner warn">${icon('alert')}<div><strong>${esc(msg)}</strong><br>Si borras la app o el dispositivo se queda sin espacio, perderías tus datos.</div>
    <button type="button" class="btn small primary" data-action="exportar">Respaldar ahora</button></div>`;
}

export function render() {
  const hoy = todayISO();
  const man = addDays(hoy, 1);
  const plazos = state.plazos.filter((p) => p.estatus !== 'cumplido').map((p) => ({ p, ...infoPlazo(p) })).filter((x) => x.calc);

  const dia = (f) => {
    const items = [
      ...state.audiencias.filter((a) => a.fecha === f).sort(byFechaHora).map((a) => rowAudiencia(a, { showDate: false })),
      ...plazos.filter((x) => x.calc.vencimiento === f).map((x) => rowPlazo(x.p)),
      ...state.tareas.filter((t) => !t.completada && t.fechaLimite === f).sort(byTarea).map(rowTarea),
    ];
    return items.length ? `<div class="list">${items.join('')}</div>` : empty('Sin audiencias, vencimientos ni tareas.');
  };

  const porVencer = plazos
    .filter((x) => x.calc.vencimiento !== hoy && x.calc.vencimiento !== man && (x.sem === 'rojo' || x.sem === 'ambar'))
    .sort((a, b) => a.calc.vencimiento.localeCompare(b.calc.vencimiento));
  const urgentes = state.tareas
    .filter((t) => !t.completada && t.fechaLimite !== hoy && t.fechaLimite !== man && (t.prioridad === 'alta' || (t.fechaLimite && t.fechaLimite < hoy)))
    .sort(byTarea);
  const bandeja = state.notas.filter((n) => !n.expedienteId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const html = `<div class="page">
    <div class="hero"><h1>${saludo()}</h1><p>${esc(fmtFechaLarga(hoy))}</p></div>
    ${campoInicio()}
    ${bannerRespaldo()}
    ${state.pendientes.length ? pendientesCard() : ''}
    <div class="grid">
      ${section('Hoy', dia(hoy))}
      ${section('Mañana', dia(man))}
      ${section('Plazos por vencer', porVencer.length ? `<div class="list">${porVencer.map((x) => rowPlazo(x.p)).join('')}</div>` : empty('Ningún plazo en ámbar o rojo.'), '<a class="btn small" href="#/plazos">Ver todos</a>')}
      ${section('Tareas urgentes', urgentes.length ? `<div class="list">${urgentes.map(rowTarea).join('')}</div>` : empty('Sin tareas de prioridad alta o vencidas.'), '<a class="btn small" href="#/tareas">Ver todas</a>')}
    </div>
    ${section(`Bandeja de entrada${bandeja.length ? ` (${bandeja.length})` : ''}`,
      bandeja.length ? `<div class="list">${bandeja.map((n) => rowNota(n, { inbox: true })).join('')}</div>` : empty('Vacía. Usa el botón + para capturar una idea en segundos.'),
      `<button type="button" class="btn small" data-action="captura">${icon('plus')}<span>Capturar</span></button>`)}
    <p class="footnote">${esc(plural(state.expedientes.length, 'expediente', 'expedientes'))} · ${esc(plural(state.audiencias.filter((a) => a.fecha >= hoy).length, 'audiencia próxima', 'audiencias próximas'))} · ${esc(plural(plazos.length, 'plazo pendiente', 'plazos pendientes'))}</p>
  </div>`;
  return { title: 'Inicio', html };
}
