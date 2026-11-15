// Idiomas de la web (#58): español, inglés, hindi y chino simplificado.
// Uso:  import { t, locale } from './i18n.js';   t('panel.sun')  ->  "Sol" / "Sun" / "सूर्य" / "太阳"
// Textos fijos del HTML: atributo data-i18n="clave" (los traduce applyStaticTexts).
// Para agregar un texto: sumar la misma clave en los 4 JSON de src/i18n/ (npm test lo verifica).
import es from './i18n/es.json';
import en from './i18n/en.json';
import hi from './i18n/hi.json';
import zh from './i18n/zh.json';
import { LANGS, LOCALES, detectLang, langFromSearch, createTranslator, siteLabel } from './i18n-core.js';
import { LANG_FLAGS } from './lang-flags.js';

const STORAGE_KEY = 'llsn.lang';
const dicts = { es, en, hi, zh };

function storedLang() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

// `?lang=en` fuerza el idioma (link de la entrega a Space Apps, #110). Se lee una sola vez, al cargar.
export const lang = detectLang(storedLang(), langFromSearch(window.location.search));
export const locale = LOCALES[lang];
export const t = createTranslator(dicts, lang);

/** Nombre del sitio en el idioma actual (site.<id>), o el de sites.json si no está traducido. */
export const siteName = (site) => siteLabel(t, site);

/** Traduce los elementos del HTML con data-i18n y ajusta <html lang>. */
export function applyStaticTexts(root = document) {
  document.documentElement.lang = lang;
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
}

/**
 * Llena el selector de idioma. Al cambiarlo guarda la elección y recarga la página:
 * el sitio y la fecha están en la URL, así que se conservan.
 */
// Botón con la bandera del idioma actual + menú con las 4 opciones (banderas en lang-flags.js).
export function initLangMenu(button, menu) {
  const switchTo = (code) => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // sin almacenamiento la elección dura solo esta carga
    }
    // También va en la URL: así un `?lang=` anterior no pisa la elección, y funciona sin localStorage.
    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    window.location.replace(url);
  };
  const currentName = dicts[lang]['lang.name'];
  button.innerHTML = LANG_FLAGS[lang];
  button.setAttribute('aria-label', `${dicts[lang]['lang.label']}: ${currentName}`);
  button.title = `${dicts[lang]['lang.label']}: ${currentName}`;
  for (const code of LANGS) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sky-langmenu__item';
    item.lang = code;
    item.setAttribute('aria-current', String(code === lang));
    item.innerHTML = `<span class="sky-langmenu__flag">${LANG_FLAGS[code]}</span><span>${dicts[code]['lang.name']}</span>`;
    item.addEventListener('click', () => switchTo(code));
    const li = document.createElement('li');
    li.append(item);
    menu.appendChild(li);
  }
  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
}
