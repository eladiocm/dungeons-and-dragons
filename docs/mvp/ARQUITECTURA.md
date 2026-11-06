# Arquitectura del MVP

Implementación 0.4.1, Next 16.4.5/React 19.3.1/TypeScript 7, runtime Node>=24.15. Se verificó Node 24.19; `node:sqlite` usa DatabaseSync, consultas preparadas y WAL. No depende de las APIs cambiadas de Node26.

## Fronteras

- `src/game`: catálogo, fichas, dados, reglas, combate, magia y aventura. Funciones puras con Roller inyectado; no React, red, SQL ni LLM.
- `src/server`: SessionStore, GameService, Master, copias, validación HTTP y medios. El servidor es la autoridad del estado.
- `src/app`: creador, mesa y hooks. Consume PublicSession, guarda proyección/borrador/ilustración para lectura, nunca restaura esas copias sobre el servidor.
- `src/lib`: proveedores, contratos, audio, seguimiento y controlador de dictado. El módulo game-contract también decodifica el archivo antiguo.

Las rutas antiguas `/api/generate-story`, `/api/generate-image` y `/api/narrate` devuelven410. Sus utilidades conservadas no forman parte del flujo nuevo de juego.

## Dominio y flujo

GameSession versión de esquema 2 contiene participantes, BattleState con actores/posiciones/presupuestos, WorldState, eventos, mensajes, objetivos/final, notas privadas y acción pendiente. actorId/participantId están separados; esto prepara contratos para grupo, pero no añade membresías ni conexión multijugador.

PublicSession elimina dmState, snapshots base/preview y objetos/NPC no presentes. El cliente no puede suministrar PG, inventario, tiradas o secretos. Los planes son una unión validada, no JSON Patch ni código ejecutable.

1. Crear recalcula CharacterDraft contra catálogo. No aceptar estadísticas derivadas del navegador.
2. Intención valida identidad, actor, versión y fase; obtiene arrendamiento persistido; pide al Master una acción tipada o aclaración.
3. La propuesta pasa por el motor. Si necesita azar se guarda PendingAction sin aplicar efectos.
4. Tirar guarda una cinta de dados por actor/grupo. Repetir petición no repite RNG. Inspiración y Fortuna tienen ventanas/contadores finitos y solo afectan dados propios.
5. Confirmar persiste efectos/eventos/mensajes juntos. La base y vista previa son snapshots finitos, sin pending recursivo.
6. Narrar modifica únicamente el mensaje del evento confirmado. Si falla, los hechos ya quedan guardados y el botón de reintentar prosa no repite mecánica. Las enmiendas se propagan a snapshots pendientes para no resucitar texto antiguo al confirmar.

Se usan `crypto.randomInt`, RNG inyectado en unitarias y preload exclusivo de E2E. No hay semillas ni sobrescrituras de dados en endpoints públicos.

## Persistencia

Directorio `GAME_DATA_DIR` (defecto `.data`), fuera de Git y del bundle. Creación perezosa al atender peticiones, sin abrir base durante build.

| Tabla | Responsabilidad |
|---|---|
| sessions | ID, hash de propietario, versión, estado/eventos JSON y fecha |
| creations | Clave de creación por propietario y hash de cuerpo |
| commands | Clave única por sesión, hash de petición y versión resultante |
| jobs | Arrendamientos y resultados de interpretación/prosa/medios |
| media | Caché persistente acotada de 24 ilustraciones |

Transacciones cortas BEGIN IMMEDIATE para creación/CAS/confirmación. Nunca esperar IA dentro de una transacción. Misma clave con diferente cuerpo devuelve409; reintento idéntico devuelve estado actual sin ejecutar el callback. Otra pestaña con versión vieja recibe conflicto y actualiza, conservando borrador.

Cookie de 256 bits HttpOnly/SameSite Strict, Secure con HTTPS; solo su SHA256 se guarda. ID de sesión no concede acceso. Comprobar origen exacto y cuerpo limitado. Los límites por proceso protegen un MVP privado; no equivalen a autenticación pública o cuotas distribuidas.

Exportación AES256GCM con clave aleatoria de 32 bytes `.data/save-key`. Cifra secretos y autentica la ficha. Importa una copia con IDs de sesión/mensajes/eventos remapeados. Clave de instalación obligatoria: preservar toda `.data` al migrar. No hay restauración portable por contraseña ni cuenta de usuario.

## Master y medios

Un mismo proveedor con prompts distintos: interpretar intención y narrar hechos confirmados. Contexto acotado: últimos mensajes/eventos, ficha, escena y hechos persistidos. Notas privadas solo para arbitraje; nunca para prompts de imagen o respuestas públicas. Una salida inválida no gasta recursos ni se interpreta por aproximación silenciosa.

Operaciones creativas: hechos coherentes, accesos previstos, disposición de NPC presente, estado de objeto visible y botín existente desbloqueado. Predicados del módulo deciden objetivos/final. La prosa no concede oro, daño, poderes ni victoria. La IA puede equivocarse en texto; los hechos y cifras confirmadas están disponibles en el diario/ficha.

| Ruta | Entrada autorizada |
|---|---|
| GET/POST /api/sessions | Listar/crear para cookie privada |
| GET /api/sessions/:id | Proyección pública |
| POST .../intent | id,actorId,expectedVersion,text |
| POST .../commands | Comando validado y expectedVersion |
| POST .../narrative | messageId ya existente |
| POST .../image | sceneRevision actual; prompt calculado en servidor |
| POST .../speech | messageId,chunkIndex,voz; texto calculado en servidor |
| POST .../transcribe | WAV limitado; solo devuelve borrador |
| GET .../export; POST /api/sessions/import | Copia autenticada privada |

Imágenes ante sceneRevision, no por cada frase. Ilustración local siempre, anterior conservada hasta recibir nueva y copia en IndexedDB. Voz caché de 4 mensajes en cliente y 16 segmentos y 16 MB en servidor. Aura no ofrece marcas por palabra: seguimiento visual estimado con reloj/duración; dispositivo usa boundary si existe.

DictationController independiente de React solo escribe borrador. Generaciones/held evitan permisos, onstop y resultados antiguos; cancelar aborta transcripción. MediaRecorder solo mientras se pulsa, AudioContext convierte a PCM 16 mono a 16 kHz; servidor calcula duración real del WAV y rechaza más de 45 s. No se conserva audio de entrada.

## PWA y evolución

SW guarda shell y recursos públicos. Excluye toda `/api`, cookies, audio y datos privados. IndexedDB/localStorage del navegador contienen proyección y borrador para lectura privada de ese perfil. Sin servidor no se ejecutan acciones.

Antes de multijugador: cuentas/membresías por participante, sala, turnos y sincronización, cuotas compartidas, repositorio remoto o coordinación persistente. SQLite local no es multirregión. Mundo abierto necesitará generador/validación de lugares, actores, objetivos y finales; no basta cambiar un prompt.

Grafo estructural actualizado desde `src`, sin claves, dependencias, sesiones ni medios. Sus diagnósticos incluyen referencias externas y relaciones combinadas: consultar `graphify-out/GRAPH_HEALTH.md`; no reemplaza la lectura del código ni garantiza extracción semántica de documentos.

## Adaptación cloud 0.4.1

SessionRepository permite resultados async; GameService y todas las rutas/media esperan el repositorio. SessionStore conserva SQLite local. SupabaseStore usa fetch HTTPS y una función SQL transaccional que opera tablas en dnd_private. Next sigue resolviendo reglas y aleatoriedad: prepare lee estado y detecta replay; commit bloquea sesión, revalida versión/clave/hash y publica estado+comando de forma atómica. Una transición especulativa que pierde CAS no publica sus dados ni consume recursos. No se reintenta la transición a escondidas.

RPC pública dnd_backend exige una credencial privada de servidor de 256 bits además de la API key publicable. El hash está en configuración privada; SQL fijo, search_path vacío, tablas/esquema revocados a anon/authenticated y RLS sin políticas. Esa frontera backend separada permite mantener cookies privadas sin exponer service_role global. No equivale a un sistema de cuentas. La auditoría marca la función SECURITY DEFINER disponible a anon; se confirmó que todas las ramas validan la credencial primero y que clave pública/otro propietario no acceden al estado.

amendNarration hace CAS con relectura acotada y modifica también pending/base/preview, sin perder acciones concurrentes. Narrate atiende jobs completados y relee si el mensaje ya se terminó. Imágenes/voz reconsultan la caché tras claim: un miss antiguo no justifica gastar otra inferencia. Cache común de 24 entradas de 2 MB, sin grabaciones de micrófono. Postgres limita estados a 2 MB/sesión, 200 sesiones globales y 120 MB de estados. La cuota diaria UTC de proveedores es compartida y atómica, inicialmente 100 llamadas.

runtime-config rechaza Vercel sin Supabase o sin clave estable de copias. SAVE_KEY_BASE64 conserva la clave de la instalación, no depende del filesystem temporal. Los datos existentes del PC no se suben automáticamente; exportación/importación permite trasladar una copia cuando se conserva la misma clave.

## Diálogo y proveedores gratuitos 0.4.2

Una aclaración del Master guarda intención+pregunta en una transacción CAS/idempotente y avanza solo la versión de diálogo. No consume turno, reloj, dados ni recursos. El cliente limpia únicamente el borrador exacto enviado; los errores y las ediciones posteriores (incluidos saltos de línea) lo conservan. La pregunta se reproduce directamente, sin otra generación de prosa.

text-router separa texto de medios: Groq GPT-OSS120B → Gemini3.1FlashLite → Cloudflare, omitiendo claves ausentes. Un intento por proveedor; valida JSON y contrato de interpretación/narración dentro del intento, antes de aceptar. La validación del motor y las dos fases siguen separadas: ningún fallback vuelve a ejecutar efectos. Timeout20s por proveedor nuevo y40s CF texto. La disponibilidad, cuota y calidad reales dependen de cada cuenta y requieren pruebas con sus claves.

RPC dnd_ai_state usa la misma credencial backend, search_path vacío, tabla privada ai_cooldowns con RLS y permisos revocados. Conserva el máximo blocked_until entre escritores; no se mezcla con la caché evictable de imágenes/voz. Retry-After numérico/fecha se respeta, también en errores temporales y en CF. Sin dato de espera:60s para cuota,30s temporal/formato y10min credenciales/modelo no disponible. Las pausas sobreviven a arranques fríos. Sin Postgres se usa un mapa por proceso local. No es un mecanismo para saltarse cuotas de cuenta.

El contexto del intérprete conserva mecánica pública y secretos de módulo solo en servidor, elimina metadatos de mensajes/ilustraciones y envía únicamente conjuros accesibles del actor (clase, libro/rituales, dotes y elfo). Voz dispositivo por defecto en instalaciones nuevas; preferencias anteriores respetadas. Aura continúa opcional y comparte las10000 neuronas de CF con sus otros medios/texto.

Auditoría remota: las dos funciones SECURITY DEFINER siguen marcadas como ejecutables por anon deliberadamente; ambas exigen la credencial independiente antes de operar. Se comprobó403 con credencial inválida. Permiso authenticated de la función nueva revocado explícitamente (los defaults de Supabase lo concedían aparte de PUBLIC). Las ocho tablas privadas con RLS sin políticas deniegan acceso directo. [Interpretación de los avisos](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
