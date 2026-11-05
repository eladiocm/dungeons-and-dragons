# Arquitectura propuesta del MVP

Estado: propuesta de implementación, pendiente de aprobar el diseño. No atribuir estos módulos al código actual.

## Base y fronteras

Mantener Next.js 16/React 19 y TypeScript del proyecto. Rutas con runtime Node para IA y almacenamiento. Reutilizar proveedores Cloudflare/Ollama, contratos de voz, límites de solicitudes y PWA donde sigan siendo correctos. Leer primero las guías de la versión instalada de Next.

Separar cuatro capas:

1. `domain/`: catálogo tipado, creación, reglas, dados, combate, recursos, inventario y objetivos; funciones puras, sin React, `fetch`, base de datos ni LLM.
2. `application/`: autorización de participante, comandos, validación de propuestas del Master, transacciones y selección del contexto público/privado.
3. `infrastructure/`: repositorio de sesiones, proveedores de IA, voz/transcripción, almacenamiento de imágenes y adaptadores. Ninguna clave llega al cliente.
4. `app/`: asistente de personaje, mesa, hooks de audio/dictado, endpoints y componentes accesibles.

El estado se almacena por el servidor. El cliente mantiene una proyección y borradores, sin poder asignarse PG, oro, resultados o conjuros con un POST arbitrario.

## Modelo conceptual

```text
GameSession
  id, schemaVersion, rulesetVersion, catalogVersion, moduleVersion
  adventureMode: prepared | open-world (segunda etapa)
  version, status: setup | active | ended
  phase: exploration | combat | awaiting-choice | awaiting-roll | narrating | ending
  participants: [{ participantId, characterId, role, ownerId }]
  characters: Record<CharacterId, CharacterState>
  world: { sceneId, time, visibleObjects, facts, objectives, encounter }
  dmState: { undiscoveredFacts, moduleFlags } // nunca proyección pública
  pendingAction?, combat?, ending?

CharacterState
  id, identity, classId, speciesId, backgroundId, level
  abilities, proficiencies, expertise, saves, languages, feats
  hp, tempHp, armor, movement, conditions, deathSaves
  inspiration, hitDice, featureUses, spellbook, preparedSpells, slots
  inventory, equipped, currency

GameEvent
  id, sessionId, sequence, actionId, actorId, type, payload, timestamp

PendingAction
  id, actorId, intent, supportedAction, choices, rollRequests, status
  authorizedCosts, targets, preconditions, expectedStateVersion
```

No campos singleton `player` o `enemy` que impidan más participantes. Los eventos hacen referencia a IDs estables. Estado y eventos se guardan juntos; un evento no es un texto libre que vuelva a ejecutar la IA.

## Almacenamiento y sesión privada

Propuesta: SQLite en `.data/` para desarrollo y primera instancia Node, mediante API disponible en la versión de Node comprobada; operaciones SQL preparadas y transacciones cortas. Confirmar estabilidad y APIs exactas antes de elegir `node:sqlite` o una librería. No depender de funciones de Node 26 en un runtime 24. Si el alojamiento no garantiza disco persistente, implementar el adaptador remoto antes de desplegar; no tratar SQLite local como almacenamiento multirregión.

Interfaz `SessionRepository`: crear, leer para un propietario, confirmar transición con versión, recuperar comando repetido, guardar resultado narrativo e importar/exportar. Test de contrato para cada adaptador. Tablas conceptuales: owners, sessions, participants, events, commands y narrative_jobs; índices únicos para secuencia e idempotencia. El módulo original y catálogo son datos versionados del servidor.

Identidad MVP: cookie aleatoria opaca de 256 bits; guardar su hash, no el secreto. `HttpOnly`, `SameSite=Strict`, `Secure` bajo HTTPS. Validar origen, límites de cuerpo y permisos en toda ruta de sesión/voz/imagen. El ID de partida por sí solo no concede acceso. Perder la cookie puede impedir continuar en ese navegador: exportación privada para copia y recuperación, sin exportar tokens ni cookies.

No migrar contraseñas ni crear un sistema de cuentas todavía. Para grupo, añadir membresías/autenticación sobre `ownerId`/`participantId`; un jugador no puede declarar el `actorId` de otro y obtener acceso.

`.data/`, medios privados, `.env.local`, reportes y artefactos de prueba fuera de Git. Copias/exportaciones las solicita la persona; no publicarlas en entregables ni logs.

## Comandos y respuestas

Rutas propuestas (nombres finales quedan al implementador):

| Operación | Entrada pública | Efecto |
| --- | --- | --- |
| Crear sesión | selección de catálogo + ficha candidata | recalcular y validar todo; no aceptar estadísticas calculadas por cliente |
| Obtener sesión | ID autorizado | proyección pública y eventos desde una secuencia |
| Proponer acción | actionId, version, actorId, texto | interpretar, validar, pedir aclaración/elección o crear pendingAction |
| Elegir | actionId, choiceId, version | consumir una opción legal; no gasto implícito de inspiración/espacios |
| Tirar | actionId, rollId, version | RNG servidor, guardar resultado; resolver cuando están las elecciones necesarias |
| Reintentar narración | eventId | generar solo prosa del evento ya confirmado |
| Ilustrar | sceneRevision autorizado | imagen de lo visible; mantener anterior hasta recibir resultado |
| Narrar | messageId autorizado + voz | usar texto de la intervención existente; no texto arbitrario ilimitado |
| Transcribir | audio limitado | devolver borrador, nunca ejecutar una acción |
| Exportar/importar | esquema versionado validado | nuevo guardado privado; recalcular invariantes y excluir secretos de acceso |

El catálogo público contiene solo opciones y descripciones necesarias para crear personaje. La respuesta de sesión excluye secretos del módulo. Las notas ocultas no deben aparecer en HTML prerenderizado, JS, imágenes, alt-text ni exportaciones públicas.

## Resolución y fallos

1. Comprobar propietario, actor, versión y fase.
2. Registrar/reutilizar commandId/idempotencia. La misma clave con distinto cuerpo se rechaza.
3. Interpretar intención con contexto acotado. El LLM devuelve una propuesta tipada, nunca código ejecutable ni SQL. Datos narrativos no sustituyen instrucciones del sistema.
4. Validar objetivos, visibilidad, alcance, costes, acciones restantes y capacidades. Una propuesta fuera del catálogo no se ejecuta por aproximación silenciosa. Una acción creativa compatible puede convertirse en prueba/adjudicación con consecuencias permitidas por el módulo.
5. Persistir la acción pendiente antes de solicitar dados. El servidor genera resultados mediante `crypto.randomInt`; la animación solo los representa.
6. Permitir las decisiones que cambian resultados (inspiración, rasgos opcionales) en la ventana legal antes de cerrar la resolución. No permitir rerolls ilimitados cambiando de commandId.
7. Confirmar atómicamente nueva versión y eventos de costes, dados, daño, botín y progreso. No mantener transacciones SQLite abiertas mientras espera el LLM.
8. Pedir narración de hechos ya resueltos, con diálogo y ambiente libre. Rechazar/rehacer campos estructurados que contradigan la resolución. Si falla, mostrar los resultados mecánicos y una explicación segura; dejar reintentar prosa sin repetir efectos.

Dos pestañas con la misma versión: solo una transición confirma; la otra recibe conflicto y actualiza. La respuesta perdida de Tirar recupera el resultado anterior. Reiniciar servidor durante narración deja el evento y trabajo pendientes, recuperables sin nuevas tiradas. Acciones pendientes con resultado no pueden borrarse para volver a tirar.

## Master de IA

Tres responsabilidades separadas: interpretar una intención, proponer una respuesta del mundo dentro de hechos/módulo y narrar eventos autorizados. Puede ser el mismo proveedor con prompts distintos, sin un framework de agentes obligatorio.

El Master no decide la acción del héroe, no cambia reglas, no revela secretos, no inventa posesiones, no manipula dados y no altera un final confirmado. Pregunta ante una acción que requiera elección real. No convierte Persuasión en control mental ni obliga a tirar por observar lo obvio.

Contexto: ficha estructurada y recursos actuales; objetivo/hitos; escena pública; hechos y resumen persistidos; ventana reciente del diálogo; secretos únicamente cuando el servidor los necesita para arbitrar. El resumen no tiene autoridad sobre estado ni reemplaza eventos.

Los errores de formato o proveedor no consumen recursos. Presupuesto y cantidad de llamadas acotados por acción. Voz e imágenes comparten cuota con texto: caché por contenido, ilustración solo ante cambio visual, sin reintentos infinitos ni proveedor pagado automático. Añadir autenticación y cuota compartida antes de exposición pública.

El código actual tiene `/api/generate-story` que acepta historial del cliente. La mesa nueva no debe poder usar ese camino para saltarse el motor. Mantenerlo solo para archivo legado, sin efectos de partida, o retirarlo de la ruta nueva.

### Improvisación que cambia el mundo

Decisión propuesta del implementador para cerrar la frontera entre libertad y autoridad: el Master puede crear hechos persistentes y alternativas dentro del mundo preparado, mediante operaciones tipadas y validadas. No queda limitado a escoger entre tres botones, y tampoco recibe acceso a un parche JSON arbitrario del estado.

Operaciones iniciales: añadir un hecho público no contradictorio con procedencia; cambiar disposición de un NPC sin control mental; descubrir o crear un acceso plausible entre lugares existentes; cambiar un objeto del entorno (mover, abrir, romper, encender) conforme a material/estado; transferir un objeto del catálogo desde una fuente existente; activar una amenaza de una plantilla del módulo; revelar o cumplir un hito cuando se satisfacen sus predicados.

El servidor comprueba IDs, ubicación, recursos, precondiciones y resultado de prueba cuando lo hay. El Master propone CD y consecuencia contextual dentro de rangos y plantillas admitidos; el motor calcula bonificadores, dados y resolución. Los hechos nuevos no pueden reescribir una tirada anterior, crear poderes/oro sin fuente, resucitar personajes, modificar reglas o marcar un objetivo sin su condición. Un acuerdo, acceso o solución original se registra como evento, se conserva al recargar y se incluye en contexto futuro.

Ejemplo: «uso la cuerda para entrar por la ventana» puede crear un acceso tras comprobar cuerda, anclaje, distancia y la prueba pertinente; no necesita que el módulo tuviese un botón «ventana». «Convenzo al vigilante de que me deje pasar» puede producir un acuerdo y evitar combate; una tirada alta no obliga a un NPC a aceptar cualquier exigencia. «Tengo una espada legendaria» no crea un objeto poseído.

Una intención fuera de estas capacidades requiere aclaración o explica la limitación con alternativas, sin fingir un efecto que no se guardó. Ampliar el catálogo de operaciones es trabajo de código probado; no una instrucción del jugador al LLM. Crear regiones y campañas enteras pertenece a la futura modalidad abierta.

## Medios y cliente

Un canal de audio activo, cancelación por generación y caché acotada. El reloj del audio manda sobre el resaltado; los eventos de dictado usan IDs de captura para ignorar callbacks antiguos. Cambiar partida, voz o personaje limpia referencias de medios. No reabrir el micrófono por un permiso que se concedió tarde.

IndexedDB: última ilustración y proyección reciente para lectura offline. Es copia del servidor, no autoridad al volver a conectar. Si se supera cuota, conservar estado textual y usar ilustración local de respaldo; no bloquear la partida. Borrador de acción local separado del historial confirmado.

No es necesario WebGL para el MVP: dados pueden animarse con SVG/CSS, conservando fórmula y resultado legibles. Iconos SVG consistentes; evaluar una biblioteca como Lucide antes de añadirla. Evitar un motor 3D y un modelo de voz/transcripción grande en el paquete inicial sin mediciones.

## Entornos y ramas

`develop` para el MVP, `main` como versión integrada. Registrar primero el estado 0.3.0 en un commit de base en develop, preservando los cambios previos; no mezclarlos silenciosamente con la primera regla. Nunca añadir `.env.local` con `git add .` sin revisar lo staged.

Pruebas unitarias con repositorio en memoria y RNG inyectado desde código de pruebas. E2E en build de producción aislada, fixtures IA/audio y SQLite temporal. Ningún endpoint público permite fijar el dado, semilla o ficha del servidor para pruebas.

Publicación posterior: seleccionar hosting compatible, almacenamiento persistente y controles de coste; preparar concreto, verificar y luego integrar/desplegar según alcance autorizado. No hacer upgrade de planes para superar límites.

## Uso de Graphify y Engram

El grafo previo tiene 160 nodos y refleja contratos/hook de juego de una versión anterior; no recoge completamente voz/PWA actual. Se consultó como mapa inicial y se contrastó con código. Regenerar solo después de cambios estructurales; excluir dependencias, claves, `.data`, medios y reportes. Un grafo desactualizado no es prueba de cómo funciona el código.

Engram: guardar acuerdos del usuario, decisiones aprobadas y defectos no obvios, con rutas relativas y claves estables. No guardar secretos, audios del usuario ni fichas personales. La documentación del repositorio mantiene la especificación revisable aunque Engram no esté disponible.

Referencias técnicas: [Node SQLite](https://nodejs.org/api/sqlite.html), guías locales de Next instaladas, fuentes de voz/dictado en `ESPECIFICACION.md`.
