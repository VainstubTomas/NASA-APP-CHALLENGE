# 06. Pitch, demo y entrega

Última actualización: 2026-11-12 · Estado: borrador. El guion definitivo se cierra el sábado a la noche.

## Mensaje central
> Hoy saber si un sitio lunar tiene Sol y línea de vista con la Tierra requiere herramientas de NASA complejas. Nosotros lo hicimos simple, visual y verificable.

## Estructura de la presentación (3 a 5 minutos, ajustar al tiempo que den)
1. **El problema** (30 s): polo sur lunar, Sol y Tierra pegados al horizonte, cualquier montaña los tapa. Analogía del campamento: sol para el panel y señal para el celular.
2. **Por qué es difícil hoy** (30 s): las herramientas actuales (Quickmap, Moon Trek, Horizons) son potentes pero confusas. Mostrar 2 o 3 capturas y lo que resulta confuso (esa lista se arma en el issue C0-10).
3. **Nuestra solución** (30 s): una pantalla, una pregunta.
4. **Demo en vivo** (90 s): ver guion.
5. **Cómo sabemos que está bien** (30 s): los datos salen de JPL Horizons, la herramienta oficial de NASA, y verificamos contra su interfaz que los mostramos bien en tres sitios y tres fechas.
6. **Qué sigue** (15 s): coordenadas propias, más misiones, mejores ventanas de aterrizaje.

Contexto internacional (opcional): el portal de Exploración lunar de la CSA, recurso oficial del desafío, cuenta el aporte de Canadá a Artemis. Usar 1 o 2 datos con fuente si suman (issue C0-12).

## Guion de la demo (historia)
"Una misión iba a aterrizar el día X en este sitio. Se atrasó. ¿Qué cambia?"
1. Elegir un sitio de la lista y la fecha original: se ve el horizonte, el Sol y la Tierra, y los números.
2. Avanzar el reproductor de tiempo: el Sol se acerca a una montaña. Aparece la cuenta regresiva: "el Sol se oculta en N horas".
3. Cambiar la fecha (retraso): mirar la línea de tiempo de luz y de contacto con la Tierra.
4. Comparar los dos escenarios lado a lado y concluir cuál conviene (capa 4).
5. Mostrar el panel de validación contra Horizons (C3-06): para casos conocidos, nuestros números al lado de los de Horizons, con la diferencia.

Elegir un sitio y fechas donde la diferencia sea visible y dramática; probarlas el sábado.

## Plan B de la demo
- La web está desplegada, pero tener también una copia local corriendo y un video corto grabado por si falla internet o el proyector.
- Si una capa no llegó, se demuestra la anterior sin disculpas y se cuenta como futuro.

## Ensayo
- Correr la demo completa al menos dos veces antes de la defensa (dom 15, entre 14:30 y 16:30).
- Probar con alguien de afuera (un mentor o compañero de otro equipo) y anotar dónde se confunde.

## Checklist de entrega (confirmar qué pide la organización)
- [ ] Repo en GitHub público y actualizado, con README claro
- [ ] `main` contiene la versión final y arranca siguiendo el README
- [ ] Datos sintéticos de desarrollo eliminados (`synthetic: true` fuera de `sites.json`)
- [ ] Web desplegada con link en el README
- [ ] Créditos y fuentes de datos citados (JPL Horizons, Quickmap de ASU, NASA Moon Trek, datos LRO/LOLA; CSA si se usa)
- [ ] Presentación lista
- [ ] Subido con margen antes de las 14:30 del domingo 15
- [ ] Video corto de respaldo (si lo piden o por seguridad)
