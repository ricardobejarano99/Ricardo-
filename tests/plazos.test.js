import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ART19_LA, makeCalendar, calcularPlazo, diasRestantes, semaforo, nextHabil, prevHabil, desglose,
} from '../js/plazos.js';

const cal = makeCalendar({ anuales: ART19_LA, fechas: [], rangos: [] });

test('fines de semana y art. 19 LA son inhábiles', () => {
  assert.equal(cal.esHabil('2026-10-24'), false); // sábado
  assert.equal(cal.esHabil('2026-10-25'), false); // domingo
  assert.equal(cal.esHabil('2026-11-20'), false); // viernes 20 de noviembre
  assert.equal(cal.esHabil('2026-10-26'), true);
});

test('días hábiles: surte efectos al día hábil siguiente y salta el 20 de noviembre', () => {
  // Notificación lunes 26/10/2026; surte efectos martes 27; corre del miércoles 28.
  const r15 = calcularPlazo(cal, { notificacion: '2026-10-26', dias: 15, tipo: 'habiles', surte: 'siguiente' });
  assert.equal(r15.efectos, '2026-10-27');
  assert.equal(r15.inicio, '2026-10-28');
  assert.equal(r15.vencimiento, '2026-11-17');
  // Día 17 = jueves 19; viernes 20 inhábil; día 18 = lunes 23.
  const r = calcularPlazo(cal, { notificacion: '2026-10-26', dias: 18, tipo: 'habiles', surte: 'siguiente' });
  assert.equal(r.vencimiento, '2026-11-23');
  assert.equal(r.computados.length, 18);
  assert.ok(!r.computados.includes('2026-11-20'));
});

test('surte efectos el mismo día', () => {
  const r = calcularPlazo(cal, { notificacion: '2026-10-26', dias: 3, tipo: 'habiles', surte: 'mismo' });
  assert.deepEqual(r.computados, ['2026-10-27', '2026-10-28', '2026-10-29']);
});

test('notificación en viernes: surte efectos el lunes', () => {
  const r = calcularPlazo(cal, { notificacion: '2026-10-23', dias: 1, tipo: 'habiles', surte: 'siguiente' });
  assert.equal(r.efectos, '2026-10-26');
  assert.equal(r.vencimiento, '2026-10-27');
});

test('días naturales que vencen en inhábil se recorren si se pide', () => {
  // Surte efectos el 27/10; 4 días naturales -> sábado 31/10 -> lunes 2/11.
  const a = calcularPlazo(cal, { notificacion: '2026-10-26', dias: 4, tipo: 'naturales', surte: 'siguiente', recorrer: true });
  assert.equal(a.vencimiento, '2026-11-02');
  assert.equal(a.recorrido, true);
  const b = calcularPlazo(cal, { notificacion: '2026-10-26', dias: 4, tipo: 'naturales', surte: 'siguiente', recorrer: false });
  assert.equal(b.vencimiento, '2026-10-31');
});

test('rangos y fechas específicas editables', () => {
  const c = makeCalendar({ anuales: ART19_LA, fechas: [{ fecha: '2026-11-02', desc: 'Suspensión' }], rangos: [{ desde: '2026-12-16', hasta: '2026-12-31', desc: 'Vacaciones' }] });
  assert.equal(c.motivo('2026-11-02'), 'Suspensión');
  assert.equal(c.motivo('2026-12-21'), 'Vacaciones');
  assert.equal(nextHabil(c, '2026-12-15'), '2027-01-04'); // 1 de enero también inhábil
});

test('aviso del día hábil anterior y recordatorio 2 días antes', () => {
  // Vence lunes 23/11/2026: el viernes 20 es inhábil, el aviso cae el jueves 19.
  assert.equal(prevHabil(cal, '2026-11-23'), '2026-11-19');
  assert.equal(prevHabil(cal, '2026-11-19'), '2026-11-18');
});

test('días restantes y semáforo', () => {
  assert.equal(diasRestantes(cal, '2026-10-26', '2026-10-26'), 0);
  assert.equal(diasRestantes(cal, '2026-10-30', '2026-11-02'), 1); // viernes -> lunes
  assert.equal(diasRestantes(cal, '2026-10-28', '2026-10-26'), -2);
  assert.equal(diasRestantes(cal, '2026-10-26', '2026-11-02', 'naturales'), 7);
  assert.equal(semaforo(10), 'verde');
  assert.equal(semaforo(5), 'ambar');
  assert.equal(semaforo(1), 'rojo');
  assert.equal(semaforo(-3), 'rojo');
});

test('datos inválidos no calculan', () => {
  assert.equal(calcularPlazo(cal, { notificacion: '', dias: 5 }), null);
  assert.equal(calcularPlazo(cal, { notificacion: '2026-10-26', dias: 0 }), null);
  assert.equal(calcularPlazo(cal, { notificacion: '2026-10-26', dias: 2.5 }), null);
});

test('desglose marca días contados e inhábiles', () => {
  const r = calcularPlazo(cal, { notificacion: '2026-11-18', dias: 2, tipo: 'habiles', surte: 'siguiente' });
  const d = desglose(cal, r);
  assert.equal(r.efectos, '2026-11-19');
  assert.deepEqual(d.map((x) => [x.fecha, x.n]), [['2026-11-20', null], ['2026-11-21', null], ['2026-11-22', null], ['2026-11-23', 1], ['2026-11-24', 2]]);
});
