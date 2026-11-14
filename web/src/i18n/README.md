# Idiomas de la web (i18n)

Issue #58. La web está en **español** (`es`), **inglés** (`en`), **hindi** (`hi`) y **chino simplificado** (`zh`).
Cada idioma es un archivo JSON con pares `"clave": "texto"`; las claves son las mismas en los cuatro.

## Origen de las traducciones (importante para la entrega)

| Idioma | Archivo | Origen | Revisado por una persona que hable el idioma |
|---|---|---|---|
| Español | `es.json` | Textos originales del equipo | Sí (es el idioma del equipo) |
| Inglés | `en.json` | **Traducido con IA** (Claude, 2026-11-14) | No |
| Hindi | `hi.json` | **Traducido con IA** (Claude, 2026-11-14) | **No**: nadie del equipo habla hindi |
| Chino simplificado | `zh.json` | **Traducido con IA** (Claude, 2026-11-14) | **No**: nadie del equipo habla chino |

Incluye los nombres de los sitios (`site.<id>`). Regla única para los 4 idiomas: el **nombre propio de la
misión se conserva en su denominación original** (`Apollo 11`, `Chang'e 6`, `Chandrayaan-3`…) y solo se
traduce el accidente geográfico entre paréntesis (por ejemplo, `Apollo 11 (शांति सागर)` o `Apollo 11（静海）`
para el Mar de la Tranquilidad). Los accidentes geográficos traducidos con IA no se verificaron contra fuentes
oficiales en esos idiomas. `npm test` comprueba que cada etiqueta empiece con el nombre original de la misión.

**En la presentación y el README final hay que decir que las traducciones al inglés, hindi y chino se
hicieron con IA y no fueron revisadas por hablantes nativos.** Si alguien las revisa, actualizar esta tabla.

## Cómo agregar o cambiar un texto

1. Elegir una clave con el prefijo de su parte de la web (`panel.`, `selector.`, `timeline.`…).
2. Agregarla en los **cuatro** JSON. Si se traduce con IA, no hace falta marcarlo texto por texto: la tabla
   de arriba ya lo indica para todo el archivo.
3. En el código, usar `t('clave')` (de `src/i18n.js`) en lugar de escribir el texto. Para variables:
   `"Mirar hacia {direction}"` en el JSON y `t('panel.azimuth', { direction })` en el código.
   En el HTML: atributo `data-i18n="clave"`.
4. Correr `npm test`: falla si falta la clave en algún idioma, si queda vacía o si las `{variables}` no coinciden.

Un sitio nuevo en `sites.json` necesita su `site.<id>` en los cuatro JSON (`npm test` lo pide); mientras
tanto, la web muestra el nombre de `sites.json`.

## Cómo funciona

- `src/i18n-core.js`: lógica sin DOM (probada en `src/i18n.test.js`): `t()`, detección de idioma, nombres de sitio.
- `src/i18n.js`: conecta con la página. El idioma sale de la elección guardada (`localStorage`), si no del
  navegador, si no español. Al cambiarlo en el selector se guarda y se recarga la página (sitio y fecha
  quedan en la URL).
- Fechas y números usan el formato de cada idioma (`toLocaleString`).
