# 05. Roadmap e issues iniciales

Última actualización: 2026-11-14 · Fuente de verdad de los issues: `scripts/issues.json`. Este documento se mantiene a mano: si cambia `issues.json`, se actualiza acá en el mismo PR. El mapa general de las fases está en el [README](../README.md#mapa-del-proyecto).

Los issues se cargan en GitHub con `python scripts/create_issues.py` (ver `docs/04-GIT-WORKFLOW.md`). Cada capa es una **épica** (`[EPICA] ...`, issue padre) y sus issues cuelgan de ella como sub-issues (ver "Épicas" en `docs/04-GIT-WORKFLOW.md` y ADR-008). Cada issue es una tarea de hasta ~4 horas, con un solo responsable asignado, etiquetas de capa, área y tamaño. Es un equipo multirubro: no hay roles fijos y cualquiera toma issues de cualquier área.

## Hitos

| Cuándo | Meta | Merge a `main` |
|---|---|---|
| Jue 12 (noche) | Kickoff: repo, `main` protegida, épicas e issues cargados, mini sesión de Git | Estructura inicial |
| Vie 13 | Recursos liberados: ajustar ADR-001 y PRD. Capa 0 completa, con Horizons descargado para todos los sitios (C0-13); ensayo general a la noche (Sol validado contra Horizons) | Capa 0 |
| Sáb 14, 09:30 a 12:30 | Capa 1; primera unión (web lee datos reales) antes de las 12:30 | |
| Sáb 14, 13:30 a 14:30 | Capa 2 y demo mínima | **Demo mínima antes de las 14:30** |
| Sáb 14, 14:30 a 16:30 | Mentoreo con jurados invitados: `main` demoable. Tomar feedback como issues | |
| Sáb 14, 17:00 a 19:00 y sesión en casa hasta ~01:00 | Capa 3 y capa 4 | Lo que funcione, ~01:00 |
| Dom 15, 09:00 a 12:30 | Pendientes, pulido y textos | **12:30: congelar features** |
| Dom 15, 12:30 a 14:30 | Solo `fix/*`, README y guion | |
| Dom 15, 14:30 | Últimos ajustes y subida a GitHub | Versión final |
| Dom 15, 16:30 | Defensa ante el jurado | |

Regla: **recortar, no estirar**. Si hay atraso, se baja una capa y se muestra la última que funcione.

## Issues por capa

### Capa 0: base (antes del sábado)

| ID | Tarea | Área | Tamaño |
|---|---|---|---|
| C0-01 | Crear proyecto web con Vite y publicar una versión de prueba | Web | S |
| C0-02 | Entorno Python reproducible y probado | Efemérides | S |
| C0-04 | Cliente de la API de Horizons: azimut y elevación del Sol y la Tierra desde un sitio lunar | Efemérides | L |
| C0-05 | Test automático contra respuestas guardadas de Horizons | Efemérides | M |
| C0-07 | Lista de 10 a 20 sitios con coordenadas verificadas y fuente | Producto | M |
| C0-08 | Revisar y aprobar el contrato de datos v1.0 | Web | S |
| C0-09 | Proteger main, cargar etiquetas, épicas e issues y armar el tablero | Producto | S |
| C0-10 | Probar Quickmap, Moon Trek y Horizons y anotar lo confuso | Producto | S |
| C0-11 | Preguntar a los organizadores si se puede llegar con trabajo previo | Producto | S |
| C0-12 | Leer el portal de Exploración lunar de la CSA y sacar datos para el pitch | Producto | S |
| C0-13 | Descargar de Horizons las efemérides de todos los sitios y guardarlas en caché | Efemérides | M |

> Los issues C0-03 y C0-06 (mapa de elevación y perfil de horizonte) se movieron a la capa 5 como C5-05 y C5-06 (ADR-011). Los IDs no se reutilizan.

### Capa 1: sitio, fecha y posiciones (obligatoria)

| ID | Tarea | Área | Tamaño |
|---|---|---|---|
| C1-01 | Script que genera ephemeris.json por sitio | Efemérides | L |
| C1-02 | Selector de sitio y fecha y hora desde la primera pantalla | Web | M |
| C1-03 | Panel de números: elevación y azimut del Sol y la Tierra | Web | M |

### Capa 2: horizonte liso con Sol y Tierra (obligatoria)

Luna esfera sin relieve: el horizonte es 0° en todas las direcciones (ADR-011).

| ID | Tarea | Área | Tamaño |
|---|---|---|---|
| C2-01 | Generar horizon.json plano (360 ceros) de todos los sitios | Terreno | S |
| C2-02 | Dibujo del horizonte liso con el Sol y la Tierra encima y aviso "sin relieve" | Web | M |
| C2-03 | Visibilidad hora por hora combinando efemérides y horizonte | Efemérides | M |
| C2-04 | Primera unión: la web lee datos reales | Web | S |

### Capa 3: línea de tiempo y cuenta regresiva (obligatoria)

| ID | Tarea | Área | Tamaño |
|---|---|---|---|
| C3-01 | Generar metrics.json con horas de luz y de contacto | Efemérides | M |
| C3-02 | Reproductor de tiempo | Web | M |
| C3-03 | Línea de tiempo de Sol y Tierra para los próximos días | Web | M |
| C3-04 | Cuenta regresiva: el Sol se oculta en N horas | Web | S |
| C3-05 | Textos en lenguaje simple y diseño de la web | Producto | M |
| C3-06 | Panel de validación: los números de la web contra JPL Horizons | Web | M |

### Capa 4: comparación de escenarios (obligatoria desde el ADR-009)

| ID | Tarea | Área | Tamaño |
|---|---|---|---|
| C4-01 | Comparación de 2 o 3 escenarios lado a lado | Web | L |

### Capa 5: extras y, al final, relieve real (solo si sobra tiempo)

Orden: primero los extras y **último de todo el relieve** (ADR-011).

| ID | Tarea | Área | Tamaño |
|---|---|---|---|
| C5-01 | Botón se atrasó el lanzamiento | Web | M |
| C5-03 | Buscador de mejores ventanas de aterrizaje | Efemérides | L |
| C5-04 | Decidir coordenadas personalizadas: grilla precalculada o servidor | Terreno | M |
| C5-05 | Conseguir el mapa de elevación del polo sur (Moon Trek, Quickmap o PDS). Antes C0-03 | Terreno | M |
| C5-06 | Perfil de horizonte de un sitio (360 valores) y gráfico de la silueta. Antes C0-06 | Terreno | L |
| C5-07 | Generar horizon.json con relieve de los sitios del polo sur | Terreno | M |
| C5-08 | Dibujo de la silueta con relieve y visible o tapado por el relieve en la web | Web | M |
| C5-02 | Pendiente del terreno por sitio | Terreno | M |

### Entrega y demo

| ID | Tarea | Área | Tamaño |
|---|---|---|---|
| E-01 | Repo listo para entrega: README final y limpieza de datos sintéticos | Producto | S |
| E-02 | Guion de la demo y ensayo | Producto | M |
| E-03 | Presentación y video de respaldo | Producto | M |

## Cómo se divide el trabajo

- **Datos y lógica en Python** (efemérides y terreno): ruta crítica. Lo primero es el cliente de Horizons con las convenciones verificadas (C0-04 y C0-05) y la descarga completa a caché antes del sábado (C0-13). El mapa de elevación ya no está en la ruta crítica: queda para el final de la capa 5 (C5-05, ADR-011).
- **Web**: arranca con los datos sintéticos de `data/public/` mientras el precálculo en Python genera los reales; la primera unión es el sábado antes de las 12:30.
- **Producto, contenido y demo**: lista de sitios, textos, diseño, guion y presentación; es trabajo de todos.
- Se equilibra la carga, no la cantidad de issues. Quien termina toma el siguiente issue disponible de cualquier área.
