// Núcleo de idiomas (#58), sin DOM ni archivos, para poder probarlo con `npm test`.
// Los textos viven en src/i18n/<idioma>.json (una clave plana por texto).

export const LANGS = ['es', 'en', 'hi', 'zh'];
// Idioma fuente de los textos (los JSON se escriben primero en español).
export const DEFAULT_LANG = 'es';
// Idioma para quien no usa ninguno de los 4: inglés, porque Space Apps pide inglés en todo lo
// que se enlaza en la entrega (#110).
export const FALLBACK_LANG = 'en';

// Locale para fechas y números (Intl) de cada idioma.
export const LOCALES = { es: 'es-AR', en: 'en-US', hi: 'hi-IN', zh: 'zh-CN' };

/** Idioma pedido en la URL (`?lang=en`), o null si no hay o no lo soportamos. */
export function langFromSearch(search) {
  const value = new URLSearchParams(search).get('lang')?.toLowerCase() ?? null;
  return LANGS.includes(value) ? value : null;
}

/**
 * Idioma a usar: el de la URL (`?lang=`) si es válido; si no, el guardado por el usuario; si no,
 * el primero del navegador que soportemos ('zh-CN' -> 'zh'); si ninguno, inglés.
 */
export function detectLang(browserLangs = [], storedLang = null, urlLang = null) {
  if (LANGS.includes(urlLang)) return urlLang;
  if (LANGS.includes(storedLang)) return storedLang;
  for (const tag of browserLangs) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return FALLBACK_LANG;
}

/**
 * Nombre de un sitio en el idioma actual: la clave site.<id> de los JSON de idiomas o, si no
 * existe (un sitio nuevo todavía sin traducir), el nombre de sites.json, que no se modifica.
 */
export function siteLabel(t, site) {
  const key = `site.${site.id}`;
  const text = t(key);
  return text === key ? site.name : text;
}

/**
 * Devuelve t(clave, variables): el texto en `lang`, o en español si falta, o la clave.
 * Las variables se escriben {nombre} en el JSON.
 */
export function createTranslator(dicts, lang) {
  return (key, vars = {}) => {
    const text = dicts[lang]?.[key] ?? dicts[DEFAULT_LANG]?.[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  };
}
