import { initSelector } from './selector.js';

initSelector().catch((err) => {
  const notice = document.getElementById('notice');
  notice.hidden = false;
  notice.textContent = `No se pudo cargar la lista de sitios: ${err.message}`;
});
