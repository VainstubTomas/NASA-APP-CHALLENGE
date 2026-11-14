// Pruebas de idiomas (#58). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, DEFAULT_LANG, detectLang, createTranslator, siteLabel } from './i18n-core.js';

const load = (lang) => JSON.parse(readFileSync(new URL(`./i18n/${lang}.json`, import.meta.url), 'utf8'));
const dicts = Object.fromEntries(LANGS.map((lang) => [lang, load(lang)]));
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('los 4 idiomas pedidos: español, inglés, hindi y chino simplificado', () => {
  assert.deepEqual(LANGS, ['es', 'en', 'hi', 'zh']);
  assert.equal(DEFAULT_LANG, 'es');
});

test('todos los idiomas tienen exactamente las mismas claves que español', () => {
  const keys = Object.keys(dicts.es).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(dicts[lang]).sort(), keys, `claves distintas en ${lang}.json`);
  }
});

test('ningún texto está vacío y cada idioma declara su nombre', () => {
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(dicts[lang])) {
      assert.equal(typeof value, 'string', `${lang}.${key}`);
      assert.ok(value.trim().length > 0, `${lang}.${key} vacío`);
    }
  }
  assert.equal(dicts.hi['lang.name'], 'हिन्दी');
  assert.equal(dicts.zh['lang.name'], '简体中文');
});

test('los marcadores {variable} son los mismos en todos los idiomas', () => {
  for (const key of Object.keys(dicts.es)) {
    const expected = placeholders(dicts.es[key]);
    for (const lang of LANGS) {
      assert.deepEqual(placeholders(dicts[lang][key]), expected, `${lang}.${key}`);
    }
  }
});

test('detecta el idioma del navegador y usa español si no lo soporta', () => {
  assert.equal(detectLang(['zh-CN', 'en']), 'zh');
  assert.equal(detectLang(['hi-IN']), 'hi');
  assert.equal(detectLang(['en-US', 'es']), 'en');
  assert.equal(detectLang(['fr-FR', 'es-AR']), 'es');
  assert.equal(detectLang(['fr-FR']), 'es');
  assert.equal(detectLang([]), 'es');
  // La elección guardada por el usuario gana sobre el navegador.
  assert.equal(detectLang(['en-US'], 'hi'), 'hi');
  assert.equal(detectLang(['en-US'], 'xx'), 'en'); // guardado inválido: se ignora
});

test('t() reemplaza variables y, si falta una traducción, usa español y después la clave', () => {
  const t = createTranslator(
    { es: { saludo: 'Hola {nombre}', solo_es: 'Solo en español' }, en: { saludo: 'Hello {nombre}' } },
    'en',
  );
  assert.equal(t('saludo', { nombre: 'Fer' }), 'Hello Fer');
  assert.equal(t('solo_es'), 'Solo en español');
  assert.equal(t('no.existe'), 'no.existe');
});

test('cada sitio de sites.json tiene su nombre traducido (site.<id>)', () => {
  // Los nombres de sites.json son datos del contrato y no se tocan: la web los traduce por id.
  const sitesUrl = new URL('../../data/public/sites.json', import.meta.url);
  const { sites } = JSON.parse(readFileSync(sitesUrl, 'utf8'));
  for (const site of sites) {
    assert.ok(dicts.es[`site.${site.id}`], `falta site.${site.id} en los JSON de idiomas`);
  }
  assert.equal(dicts.en['site.change-6'], "Chang'e 6 (far side)");
  assert.equal(dicts.zh['site.change-6'], '嫦娥六号（月球背面）');
});

test('siteLabel usa la traducción por id y, si no existe, el nombre de sites.json', () => {
  const t = createTranslator({ es: { 'site.a': 'Sitio A' }, en: { 'site.a': 'Site A' } }, 'en');
  assert.equal(siteLabel(t, { id: 'a', name: 'Original' }), 'Site A');
  assert.equal(siteLabel(t, { id: 'nuevo', name: 'Sitio nuevo' }), 'Sitio nuevo');
});

test('cada idioma traduce los puntos cardinales de 8 rumbos', () => {
  for (const lang of LANGS) {
    for (const point of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) {
      assert.ok(dicts[lang][`compass.${point}`], `${lang}: falta compass.${point}`);
    }
  }
  assert.equal(dicts.es['compass.W'], 'O');
  assert.equal(dicts.en['compass.W'], 'W');
});
