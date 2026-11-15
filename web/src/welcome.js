// Modal de bienvenida: al entrar a la web, logos de Vizcachas y de NASA Space Apps Challenge, el nombre del
// proyecto y una descripción breve. Se cierra con la cruz, con Escape o con un clic afuera.
// Se muestra una vez por sesión del navegador: cambiar de idioma recarga la página y no debe volver a abrirlo.
import './welcome.css';
import vizcachasLogo from './assets/sky/logo-vizcachas.svg';
import nasaLogo from './assets/sky/nasa-space-apps.png';
import { t } from './i18n.js';

const SEEN_KEY = 'llsn.welcome.seen';
export const PROJECT_TITLE = 'Lunar Landing Site Navigator';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // sin almacenamiento se muestra siempre
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* la próxima carga lo vuelve a mostrar */
  }
}

export function initWelcome() {
  if (alreadySeen()) return;
  const previousFocus = document.activeElement;

  const overlay = el('div', 'welcome');
  const card = el('div', 'welcome__card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'welcome-title');
  card.setAttribute('aria-describedby', 'welcome-text');

  const close = el('button', 'welcome__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', t('welcome.close'));

  // El logo de Vizcachas es negro sobre transparente: va dentro de un círculo blanco (como en la pantalla principal).
  const viz = el('div', 'welcome__viz');
  const vizImg = el('img');
  vizImg.src = vizcachasLogo;
  vizImg.alt = t('sky.logo');
  viz.append(vizImg);
  const nasa = el('img', 'welcome__nasa');
  nasa.src = nasaLogo;
  nasa.alt = t('welcome.nasaLogo');
  const logos = el('div', 'welcome__logos');
  logos.append(viz, el('span', 'welcome__sep'), nasa);

  const title = el('h2', 'welcome__title', PROJECT_TITLE);
  title.id = 'welcome-title';
  const text = el('p', 'welcome__text', t('welcome.description'));
  text.id = 'welcome-text';

  card.append(close, logos, title, text);
  overlay.append(card);
  document.body.append(overlay);
  close.focus();

  function dismiss() {
    markSeen();
    document.removeEventListener('keydown', onKey, true);
    overlay.classList.add('is-closing');
    const remove = () => overlay.remove();
    overlay.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 400); // por si la animación no corre (movimiento reducido)
    previousFocus?.focus?.();
  }
  function onKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
    } else if (event.key === 'Tab') {
      event.preventDefault(); // un solo control enfocable: el foco se queda en la cruz
      close.focus();
    }
  }
  document.addEventListener('keydown', onKey, true);
  close.addEventListener('click', dismiss);
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) dismiss();
  });
}
