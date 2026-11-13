# ADR-001: Desafío elegido y alcance del MVP por capas

- **Estado**: Aceptado
- **Fecha**: 2026-11-12
- **Decidieron**: equipo completo (Toto, Panchi, Fer, Facu)

## Contexto
Elegimos el desafío de navegación de sitios de aterrizaje lunar (polo sur): dado un sitio y una fecha, mostrar si habrá Sol y comunicación directa con la Tierra. Tenemos unas 15 horas efectivas de trabajo (≈10 en el lugar y ≈5 en la sesión del sábado a la noche), 4 personas con experiencia dispar y recursos oficiales que se liberan el viernes.

## Decisión
Construir una web estática que lee datos precalculados, organizada en **capas de MVP** donde cada una es una demo completa por sí sola (ver `docs/01-PRD.md`). Objetivo: capas 1 a 3 aseguradas, capa 4 como meta probable, capa 5 solo si sobra tiempo. Congelar features el domingo 15 a las 12:30.

## Alternativas descartadas
- Cálculo en vivo en el navegador o en un servidor: más riesgo, más trabajo y depende de internet en la demo.
- Visualización 3D del terreno: llamativa pero fuera de las horas disponibles.
- Cubrir todo el polo con mapas de iluminación: es un problema distinto y mucho más pesado.

## Consecuencias
- Hay que precalcular lo pesado antes del sábado; por eso la capa 0 es previa.
- "Recortar, no estirar": ante atraso se baja una capa, no se estira el tiempo.
- El nombre oficial del desafío y los criterios de evaluación se agregan a `docs/00-CONTEXT.md` cuando se liberen los recursos.
