# ADR-012: Premio objetivo: Best Use of Data y, en segundo lugar, Best Use of Science

- **Estado**: Propuesto
- **Fecha**: 2026-11-14
- **Decidieron**: pendiente de confirmar por el equipo

## Contexto
La página del desafío no trae criterios de evaluación, pero Space Apps publica 10 premios globales en https://www.spaceappschallenge.org/awards/ (copiados el 14/11; la tabla completa está en `docs/00-CONTEXT.md`, sección "Premios"). Si el pitch le habla a todos los premios, no gana ninguno. Hay que elegir a cuál apuntar con lo que ya vamos a construir, sin agregar funciones.

## Decisión
1. **Premio principal: Best Use of Data** ("el proyecto que mejor hace accesibles los datos espaciales o los usa en una aplicación única"). Es nuestra propuesta de valor literal: los datos de JPL Horizons y del LRO existen, pero sus herramientas son complejas, y nosotros los respondemos en una pantalla y una pregunta.
2. **Premio secundario: Best Use of Science** ("el uso más válido de la ciencia o del método científico"). Lo sostiene la validación contra Horizons (C0-05, C3-06) y que declaramos los límites (horizonte ideal mientras no haya relieve, ADR-011).
3. **Ángulos del pitch, sin trabajo extra**: Best Use of Storytelling (la historia "la misión se atrasó") y Best Mission Concept (planificación de aterrizajes de Artemis).

## Alternativas descartadas
- **Best Use of Technology**: premia la tecnología más innovadora; la nuestra es una web simple sobre JSON precalculados, a propósito.
- **Galactic Impact, Most Inspirational, Global Connection, Art & Technology, Local Impact**: el proyecto encaja poco y apuntar ahí pediría funciones o un discurso que no tenemos.
- **No elegir premio**: el pitch queda genérico.

## Consecuencias
- **No cambia el alcance ni el contrato**: capas 1 a 4 igual, recortar no estirar.
- El pitch abre con "datos de NASA difíciles de usar, ahora accesibles" y nombra la fuente de cada número (Horizons, LRO/LOLA, Quickmap, Moon Trek).
- La validación contra Horizons pasa de detalle a argumento central de la demo (C3-06 gana prioridad dentro de la capa 3).
- El aviso "horizonte ideal, sin relieve" (ADR-011) es condición para Best Use of Science: un resultado optimista sin aviso contradice "uso válido de la ciencia".
- La rúbrica con que puntúa el jurado (local y global) sigue sin confirmar: preguntarla a los organizadores (C0-11).
