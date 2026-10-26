// Datos de ejemplo ficticios (marcados con seed: true para poder borrarlos de un toque).
import * as store from './store.js';
import { uid, todayISO } from './util.js';
import { addDays } from './plazos.js';

export async function cargarEjemplo() {
  const hoy = todayISO();
  const d = (n) => addDays(hoy, n);
  const ids = [uid(), uid(), uid(), uid()];
  const S = { seed: true };

  await store.saveMany('expedientes', [
    { ...S, id: ids[0], numero: '123/2026', tipo: 'Causa penal', organo: 'Juzgado de Control de Ejemplo, Distrito Judicial Ficticio', cliente: 'Cliente Ejemplo Uno', contraparte: 'Ministerio Público (ficticio)', etapa: 'Investigación complementaria', estatus: 'Activo', notas: 'Datos de ejemplo. Plazo de investigación complementaria por definir en audiencia.' },
    { ...S, id: ids[1], numero: '456/2026', tipo: 'Amparo indirecto', organo: 'Juzgado Primero de Distrito de Ejemplo', cliente: 'Cliente Ejemplo Dos', contraparte: 'Juez de Control (autoridad responsable ficticia)', etapa: 'Informes justificados', estatus: 'Activo', notas: 'Acto reclamado: orden de aprehensión (ejemplo). Suspensión provisional concedida.' },
    { ...S, id: ids[2], numero: '78/2026', tipo: 'Amparo directo', organo: 'Tribunal Colegiado de Ejemplo', cliente: 'Cliente Ejemplo Tres', contraparte: 'Tribunal de Enjuiciamiento (autoridad responsable ficticia)', etapa: 'Demanda presentada', estatus: 'En espera', notas: '' },
    { ...S, id: ids[3], numero: 'Toca 90/2026', tipo: 'Recurso', organo: 'Sala de Apelación de Ejemplo', cliente: 'Cliente Ejemplo Uno', contraparte: 'Ministerio Público (ficticio)', etapa: 'Apelación', estatus: 'Activo', notas: 'Apelación contra auto de vinculación a proceso (ejemplo).' },
  ]);

  await store.saveMany('audiencias', [
    { ...S, expedienteId: ids[0], tipo: 'Revisión de medidas cautelares', fecha: hoy, hora: '12:00', duracion: 90, sede: 'Sala 3, Centro de Justicia de Ejemplo', notas: '' },
    { ...S, expedienteId: ids[1], tipo: 'Audiencia constitucional', fecha: d(1), hora: '09:30', duracion: 60, sede: 'Juzgado Primero de Distrito de Ejemplo', notas: 'Llevar pruebas documentales.' },
    { ...S, expedienteId: ids[3], tipo: 'Apelación', fecha: d(4), hora: '11:00', duracion: 120, sede: 'Sala de Apelación de Ejemplo', notas: '' },
    { ...S, expedienteId: ids[0], tipo: 'Cierre de investigación', fecha: d(15), hora: '10:00', duracion: 120, sede: 'Sala 1, Centro de Justicia de Ejemplo', notas: '' },
  ]);

  await store.saveMany('plazos', [
    { ...S, expedienteId: ids[1], actuacion: 'Ampliación de demanda', notificacion: d(-12), dias: 15, tipoDias: 'habiles', surte: 'siguiente', recorrer: true, recordatorio2: true, estatus: 'pendiente', notas: '' },
    { ...S, expedienteId: ids[3], actuacion: 'Contestar agravios', notificacion: d(-1), dias: 3, tipoDias: 'habiles', surte: 'siguiente', recorrer: true, recordatorio2: false, estatus: 'pendiente', notas: '' },
    { ...S, expedienteId: ids[0], actuacion: 'Ofrecer datos de prueba', notificacion: d(-2), dias: 10, tipoDias: 'habiles', surte: 'mismo', recorrer: true, recordatorio2: false, estatus: 'pendiente', notas: '' },
    { ...S, expedienteId: ids[2], actuacion: 'Presentar demanda de amparo directo', notificacion: d(-40), dias: 15, tipoDias: 'habiles', surte: 'siguiente', recorrer: true, recordatorio2: false, estatus: 'cumplido', notas: 'Presentada (ejemplo).' },
  ]);

  await store.saveMany('tareas', [
    { ...S, expedienteId: ids[1], titulo: 'Preparar alegatos para audiencia constitucional', prioridad: 'alta', fechaLimite: d(1), completada: false, notas: '' },
    { ...S, expedienteId: ids[0], titulo: 'Solicitar copias de la carpeta de investigación', prioridad: 'media', fechaLimite: d(3), completada: false, notas: '' },
    { ...S, expedienteId: ids[3], titulo: 'Revisar registro de audio de la audiencia de vinculación', prioridad: 'alta', fechaLimite: d(-1), completada: false, notas: '' },
    { ...S, expedienteId: null, titulo: 'Actualizar calendario de días inhábiles del CJF', prioridad: 'baja', fechaLimite: null, completada: false, notas: '' },
    { ...S, expedienteId: ids[2], titulo: 'Revisar acuerdo de admisión', prioridad: 'media', fechaLimite: d(-5), completada: true, notas: '' },
  ]);

  await store.saveMany('notas', [
    { ...S, expedienteId: null, texto: 'Revisar si procede ampliar la demanda por el nuevo acto (ejemplo).' },
    { ...S, expedienteId: null, texto: 'Llamar al perito para confirmar disponibilidad (ejemplo).' },
    { ...S, expedienteId: ids[0], texto: 'El MP ofreció tres testigos; preparar líneas de contrainterrogatorio (ejemplo).' },
  ]);
}

export const hayEjemplo = () => store.seedItems().length > 0;
