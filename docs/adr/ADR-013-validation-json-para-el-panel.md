# ADR-013: validation.json en data/public/ para el panel de validación

- **Estado**: Propuesto
- **Fecha**: 2026-11-14
- **Decidieron**: pendiente de confirmar por el equipo (propuesta del issue #39)

## Contexto
El panel de validación (C3-06, #39) muestra los números de la web junto a los de JPL Horizons. Los valores de referencia viven en `tests/reference/horizons_reference.csv` y `tests/reference/raw/`. La web no puede leer `tests/`: Vite sirve solo `data/public/` (`publicDir` en `web/vite.config.js`), y un import desde fuera de `web/` falla en dev y en el build de Vercel. El contrato (ADR-002) dice que Python y la web se hablan solo por JSON en `data/public/`.

## Decisión
Se agrega un archivo nuevo al contrato: `data/public/validation.json`, generado por `scripts/make_validation_json.py` desde `tests/reference/`. Contiene la tolerancia (0,1°, ADR-005), la fuente y las filas de referencia (sitio, cuerpo, instante UTC, azimut, elevación). Esquema: `data/schema/validation.schema.json`. No se calcula nada nuevo: solo se copian respuestas guardadas de Horizons.

## Alternativas descartadas
- **Import directo del CSV en Vite (`?raw`)**: no toca el contrato, pero la web lee un archivo de `tests/` y depende de la configuración de Vite fuera de `web/`.
- **Duplicar los valores a mano en el código de la web**: se desincroniza con `tests/` sin aviso.

## Consecuencias
- El contrato suma un archivo. `tests/test_contract.py` lo valida contra el esquema.
- Si Horizons cambia y se regenera `tests/reference/`, hay que correr el script de nuevo y commitear `data/public/validation.json`.
- Las fechas fuera del rango de la web (después de 2027-12-31, `DATA_END_MS`) se muestran como "fuera de rango" y no cuentan como error.
