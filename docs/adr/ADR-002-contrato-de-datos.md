# ADR-002: Contrato de datos entre Python y la web

- **Estado**: Aceptado (revisado y aprobado en el issue C0-08)
- **Fecha**: 2026-11-12 (aceptado el 2026-11-14)
- **Decidieron**: el equipo, en revisión conjunta de Python y web (2026-11-14)

## Contexto
Python (efemérides y terreno) y la web trabajan en paralelo. Si no acordamos el formato desde el principio, la primera integración del sábado va a fallar.

## Decisión
- Python precalcula y escribe **JSON** en `data/public/`; la web solo lee. Se comunican **únicamente** por esos archivos.
- Formato **columnar** (arreglos paralelos) con `start_utc`, `step_s` y `count` para el tiempo. Todos los archivos llevan `schema_version`.
- Convenciones: azimut 0° = norte, sentido horario; elevación sobre el horizonte local; grados; UTC; marco topocéntrico; discos para Sol y Tierra.
- **Regla de visibilidad (confirmada)**: un cuerpo es visible si su borde superior supera el horizonte (`elevación + radio > horizonte(azimut)`). Se elige el borde superior frente al centro y al disco completo.
- Esquemas JSON en `data/schema/`, validados por `tests/test_contract.py`.
- La web arranca con datos sintéticos generados por `scripts/make_synthetic_data.py`.

## Alternativas descartadas
- Lista de objetos por muestra: archivos más pesados y lentos de leer.
- CSV: sin estructura anidada ni versionado claro.
- API en vivo: más piezas que fallar durante la demo.

## Consecuencias
- Cambios al contrato requieren ADR y aviso al equipo.
- Python y la web implementan la misma regla de visibilidad y se cruzan contra `metrics.json`.
- Confirmado en la revisión: azimut y elevación van juntos, paso de 1 hora (`step_s` = 3600) para las efemérides, horizonte liso hasta tener relieve, y radios nominales (Sol 0,25°, Tierra 1,0°).
- Pendiente: radio angular variable por muestra (v1.1).
