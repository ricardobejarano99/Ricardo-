export const TIPOS_EXP = ['Causa penal', 'Amparo indirecto', 'Amparo directo', 'Recurso'];

export const ESTATUS_EXP = ['Activo', 'En espera', 'Suspendido', 'Concluido', 'Archivado'];
export const ESTATUS_CERRADOS = ['Concluido', 'Archivado'];

export const ETAPAS = [
  'Investigación inicial',
  'Investigación complementaria',
  'Etapa intermedia',
  'Juicio oral',
  'Ejecución',
  'Demanda presentada',
  'Admisión',
  'Informes justificados',
  'Audiencia constitucional',
  'Sentencia',
  'Recurso de revisión',
  'Recurso de queja',
  'Apelación',
  'Cumplimiento',
];

export const TIPOS_AUD = [
  'Control de detención',
  'Formulación de imputación',
  'Vinculación a proceso',
  'Medidas cautelares',
  'Revisión de medidas cautelares',
  'Cierre de investigación',
  'Etapa intermedia',
  'Juicio oral',
  'Individualización de sanciones',
  'Lectura de sentencia',
  'Apelación',
  'Audiencia constitucional',
  'Audiencia incidental',
  'Procedimiento abreviado',
  'Suspensión condicional',
  'Otra',
];

export const PRIORIDADES = [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];
export const PRIORIDAD_ORDEN = { alta: 0, media: 1, baja: 2 };

export const ALERTAS = [
  [0, 'Sin alerta'], [15, '15 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes'],
  [120, '2 horas antes'], [180, '3 horas antes'], [1440, '1 día antes'], [2880, '2 días antes'],
];
