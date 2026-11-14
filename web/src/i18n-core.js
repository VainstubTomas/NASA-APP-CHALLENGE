// Núcleo de idiomas (#58), sin DOM ni archivos, para poder probarlo con `npm test`.
// Los textos viven en src/i18n/<idioma>.json (una clave plana por texto).

export const LANGS = ['es', 'en', 'hi', 'zh'];
export const DEFAULT_LANG = 'es';

// Locale para fechas y números (Intl) de cada idioma.
export const LOCALES = { es: 'es-AR', en: 'en-US', hi: 'hi-IN', zh: 'zh-CN' };

/**
 * Idioma a usar: el guardado por el usuario si es válido; si no, el primero del navegador
 * que soportemos ('zh-CN' -> 'zh'); si ninguno, español.
 */
export function detectLang(browserLangs = [], storedLang = null) {
  if (LANGS.includes(storedLang)) return storedLang;
  for (const tag of browserLangs) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return DEFAULT_LANG;
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
