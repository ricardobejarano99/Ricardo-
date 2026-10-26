// Formularios de alta y edición, y la captura rápida.
import * as store from '../store.js';
import { state } from '../store.js';
import { openForm, confirmDialog, toast, todayISO, esc, fmtFechaLarga } from '../util.js';
import { TIPOS_EXP, ESTATUS_EXP, ETAPAS, TIPOS_AUD, PRIORIDADES } from '../catalogos.js';
import { calcularPlazo, diasRestantes, semaforo, prevHabil } from '../plazos.js';
import { calendario, expById, restanteTexto, SEM_LABEL } from './common.js';
import { register } from '../actions.js';

function expOptions(none = '— Sin expediente —') {
  const opts = state.expedientes
    .slice()
    .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }))
    .map((e) => [e.id, `${e.numero} — ${e.tipo}`]);
  return none ? [['', none], ...opts] : opts;
}

const datalist = (id, items) => `<datalist id="${id}">${items.map((i) => `<option value="${esc(i)}">`).join('')}</datalist>`;

export function editarExpediente(exp) {
  const isNew = !exp;
  const base = exp ? { ...exp } : { tipo: TIPOS_EXP[0], estatus: 'Activo' };
  openForm({
    title: isNew ? 'Nuevo expediente' : 'Editar expediente',
    values: base,
    fields: [
      { name: 'numero', label: 'Número de causa o juicio', required: true, placeholder: 'Ej. 123/2026' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS_EXP },
      { name: 'organo', label: 'Órgano jurisdiccional', placeholder: 'Ej. Juzgado Tercero de Distrito…' },
      { name: 'cliente', label: 'Cliente' },
      { name: 'contraparte', label: 'Contraparte o autoridad responsable' },
      { name: 'etapa', label: 'Etapa procesal', list: 'dl-etapas', placeholder: 'Escribe o elige' },
      { name: 'estatus', label: 'Estatus', type: 'select', options: ESTATUS_EXP },
      { name: 'notas', label: 'Notas', type: 'textarea', rows: 6 },
    ],
    extra: datalist('dl-etapas', ETAPAS),
    onSubmit: async (data) => {
      const saved = await store.save('expedientes', { ...base, ...data });
      toast('Expediente guardado');
      if (isNew) location.hash = `#/expediente/${saved.id}`;
    },
    onDelete: isNew ? null : async () => {
      const n = store.vinculados(exp.id).length;
      const ok = await confirmDialog('¿Eliminar este expediente?', {
        ok: 'Eliminar', danger: true,
        detail: n ? `También se eliminarán ${n} registro(s) vinculados: audiencias, plazos, tareas y notas.` : 'Esta acción no se puede deshacer.',
      });
      if (!ok) return false;
      await store.removeExpediente(exp.id);
      location.hash = '#/expedientes';
      toast('Expediente eliminado');
      return true;
    },
  });
}

export function editarAudiencia(a, expedienteId = '', fecha = todayISO()) {
  const isNew = !a;
  const base = a ? { ...a } : {
    fecha, hora: '10:00', duracion: state.settings.duracionAudiencia, tipo: TIPOS_AUD[0], expedienteId,
  };
  openForm({
    title: isNew ? 'Nueva audiencia' : 'Editar audiencia',
    values: base,
    fields: [
      { name: 'tipo', label: 'Tipo de audiencia', type: 'select', options: TIPOS_AUD },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'hora', label: 'Hora', type: 'time', required: true },
      { name: 'duracion', label: 'Duración estimada (minutos)', type: 'number', min: 15, inputmode: 'numeric' },
      { name: 'sede', label: 'Sede', placeholder: 'Ej. Sala 4, Centro de Justicia Penal…' },
      { name: 'expedienteId', label: 'Expediente', type: 'select', options: expOptions() },
      { name: 'notas', label: 'Notas', type: 'textarea', rows: 4 },
    ],
    onSubmit: async (data) => {
      const saved = await store.save('audiencias', { ...base, ...data });
      toast('Audiencia guardada');
      if (isNew) location.hash = `#/audiencia/${saved.id}`;
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmDialog('¿Eliminar esta audiencia?', { ok: 'Eliminar', danger: true }))) return false;
      await store.removeMany([['audiencias', a.id], ...state.pendientes.filter((p) => p.refId === a.id).map((p) => ['pendientes', p.id])]);
      history.back();
      toast('Audiencia eliminada');
      return true;
    },
  });
}

function previewPlazo(d) {
  const cal = calendario();
  const calc = calcularPlazo(cal, { notificacion: d.notificacion, dias: d.dias, tipo: d.tipoDias, surte: d.surte, recorrer: d.recorrer });
  if (!calc) return '<p class="muted">Captura la fecha de notificación y el número de días para calcular el vencimiento.</p>';
  const rest = diasRestantes(cal, todayISO(), calc.vencimiento, d.tipoDias);
  const sem = semaforo(rest, state.settings.semaforo);
  const aviso = prevHabil(cal, calc.vencimiento);
  return `<div class="calc sem-border-${sem}">
    <div class="calc-label">Vencimiento</div>
    <div class="calc-date">${esc(fmtFechaLarga(calc.vencimiento))}</div>
    <div class="calc-row"><span class="dot sem-${sem}"></span><span class="sem-text sem-${sem}">${esc(restanteTexto(rest, d.tipoDias))} · ${SEM_LABEL[sem]}</span></div>
    <div class="calc-warn">Verificar cómputo</div>
    <div class="calc-detail">Surte efectos: ${esc(fmtFechaLarga(calc.efectos))}<br>Primer día del cómputo: ${esc(fmtFechaLarga(calc.inicio))}${calc.recorrido ? '<br>El último día era inhábil: se recorrió al siguiente hábil.' : ''}<br>Aviso: ${esc(fmtFechaLarga(aviso))}, ${esc(state.settings.horaAviso)} h</div>
  </div>`;
}

export function editarPlazo(p, expedienteId = '') {
  const isNew = !p;
  const base = p ? { ...p } : {
    notificacion: todayISO(), dias: 15, tipoDias: 'habiles', surte: 'siguiente', recorrer: true, recordatorio2: false, estatus: 'pendiente', expedienteId,
  };
  openForm({
    title: isNew ? 'Nuevo plazo' : 'Editar plazo',
    values: base,
    fields: [
      { name: 'actuacion', label: 'Actuación', required: true, placeholder: 'Ej. Interponer recurso de revisión', hint: 'En modo discreto este texto aparece en el calendario: no incluyas nombres.' },
      { name: 'expedienteId', label: 'Expediente', type: 'select', options: expOptions() },
      { name: 'notificacion', label: 'Fecha de notificación', type: 'date', required: true },
      { name: 'surte', label: 'La notificación surte efectos', type: 'select', options: [['siguiente', 'Al día hábil siguiente'], ['mismo', 'El mismo día']] },
      { name: 'dias', label: 'Número de días', type: 'number', min: 1, max: 3650, inputmode: 'numeric', required: true },
      { name: 'tipoDias', label: 'Tipo de días', type: 'segmented', options: [['habiles', 'Hábiles'], ['naturales', 'Naturales']] },
      { name: 'recorrer', label: 'Si vence en día inhábil, recorrer al siguiente hábil', type: 'checkbox', hint: 'Solo aplica a plazos en días naturales.' },
      { name: 'recordatorio2', label: 'Recordatorio adicional 2 días hábiles antes', type: 'checkbox', hint: 'El aviso del día hábil anterior siempre se incluye.' },
      { name: 'estatus', label: 'Estatus', type: 'select', options: [['pendiente', 'Pendiente'], ['cumplido', 'Cumplido / presentado']] },
      { name: 'notas', label: 'Notas', type: 'textarea', rows: 3 },
    ],
    preview: previewPlazo,
    onSubmit: async (data) => {
      if (!calcularPlazo(calendario(), { notificacion: data.notificacion, dias: data.dias, tipo: data.tipoDias })) {
        toast('Revisa la fecha y el número de días (entero, de 1 a 3650).');
        return false;
      }
      const saved = await store.save('plazos', { ...base, ...data });
      toast('Plazo guardado');
      if (isNew) location.hash = `#/plazo/${saved.id}`;
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmDialog('¿Eliminar este plazo?', { ok: 'Eliminar', danger: true }))) return false;
      await store.removeMany([['plazos', p.id], ...state.pendientes.filter((x) => x.refId === p.id).map((x) => ['pendientes', x.id])]);
      history.back();
      toast('Plazo eliminado');
      return true;
    },
  });
}

export function editarTarea(t, expedienteId = '') {
  const isNew = !t;
  const base = t ? { ...t } : { prioridad: 'media', completada: false, expedienteId };
  openForm({
    title: isNew ? 'Nueva tarea' : 'Editar tarea',
    values: base,
    fields: [
      { name: 'titulo', label: 'Tarea', required: true, placeholder: 'Ej. Preparar contrainterrogatorio' },
      { name: 'expedienteId', label: 'Expediente', type: 'select', options: expOptions() },
      { name: 'prioridad', label: 'Prioridad', type: 'segmented', options: PRIORIDADES },
      { name: 'fechaLimite', label: 'Fecha límite', type: 'date' },
      { name: 'completada', label: 'Completada', type: 'checkbox' },
      { name: 'notas', label: 'Notas', type: 'textarea', rows: 3 },
    ],
    onSubmit: async (data) => {
      await store.save('tareas', { ...base, ...data });
      toast('Tarea guardada');
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmDialog('¿Eliminar esta tarea?', { ok: 'Eliminar', danger: true }))) return false;
      await store.remove('tareas', t.id);
      return true;
    },
  });
}

export function editarNota(n, expedienteId = '') {
  const isNew = !n;
  const base = n ? { ...n } : { expedienteId };
  openForm({
    title: isNew ? 'Nueva nota' : 'Nota',
    values: base,
    fields: [
      { name: 'texto', label: 'Texto', type: 'textarea', rows: 7, required: true },
      { name: 'expedienteId', label: 'Expediente', type: 'select', options: expOptions('— Bandeja de entrada —') },
    ],
    onSubmit: async (data) => {
      await store.save('notas', { ...base, ...data, expedienteId: data.expedienteId || null });
      toast('Nota guardada');
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmDialog('¿Eliminar esta nota?', { ok: 'Eliminar', danger: true }))) return false;
      await store.remove('notas', n.id);
      return true;
    },
  });
}

export function asignarNota(n) {
  if (!state.expedientes.length) { toast('Primero crea un expediente.'); return; }
  openForm({
    title: 'Asignar a expediente',
    submitLabel: 'Asignar',
    values: { expedienteId: '' },
    fields: [
      { html: `<blockquote class="quote">${esc(n.texto)}</blockquote>` },
      { name: 'expedienteId', label: 'Expediente', type: 'select', required: true, options: expOptions('— Elige un expediente —') },
    ],
    onSubmit: async ({ expedienteId }) => {
      await store.save('notas', { ...n, expedienteId });
      toast(`Nota asignada a ${expById(expedienteId)?.numero || 'expediente'}`);
    },
  });
}

export function captura() {
  const m = openForm({
    title: 'Captura rápida',
    values: {},
    fields: [{ name: 'texto', label: 'Idea, pendiente o recordatorio', type: 'textarea', rows: 6, required: true, placeholder: 'Escribe… quedará en la bandeja de entrada.' }],
    onSubmit: async ({ texto }) => {
      await store.save('notas', { texto, expedienteId: null });
      toast('Guardado en la bandeja de entrada');
    },
  });
  m.form.querySelector('textarea').focus();
}

register({
  captura: () => captura(),
  'nuevo-expediente': () => editarExpediente(),
  'editar-expediente': (el) => editarExpediente(store.get('expedientes', el.dataset.id)),
  'nueva-audiencia': (el) => editarAudiencia(null, el.dataset.exp || ''),
  'editar-audiencia': (el) => editarAudiencia(store.get('audiencias', el.dataset.id)),
  'nuevo-plazo': (el) => editarPlazo(null, el.dataset.exp || ''),
  'editar-plazo': (el) => editarPlazo(store.get('plazos', el.dataset.id)),
  'nueva-tarea': (el) => editarTarea(null, el.dataset.exp || ''),
  'editar-tarea': (el) => { const t = store.get('tareas', el.dataset.id); if (t) editarTarea(t); },
  'nueva-nota': (el) => editarNota(null, el.dataset.exp || ''),
  'editar-nota': (el) => { const n = store.get('notas', el.dataset.id); if (n) editarNota(n); },
  'asignar-nota': (el) => { const n = store.get('notas', el.dataset.id); if (n) asignarNota(n); },
  'toggle-tarea': async (el) => {
    const t = store.get('tareas', el.dataset.id);
    if (!t) return;
    await store.save('tareas', { ...t, completada: el.checked });
    if (el.checked) toast('Tarea completada');
  },
  'toggle-plazo': async (el) => {
    const p = store.get('plazos', el.dataset.id);
    if (!p) return;
    const estatus = p.estatus === 'cumplido' ? 'pendiente' : 'cumplido';
    await store.save('plazos', { ...p, estatus });
    toast(estatus === 'cumplido' ? 'Plazo marcado como cumplido' : 'Plazo marcado como pendiente');
  },
});
