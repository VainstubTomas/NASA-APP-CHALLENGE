# ADR-005: Validación contra JPL Horizons

- **Estado**: Propuesto (la tolerancia se fija después de la primera comparación real)
- **Fecha**: 2026-11-12

## Contexto
El mayor riesgo del proyecto no es que algo no ande, sino que ande y dé un resultado falso que parece razonable: ejes cruzados, convención de azimut equivocada, marco de referencia o tiempo mal convertidos. Claude no puede saber si un ángulo es correcto.

## Decisión
- **JPL Horizons es la fuente de verdad** para azimut y elevación del Sol y la Tierra desde un punto de la superficie lunar.
- Se guardan valores de referencia en `tests/reference/` (CSV con sitio, fecha UTC, azimut y elevación esperados), obtenidos de Horizons para **3 sitios y 3 fechas** como mínimo.
- `tests/` compara el cálculo propio contra esa referencia. La tolerancia inicial de partida es **0,1°** en azimut y elevación; se ajusta con evidencia en el primer test y se registra acá.
- Todo cambio en el cálculo de efemérides o en la regla de visibilidad debe pasar estos tests antes de mergear a `develop`.
- Cada archivo de referencia indica cómo se generó (parámetros de la consulta a Horizons) para poder repetirlo.

## Alternativas descartadas
- Validar a ojo contra Quickmap o Stellarium: útil como chequeo adicional, no como prueba.
- Confiar en el cálculo sin referencia externa: es justo el riesgo que queremos evitar.

## Consecuencias
- Una persona de backend es quien mantiene los tests de referencia; el panel de validación de la demo se alimenta de ellos.
- Validación secundaria del terreno: comparar nuestro horizonte contra el porcentaje de tiempo con luz de los mapas de iluminación de NASA (debe parecerse a grandes rasgos).
