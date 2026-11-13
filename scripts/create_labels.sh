#!/usr/bin/env bash
# Crea (o actualiza) las etiquetas del repo. Requiere: gh auth login
# Uso: bash scripts/create_labels.sh [owner/repo]
set -euo pipefail
REPO="${1:-VainstubTomas/NASA-APP-CHALLENGE}"

mk() { gh label create "$1" --color "$2" --description "$3" --repo "$REPO" --force; }

for n in 0 1 2 3 4 5; do mk "capa:$n" "1B2A41" "Capa $n del MVP"; done
mk "capa:entrega" "1B2A41" "Preparación de la entrega"

mk "area:efemerides" "2E6FDB" "Efemérides y validación (Python)"
mk "area:terreno"    "2E6FDB" "Terreno y horizontes (Python)"
mk "area:web"        "2F9E6E" "Frontend"
mk "area:producto"   "E0A800" "Producto, contenido y demo"

mk "tamaño:S" "C5DEF5" "Menos de ~1 hora"
mk "tamaño:M" "C5DEF5" "1 a 2 horas"
mk "tamaño:L" "C5DEF5" "2 a 4 horas (si es más, partir)"

mk "tipo:feat"  "A2EEEF" "Funcionalidad nueva"
mk "tipo:fix"   "D73A4A" "Corrección"
mk "tipo:docs"  "0075CA" "Documentación"
mk "tipo:test"  "BFDADC" "Tests"
mk "tipo:chore" "EDEDED" "Mantenimiento"

mk "prioridad:alta" "B60205" "Bloquea a otros o es ruta crítica"
mk "bloqueado"      "000000" "Espera algo de otra persona"
echo "Etiquetas creadas en $REPO"
