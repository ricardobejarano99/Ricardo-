// Cómputo de plazos procesales. Funciones puras: las fechas viajan como 'AAAA-MM-DD'.

// Días inhábiles de fecha fija del artículo 19 de la Ley de Amparo (editables en Ajustes).
export const ART19_LA = [
  ['01-01', '1 de enero'],
  ['02-05', '5 de febrero'],
  ['03-21', '21 de marzo'],
  ['05-01', '1 de mayo'],
  ['05-05', '5 de mayo'],
  ['09-14', '14 de septiembre'],
  ['09-16', '16 de septiembre'],
  ['10-12', '12 de octubre'],
  ['11-20', '20 de noviembre'],
  ['12-25', '25 de diciembre'],
].map(([md, desc]) => ({ md, desc: `${desc} (art. 19 LA)` }));

export const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const toISO = (dt) => dt.toISOString().slice(0, 10);

export function addDays(s, n) {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export const weekday = (s) => parseISO(s).getUTCDay();

export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

export function makeCalendar(inh = {}) {
  const anuales = new Map((inh.anuales || []).map((a) => [a.md, a.desc]));
  const fechas = new Map((inh.fechas || []).map((f) => [f.fecha, f.desc]));
  const rangos = (inh.rangos || []).filter((r) => r.desde && r.hasta);

  function motivo(s) {
    const w = weekday(s);
    if (w === 6) return 'Sábado';
    if (w === 0) return 'Domingo';
    if (fechas.has(s)) return fechas.get(s) || 'Día inhábil';
    const md = s.slice(5);
    if (anuales.has(md)) return anuales.get(md) || 'Día inhábil';
    for (const r of rangos) if (s >= r.desde && s <= r.hasta) return r.desc || 'Periodo inhábil';
    return null;
  }

  return { motivo, esHabil: (s) => motivo(s) === null };
}

const LIMITE = 3700;

export function nextHabil(cal, s) {
  let d = s;
  for (let i = 0; i < LIMITE; i++) {
    d = addDays(d, 1);
    if (cal.esHabil(d)) return d;
  }
  throw new Error('No hay días hábiles en el calendario');
}

export function prevHabil(cal, s) {
  let d = s;
  for (let i = 0; i < LIMITE; i++) {
    d = addDays(d, -1);
    if (cal.esHabil(d)) return d;
  }
  throw new Error('No hay días hábiles en el calendario');
}

// surte: 'siguiente' = la notificación surte efectos el día hábil siguiente; 'mismo' = el mismo día.
// El cómputo corre a partir del día siguiente a aquel en que surte efectos.
export function calcularPlazo(cal, { notificacion, dias, tipo = 'habiles', surte = 'siguiente', recorrer = true }) {
  dias = Number(dias);
  if (!isISODate(notificacion) || !Number.isInteger(dias) || dias < 1 || dias > 3650) return null;
  const efectos = surte === 'siguiente' ? nextHabil(cal, notificacion) : notificacion;
  const computados = [];
  let d = efectos;
  if (tipo === 'naturales') {
    for (let i = 0; i < dias; i++) { d = addDays(d, 1); computados.push(d); }
  } else {
    for (let i = 0; i < dias; i++) { d = nextHabil(cal, d); computados.push(d); }
  }
  let vencimiento = d;
  if (tipo === 'naturales' && recorrer && !cal.esHabil(d)) vencimiento = nextHabil(cal, d);
  return { efectos, inicio: computados[0], vencimiento, computados, recorrido: vencimiento !== d };
}

// Días restantes contados desde mañana hasta el vencimiento (0 = vence hoy, negativo = vencido).
export function diasRestantes(cal, hoy, venc, tipo = 'habiles') {
  if (venc === hoy) return 0;
  if (venc < hoy) return -diffDays(venc, hoy);
  if (tipo === 'naturales') return diffDays(hoy, venc);
  let n = 0;
  for (let d = addDays(hoy, 1); d <= venc; d = addDays(d, 1)) if (cal.esHabil(d)) n++;
  return n;
}

export function semaforo(rest, { ambar = 5, rojo = 1 } = {}) {
  if (rest <= rojo) return 'rojo';
  if (rest <= ambar) return 'ambar';
  return 'verde';
}

// Día por día, desde que surte efectos hasta el vencimiento, para verificar el cómputo.
export function desglose(cal, calc) {
  const num = new Map(calc.computados.map((d, i) => [d, i + 1]));
  const out = [];
  for (let d = addDays(calc.efectos, 1); d <= calc.vencimiento; d = addDays(d, 1)) {
    out.push({ fecha: d, n: num.get(d) ?? null, motivo: cal.motivo(d) });
  }
  return out;
}
