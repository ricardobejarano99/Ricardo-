import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, faltantes, claveCausa, hoyMX } from '../js/interprete.js';

// Miércoles 28 de octubre de 2026.
const hoy = '2026-10-28';
const expedientes = [
  { id: 'e375', numero: '375/2025' },
  { id: 'e150', numero: 'C.P. 0150/2026' },
];
const I = (t) => interpretar(t, { hoy, expedientes });

test('ejemplo 1: audiencia con causa, fecha escrita y hora', () => {
  const r = I('audiencia intermedia causa 375/2025 el 5 de noviembre a las 10');
  assert.equal(r.tipo, 'audiencia');
  assert.equal(r.tipoAudiencia, 'Etapa intermedia');
  assert.equal(r.fecha, '2026-11-05');
  assert.equal(r.hora, '10:00');
  assert.equal(r.causa, '375/2025');
  assert.equal(r.expedienteId, 'e375');
});

test('ejemplo 2: vencimiento de plazo el viernes', () => {
  const r = I('vence plazo para amparo causa 150/2026 el viernes');
  assert.equal(r.tipo, 'plazo');
  assert.equal(r.fecha, '2026-10-30');
  assert.equal(r.causa, '150/2026');
  assert.equal(r.expedienteId, 'e150');
  assert.equal(r.titulo, 'Plazo para amparo');
});

test('ejemplo 3: tarea mañana', () => {
  const r = I('llamar a cliente mañana');
  assert.equal(r.tipo, 'tarea');
  assert.equal(r.fecha, '2026-10-29');
  assert.equal(r.hora, '');
  assert.equal(r.titulo, 'Llamar a cliente');
});

test('ejemplo 4: tarea pasado mañana 4 pm', () => {
  const r = I('revisar carpeta de investigación pasado mañana 4 pm');
  assert.equal(r.tipo, 'tarea');
  assert.equal(r.fecha, '2026-10-30');
  assert.equal(r.hora, '16:00');
  assert.equal(r.titulo, 'Revisar carpeta de investigación');
});

test('fechas: 5/11, 5 nov, con año, hoy, en N días', () => {
  assert.equal(I('tarea 5/11').fecha, '2026-11-05');
  assert.equal(I('revisar 5 nov').fecha, '2026-11-05');
  assert.equal(I('revisar el 3 de febrero de 2027').fecha, '2027-02-03');
  assert.equal(I('revisar 15/01/2027').fecha, '2027-01-15');
  assert.equal(I('revisar hoy').fecha, hoy);
  assert.equal(I('revisar en 10 días').fecha, '2026-11-07');
});

test('fecha pasada sin año se va al año siguiente con aviso', () => {
  const r = I('revisar 3 de marzo');
  assert.equal(r.fecha, '2027-03-03');
  assert.ok(r.avisos.some((a) => a.includes('2027')));
});

test('próxima semana y días de la semana', () => {
  assert.equal(I('revisar la próxima semana').fecha, '2026-11-02');
  assert.equal(I('revisar el martes de la próxima semana').fecha, '2026-11-03');
  assert.equal(I('revisar el lunes').fecha, '2026-11-02');
  const r = I('revisar el miércoles');
  assert.equal(r.fecha, '2026-11-04');
  assert.ok(r.avisos.some((a) => a.includes('próxima semana')));
});

test('horas: 10:30, 16 hrs, 4 de la tarde, mediodía, 10 y media, palabras', () => {
  assert.equal(I('audiencia mañana a las 10:30').hora, '10:30');
  assert.equal(I('audiencia mañana 16 hrs').hora, '16:00');
  assert.equal(I('audiencia mañana a las 4 de la tarde').hora, '16:00');
  assert.equal(I('audiencia mañana a mediodía').hora, '12:00');
  assert.equal(I('audiencia mañana a las 10 y media').hora, '10:30');
  assert.equal(I('audiencia el cinco de noviembre a las diez').hora, '10:00');
  assert.equal(I('audiencia el cinco de noviembre a las diez').fecha, '2026-11-05');
  assert.equal(I('audiencia mañana a las 9 de la mañana').fecha, '2026-10-29');
  assert.equal(I('audiencia mañana a las 9 de la mañana').hora, '09:00');
});

test('"a las 4" sin indicación se supone por la tarde y avisa', () => {
  const r = I('audiencia mañana a las 4');
  assert.equal(r.hora, '16:00');
  assert.ok(r.avisos.some((a) => a.includes('tarde')));
});

test('causa inexistente: se reporta y no se vincula', () => {
  const r = I('audiencia de vinculación causa 99/2026 mañana a las 11');
  assert.equal(r.causa, '99/2026');
  assert.equal(r.expedienteId, '');
  assert.equal(r.tipoAudiencia, 'Vinculación a proceso');
  assert.ok(r.avisos.some((a) => a.includes('99/2026')));
});

test('lo que no se entiende queda en blanco con aviso', () => {
  const r = I('audiencia');
  assert.equal(r.fecha, '');
  assert.equal(r.hora, '');
  const f = faltantes(r);
  assert.deepEqual(f.filter((x) => x.requerido).map((x) => x.campo), ['fecha', 'hora']);
  // Si el usuario cambia el tipo a tarea, la hora deja de faltar y la fecha es opcional.
  assert.deepEqual(faltantes({ ...r, tipo: 'tarea', titulo: 'x' }).filter((x) => x.requerido), []);
});

test('la causa no se confunde con una fecha y viceversa', () => {
  const r = I('revisar causa 12/2026 el 5/11/2026');
  assert.equal(r.causa, '12/2026');
  assert.equal(r.fecha, '2026-11-05');
});

test('urgente sube la prioridad y no queda en el título', () => {
  const r = I('urgente preparar alegatos mañana');
  assert.equal(r.prioridad, 'alta');
  assert.equal(r.titulo, 'Preparar alegatos');
});

test('claveCausa y hoy en Ciudad de México', () => {
  assert.equal(claveCausa('Toca 090/2026'), '90/2026');
  assert.equal(claveCausa('sin número'), '');
  // 2026-10-29 03:00 UTC = 28 de octubre, 21:00 en CDMX.
  assert.equal(hoyMX(new Date('2026-10-29T03:00:00Z')), '2026-10-28');
});
