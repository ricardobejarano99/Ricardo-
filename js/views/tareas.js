import { state } from '../store.js';
import { esc } from '../util.js';
import { rowTarea, empty, addBtn, byTarea } from './common.js';
import { register, registerChange } from '../actions.js';

const vista = { estado: 'pendientes', exp: '' };

export function render() {
  const items = state.tareas
    .filter((t) => vista.estado === 'todas' || (vista.estado === 'completadas' ? t.completada : !t.completada))
    .filter((t) => !vista.exp || (vista.exp === '-' ? !t.expedienteId : t.expedienteId === vista.exp))
    .sort(byTarea);
  const tab = (k, l) => `<label><input type="radio" name="ta-vista" data-action="ta-vista" value="${k}"${vista.estado === k ? ' checked' : ''}><span>${l}</span></label>`;
  const exps = state.expedientes.slice().sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }));
  const sel = `<select data-onchange="ta-exp" aria-label="Expediente">
    <option value="">Todos los expedientes</option><option value="-"${vista.exp === '-' ? ' selected' : ''}>Sin expediente</option>
    ${exps.map((e) => `<option value="${esc(e.id)}"${vista.exp === e.id ? ' selected' : ''}>${esc(e.numero)}</option>`).join('')}</select>`;
  const data = vista.exp && vista.exp !== '-' ? `data-exp="${esc(vista.exp)}"` : '';
  const html = `<div class="page">
    <div class="toolbar"><div class="segmented grow">${tab('pendientes', 'Pendientes')}${tab('completadas', 'Completadas')}${tab('todas', 'Todas')}</div>${addBtn('nueva-tarea', 'Nueva', data)}</div>
    <div class="toolbar">${sel}</div>
    ${items.length ? `<div class="list">${items.map(rowTarea).join('')}</div>` : empty('No hay tareas en esta vista.')}
  </div>`;
  return { title: 'Tareas', html };
}

register({
  'ta-vista': (el) => { vista.estado = el.value; window.dispatchEvent(new Event('rerender')); },
});
registerChange({
  'ta-exp': (el) => { vista.exp = el.value; window.dispatchEvent(new Event('rerender')); },
});
