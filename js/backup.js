// Respaldo cifrado: exportar a .json e importar (combinar o reemplazar).
import * as store from './store.js';
import { state } from './store.js';
import { openModal, toast, todayISO, promptPin, shareOrDownload, esc } from './util.js';
import { register, registerChange } from './actions.js';

async function exportar() {
  let data;
  try {
    data = JSON.stringify(await store.exportBackup());
  } catch (e) {
    toast(`No se pudo preparar el respaldo: ${e.message}`);
    return;
  }
  const nombre = `despacho-respaldo-${todayISO()}.json`;
  const kb = Math.max(1, Math.round(data.length / 1024));
  // Segundo toque para guardar: iOS solo abre la hoja de compartir desde un gesto directo.
  const m = openModal(`<div class="modal-body"><h2 class="modal-title">Respaldo listo</h2>
    <p>Archivo <strong>${esc(nombre)}</strong> (${kb} KB), cifrado con tu código de acceso actual.</p>
    <p class="muted">Guárdalo en Archivos o envíalo por AirDrop a tu otro dispositivo. Para abrirlo necesitarás el código de acceso que tienes hoy.</p>
    <div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn primary" data-save>Guardar respaldo</button></div></div>`);
  m.el.querySelector('[data-save]').onclick = async () => {
    const r = await shareOrDownload(nombre, data, 'application/json');
    if (r === 'cancel') return;
    state.settings.ultimoRespaldo = new Date().toISOString();
    await store.saveSettings();
    m.close();
    toast('Respaldo guardado');
  };
}

function elegirModo() {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal(`<div class="modal-body"><h2 class="modal-title">¿Cómo importar?</h2>
      <p><strong>Combinar</strong>: agrega lo nuevo y conserva la versión más reciente de cada registro. Lo que hayas borrado aquí puede volver a aparecer.</p>
      <p><strong>Reemplazar</strong>: borra los datos de este dispositivo y deja solo los del respaldo.</p>
      <div class="modal-actions stack"><button type="button" class="btn primary" data-m="combinar">Combinar</button>
      <button type="button" class="btn danger" data-m="reemplazar">Reemplazar todo</button><button type="button" class="btn" data-close>Cancelar</button></div></div>`,
    { onClose: () => { if (!done) resolve(null); } });
    m.el.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { done = true; resolve(b.dataset.m); m.close(); }; });
  });
}

async function importar(file) {
  let obj;
  try {
    obj = JSON.parse(await file.text());
  } catch {
    toast('El archivo no es un respaldo válido de Despacho.');
    return;
  }
  if (!store.isBackup(obj)) { toast('El archivo no es un respaldo válido de Despacho.'); return; }
  const pin = await promptPin('Código del respaldo', `Respaldo del ${obj.creado ? new Date(obj.creado).toLocaleString('es-MX') : 'fecha desconocida'}. Ingresa el código de acceso con el que se creó.`);
  if (!pin) return;
  let payload;
  try {
    payload = await store.decryptBackup(obj, pin);
  } catch {
    toast('Código incorrecto o archivo dañado.');
    return;
  }
  const modo = await elegirModo();
  if (!modo) return;
  const { nuevos, actualizados } = await store.importPayload(payload, modo);
  toast(modo === 'reemplazar' ? `Datos reemplazados: ${nuevos} registros.` : `Importado: ${nuevos} nuevos, ${actualizados} actualizados.`, { timeout: 5000 });
}

register({ exportar });
registerChange({
  'importar-archivo': (el) => {
    const f = el.files?.[0];
    el.value = '';
    if (f) importar(f);
  },
});
