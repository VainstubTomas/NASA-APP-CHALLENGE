# ADR-011: Luna lisa primero, fecha desde el inicio y relieve al final

- **Estado**: Propuesto
- **Fecha**: 2026-11-14
- **Decidieron**: pendiente de confirmar por el equipo (propuesta del sábado a la mañana)
- **Reemplaza en parte a**: ADR-001 (alcance de las capas 2 y 5) y ADR-006 (el mapa de elevación deja de ser de la capa 0)

## Contexto
Los recursos oficiales no trajeron mapa de elevación (ADR-006). Conseguirlo y convertirlo en un horizonte de 360 valores (C0-03, C0-06 y C2-01) es la parte más incierta del proyecto y hoy bloquea la capa 2, que es la demo mínima del sábado a las 14:30. Además, Horizons ya entrega azimut y elevación topocéntricos sobre una esfera lunar sin relieve, así que con esos números solos se puede construir y validar toda la web.

## Decisión
1. **Se arranca con una Luna esfera lisa, sin relieve.** El horizonte local es 0° de elevación en los 360 azimuts (sin refracción, porque la Luna no tiene atmósfera). Un cuerpo es visible si `elevación + radio angular > 0` (regla del contrato con horizonte 0). Las capas 1 a 4 se construyen así.
2. **La fecha y la hora se ingresan desde la primera pantalla.** El selector de fecha y hora UTC es lo primero que se construye en la web (C1-02) y el estado va en la URL. No existe una versión de la web sin fecha, ni siquiera con datos sintéticos.
3. **El relieve real (mapa de elevación LOLA) queda para lo último**, dentro de la capa 5 y después de los otros extras. Si no llega, el proyecto igual está completo.

### Qué cambia en el contrato
Nada. `horizon.json` se sigue generando para cada sitio, con 360 ceros y sin el campo opcional `dem`. La web lee igual con o sin relieve: cuando llegue el relieve solo cambian los datos, no el código.

### Issues que cambian
| Antes | Ahora |
|---|---|
| C0-03 Conseguir el mapa de elevación | **C5-05** (capa 5, relieve) |
| C0-06 Perfil de horizonte de 360 valores | **C5-06** (capa 5, relieve) |
| C2-01 Generar horizon.json de todos los sitios | **C2-01** pasa a generar el horizonte plano (360 ceros). La versión con relieve es **C5-07** |
| C2-02 Dibujo del horizonte con Sol y Tierra | **C2-02** dibuja el horizonte liso. El dibujo de la silueta con relieve es **C5-08** |
| Capa 2: "horizonte real" | Capa 2: "horizonte liso con el Sol y la Tierra encima" |
| Capa 5: extras | Capa 5: extras y, al final, relieve real |

## Alternativas descartadas
- **Dejar el relieve en la capa 2**: la demo mínima dependería de un dato que todavía no tenemos.
- **Sacar el relieve del proyecto**: el texto oficial pide la topografía real y es lo que hace único el polo sur; se deja como meta final.
- **Horizonte plano sin archivo `horizon.json`**: cambia el contrato y obliga a escribir dos caminos de código en la web.

## Consecuencias
- **El resultado es optimista**: sin relieve, un sitio parece mejor de lo que es (una montaña de un par de grados tapa el Sol o la Tierra). La web debe decir de forma visible "horizonte ideal, sin relieve" (criterio de C2-02) y el pitch no puede afirmar que la herramienta muestra montañas que tapan hasta que llegue la capa 5.
- **Los sitios Apolo y los lejanos al polo entran sin problema**: el mapa del polo sur no los cubría, y con horizonte liso ya no importa. Resuelve la decisión pendiente de C0-07.
- **Validación más directa**: lo que muestra la web usa la misma geometría que Horizons, así que los números se comparan uno a uno.
- **La ruta crítica queda en Horizons** (C0-04, C0-05, C0-13): sin descarga y sin lectura verificada no hay capa 1.
- **Issues ya creados en GitHub**: hay que ajustarlos a mano (título, etiqueta `capa:N` y épica). No volver a correr `scripts/create_issues.py` sin revisar: evita duplicados comparando por título, y los títulos cambiaron.
- El orden dentro de la capa 5 es: extras (C5-01, C5-03, C5-04) y, último de todos, el relieve (C5-05 a C5-08, con C5-02).
