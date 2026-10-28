// Interpreta una frase en español ("audiencia intermedia causa 375/2025 el 5 de noviembre a las 10")
// y devuelve los campos de un pendiente. Sin conexión y sin IA: reglas y expresiones regulares.
// Lo que no se reconoce se deja en blanco y se reporta en `avisos`.
import { addDays, weekday, isISODate } from './plazos.js';

export const TZ = 'America/Mexico_City';

// Fecha de hoy en la Ciudad de México (no en la zona del dispositivo).
export function hoyMX(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  }
}

// Minúsculas sin acentos, conservando la longitud para poder mapear posiciones al texto original.
const plano = (s) => s.split('').map((c) => c.normalize('NFD')[0].toLowerCase()).join('');

const NUMEROS = {
  una: 1, uno: 1, un: 1, primero: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, 'treinta y uno': 31, 'treinta y un': 31,
};
const PAL_NUM = Object.keys(NUMEROS).sort((a, b) => b.length - a.length).join('|');

const MESES = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6,
  julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12,
};
const PAL_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

const DIAS_SEM = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Tipos de audiencia: la primera coincidencia gana (lo específico antes que lo general).
const TIPOS_AUDIENCIA = [
  [/control de (la )?detencion/, 'Control de detención'],
  [/formulacion de imputacion|imputacion/, 'Formulación de imputación'],
  [/vinculacion/, 'Vinculación a proceso'],
  [/revision de (las )?medidas/, 'Revisión de medidas cautelares'],
  [/medidas? cautelar/, 'Medidas cautelares'],
  [/cierre de (la )?investigacion/, 'Cierre de investigación'],
  [/intermedia/, 'Etapa intermedia'],
  [/juicio oral|de juicio\b/, 'Juicio oral'],
  [/individualizacion/, 'Individualización de sanciones'],
  [/lectura (de|del) (la )?(sentencia|fallo)/, 'Lectura de sentencia'],
  [/apelacion/, 'Apelación'],
  [/constitucional/, 'Audiencia constitucional'],
  [/incidental|incidente/, 'Audiencia incidental'],
  [/abreviado/, 'Procedimiento abreviado'],
  [/suspension condicional/, 'Suspensión condicional'],
];

const RE_AUDIENCIA = /\b(audiencia|diligencia|juicio oral|intermedia)\b/;
const RE_PLAZO = /\b(vence|vencen|vencimiento|plazo|termino|fenece|ultimo dia)\b/;

const valida = (y, m, d) => {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isISODate(iso) && new Date(`${iso}T00:00:00Z`).getUTCDate() === d && m >= 1 && m <= 12 ? iso : null;
};

// Convierte números escritos con palabras en contextos de hora y fecha (dictado por voz).
function preparar(texto) {
  let t = ` ${texto.trim().replace(/[.!?¡¿]+$/, '')} `;
  const p = plano(t);
  // Sustituciones sobre el texto original usando posiciones del texto plano (misma longitud).
  const reemplazos = [];
  const ctx = [
    new RegExp(`\\b(a la|a las)\\s+(${PAL_NUM})\\b`, 'g'),
    new RegExp(`\\b(${PAL_NUM})\\s+(de\\s+)?(${PAL_MES})\\b`, 'g'),
    new RegExp(`\\b(el|dia)\\s+(${PAL_NUM})\\b(?=\\s+de\\b)`, 'g'),
  ];
  for (const re of ctx) {
    for (const m of p.matchAll(re)) {
      const palabra = re === ctx[1] ? m[1] : m[2];
      const ini = m.index + m[0].indexOf(palabra);
      reemplazos.push([ini, ini + palabra.length, String(NUMEROS[palabra])]);
    }
  }
  reemplazos.sort((a, b) => b[0] - a[0]);
  let prev = Infinity;
  for (const [a, b, s] of reemplazos) {
    if (b > prev) continue;
    t = t.slice(0, a) + s + t.slice(b);
    prev = a;
  }
  // "10 y media" -> "10:30"; "10 y cuarto" -> "10:15"; "1º" -> "1".
  t = t.replace(/\b(\d{1,2})\s+y\s+media\b/gi, '$1:30').replace(/\b(\d{1,2})\s+y\s+cuarto\b/gi, '$1:15');
  t = t.replace(/\b(\d{1,2})\s*[º°]/g, '$1');
  return t.replace(/\s+/g, ' ');
}

export function interpretar(texto, { hoy = hoyMX(), expedientes = [] } = {}) {
  const original = preparar(texto || '');
  const n = plano(original);
  const usados = [];
  const avisos = [];
  const libre = (a, b) => usados.every(([x, y]) => b <= x || a >= y);
  const marcar = (a, b) => usados.push([a, b]);

  // Primera coincidencia que no se encime con lo ya reconocido.
  function buscar(re) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of n.matchAll(g)) {
      if (libre(m.index, m.index + m[0].length)) return m;
    }
    return null;
  }
  const tomar = (m) => { marcar(m.index, m.index + m[0].length); return m; };

  const r = {
    texto: texto || '', tipo: 'tarea', fecha: '', hora: '', causa: '', expedienteId: '',
    titulo: '', tipoAudiencia: '', sede: '', prioridad: 'media', avisos,
  };

  // --- Momento del día ("de la mañana" no es "mañana" el día) -----------------
  let meridiano = null;
  let mm = buscar(/\b(de|en|por) la (manana|tarde|noche)\b/);
  if (mm) { tomar(mm); meridiano = mm[2] === 'manana' ? 'am' : 'pm'; }

  // --- Fecha completa d/m/aaaa ---------------------------------------------
  let fecha = '';
  let explicita = false;
  mm = buscar(/\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/);
  if (mm) {
    tomar(mm);
    const y = mm[3].length === 2 ? 2000 + Number(mm[3]) : Number(mm[3]);
    fecha = valida(y, Number(mm[2]), Number(mm[1])) || '';
    if (!fecha) avisos.push(`La fecha "${mm[0]}" no es válida.`);
    explicita = true;
  }

  // --- Número de causa (###/AAAA) ------------------------------------------
  mm = buscar(/\b(?:(?:causa|expediente|exp|toca|carpeta|c\.?p)\.?\s*(?:penal\s*)?(?:no\.?|num\.?|numero)?\s*)?(\d{1,6})\s*\/\s*((?:19|20)\d{2})\b/);
  if (mm) {
    tomar(mm);
    r.causa = `${Number(mm[1])}/${mm[2]}`;
    const exp = expedientes.find((e) => claveCausa(e.numero) === r.causa);
    if (exp) r.expedienteId = exp.id;
    else avisos.push(`La causa ${r.causa} no coincide con ningún expediente guardado.`);
  }

  // --- "5 de noviembre (de 2026)", "5 nov" ------------------------------------
  const anioPorDefecto = (m, d) => {
    const y = Number(hoy.slice(0, 4));
    const f = valida(y, m, d);
    if (f && f < hoy) {
      const sig = valida(y + 1, m, d);
      avisos.push(`Esa fecha ya pasó este año; usé ${y + 1}. Corrígela si te referías a ${y}.`);
      return sig;
    }
    return f;
  };
  if (!fecha) {
    mm = buscar(new RegExp(`\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s*(?:de\\s+)?(${PAL_MES})\\.?(?:\\s+(?:de|del)?\\s*((?:19|20)\\d{2}))?\\b`));
    if (mm) {
      tomar(mm);
      const d = Number(mm[1]);
      const m = MESES[mm[2]];
      fecha = (mm[3] ? valida(Number(mm[3]), m, d) : anioPorDefecto(m, d)) || '';
      if (!fecha) avisos.push(`La fecha "${mm[0].trim()}" no es válida.`);
      explicita = true;
    }
  }

  // --- "5/11" ---------------------------------------------------------------
  if (!fecha) {
    mm = buscar(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (mm && Number(mm[2]) <= 12) {
      tomar(mm);
      fecha = anioPorDefecto(Number(mm[2]), Number(mm[1])) || '';
      if (!fecha) avisos.push(`La fecha "${mm[0]}" no es válida.`);
      explicita = true;
    }
  }

  // --- Relativas: hoy, mañana, pasado mañana, en N días -----------------------
  if (!fecha) {
    const rel = [
      [/\bpasado\s+manana\b/, () => addDays(hoy, 2)],
      [/\bmanana\b/, () => addDays(hoy, 1)],
      [/\bhoy\b/, () => hoy],
      [/\b(?:en|dentro de)\s+(\d{1,3})\s+dias?\b/, (m) => addDays(hoy, Number(m[1]))],
    ];
    for (const [re, f] of rel) {
      mm = buscar(re);
      if (mm) { tomar(mm); fecha = f(mm); break; }
    }
  }

  // --- Día de la semana y "la próxima semana" ---------------------------------
  const lunesProx = addDays(hoy, ((8 - weekday(hoy)) % 7) || 7);
  const reDia = /\b(?:(?:el|este|esta|para el)\s+)?(?:(proximo)\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+(proximo))?(\s+de\s+la\s+(?:proxima\s+semana|semana\s+que\s+(?:entra|viene)))?\b/;
  mm = buscar(reDia);
  if (mm) {
    tomar(mm);
    const w = DIAS_SEM[mm[2]];
    let f;
    if (mm[4]) {
      f = addDays(lunesProx, (w + 6) % 7);
    } else {
      let diff = (w - weekday(hoy) + 7) % 7;
      if (diff === 0) {
        diff = 7;
        if (!fecha) avisos.push(`Hoy es ${NOMBRE_DIA[w]}: entendí el ${NOMBRE_DIA[w]} de la próxima semana.`);
      }
      f = addDays(hoy, diff);
    }
    if (!fecha) fecha = f;
    else if (explicita && fecha !== f && weekday(fecha) !== w) {
      avisos.push(`Dijiste ${NOMBRE_DIA[w]}, pero la fecha indicada cae en ${NOMBRE_DIA[weekday(fecha)]}. Revisa la fecha.`);
    }
  }
  if (!fecha) {
    mm = buscar(/\b(?:la\s+)?(?:proxima\s+semana|semana\s+que\s+(?:entra|viene))\b/);
    if (mm) {
      tomar(mm);
      fecha = lunesProx;
      avisos.push('"La próxima semana" no indica un día: puse el lunes. Ajústalo si es otro.');
    }
  }

  // --- "el 5" (solo el día) ---------------------------------------------------
  if (!fecha) {
    mm = buscar(/\bel\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?::|\/|hrs?\b|horas\b|am\b|pm\b|a\.?\s?m|p\.?\s?m))/);
    if (mm) {
      const d = Number(mm[1]);
      const [y, m] = hoy.split('-').map(Number);
      let f = valida(y, m, d);
      if (f && f < hoy) f = m === 12 ? valida(y + 1, 1, d) : valida(y, m + 1, d);
      if (f) {
        tomar(mm);
        fecha = f;
        avisos.push(`Solo indicaste el día ${d}: usé el ${d} del mes que corresponde. Confírmalo.`);
      }
    }
  }

  // --- Hora -----------------------------------------------------------------
  let hora = null;
  let mer = null;
  let explicitaHora = false;
  const horaRes = [
    /\b(?:a\s+las?\s+)?(\d{1,2}):(\d{2})\s*(?:hrs?\b|horas\b|h\b)?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/,
    /\b(?:a\s+las?\s+)?(\d{1,2})\s*()(a\.?\s?m\.?|p\.?\s?m\.?)(?=\s|$)/,
    /\b(?:a\s+las?\s+)?(\d{1,2})\s*()(?:hrs?|horas|h)\b()/,
    /\ba\s+las?\s+(\d{1,2})\b()()(?!\s*(?:de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)))/,
  ];
  for (const re of horaRes) {
    mm = buscar(re);
    if (mm) {
      tomar(mm);
      hora = [Number(mm[1]), Number(mm[2] || 0)];
      if (mm[3]) mer = mm[3].startsWith('p') ? 'pm' : 'am';
      explicitaHora = mm[0].includes(':') || !!mm[3] || /h/.test(mm[0].replace(/^.*\d/, ''));
      break;
    }
  }
  if (!hora) {
    mm = buscar(/\b(?:a\s+)?(?:medio\s*dia|mediodia)\b/);
    if (mm) { tomar(mm); hora = [12, 0]; explicitaHora = true; }
  }
  mer = mer || meridiano;
  if (hora) {
    let [h, m] = hora;
    if (h > 23 || m > 59) {
      avisos.push('No entendí la hora.');
    } else {
      if (mer === 'pm' && h < 12) h += 12;
      else if (mer === 'am' && h === 12) h = 0;
      else if (!mer && !explicitaHora && h >= 1 && h <= 7) {
        avisos.push(`Supuse ${h}:${String(m).padStart(2, '0')} de la tarde (${h + 12}:${String(m).padStart(2, '0')}). Corrígela si era en la mañana.`);
        h += 12;
      }
      r.hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  r.fecha = fecha;

  // --- Tipo -----------------------------------------------------------------
  const pa = n.search(RE_AUDIENCIA);
  const pp = n.search(RE_PLAZO);
  if (pa >= 0 && (pp < 0 || pa < pp)) r.tipo = 'audiencia';
  else if (pp >= 0) r.tipo = 'plazo';

  // --- Prioridad y sede -------------------------------------------------------
  mm = buscar(/\b(urgente|importante|prioritari[oa])\b/);
  if (mm) { tomar(mm); r.prioridad = 'alta'; }
  mm = buscar(/\ben\s+(?:la\s+)?(sala\s+[\w\d-]+)/);
  if (mm) {
    tomar(mm);
    const ini = mm.index + mm[0].indexOf(mm[1]);
    const s = original.slice(ini, ini + mm[1].length);
    r.sede = s.charAt(0).toUpperCase() + s.slice(1);
  }

  if (r.tipo === 'audiencia') {
    for (const [re, nombre] of TIPOS_AUDIENCIA) {
      if (re.test(n)) { r.tipoAudiencia = nombre; break; }
    }
    if (!r.tipoAudiencia) {
      r.tipoAudiencia = 'Otra';
      avisos.push('No identifiqué el tipo de audiencia: quedó como "Otra".');
    }
  }

  // --- Título: lo que no se reconoció como fecha, hora o causa ---------------
  let resto = '';
  let ult = 0;
  for (const [a, b] of usados.sort((x, y) => x[0] - y[0])) {
    if (a > ult) resto += original.slice(ult, a);
    resto += ' ';
    ult = Math.max(ult, b);
  }
  resto += original.slice(ult);
  if (r.tipo === 'plazo') resto = resto.replace(/\b(vence|vencen|fenece)\b/gi, ' ');
  const conectores = /^(?:el|la|los|las|para|de|del|a|al|en|y|e|,|;|:|-|—)\s+/i;
  const finales = /\s+(?:el|la|los|las|para|de|del|a|al|en|y|e|que|con|,|;|:|-|—)$/i;
  resto = ` ${resto.replace(/\s+/g, ' ').trim()} `.trim();
  for (let i = 0; i < 6; i++) resto = ` ${resto}`.trim().replace(conectores, '').replace(finales, '').trim();
  resto = resto.replace(/^[,;:.\s-]+|[,;:\s-]+$/g, '');
  r.titulo = resto ? resto.charAt(0).toUpperCase() + resto.slice(1) : '';

  return r;
}

// Campos que quedaron vacíos según el tipo elegido: [{ campo, msg, requerido }].
// Se calcula aparte de `avisos` porque el tipo puede cambiar en la vista previa.
export function faltantes(v) {
  const out = [];
  if (v.tipo === 'nota') return out;
  if (!v.fecha) {
    out.push(v.tipo === 'tarea'
      ? { campo: 'fecha', msg: 'No identifiqué fecha: la tarea quedará sin fecha límite.', requerido: false }
      : { campo: 'fecha', msg: 'No identifiqué la fecha.', requerido: true });
  }
  if (v.tipo === 'audiencia' && !v.hora) out.push({ campo: 'hora', msg: 'No identifiqué la hora de la audiencia.', requerido: true });
  if (v.tipo !== 'audiencia' && !v.titulo) out.push({ campo: 'titulo', msg: 'No identifiqué la descripción.', requerido: true });
  if (v.tipo !== 'tarea' && !v.expedienteId && !v.causa) {
    out.push({ campo: 'expedienteId', msg: 'No identifiqué número de causa: elige el expediente si corresponde.', requerido: false });
  }
  return out;
}

// "Toca 90/2026", "123/2026", "C.P. 0045/2025" -> "90/2026", "123/2026", "45/2025".
export function claveCausa(numero) {
  const m = String(numero || '').match(/(\d{1,6})\s*\/\s*((?:19|20)\d{2})/);
  return m ? `${Number(m[1])}/${m[2]}` : '';
}
