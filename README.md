# Calabozos y Dragones — aventura con IA gratuita

## Evolución al MVP SRD

El desarrollo continúa en `develop`. La versión ejecutable 0.3.0 sigue siendo una aventura narrativa; la creación de personaje, el motor SRD, combate y dados están **en desarrollo, todavía sin habilitar**. El alcance elegido es SRD 5.2.1 español, nivel 1 y guerrero, pícaro, clérigo y mago. Primero aventura preparada con acciones libres; mundo abierto en una segunda etapa.

Consulta [la especificación y documentación del MVP](docs/mvp/README.md), [el estado real](docs/mvp/ESTADO.md) y [la guía para agentes](AGENTS.md). El diseño incluye voz, dictado con revisión, mesa adaptable, persistencia y criterios de pruebas. Las propuestas de catálogo y límites de sincronización/dictado han sido aprobadas por el usuario.

Aventura conversacional en español: eliges acciones, un narrador de IA desarrolla la historia y un segundo modelo ilustra las escenas con estética pixel art. Es un juego narrativo inspirado en D&D; no implementa fichas, dados ni reglas oficiales.

## Opción recomendada: Cloudflare Workers AI

- Narración: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- Imágenes: `@cf/black-forest-labs/flux-1-schnell`.
- Una cuenta y un token para ambos. No requiere GPU propia ni servidor desplegado en Cloudflare: Next.js llama a su API REST.
- La asignación gratuita es de **10.000 neuronas al día**, compartida entre modelos y aplicaciones de la cuenta. Se renueva a las 00:00 UTC. En **Workers Free**, al agotarla se detienen las llamadas; en Workers Paid, el exceso puede facturarse. **Conserva Workers Free si quieres evitar cargos.** Esta aplicación no cambia planes ni activa proveedores de pago. La disponibilidad/cuota puede cambiar.

Se eligió Cloudflare porque cubre texto e imágenes con una sola cuenta y una cuota renovable. Groq es otra opción para texto, pero no resuelve las imágenes. Pollinations actualmente usa claves/Pollen; no se asume que su API sea ilimitada y gratuita. Para texto local sin cuota de proveedor se incluye Ollama.

Fuentes oficiales, consultadas el 4 de noviembre de 2026:
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
- https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/

## Requisitos y arranque en Windows

Node.js **22.18 o posterior** (este proyecto se verificó con Node 24). npm. Internet para Cloudflare. Se usa exclusivamente `package-lock.json` para instalar las versiones comprobadas.

```powershell
cd "C:\Users\PM_EC\Documents\WORKS\dungeons-and-dragons"
npm ci
Copy-Item .env.example .env.local
```

Si `.env.local` ya existe y contiene tus credenciales, **no lo sustituyas**. Si configuras desde cero, abre Cloudflare → Workers AI → Use REST API. Copia Account ID y crea un token de esa cuenta con permiso Workers AI Read (inferencia). La plantilla de Cloudflare también puede incluir Edit, pero esta aplicación no necesita gestionar recursos.

```dotenv
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=tu_account_id_de_32_caracteres
CLOUDFLARE_API_TOKEN=tu_token
ENABLE_IMAGES=true
```

El token se usa solo en el servidor. `.env.local` está excluido de Git; nunca lo compartas ni uses una variable `NEXT_PUBLIC_` para claves. Reinicia Next.js tras cambiar las variables.

```powershell
npm run dev
```

Abre http://localhost:3000. Para producción local:

```powershell
npm run build
npm start
```

Hace falta un servidor Node.js; las rutas de IA impiden exportar esta app como web estática. No se necesita base de datos. El límite de peticiones es básico, por proceso; antes de exponerla públicamente añade autenticación y límites compartidos para proteger tu cuota.

## Alternativa local: Ollama

Instala Ollama desde https://ollama.com/download y descarga el modelo:

```powershell
ollama pull qwen3:4b
```

Configura:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
ENABLE_IMAGES=false
```

Ollama debe estar iniciado. Qwen3 4B ocupa aproximadamente 2,5 GB de descarga y necesita memoria adicional; la velocidad depende de CPU/GPU y RAM. No se descarga automáticamente. La narración no utiliza servicios de pago; sí consume recursos y electricidad del equipo. Para ilustraciones opcionales puedes conservar las credenciales de Cloudflare y `ENABLE_IMAGES=true`.

Fuente del modelo: https://ollama.com/library/qwen3:4b

## Uso y guardado

La primera escena comienza automáticamente cuando el narrador está configurado. Enter envía; Shift+Enter añade una línea. Las escenas y descripciones se guardan en este navegador. Al recargar se recupera la conversación sin volver a llamar a la IA. Las imágenes no se guardan para evitar llenar el almacenamiento; puedes volver a ilustrarlas manualmente.

Un fallo de imagen no bloquea la historia. Los botones permiten reintentar solo la imagen o la escena fallida sin duplicar la acción. Nueva aventura cancela las peticiones pendientes. Puedes desactivar las ilustraciones para ahorrar cuota.

En partidas largas se conserva la escena inicial y un máximo de 199 mensajes recientes guardados. La IA recibe un contexto acotado: puede olvidar detalles antiguos que no figuren en ese contexto. El guardado no se sincroniza entre dispositivos ni es una copia de seguridad.

## Comprobaciones

```powershell
npm test
npm run typecheck
npm run lint
npm audit
npm run build
npx playwright install chromium
npm run test:e2e
```

Los tests de navegador simulan las APIs para reproducir errores, cuota agotada, guardado y cancelaciones sin consumir cuota real. Para usar un Chromium compatible ya instalado puedes indicar `PLAYWRIGHT_CHROMIUM_EXECUTABLE` con su ruta. Las pruebas reales de narración e imagen usan las credenciales de `.env.local`; los tests unitarios no necesitan claves.

## Estructura

- `src/lib/ai-provider.ts`: Cloudflare y Ollama; tiempos de espera y errores seguros.
- `src/lib/game-contract.ts`: validación, contexto y formato del guardado.
- `src/lib/game-api.ts`: límites de peticiones/cuerpo y rutas de generación.
- `src/app/hooks/use-game.ts`: partida, guardado, cancelación y reintentos.
- `src/app/api/config`: estado de configuración sin secretos.
- `tests`: contratos y flujo de juego en navegador.

## Resolución de problemas

- **Falta configurar el narrador:** revisa el Account ID y el token en `.env.local`; reinicia Next.
- **Credenciales rechazadas:** comprueba que el token es de la misma cuenta y tiene acceso a Workers AI.
- **Cuota o límite agotado:** espera; no hay reintentos automáticos ni cambio a un modelo de pago.
- **Ollama no conecta:** inicia Ollama y comprueba `ollama list`; la URL debe ser local.
- **No se guarda:** el modo privado o un navegador lleno pueden bloquear localStorage; se muestra un aviso y la pestaña sigue funcionando.

## Voz natural y lectura de escenas

Cada escena incluye la pregunta al jugador dentro del mismo mensaje. El botón **Escuchar escena** lee ese texto completo. Elige una de las voces españolas, usa pausa/reanudación/detener o activa **Leer nuevas escenas**. El navegador puede requerir un primer toque para permitir el audio; las escenas guardadas no se reproducen automáticamente al recargar.

La voz natural usa `@cf/deepgram/aura-2-es` mediante el token existente. No requiere otra cuenta. **Consume la cuota gratuita diaria compartida** con texto e imágenes; no es voz ilimitada. Se cachean temporalmente audios repetidos en servidor y en la pestaña, de forma acotada. No se guardan audios en el service worker. Puedes desactivarla en el servidor con `ENABLE_VOICE=false`.

La alternativa **Voz del dispositivo** usa la síntesis del navegador y no consume cuota de Cloudflare. Su calidad, idioma y funcionamiento sin Internet dependen de las voces instaladas en el móvil o equipo. No se cambia silenciosamente a un proveedor de pago.

La voz natural usa pausas y expresividad propias del modelo, con texto escrito para leerse en voz alta. No hay clonación de voz ni controles de emoción no soportados por el proveedor.

Documentación: https://developers.cloudflare.com/workers-ai/models/aura-2-es/

## Ilustraciones según la escena

El narrador decide si un cambio visual importante merece una nueva imagen: otro lugar, una aparición, amenaza o revelación. Una conversación o una acción menor en el mismo escenario conserva la escena. La primera escena siempre puede ilustrarse. Este criterio es una decisión del modelo y puede variar según la historia.

## PWA y móvil

La aplicación incluye manifiesto, iconos de instalación, modo independiente y service worker. En Android usa **Instalar aplicación** en el menú (o el botón si está disponible). En iPhone abre la URL en Safari → Compartir → Añadir a la pantalla de inicio.

**Para instalarla y usarla desde un móvil hace falta una URL HTTPS accesible al móvil y un servidor Node activo.** `127.0.0.1` en el teléfono se refiere al propio teléfono, no a tu PC. Esta actualización prepara la PWA local; no publica el proyecto ni configura un dominio. El desarrollo en localhost funciona como contexto seguro para probar la instalación y el service worker. Un acceso HTTP por IP de red normalmente no habilita estas funciones.

Después de una primera visita completa, puede abrirse sin conexión y mostrar la conversación guardada. Generar escenas, imágenes o voz de Cloudflare sigue requiriendo Internet. Las ilustraciones y audios no se guardan para lectura offline. El service worker cachea únicamente la interfaz pública y recursos estáticos; nunca `/api`, credenciales o cuerpos de peticiones. El guardado sigue perteneciendo a ese navegador/origen: un dominio nuevo no importa automáticamente las partidas del localhost.

El diseño se adapta al ancho móvil, las zonas seguras y el teclado; la entrada mantiene 16px y los controles principales permiten interacción táctil. Se verifican vistas móviles en navegador, no se sustituye la comprobación final en un teléfono físico.
