import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ART19_LA, makeCalendar, calcularPlazo } from '../js/plazos.js';
import { eventoAudiencia, eventosPlazo, googleUrl, ics, trigger, eventHash } from '../js/calendar.js';

const cal = makeCalendar({ anuales: ART19_LA });
const s = { modoDiscreto: true, alertasAudiencia: [1440, 120], duracionAudiencia: 120, horaAviso: '09:00' };
const exp = { id: 'e1', numero: '123/2026', cliente: 'Persona Confidencial', organo: 'Juzgado X', contraparte: 'MP' };
const aud = { id: 'a1', tipo: 'Etapa intermedia', fecha: '2026-11-03', hora: '10:30', duracion: 90, sede: 'Sala 4' };

test('modo discreto: sin nombre del cliente en título ni descripción', () => {
  const ev = eventoAudiencia(aud, exp, s);
  assert.equal(ev.title, 'Etapa intermedia — 123/2026');
  assert.ok(!ev.description.includes('Persona Confidencial'));
  assert.ok(!googleUrl(ev).includes('Confidencial'));
  const abierto = eventoAudiencia(aud, exp, { ...s, modoDiscreto: false });
  assert.ok(abierto.title.includes('Persona Confidencial'));
});

test('enlace de Google Calendar con fechas, sede y zona horaria', () => {
  const u = new URL(googleUrl(eventoAudiencia(aud, exp, s)));
  assert.equal(u.hostname, 'calendar.google.com');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('dates'), '20261103T103000/20261103T120000');
  assert.equal(u.searchParams.get('location'), 'Sala 4');
  assert.equal(u.searchParams.get('ctz'), 'America/Mexico_City');
});

test('plazo: evento de día completo, aviso el día hábil anterior y recordatorio opcional', () => {
  const p = { id: 'p1', actuacion: 'Recurso de revisión', notificacion: '2026-11-04', dias: 10, tipoDias: 'habiles', surte: 'siguiente', recordatorio2: true };
  const calc = calcularPlazo(cal, { notificacion: p.notificacion, dias: p.dias });
  assert.equal(calc.vencimiento, '2026-11-19');
  const evs = eventosPlazo(p, exp, s, cal, calc);
  assert.equal(evs.venc.allDay, true);
  assert.ok(evs.venc.description.startsWith('VERIFICAR CÓMPUTO'));
  assert.equal(evs.aviso.fecha, '2026-11-18');
  assert.equal(evs.rec2.fecha, '2026-11-17');
  // Alarmas relativas a la medianoche del vencimiento: 9:00 del día anterior = 15 h antes.
  assert.deepEqual(evs.venc.alarms.map((a) => a.min), [900, 2340]);
  const g = new URL(googleUrl(evs.venc));
  assert.equal(g.searchParams.get('dates'), '20261119/20261120');
});

test('aviso de un plazo que vence en lunes cae el viernes', () => {
  const p = { id: 'p2', actuacion: 'Agravios', notificacion: '2026-10-27', dias: 3, tipoDias: 'habiles', surte: 'siguiente' };
  const calc = calcularPlazo(cal, { notificacion: p.notificacion, dias: p.dias });
  assert.equal(calc.vencimiento, '2026-11-02');
  const evs = eventosPlazo(p, exp, s, cal, calc);
  assert.equal(evs.aviso.fecha, '2026-10-30');
  assert.equal(evs.rec2, undefined);
  assert.equal(trigger(evs.venc.alarms[0].min), '-P2DT15H');
});

test('archivo .ics válido con alertas, CRLF y líneas plegadas', () => {
  const ev = eventoAudiencia({ ...aud, sede: 'Sala 4, edificio "B"; planta baja' }, exp, { ...s, modoDiscreto: false });
  const txt = ics([ev], new Date('2026-10-26T12:00:00Z'));
  assert.ok(txt.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(txt.endsWith('END:VCALENDAR\r\n'));
  assert.ok(txt.includes('DTSTART;TZID=America/Mexico_City:20261103T103000'));
  assert.ok(txt.includes('TRIGGER:-P1D'));
  assert.ok(txt.includes('TRIGGER:-PT2H'));
  assert.ok(txt.includes('LOCATION:Sala 4\\, edificio "B"\\; planta baja'));
  const enc = new TextEncoder();
  for (const line of txt.split('\r\n')) assert.ok(enc.encode(line).length <= 75, `línea larga: ${line}`);
  assert.ok(!/[^\r]\n/.test(txt));
});

test('la huella cambia cuando cambia el evento', () => {
  const a = eventoAudiencia(aud, exp, s);
  const b = eventoAudiencia({ ...aud, hora: '11:00' }, exp, s);
  assert.notEqual(eventHash(a), eventHash(b));
  assert.equal(eventHash(a), eventHash(eventoAudiencia(aud, exp, s)));
});

test('el service worker guarda todos los archivos de la app', () => {
  const root = new URL('..', import.meta.url).pathname;
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean));
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [relative(root, p)];
  });
  const files = ['index.html', 'manifest.json', ...walk(join(root, 'css')), ...walk(join(root, 'js')), ...walk(join(root, 'icons'))];
  for (const f of files) assert.ok(listed.has(f), `falta en sw.js: ${f}`);
  for (const f of listed) assert.ok(files.includes(f), `sw.js lista un archivo inexistente: ${f}`);
});
