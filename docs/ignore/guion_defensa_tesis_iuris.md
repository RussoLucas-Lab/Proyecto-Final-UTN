# Guion — Defensa de Tesis en Video (10 min)
## Proyecto: Iuris — Plataforma de Gestión de Casos Legales

> **Nota antes de grabar:** completá los corchetes `[ ]` con tus datos personales (nombre, director/a, título exacto del TFG) antes de leer el guion. El resto del contenido está adaptado a lo trabajado en Iuris.

---

## [0:00–0:45] Apertura e identificación

"Buenos días. Mi nombre es [Nombre], estudiante de la Tecnicatura Universitaria en Programación de UTN-FRM, y presento mi trabajo final de grado titulado **'Iuris: plataforma de gestión de casos legales con comunicación asistida por IA para estudios de derecho laboral'**, desarrollado junto a mis compañeros Facundo Bustamante y Lisandro Romero, bajo la dirección de [Director/a]. En los próximos diez minutos voy a recorrer el problema que motivó esta investigación, los objetivos, el marco teórico, la metodología, los resultados y las conclusiones."

---

## [0:45–2:00] Problema y motivación

El proyecto surge de una necesidad concreta de un estudio jurídico de la provincia de Mendoza, especializado en derecho laboral y en juicios por accidentes y enfermedades del trabajo. Este estudio, al igual que muchos otros del ámbito jurídico argentino, gestiona sus expedientes, casos y clientes mediante una combinación de planillas de Excel y Lex-Doctor, el software de gestión jurídica más utilizado en el país.

Uno de los principales problemas detectados durante el relevamiento fue el elevado tiempo que abogados y personal administrativo dedican a tareas de comunicación con los clientes. Informar el estado de un expediente, responder consultas sobre el avance de un caso o redactar telegramas laborales son actividades que se realizan de forma manual y representan una parte significativa de la jornada laboral, reduciendo el tiempo disponible para tareas de mayor valor profesional.

La principal causa de esta situación es la dispersión de la información necesaria para realizar dichas comunicaciones. Si bien Lex-Doctor almacena los datos generales de los expedientes, gran parte del seguimiento operativo se lleva en planillas de Excel desarrolladas por cada abogado o administrativo. Estas planillas contienen información como estados procesales, tareas pendientes, plazos y anotaciones internas, pero no siguen una estructura común, suelen duplicarse, desactualizarse y no mantienen integración con el sistema principal. Como consecuencia, antes de poder responder una consulta o elaborar una comunicación, el profesional debe reconstruir el contexto del caso consultando múltiples fuentes de información.

Esta situación se evidencia especialmente en dos procesos cotidianos. El primero es la generación de actualizaciones para los clientes, donde el abogado debe revisar el expediente, identificar las novedades relevantes y redactar un mensaje claro y comprensible. El segundo corresponde a la confección de telegramas laborales para Correo Argentino, proceso que requiere recopilar la información del caso y redactar manualmente un texto que respete las formalidades jurídicas y las restricciones propias de este medio de comunicación. Ambos procesos son repetitivos, demandan una inversión considerable de tiempo y dependen completamente de la intervención del profesional.

A estas dificultades se suman las limitaciones de Lex-Doctor, que funciona únicamente en estaciones de trabajo locales, no ofrece acceso mediante una aplicación web, carece de herramientas de asistencia inteligente para la generación de documentos y comunicaciones, y presenta un modelo de datos poco flexible para adaptarse a las necesidades específicas de cada estudio jurídico.

En este contexto surge **Iuris**, una plataforma diseñada para reducir el tiempo dedicado a las tareas de comunicación mediante la centralización de la información del estudio y la incorporación de herramientas de inteligencia artificial con supervisión humana. El sistema permite automatizar la generación de actualizaciones para clientes y la redacción de telegramas laborales, manteniendo siempre la posibilidad de revisión por parte del abogado antes de su envío. De esta manera, se busca disminuir la carga administrativa, agilizar la comunicación con los clientes y permitir que los profesionales concentren su tiempo en actividades propias de la práctica jurídica.


---

## [2:00–3:00] Pregunta de investigación y objetivos

"La pregunta de investigación que guió este trabajo fue: **¿cómo se puede diseñar e implementar una plataforma de gestión de casos legales que mejore la accesibilidad, incorpore comunicación asistida por inteligencia artificial, y sea más flexible que las soluciones existentes como Lex-Doctor, para un estudio especializado en derecho laboral y ART?**

El **objetivo general** fue diseñar y desarrollar Iuris, una plataforma de gestión de casos legales con arquitectura cloud moderna, comunicación asistida por IA con supervisión humana (human-in-the-loop) y automatización flexible mediante n8n.

Como **objetivos específicos** me propuse:
1. Modelar el ciclo de vida de los expedientes como datos configurables por área —laboral y ART— en lugar de estados fijos codificados en el sistema.
2. Diseñar una arquitectura *feature-first* o de rebanada vertical, tanto en frontend como en backend, que facilite la mantenibilidad del sistema.
3. Integrar comunicación asistida por IA con clientes, garantizando que todo mensaje generado automáticamente sea revisado por un abogado antes de enviarse.
4. Implementar la gestión documental del estudio, incluyendo la generación de telegramas conforme a la Ley 23.789 de Correo Argentino."

---

## [3:00–4:30] Marco teórico / antecedentes

"El trabajo se apoya en cuatro ejes conceptuales principales.

Primero, los sistemas de *legal tech* y gestión de expedientes, tomando como antecedente directo a Lex-Doctor, cuyas limitaciones de accesibilidad y rigidez estructural funcionan como punto de comparación constante a lo largo de la tesis.

Segundo, el concepto de **human-in-the-loop** en sistemas de inteligencia artificial: la idea de que la IA puede generar borradores o sugerencias, pero la decisión final —sobre todo en un contexto tan sensible como la comunicación legal con clientes— debe quedar en manos de una persona.

Tercero, patrones de arquitectura de software modernos, en particular la organización *feature-first*, que prioriza la cohesión por funcionalidad de negocio por sobre la separación tradicional en capas técnicas.

Y cuarto, el modelado de **estados como datos** en lugar de enumeraciones fijas en el código, un patrón que permite que las etapas de un expediente sean configurables sin necesidad de modificar el software cada vez que el estudio cambia su flujo de trabajo.

El aporte de Iuris respecto de estos antecedentes está en combinar estos cuatro ejes en una sola plataforma pensada para un caso de uso real y validada con un cliente concreto."

---

## [4:30–6:30] Metodología

"Para el desarrollo utilzamos la metodología estudiada durante el cursado de la TUP, es decir, **Spec Driven Development (SDD)**: cada funcionalidad nace como una propuesta que se somete a revisión crítica antes de avanzar, siguiendo el ciclo *proponer → diseñar → especificar → planificar tareas → implementar*. Esto nos permitió mantener trazabilidad completa entre cada decisión de arquitectura y su implementación.

El relevamiento de requisitos se hizo junto al estudio jurídico, lo que permitió delimitar el alcance del proyecto con precisión: por pedido explícito del cliente, se dejaron fuera del alcance, por ejemplo, los módulos de reportes y facturación, y se postergó para trabajo futuro un portal de acceso para clientes.

En términos técnicos, el backend se construyó con FastAPI y PostgreSQL, con migraciones versionadas mediante Alembic; el frontend con React; y la orquestación de los flujos de inteligencia artificial —incluida toda interacción con modelos de OpenAI— se resolvió exclusivamente a través de n8n, nunca desde el backend directamente, lo cual es una decisión arquitectónica no negociable del proyecto.

Cada decisión relevante quedó documentada en Architecture Decision Records (ADRs), y cada cambio de implementación se ancló a artefactos de especificación —requisitos funcionales, reglas de negocio, ADRs y casos de uso— antes de ser desarrollado. Esto le dio al proyecto un nivel de rigor y trazabilidad equivalente al de un desarrollo de software profesional, no solo académico."

---

## [6:30–8:00] Resultados

Como primer resultado, se desarrolló un generador automático de mensajes para clientes. Este componente utiliza el estado actual del caso y las tareas pendientes definidas por el abogado para generar un mensaje formal y comprensible con un solo clic, reduciendo significativamente el tiempo necesario para responder consultas sobre el estado de un expediente.

Como segundo resultado, se implementó un proceso batch encargado de generar actualizaciones periódicas para los clientes. El sistema identifica automáticamente aquellos casos cuya última comunicación fue realizada hace quince días o más y genera un mensaje personalizado para cada uno. De esta manera, el abogado dispone al inicio de la jornada de todas las actualizaciones listas para su revisión y posterior envío.

Como tercer resultado, se desarrolló un generador automático de telegramas laborales. A partir de la información del cliente y del caso, el sistema confecciona el texto del telegrama y genera un documento PDF listo para ser compartido con el cliente, disminuyendo considerablemente el tiempo requerido para su elaboración.

Como instancia de validación, el Producto Mínimo Viable (MVP) fue presentado al estudio jurídico que originó la necesidad del proyecto. La solución obtuvo una recepción muy positiva por parte de los abogados y del personal administrativo, quienes manifestaron que las funcionalidades desarrolladas responden a problemáticas reales de su trabajo diario y expresaron su interés en incorporar la plataforma a sus actividades una vez finalizado su desarrollo.


---

## [8:00–9:00] Discusión y conclusiones

Volviendo a la pregunta de investigación, los resultados obtenidos demuestran que es posible desarrollar una plataforma de gestión jurídica que reduzca significativamente el tiempo dedicado a tareas repetitivas, como la comunicación con clientes y la confección de telegramas laborales, mediante el uso de inteligencia artificial con supervisión humana.

Las funcionalidades implementadas cumplen los objetivos planteados y validan que la automatización puede actuar como una herramienta de apoyo al abogado, sin reemplazar su criterio profesional. La revisión obligatoria de cada contenido generado garantiza que el control de las comunicaciones permanezca en manos del profesional.

Finalmente, la evaluación del Producto Mínimo Viable por parte del estudio jurídico permitió obtener una validación inicial de la propuesta, evidenciando que la solución responde a necesidades reales y presenta potencial para integrarse al trabajo cotidiano del estudio.


---

## [9:00–10:00] Limitaciones, trabajo futuro y cierre

Como limitación del trabajo, si bien las automatizaciones desarrolladas podrían ejecutarse de forma completamente autónoma, en el ámbito jurídico resulta indispensable mantener la supervisión y aprobación de un abogado antes del envío de cualquier comunicación o documento generado por el sistema. Esta decisión responde a la naturaleza sensible de la información tratada y busca garantizar que la responsabilidad profesional continúe recayendo sobre el abogado.

Como líneas de trabajo futuro, quedan pendientes el desarrollo de un portal de acceso para clientes y la migración del almacenamiento de documentos de MinIO a Cloudflare R2 para el entorno de producción. Además, durante la validación del proyecto, el estudio jurídico manifestó interés en incorporar nuevos módulos orientados al área de marketing, aprovechando las APIs ofrecidas por las herramientas de Meta para desarrollar dashboards, obtener métricas de campañas y automatizar diversos procesos vinculados a la captación y seguimiento de potenciales clientes.

Para finalizar, Iuris demuestra que es posible construir una alternativa moderna y accesible para la gestión de estudios jurídicos, incorporando herramientas de inteligencia artificial que asistan al profesional sin reemplazar su criterio. El proyecto fue desarrollado a partir de una necesidad real y validado mediante un Producto Mínimo Viable presentado al estudio jurídico, cuyos profesionales manifestaron su conformidad e interés en incorporar la plataforma a su trabajo cotidiano.

Agradezco a nuestro director/a [Director/a] por su tiempo.


---

## Checklist antes de grabar
- [ ] Completar `[Nombre]` y `[Director/a]`
- [ ] Verificar el título exacto de la tesis según lo registrado en UTN
- [ ] Preparar la tabla/gráfico de resultados para el bloque 6:30–8:00 (ej. captura del dropdown de telegramas o del flujo WhatsApp)
- [ ] Ensayar con cronómetro — el guion está calibrado a ~10 minutos leyendo a ritmo natural
