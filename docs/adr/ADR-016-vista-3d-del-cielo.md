> 🇬🇧 [Read in English](../en/adr/ADR-016-3d-sky-view.md)

# ADR-016: Vista 3D del cielo con el horizonte liso

- **Estado**: Propuesto
- **Fecha**: 2026-11-14
- **Decidieron**: pendiente de confirmar por el equipo (registro de una decisión ya tomada en el PR #88, issue #30)

## Contexto
El PRD y el ADR-001 dejaban fuera de alcance la "visualización 3D del terreno o render realista de la superficie" porque no entraba en las horas del hackatón. El sábado 14 se mergeó el PR #88: una vista 3D del cielo (three.js) que muestra el Sol y la Tierra sobre el horizonte liso, con la mirada arrastrable. Nadie escribió un ADR, así que los docs y el código decían cosas distintas.

El texto oficial del desafío invita a explorar "2D maps, 3D surface visualizations, or other creative representations".

## Decisión
La vista 3D del **cielo** queda dentro del alcance. Usa los mismos datos que el resto de la web (`ephemeris.json` y `horizon.json`) y no calcula nada propio. Sigue **fuera** de alcance el render realista del **terreno** (relieve, texturas de la superficie): el relieve real llega solo a `horizon.json`, en la capa 5 (ADR-011).

## Alternativas descartadas
- **Sacar la vista 3D:** ya estaba hecha y probada, y le habla a "Multiple visualization approaches" del desafío y al criterio de Presentación.
- **Ampliarla a un terreno 3D realista:** es justo lo que el ADR-001 descartó por tiempo, y sin relieve real mostraría montañas inventadas.

## Consecuencias
- El PRD cambia la línea de "Fuera de alcance": queda afuera el render realista del terreno, no la vista 3D del cielo.
- La web carga three.js en diferido (unos 120 kB comprimidos) y, si el navegador no tiene WebGL, vuelve a la brújula y la regla en 2D.
- three.js (MIT) va en los créditos del README.
- La vista 3D muestra el horizonte ideal; el aviso "horizonte ideal, sin relieve" sigue siendo obligatorio.
- Actualización (C5-08, #52): en los sitios con `dem` la vista dibuja la silueta del perfil de 360° de `horizon.json` y marca lo que el relieve tapa; la silueta reacciona a la luz del Sol y de la Tierra como el suelo. El suelo sigue siendo ilustrativo: ya no se avisa en pantalla, pero consta acá y en el README. El aviso "sin relieve" queda solo para los sitios sin `dem`. Sigue fuera de alcance el render realista del terreno.
