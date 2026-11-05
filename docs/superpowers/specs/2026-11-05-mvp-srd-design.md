# MVP de aventura de rol — propuesta para revisión

Fecha: 5 de noviembre de 2026. Rama: `develop`. Estado: diseño; **no describe funcionalidades ya implementadas**. Base actual: aplicación narrativa 0.3.0.

## Acuerdos del usuario

- Reglas SRD 5.2.1 en español; personajes de nivel 1; guerrero, pícaro, clérigo y mago.
- Primero una aventura preparada con acciones libres. Después, una modalidad de mundo abierto elegible al crear partida.
- La IA siempre dirige como Master. El jugador decide sus acciones; la IA no las elige por él.
- Creación y revisión de personaje antes de habilitar Iniciar partida.
- Escena ilustrada persistente, chat a su derecha; ficha e inventario bajo la escena; dados bajo el chat.
- Configuración, nueva partida e instalación en menú de tres puntos arriba a la derecha.
- Narración automática por defecto, desactivable; controles de iconos sobre el chat y seguimiento del texto leído.
- Entrada por texto o manteniendo pulsado el micrófono. Soltar detiene el dictado; nunca envía. El jugador revisa y envía expresamente.
- Móvil y PWA; documentación para agentes; trabajo por etapas con pruebas unitarias y E2E; `develop` antes de integrar en `main`.

## Enfoque propuesto

Conservar Next.js/React, las integraciones de texto, imágenes y voz existentes y la PWA. Añadir un motor de reglas independiente y una sesión persistida por el servidor. El motor determina las consecuencias mecánicas; el Master interpreta intenciones y narra resultados ya resueltos.

Alternativas consideradas:

1. Chat abierto con una ficha actualizada por la IA: menor trabajo inicial, pero permite inventar tiradas, perder objetos y contradecir las reglas. No cumple la fidelidad solicitada.
2. Motor verificable + aventura preparada + improvisación narrativa: seleccionado para la primera etapa, con mundo abierto después según la respuesta del usuario.
3. Simulador completo con tablero táctico, todos los niveles y contenido: amplitud superior al MVP; requeriría otra escala de trabajo y no es necesaria para esta primera partida.

La equivalencia con todo D&D no se promete. Se implementará fielmente el subconjunto publicado y probado. Las adaptaciones para jugar solo y las opciones todavía ausentes se documentarán por separado.

## Recorrido antes de jugar

1. Inicio: Continuar (si hay partida) o Crear partida. No llamar a la IA ni iniciar audio al visitar la página.
2. Modalidad: Aventura preparada disponible. Mundo abierto se explica como próxima etapa; no simular que se puede iniciar.
3. Personaje: nombre, clase, especie y trasfondo; detalles personales y alineamiento como información narrativa, sin penalizaciones inventadas.
4. Características: repartir 15, 14, 13, 12, 10 y 8 entre Fuerza, Destreza, Constitución, Inteligencia, Sabiduría y Carisma. Ofrecer reparto sugerido editable. Aplicar mejoras del trasfondo válidas (+2/+1 o +1/+1/+1).
5. Competencias y rasgos: elegir habilidades, pericias, idiomas, dotes y opciones de clase. Evitar pérdidas por competencias duplicadas conforme a la regla aplicable.
6. Equipo y magia: paquetes permitidos del catálogo, armas equipadas, maestrías, trucos y preparación de conjuros. Explicar función y coste de cada opción.
7. Revisión: PG, CA, iniciativa, velocidad, habilidades, salvaciones, capacidades, equipo y recursos calculados por el motor. Mostrar qué falta y permitir volver atrás.
8. Iniciar partida: crear sesión solo si es válida, pedir primera escena y habilitar audio tras este gesto explícito del jugador.

La primera escena debe situar al personaje, presentar el conflicto, el objetivo y una razón personal para implicarse, describir pistas observables y terminar con una pregunta. No revelar secretos del Master ni soluciones de acertijos.

## Catálogo inicial propuesto por el implementador

- Cuatro clases aprobadas; nivel fijo 1 durante la aventura. Experiencia/registro de progreso visibles; subir de nivel no se habilita hasta existir sus reglas y elecciones.
- Cuatro especies: humano, enano, mediano y alto elfo. Se propone limitar inicialmente el elfo a ese linaje, indicado en el selector. Los demás linajes/especies se incorporarán después.
- Cuatro trasfondos del SRD: acólito, criminal, erudito y soldado.
- Dotes de origen del catálogo: Alerta, Atacante salvaje, Habilidoso e Iniciado en la magia. Para esta última, listas iniciales de clérigo y mago; la lista de druida queda fuera del primer catálogo y se indica expresamente.
- Estilos de combate del guerrero y maestrías de las armas disponibles se implementan antes de habilitarlos. No dar Acción súbita al guerrero, Acción astuta al pícaro ni Canalizar divinidad al clérigo en nivel 1.
- Magia: catálogo inicial acotado a trucos y conjuros SRD de nivel 1 con efectos implementados, más rituales de ese catálogo. El mago mantiene libro de seis conjuros, prepara cuatro y tiene dos espacios de nivel 1; clérigo prepara cuatro, tiene tres trucos (cuatro con Taumaturgo) y dos espacios. Las dotes y el linaje añaden sus recursos propios sin confundirlos con espacios de clase.
- No habrá elección de poderes que solo estén descritos y no funcionen. El manifiesto del catálogo debe enumerar cada hechizo, arma, maestría y condición habilitados y su prueba.

Estas restricciones del catálogo acotan contenido; no autorizan a cambiar silenciosamente cómo funciona una opción publicada. `REGLAS.md` identifica referencias y diferencias de edición importantes.

## Turno y dados

El jugador escribe o dicta una intención libre. Una acción segura, posible y sin incertidumbre relevante no lleva tirada. Si es imposible, se explica por qué antes de consumir recursos. Si la intención es ambigua, el Master pide una aclaración.

Cuando procede una prueba, se presenta la acción interpretada, habilidad o salvación, sus modificadores y el motivo de ventaja/desventaja. El botón Tirar permite realizar una única tirada vinculada a esa acción. Una animación muestra los dados; el resultado autoritativo procede del servidor, nunca del texto de la IA ni de la animación. El daño se tira cuando corresponda.

- Pruebas: d20 + modificador + competencia aplicable frente a CD. Pericia duplica la competencia, no el modificador. Igualar la CD cuenta como éxito.
- Ventaja/desventaja: dos d20 y mayor/menor; no se acumulan y se cancelan cuando concurren ambas. Las excepciones de especie/rasgo quedan en el motor.
- Ataques: contra CA; 1 natural falla y 20 natural acierta y duplica dados de daño, no los modificadores. No aplicar éxito/fallo automático por 20/1 a todas las pruebas de habilidad.
- Iniciativa, acción, movimiento, acción adicional y reacción se registran por participante. Enemigos y jugador siguen el mismo orden de combate. No resolver tres acciones de combate como si fueran una sola.
- El jugador conserva decisiones sobre objetivo, arma, conjuro, gasto de recursos, inspiración, recuperación y efectos opcionales. El motor puede pedir una elección antes de confirmar la resolución.
- Las tiradas automáticas de enemigos y los daños aparecen en el registro. Nunca volver a sortear un resultado al reintentar la red o al recargar.

Ver `ARQUITECTURA.md` para comandos, concurrencia, versión de estado e idempotencia.

## Ficha, objetos y combate

La ficha muestra PG actuales/máximos/temporales, CA, velocidad, iniciativa, competencias, salvaciones, condiciones con duración, inspiración, dados de golpe, espacios, usos de rasgos, monedas y equipo.

El inventario distingue objetos equipados, consumibles, cantidades, peso, objetos de misión y botín disponible en la escena. La IA no concede oro ni crea equipamiento con prosa: propone una interacción del catálogo/aventura y el motor valida posesión, cercanía, cantidad y coste. El mismo botín no puede cobrarse dos veces. Cada cambio aparece en el diario y en la ficha.

La primera versión usa combate descrito, sin cuadrícula. Distancias, cobertura, visibilidad, alcance y posiciones relevantes se registran de forma estructurada; no basta con que la prosa diga «cerca». Se explican los movimientos y ataques de oportunidad antes de confirmar acciones que los provoquen.

El catálogo de conjuros define ataque/salvación, daño/curación, concentración, componentes, alcance, objetivos, duración y economía de acciones. El servidor rechaza un conjuro no preparado, sin espacio o imposible en la situación actual. Concentración solo permite un efecto simultáneo; el daño requiere su salvación correspondiente. Los rituales avanzan el tiempo y no gastan espacios.

Los descansos respetan tiempo, seguridad, interrupciones y recursos SRD. No son un botón para curarse ilimitadamente entre ataques. El descanso corto no repone todos los espacios de mago/clérigo; Recuperación arcana es un recurso separado.

Llegar a 0 PG no equivale siempre a morir. Aplicar inconsciencia, salvaciones contra muerte, estabilización, daño masivo y recuperación. El jugador tira sus salvaciones; no puede ejecutar acciones normales estando inconsciente. Derrota, muerte y éxito son desenlaces distintos.

## Aventura propuesta: La última luz de Valdumbría

Mundo y personajes originales. Una campana anuncia que el faro protector de Valdumbría se ha apagado. Falta la lente de ámbar; la niebla empieza a cubrir el camino y una aprendiz desapareció al investigar el antiguo molino.

Objetivo explícito: recuperar la lente y reactivar el faro. Objetivos secundarios: averiguar qué ocurrió y ayudar a la aprendiz. Pueden cumplirse de distintas maneras y el epílogo debe reconocerlo.

Cinco lugares: plaza/refugio, camino anegado, molino abandonado, cámara del mecanismo y faro. Tres hitos verificables: localizar la lente, conseguirla, reactivar el faro. Hay pistas redundantes: una prueba fallida cambia coste/riesgo, pero no elimina la única pista necesaria.

En cada conflicto hay alternativas compatibles con lo que sucede: observar, dialogar, negociar, usar equipo o magia, buscar otro acceso, retirarse o combatir. No son botones que limiten las acciones posibles. El Master reacciona también a propuestas no previstas.

El módulo define objetos, NPC, encuentros para un aventurero de nivel 1, posiciones y amenazas. Los enemigos adaptados y ayudas para juego en solitario se etiquetan como contenido original/adaptación del módulo. No enfrentar al personaje solo a encuentros calculados para cuatro aventureros.

El tiempo del mundo avanza por desplazamientos, rituales, descansos y acciones relevantes; charlar o enviar un mensaje no consume arbitrariamente una unidad. Un aviso anticipa consecuencias del tiempo antes de una decisión importante. No se introducen finales inevitables escondidos detrás de un contador invisible.

Desenlaces: éxito completo, éxito con consecuencias, fracaso de misión con supervivencia, retirada voluntaria y muerte según reglas. Una partida terminada muestra epílogo, objetivos alcanzados, destino del personaje y registro. No ofrece otra acción como si siguiera activa.

La duración objetivo será una sesión corta, sin prometer un número exacto de turnos ni forzar al jugador por un único recorrido. El contenido detallado y los encuentros se fijan y prueban antes de habilitar la aventura.

## Diseño de la mesa

Estética: mesa de aventura fantástica, con ilustración como foco principal, paneles de tinta oscura y acentos de latón. Evitar aspecto de panel administrativo, adornos que reduzcan lectura y texto diminuto. Propuesta de paleta: tinta `#141820`, pizarra `#202733`, pergamino `#F0E6D2`, latón `#D5AE67`, verde de curación `#84B89A`, rojo de daño `#E28B87`. Contrastar estados reales antes de aprobar colores.

Tipografía: títulos serif de carácter fantástico, cuerpo sobrio y legible. Fuentes locales o del sistema para conservar arranque sin conexiones externas. Texto base de 16 px o más; no usar una tipografía decorativa para párrafos largos.

En escritorio: dos columnas, aproximadamente 60/40. Izquierda: escena arriba y ficha debajo. Derecha: chat con controles del narrador arriba y compositor accesible; bandeja de dados debajo. Cabecera compacta con nombre de aventura y menú ⋮. Objetivo actual visible dentro del área de juego.

La imagen actual permanece mientras el jugador actúa o conversa. Al cambiar la escena, se conserva la anterior hasta cargar la nueva, con indicación discreta de preparación. En el primer arranque o si falla la generación siempre existe una ilustración local del lugar; nunca un panel vacío o una imagen rota. Guardar la escena actual y su ilustración en IndexedDB con tamaño acotado; restaurarla al volver, sin generar otra automáticamente. La API devuelve descripciones visibles separadas de secretos del Master.

En móvil: una columna con escena compacta seguida de chat/compositor. Resumen de PG/CA y objetivo siempre accesible; ficha, inventario y dados se abren mediante pestañas o paneles accesibles. No intentar encoger cuatro paneles de escritorio. La animación de una tirada puede abrir la bandeja de dados sin ocultar su resultado en el chat. Teclado virtual no debe tapar el texto ni Enviar.

Menú ⋮: nueva partida (con confirmación si sustituye una existente), continuar/guardar/exportar, configuración de voz/volumen/velocidad/seguimiento del texto, ilustraciones/ahorro de datos, movimiento reducido e instalar PWA. La instalación no aparece como una barra ajena al juego. No mostrar nombres de modelos/proveedores en la mesa.

Controles del narrador: reproducir/pausar, detener y repetir, con SVG de una sola familia, botones de al menos 44 px, nombres accesibles y pistas al enfocar. Estado de carga/error accesible. No depender de color, hover o emoji. Animación de dados opcional con `prefers-reduced-motion`; la animación no decide ni oculta el resultado.

## Narración y seguimiento del texto

Por defecto se narran automáticamente las nuevas intervenciones del Master tras iniciar la partida. No narrar al jugador, estadísticas técnicas ni descripciones secretas. Nunca reproducir varias voces a la vez; detener la narración al comenzar a dictar. Preferencias persistentes. Recargar no debe volver a leer todo el historial.

El navegador puede bloquear reproducción automática aun tras una espera de red: conservar la escena y mostrar el icono de reproducir, sin insistir ni perder audio. El desbloqueo se intenta con el gesto Iniciar partida; no se promete eludir las políticas del dispositivo.

La palabra activa se distingue en color y énfasis, con un pequeño aumento visual que no redistribuya las líneas. No modificar el tamaño del párrafo entero ni producir saltos durante la lectura. Mantener el desplazamiento del usuario; permitir desactivar seguimiento.

**Límite técnico pendiente de validar en un prototipo:** Aura devuelve audio sin tiempos por palabra. Propuesta inicial: voz del dispositivo con eventos `boundary` cuando existan; voz natural por frases con avance de palabras estimado desde la duración real del fragmento. Sincronizar pausa, velocidad, repetición y saltos con el reloj de audio, sin temporizador que siga avanzando pausado. La estimación no se presentará como alineación exacta. Si se exige precisión palabra a palabra en todas las voces, añadir alineación forzada como etapa propia y medir su latencia/cuota antes de seleccionarla. No asumir que una transcripción por segmentos equivale a marcas exactas de palabra.

## Dictado de acciones

Web Speech API cuando el navegador ofrezca reconocimiento adecuado. Pulsar mantiene una captura identificada; transcripción provisional en el compositor sin perder el texto escrito previamente. Soltar, `pointercancel`, pérdida de foco, bloqueo, navegación o desmontaje detienen escucha; limpiar escuchadores y descartar resultados de capturas antiguas.

Accesibilidad: además del gesto, ofrecer modo de iniciar/detener con teclado y toque, claramente separado de Enviar. No usar una tecla global que capture contraseñas u otros formularios. Dar feedback de escucha y del permiso denegado.

Permiso solicitado solo al activar micrófono. Si el usuario suelta antes de conceder permiso, no empezar a escuchar después. Los últimos resultados pueden finalizar lo ya capturado al soltar, pero no admitir nueva voz. Nunca autoenviar, incluso si se reconoce «enviar».

Alternativa propuesta donde no haya dictado en vivo: grabar solo mientras se mantiene pulsado y transcribir al soltar con Whisper a través del servidor. Se indica «Transcribiendo»; **no se promete texto en vivo en ese modo**. Si no hay captura compatible, se mantiene entrada por texto y un mensaje concreto. No descargar un modelo pesado en el móvil sin una decisión explícita.

Audio de entrada temporal, límites de duración/tamaño, sin conservarlo ni incluirlo en telemetría. La transcripción sigue siendo texto editable del jugador, no instrucciones para el servidor. No garantizar funcionamiento sin Internet: algunas implementaciones de reconocimiento usan servicios remotos.

## Persistencia, PWA y recuperación

- Estado autoritativo y eventos guardados antes de narrar sus consecuencias. Si falla el narrador después de tirar, reintentar solo la narración; no repetir daño, botín o gasto.
- Guardar ficha, escena, objetivos, condiciones, turnos, inventario y registro con esquema versionado. Exportar/importar con validación para copias personales. El control de sesión no viaja en la exportación.
- Las partidas v1 de chat libre se conservan como archivo de lectura; no fabricar retroactivamente personajes, tiradas o estadísticas. No borrarlas por empezar una partida del nuevo formato.
- Sin conexión: abrir interfaz, consultar última ficha/historial/imagen. No continuar acciones contra estado antiguo ni simular llamadas a IA. Un borrador no enviado puede conservarse localmente.
- Service worker solo almacena recursos públicos. Ningún `/api`, cookie, token, voz privada o secreto del Master en cachés públicas.
- Instalación en teléfono necesita origen alcanzable con HTTPS y backend accesible. Publicar no forma parte de esta fase; se prepara despliegue tras probar e integrar la versión.

## Preparación para varios jugadores

Desde el inicio usar sesión, colección de participantes, personaje por participante, actor activo, eventos ordenados y versión de estado. Nunca codificar el único héroe como variable global. La interfaz selecciona el personaje local y el motor recibe `actorId`.

Primera etapa: una persona, una sesión privada. No habilitar salas, invitaciones, chat entre personas ni controles para personajes de otros usuarios. Segunda etapa multijugador requiere identidad, membresía, sincronización, límites compartidos y pruebas de concurrencia; la preparación del modelo no equivale a que ya funcione multijugador.

## Etapas y condiciones de salida

1. Especificación y catálogo: decisiones revisadas, fuentes y reglas etiquetadas, módulo definido y lista de pruebas. Puerta de diseño antes de modificar el producto.
2. Motor y creación: dados, atributos, ficha, inventario y recursos; pruebas de cada regla soportada. Asistente de personaje y revisión, sin empezar aventura al cargar.
3. Sesión y aventura: persistencia, acciones libres interpretadas/validadas, combate, misión y finales; caminos de victoria/fracaso/muerte reproducibles en pruebas sin IA.
4. Mesa adaptable: escena persistente, chat, ficha/inventario, dados y menú; pruebas con teclado y pantallas pequeñas.
5. Voz: narración automática, controles y seguimiento visual; dictado mantener/revisar/enviar con pruebas de cancelación y dispositivos reales cuando estén disponibles.
6. Integración: E2E de partida completa, recuperación de errores y offline/PWA; revisión independiente, documentación final y comprobaciones de producción. Después preparar integración de `develop` a `main` y despliegue.

No declarar terminada una etapa por tener pantallas que aparentan sus resultados. `PRUEBAS.md` define la evidencia de aceptación. El trabajo pendiente se registra explícitamente.

## Decisiones propuestas que debe revisar el usuario

- Cuatro especies iniciales (humano, enano, mediano y alto elfo), cuatro trasfondos y catálogo limitado de magia; sin progresión de nivel todavía.
- Aventura original La última luz de Valdumbría y su estructura; tono de fantasía aventurera con misterio y consecuencias, sin gore necesario.
- Combate descrito con distancias registradas, sin tablero táctico en el primer MVP.
- Seguimiento aproximado de palabras para voz natural; límites de compatibilidad y transcripción al soltar cuando falte dictado en vivo.
- SQLite local para desarrollo y MVP de una instancia, con adaptador de almacenamiento para el alojamiento elegido después. Las partidas se autentican con sesión privada; no una cuenta multijugador todavía.

## Fuentes

- [SRD oficial y versiones](https://www.dndbeyond.com/srd).
- [SRD 5.2.1 español, PDF oficial](https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf). Usar numeración impresa en referencias.
- [Aura-2-es: parámetros y audio](https://developers.cloudflare.com/workers-ai/models/aura-2-es/).
- [SpeechRecognition: compatibilidad y servicios remotos](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
- [Eventos de límite de palabra/frase](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event).
- [Whisper: transcripción y segmentos](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/).

Consultadas el 5 de noviembre de 2026. Conservar atribución del SRD y distinguir material original y adaptaciones; el uso del SRD no convierte el proyecto en un producto oficial.
