# Despacho

Aplicación web progresiva (PWA) para organizar la práctica penal: expedientes, audiencias, plazos, tareas y captura rápida de notas. Funciona sin conexión y guarda todo cifrado en el dispositivo.

**URL:** https://ricardobejarano99.github.io/Ricardo-/

## Instalar en iPhone o iPad

1. Abre la URL en **Safari**.
2. Toca **Compartir → Añadir a pantalla de inicio**.
3. Abre Despacho desde el ícono y crea tu código de acceso.

A partir de ahí funciona sin internet. Instálala en cada dispositivo y pasa los datos con un respaldo (Ajustes → Respaldo).

## Privacidad y seguridad

- Sin servidores: los datos viven en IndexedDB del dispositivo, cifrados con AES-GCM (256 bits) y una clave derivada del código de acceso con PBKDF2-SHA-256 (310 000 iteraciones).
- El código de acceso nunca se guarda. **Si lo olvidas, los datos no se pueden recuperar.**
- Lo único que sale del dispositivo es lo que envías tú a Google Calendar con su botón. En modo discreto (activado por defecto), solo viajan el tipo de actuación, el número de causa y la sede.
- iOS puede borrar los datos de la app si el dispositivo se queda sin espacio o si eliminas la app. Respalda con frecuencia; la pantalla de inicio te avisa cuando pasan más de 7 días.

## Cómputo de plazos

- El plazo corre a partir del día siguiente a aquel en que surte efectos la notificación (el mismo día o el día hábil siguiente, según elijas).
- Excluye sábados, domingos y tu lista de días inhábiles. Vienen precargadas las fechas fijas del art. 19 de la Ley de Amparo; los periodos vacacionales y las suspensiones de labores debes agregarlos tú.
- El resultado siempre lleva la leyenda **"verificar cómputo"**: es una herramienta de apoyo, no sustituye la revisión del abogado.

## Desarrollo

Sin dependencias ni compilación: HTML, CSS y JavaScript (módulos ES).

```sh
npm test                       # pruebas del cómputo de plazos y del calendario
python3 -m http.server 8000    # servir localmente
```

Al publicar cambios, sube `VERSION` en `sw.js`; los dispositivos verán el aviso "Hay una nueva versión". Si agregas archivos, inclúyelos en `ASSETS` de `sw.js` (una prueba lo verifica).

La publicación en GitHub Pages es automática con cada push a `main` (`.github/workflows/pages.yml`).
