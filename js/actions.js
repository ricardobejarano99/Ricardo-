// Registro de acciones de la interfaz. Los elementos declaran data-action (clic),
// data-onchange (cambio) o data-oninput (escritura) y app.js las despacha.
export const actions = {};
export const changeActions = {};
export const inputActions = {};

export const register = (map) => Object.assign(actions, map);
export const registerChange = (map) => Object.assign(changeActions, map);
export const registerInput = (map) => Object.assign(inputActions, map);
