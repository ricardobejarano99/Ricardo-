// Eventos de calendario: enlace de Google Calendar (sin API ni OAuth) y archivo .ics.
import { addDays, diffDays, prevHabil } from './plazos.js';

export const TZID = 'America/Mexico_City';

const pad = (n) => String(n).padStart(2, '0');
const compact = (fecha, hora) => fecha.replace(/-/g, '') + (hora ? `T${hora.replace(':', '')}00` : '');
const corta = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function addMinutes(fecha, hora, min) {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + min;
  const shift = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return { fecha: addDays(fecha, shift), hora: `${pad(Math.floor(t / 60))}:${pad(t % 60)}` };
}

function datosExpediente(exp, s) {
  const num = exp?.numero || 'Sin expediente';
  const lineas = [`Expediente: ${num}`];
  if (!s.modoDiscreto && exp) {
    if (exp.organo) lineas.push(`Órgano: ${exp.organo}`);
    if (exp.cliente) lineas.push(`Cliente: ${exp.cliente}`);
    if (exp.contraparte) lineas.push(`Contraparte / autoridad: ${exp.contraparte}`);
  }
  return { num, lineas };
}

function titulo(base, num, exp, s) {
  return s.modoDiscreto ? `${base} — ${num}` : [base, num, exp?.cliente].filter(Boolean).join(' — ');
}

export function eventoAudiencia(a, exp, s) {
  const { num, lineas } = datosExpediente(exp, s);
  const title = titulo(a.tipo || 'Audiencia', num, exp, s);
  const hora = a.hora || '09:00';
  return {
    uid: `aud-${a.id}@despacho`,
    title,
    description: [...lineas, '', 'Generado por Despacho.'].join('\n'),
    location: a.sede || '',
    allDay: false,
    fecha: a.fecha,
    hora,
    fin: addMinutes(a.fecha, hora, Number(a.duracion) || s.duracionAudiencia || 120),
    alarms: (s.alertasAudiencia || []).filter((m) => m > 0).map((min) => ({ min, text: title })),
  };
}

// calc = resultado de calcularPlazo(). Devuelve el evento de vencimiento, el aviso del día hábil
// anterior y, si se pidió, el recordatorio 2 días hábiles antes.
export function eventosPlazo(p, exp, s, cal, calc) {
  const { num, lineas } = datosExpediente(exp, s);
  const base = titulo(p.actuacion || 'Plazo', num, exp, s);
  const venc = calc.vencimiento;
  const description = [
    'VERIFICAR CÓMPUTO',
    ...lineas,
    ...(calc.manual
      ? ['Vencimiento capturado manualmente, sin cómputo automático.']
      : [
        `Notificación: ${corta(p.notificacion)}`,
        `Surte efectos: ${corta(calc.efectos)}`,
        `Plazo: ${p.dias} días ${p.tipoDias === 'naturales' ? 'naturales' : 'hábiles'}`,
      ]),
    `Vencimiento: ${corta(venc)}`,
    '',
    calc.manual
      ? 'Fecha de vencimiento capturada en Despacho. Verifíquela contra el calendario oficial de días inhábiles.'
      : 'Cómputo automático de Despacho. Verifíquelo contra el calendario oficial de días inhábiles.',
  ].join('\n');

  const horaAviso = s.horaAviso || '09:00';
  const [hh, mm] = horaAviso.split(':').map(Number);
  const antesDe = (fecha) => diffDays(fecha, venc) * 1440 - (hh * 60 + mm);
  const aviso = prevHabil(cal, venc);
  const rec2 = prevHabil(cal, aviso);

  const tAviso = `Aviso: vence ${corta(venc)} — ${base}`;
  const tRec2 = `Vence en 2 días hábiles (${corta(venc)}) — ${base}`;
  const alarms = [{ min: antesDe(aviso), text: tAviso }];
  if (p.recordatorio2) alarms.push({ min: antesDe(rec2), text: tRec2 });

  const out = {
    venc: { uid: `plazo-${p.id}@despacho`, title: `Vence: ${base}`, description, location: '', allDay: true, fecha: venc, alarms },
    aviso: {
      uid: `plazo-${p.id}-aviso@despacho`, title: tAviso, description, location: '', allDay: false,
      fecha: aviso, hora: horaAviso, fin: addMinutes(aviso, horaAviso, 30), alarms: [{ min: 0, text: tAviso }],
    },
  };
  if (p.recordatorio2) {
    out.rec2 = {
      uid: `plazo-${p.id}-rec2@despacho`, title: tRec2, description, location: '', allDay: false,
      fecha: rec2, hora: horaAviso, fin: addMinutes(rec2, horaAviso, 30), alarms: [{ min: 0, text: tRec2 }],
    };
  }
  return out;
}

export function googleUrl(ev) {
  const dates = ev.allDay
    ? `${compact(ev.fecha)}/${compact(addDays(ev.fecha, 1))}`
    : `${compact(ev.fecha, ev.hora)}/${compact(ev.fin.fecha, ev.fin.hora)}`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates, details: ev.description, ctz: TZID });
  if (ev.location) q.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

const escICS = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// RFC 5545: líneas de máximo 75 octetos.
function fold(line) {
  const enc = new TextEncoder();
  let out = '', cur = '', len = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > limit) { out += `${cur}\r\n `; cur = ''; len = 0; limit = 74; }
    cur += ch;
    len += n;
  }
  return out + cur;
}

// Minutos antes del inicio -> duración ISO 8601 (p. ej. 1440 -> -P1D, 120 -> -PT2H).
export function trigger(min) {
  if (!min) return 'PT0M';
  const sign = min > 0 ? '-' : '';
  let r = Math.abs(min);
  const d = Math.floor(r / 1440); r -= d * 1440;
  const h = Math.floor(r / 60); const m = r - h * 60;
  let t = '';
  if (h) t += `${h}H`;
  if (m) t += `${m}M`;
  return `${sign}P${d ? `${d}D` : ''}${t ? `T${t}` : ''}`;
}

export function ics(events, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Despacho//Agenda juridica//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', `TZID:${TZID}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE',
  ];
  for (const ev of events) {
    L.push('BEGIN:VEVENT', `UID:${ev.uid}`, `DTSTAMP:${stamp}`);
    if (ev.allDay) {
      L.push(`DTSTART;VALUE=DATE:${compact(ev.fecha)}`, `DTEND;VALUE=DATE:${compact(addDays(ev.fecha, 1))}`, 'TRANSP:TRANSPARENT');
    } else {
      L.push(`DTSTART;TZID=${TZID}:${compact(ev.fecha, ev.hora)}`, `DTEND;TZID=${TZID}:${compact(ev.fin.fecha, ev.fin.hora)}`);
    }
    L.push(`SUMMARY:${escICS(ev.title)}`);
    if (ev.location) L.push(`LOCATION:${escICS(ev.location)}`);
    L.push(`DESCRIPTION:${escICS(ev.description)}`);
    for (const a of ev.alarms || []) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escICS(a.text)}`, `TRIGGER:${trigger(a.min)}`, 'END:VALARM');
    }
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return `${L.map(fold).join('\r\n')}\r\n`;
}

// Huella del contenido de un evento, para detectar cambios posteriores a su envío.
export function eventHash(ev) {
  const s = JSON.stringify([ev.title, ev.fecha, ev.hora, ev.fin, ev.location, ev.description, ev.alarms]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
