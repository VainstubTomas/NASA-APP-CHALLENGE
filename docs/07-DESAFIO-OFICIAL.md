# 07. Texto oficial del desafío (traducido)

Fuente: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/ (copiado el 2026-11-13; traducción automática al español). Es referencia: no se edita. El análisis contra nuestro alcance está en `docs/00-CONTEXT.md`.

**No incluye criterios de evaluación.** Los recursos están en `docs/00-CONTEXT.md` y en el ADR-006.

---

Las misiones al polo sur de la Luna se enfrentan a limitaciones extremas de iluminación y comunicación, y su planificación requiere una cuidadosa coordinación entre los equipos científicos y de ingeniería. Existen herramientas para determinar las posiciones del Sol y la Tierra en posibles lugares de aterrizaje, pero sus interfaces complejas dificultan la evaluación eficiente de información crucial. Su reto consiste en crear una herramienta o aplicación intuitiva que permita a los planificadores de misiones, educadores y al público comparar rápidamente lugares y fechas de aterrizaje, visualizando las posiciones del Sol y la Tierra con respecto al horizonte para evaluar el potencial de generación de energía y las ventanas de comunicación directa con la Tierra.

## Fondo
El programa de Servicios Comerciales de Carga Lunar (CLPS) de la NASA y otras misiones lunares dependen de una cuidadosa selección de los lugares y fechas de aterrizaje, que equilibren las necesidades de los equipos científicos y de ingeniería. Uno de los desafíos más importantes en este proceso es comprender el entorno local de iluminación y comunicación en un posible lugar de aterrizaje. La posición del Sol determina la disponibilidad de energía para los paneles solares y las condiciones térmicas para el equipo, mientras que la posición de la Tierra determina si es posible la comunicación directa sin satélites de retransmisión.

Este desafío es particularmente acuciante en el polo sur de la Luna, donde se planean numerosas misiones futuras debido a la presencia de hielo de agua y otros recursos de gran valor científico. La geometría del polo sur genera variaciones extremas en la iluminación solar y la visibilidad de la Tierra a lo largo de los diferentes días y estaciones lunares. Pequeños cambios en la ubicación o la fecha de aterrizaje pueden afectar drásticamente tanto el potencial de generación de energía como las ventanas de comunicación, lo que hace que la evaluación rápida del sitio sea fundamental.

En la práctica, el desarrollo de misiones rara vez sigue un cronograma fijo. Los desafíos en el desarrollo del hardware, los retrasos en el lanzamiento u otros factores a menudo obligan a los planificadores de misiones a reconsiderar la fecha y el lugar de aterrizaje originales. Cuando esto sucede, los ingenieros necesitan evaluar rápidamente sitios alternativos en la misma región, o fechas alternativas en el mismo sitio, para comprender cómo estos cambios afectan la viabilidad de la misión. Una herramienta que permita la comparación rápida e intuitiva de múltiples escenarios aceleraría este proceso de toma de decisiones y ayudaría a los equipos a identificar alternativas viables cuando cambian las restricciones.

Las herramientas que proporcionan esta información —como Quickmap de la NASA, Moon Trek y el Sistema Horizons del JPL— están diseñadas para análisis detallados y, a menudo, resultan difíciles de usar eficazmente para quienes no son especialistas a la hora de comparar rápidamente diferentes escenarios. Evaluar cada combinación de sitio y datos implica navegar por múltiples interfaces e interpretar datos brutos. Esto genera una brecha entre los datos técnicos disponibles y las herramientas accesibles necesarias para una planificación ágil de las misiones. Una interfaz intuitiva que traduzca datos topográficos y efemérides complejos en visualizaciones claras y comparables podría ayudar a superar esta brecha.

## Objetivos
Tu reto consiste en crear una herramienta o aplicación que permita evaluar rápidamente las opciones de lugares de aterrizaje lunar. Tu solución puede incluir:

- **Selección y comparación interactiva de sitios**: Considere permitir que los usuarios elijan entre una lista seleccionada de sitios de aterrizaje destacados, como misiones Apolo anteriores, objetivos de futuras misiones CLPS, objetivos de otras misiones lunares comerciales o sitios de aterrizaje de programas lunares de otros países, así como la posibilidad de ingresar coordenadas lunares personalizadas. También puede considerar habilitar la comparación simultánea o secuencial de varios sitios para ayudar a los usuarios a evaluar rápidamente las ventajas y desventajas.
- **Flexibilidad de fecha y hora**: Considere la posibilidad de permitir que los usuarios seleccionen fechas y horas de aterrizaje, y proporcionar herramientas para explorar cómo cambian las condiciones a lo largo de los diferentes días o estaciones lunares. Esto permite a los usuarios comprender cómo los ajustes en el cronograma de la misión afectan su viabilidad.
- **Visualización de la posición del Sol y la Tierra**: Muestra las posiciones del Sol y la Tierra con respecto al horizonte en un lugar de aterrizaje seleccionado y en una fecha determinada. Puedes considerar mostrar cuánto tiempo falta para la puesta del sol, ya que esto influye directamente en las operaciones de la misión y en las ventanas de generación de energía.
- **Evaluación de energía y comunicaciones**: Considere destacar indicadores clave como el ángulo de elevación solar (que afecta la eficiencia de la generación de energía), la duración de la luz solar y las ventanas de visibilidad de la Tierra. Estos indicadores ayudan a los planificadores de la misión a evaluar rápidamente si una combinación de sitio y fecha es viable.
- **Diversos enfoques de visualización**: puede explorar mapas en 2D, visualizaciones de superficies en 3D u otras representaciones creativas que ayuden a los usuarios a comprender las relaciones espaciales entre el lugar de aterrizaje, el Sol y la Tierra.
- **Dinámica temporal**: Puede considerar la posibilidad de crear animaciones o vistas de línea de tiempo que muestren cómo cambian las posiciones del Sol y la Tierra a lo largo de un día lunar o de varios días, lo que ayudará a los usuarios a comprender la duración y el momento de las ventanas operativas.
- **Accesibilidad para todos los niveles de habilidad**: Su herramienta podría ser útil para los planificadores de misiones que buscan información técnica detallada para la toma rápida de decisiones, así como para educadores y el público en general que sienten curiosidad por saber por qué la Luna presenta desafíos de ingeniería tan particulares.

Te animamos a ser creativo/a en la presentación de esta información. Tu solución podría ser una aplicación web, una aplicación móvil, una visualización interactiva, un juego educativo o cualquier otro formato, siempre y cuando permita una evaluación rápida y eficiente del sitio.

## Consideraciones potenciales
Usted puede (pero no está obligado a) considerar lo siguiente:

**Enfoque técnico:**
- Los datos de efemérides —las posiciones y los movimientos de los cuerpos celestes— se pueden calcular utilizando herramientas como el Sistema de Horizontes del JPL, o bien se pueden utilizar conjuntos de datos precalculados.
- Los datos de topografía lunar procedentes de fuentes como el altímetro láser del orbitador lunar (LOLA) pueden ayudar a crear visualizaciones realistas de la superficie y cálculos precisos del horizonte.
- Considera cómo abordar la falta de atmósfera de la Luna al calcular la posición del horizonte. Sin refracción atmosférica, el horizonte viene determinado por el terreno local y el borde de la esfera lunar visto desde el lugar de aterrizaje.
- El ángulo de elevación solar es una métrica clave para la generación de energía, y conviene calcularlo y mostrarlo de forma destacada.

**Experiencia de usuario:**
- Su interfaz podría priorizar la comparación rápida de escenarios, lo que permitiría a los planificadores de misiones evaluar de manera eficiente múltiples combinaciones de sitios y fechas.
- Considere cómo comunicar claramente el tiempo restante antes de la puesta del sol o la puesta de la Tierra, ya que se trata de información operativa fundamental.
- Piensa en cómo hacer evidentes las diferencias extremas entre las condiciones lunares y terrestres; pueden resultar fascinantes cuando se visualizan de forma eficaz.
- Podría considerar la posibilidad de implementar funciones que ayuden a los usuarios a comprender por qué pequeños cambios de ubicación o fecha tienen un gran impacto en la viabilidad de la misión.

**Datos y precisión:**
- Conviene tener en cuenta la topografía real de la Luna, ya que la elevación del terreno puede afectar significativamente la posición del horizonte y las ventanas de visibilidad.
- Considere si su herramienta tendrá en cuenta factores como la libración (oscilación) de la Tierra o las variaciones orbitales de la Luna.
- El terreno del Polo Sur es particularmente complejo, y conviene considerar cómo representar las pendientes pronunciadas y los cráteres profundos que crean condiciones de sombra extremas.

**Compromiso e impacto:**
- Su solución podría ayudar a los planificadores de misiones a coordinar los equipos científicos y de ingeniería durante el desarrollo de la misión.
- Podría ayudar a los equipos a responder con rapidez cuando los cambios de horario o los desafíos en el desarrollo del hardware requieran ajustes en la fecha o el lugar de aterrizaje.
- También podría servir como herramienta educativa para ayudar a los estudiantes y al público en general a comprender los desafíos de la exploración lunar y por qué la planificación de las misiones es tan compleja.

Para obtener datos y recursos relacionados con este desafío, consulte la pestaña Recursos en la parte superior de la página. Es posible que se añadan más recursos antes de que comience el hackathon.
