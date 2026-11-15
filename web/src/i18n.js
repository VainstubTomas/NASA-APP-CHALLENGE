// Idiomas de la web (#58): español, inglés, hindi y chino simplificado.
// Uso:  import { t, locale } from './i18n.js';   t('panel.sun')  ->  "Sol" / "Sun" / "सूर्य" / "太阳"
// Textos fijos del HTML: atributo data-i18n="clave" (los traduce applyStaticTexts).
// Para agregar un texto: sumar la misma clave en los 4 JSON de src/i18n/ (npm test lo verifica).
import es from './i18n/es.json';
import en from './i18n/en.json';
import hi from './i18n/hi.json';
import zh from './i18n/zh.json';
import { LANGS, LOCALES, detectLang, langFromSearch, createTranslator, siteLabel } from './i18n-core.js';

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
export function initLangSelect(select) {
  for (const code of LANGS) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = dicts[code]['lang.name'];
    select.appendChild(opt);
  }
  select.value = lang;
  select.addEventListener('change', () => {
    try {
      localStorage.setItem(STORAGE_KEY, select.value);
    } catch {
      // sin almacenamiento la elección dura solo esta carga
    }
    // También va en la URL: así un `?lang=` anterior no pisa la elección, y funciona sin localStorage.
    const url = new URL(window.location.href);
    url.searchParams.set('lang', select.value);
    window.location.replace(url);
  });
}
