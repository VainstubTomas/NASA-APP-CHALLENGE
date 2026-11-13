# 01. PRD: Lunar Landing Site Navigator

Última actualización: 2026-11-13 · Estado: borrador para validar con el equipo

## Problema
Para planificar un aterrizaje cerca del polo sur lunar hay que saber, para un lugar y una fecha, si habrá Sol (energía, temperatura) y línea de vista con la Tierra (comunicación). Con el Sol y la Tierra a pocos grados del horizonte, una montaña de un par de grados los tapa, y moverse 1 km o atrasarse 2 días cambia el resultado. La información existe en herramientas de NASA, pero son difíciles de usar para quien no es especialista.

## Usuarios
| Usuario | Qué necesita |
|---|---|
| Estudiante o persona curiosa | Entender en 5 segundos si un lugar sirve y por qué |
| Ingeniero o planificador de misión | Números verificables (elevación, azimut, horas de luz y de contacto) y comparar escenarios |
| Jurado | Ver una demo clara y creíble, con validación contra fuentes oficiales |

## Propuesta de valor
Responder una sola pregunta de forma visual y comparable: **¿tengo Sol y puedo hablar con la Tierra en este sitio y en esta fecha?**

## Alcance: MVP por capas
Cada capa es una demo completa. Si algo se rompe, mostramos la última que funcione.

| Capa | Entrega | Prioridad |
|---|---|---|
| 0 | Repo, contrato de datos, datos de prueba, deploy de prueba, tests contra Horizons | Antes del sábado |
| 1 | Elegir sitio y fecha; ver elevación y azimut del Sol y la Tierra | Obligatoria |
| 2 | Dibujo del horizonte real con el Sol y la Tierra encima | Obligatoria |
| 3 | Línea de tiempo de varios días y cuenta regresiva hasta que se ocultan | Obligatoria |
| 4 | Comparación de 2 o 3 escenarios lado a lado | Deseable |
| 5 | "Se atrasó el lanzamiento", pendiente del terreno, mejores ventanas, explicaciones simples | Solo si sobra tiempo |

Objetivo realista: capas 1 a 3 aseguradas, capa 4 como meta probable.

## Fuera de alcance
- Visualización 3D del terreno o render realista de la superficie.
- Calcular iluminación para todo el polo (solo los sitios de la lista y, como mucho, una grilla).
- Backend en producción, cuentas de usuario, base de datos.
- App móvil nativa (la web debe verse bien en celular, nada más).
- Simulación de trayectoria, combustible o del vehículo de aterrizaje.
- Cualquier función que no esté en un issue de la capa vigente.

## Requisitos funcionales (resumen)
1. Lista de 10 a 20 sitios con coordenadas verificadas y fuente.
2. Selector de fecha y hora (UTC) y reproductor de tiempo.
3. Para cada instante: azimut y elevación del Sol y la Tierra, y si cada uno es visible sobre el horizonte.
4. Horizonte del sitio dibujado como silueta de 360° con el Sol y la Tierra como discos.
5. Métricas: horas de luz por día, horas con Tierra visible, tiempo hasta la próxima puesta.
6. La URL guarda sitio y fecha para compartirla.

## Requisitos no funcionales
- **Correctitud**: los ángulos son los de JPL Horizons, leídos sin errores de convención, unidades ni tiempo (verificación del ADR-006).
- **Rendimiento**: la web no hace cálculo pesado; lee JSON precalculados y funciona sin conexión durante la demo.
- **Claridad**: textos en lenguaje simple, como para un estudiante de secundaria.
- **Responsive**: se ve bien en celular.

## Criterios de éxito
1. Un sitio y una fecha conocidos muestran en la web los mismos valores que la interfaz de Horizons (test automático en verde).
2. La demo cuenta una historia completa en menos de 3 minutos (ver `docs/06-PITCH-DEMO.md`).
3. Cualquier persona nueva entiende qué muestra la pantalla sin explicación.
4. El repo corre desde cero siguiendo el README.

## Riesgos principales
| Riesgo | Mitigación |
|---|---|
| Resultado falso que parece razonable (ejes, azimut, unidades) | Convenciones escritas en `CLAUDE.md` y validación contra Horizons desde la capa 0 |
| Proyección del mapa LOLA mal usada | Usar `pyproj`/`rasterio`, nunca convertir a mano |
| Archivos enormes | Resolución media o recorte del polo sur; datos fuera de git |
| Poco tiempo efectivo | Precalcular lo pesado el viernes, apuntar a capas 1 a 3, recortar sin culpa |
| Los recursos oficiales no traen archivos de datos (solo Quickmap, Moon Trek, Horizons y el portal de la CSA) | ADR-006: efemérides desde la API de Horizons; mapa de elevación por confirmar en C0-03, con plan B |
| Horizons caído o con límite de consultas durante el evento | Descargar todo antes del sábado; caché en `data/raw/horizons/` y copia en la nube |

## Preguntas abiertas
- Coordenadas personalizadas: ¿grilla de puntos precalculada o un servidor pequeño? (decidir en un ADR; por defecto, solo sitios de la lista).
- Regla de visibilidad: ¿el cuerpo cuenta como visible con el centro o con el borde sobre el horizonte? (ver `docs/03-DATA-CONTRACT.md`, regla provisional).
- Rango temporal de los datos (por defecto, desde noviembre de 2026, resolución horaria).
