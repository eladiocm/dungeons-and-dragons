# Calabozos y Dragones — La última luz de Valdumbría

MVP 0.4.1 en español para jugar una aventura de fantasía en solitario. Creas un personaje de nivel 1, revisas su ficha y decides cuándo iniciar. El Master interpreta tus acciones libres y narra; el motor aplica las reglas, los dados y los cambios de la partida.

Basado en el **SRD 5.2.1**, con un catálogo reducido: guerrero, pícaro, clérigo y mago; humano, enano, mediano y alto elfo; cuatro trasfondos. La aventura original tiene objetivos y desenlaces por victoria, fracaso, retirada o muerte. Mundo abierto y multijugador quedan para otra etapa.

## Ejecutar en Windows

Necesitas **Node.js >=24.15** y npm. Verificado con Node 24.19. Para IA remota hace falta Internet y una cuenta gratuita de Cloudflare; para texto local puedes usar Ollama.

```powershell
cd "C:\Users\PM_EC\Documents\WORKS\dungeons-and-dragons"
npm ci
# Solo si todavía no tienes .env.local:
Copy-Item .env.example .env.local
npm run dev
```

Conserva las credenciales existentes: no sobrescribas `.env.local`. Abre [localhost:3000](http://localhost:3000). Para producción local:

```powershell
npm run build
npm start
```

En desarrollo local, las partidas se guardan automáticamente en SQLite (`.data/game.sqlite`). La carpeta se crea al usar la API; no necesita un servicio de base de datos externo. Se requiere **un servidor Node y disco persistente**. Esta implementación no se exporta como web estática, no corre sin adaptar sobre Edge/Workers y no debe instalarse sobre almacenamiento efímero.

## IA gratuita y voz

Configuración recomendada:

```dotenv
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=tu_account_id
CLOUDFLARE_API_TOKEN=tu_token_workers_ai
ENABLE_IMAGES=true
ENABLE_VOICE=true
```

El token se usa exclusivamente en el servidor y requiere inferencia de Workers AI para la cuenta. Cloudflare ofrece una asignación gratuita compartida de **10.000 neuronas diarias**; texto, ilustraciones, voz y transcripción consumen esa cuota. Se renueva a las 00:00 UTC. Mantén **Workers Free** para que el agotamiento detenga las llamadas; este proyecto no activa planes ni proveedores de pago automáticamente. No se promete uso ilimitado.

- Master: Llama 3.3 70B, salida JSON validada.
- Ilustración: FLUX.1 schnell, solo ante cambios de escena. Siempre hay una ilustración local de respaldo.
- Voz española: Aura 2; Néstor, Carina o Javier. Alternativa: voz del dispositivo, de calidad dependiente del sistema.
- Dictado grabado: Whisper large v3 turbo. El reconocimiento en vivo usa la implementación del navegador cuando existe.

Fuentes oficiales: [precios y cuota](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Llama 3.3](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/), [FLUX](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/), [Aura español](https://developers.cloudflare.com/workers-ai/models/aura-2-es/), [Whisper](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/).

Para texto local:

```powershell
ollama pull qwen3:4b
```

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
ENABLE_IMAGES=false
```

Ollama requiere memoria/CPU o GPU propias; no se instala ni descarga automáticamente. Puedes conservar las credenciales de Cloudflare para medios. Ninguna clave debe usar prefijo `NEXT_PUBLIC_`, aparecer en Git, capturas o mensajes.

## Cómo jugar

1. Elige clase y especie, origen, atributos, talentos, magia e idiomas. Hay una propuesta editable y revisión final; cambiar los orígenes reajusta la propuesta para mantenerla válida.
2. Inicia la aventura. Lee o escucha el entorno y el objetivo. La narración automática está activada de forma predeterminada; se puede desactivar en el menú de tres puntos.
3. Escribe lo que intentas hacer. El Master pide aclaración si falta una elección y el motor rechaza lo imposible o no implementado sin gastar recursos.
4. Si se necesitan dados, pulsa Tirar. Revisa el resultado y los recursos legales de repetición; al Confirmar se aplican los efectos una vez. Una tirada hecha no puede cancelarse para buscar otra.
5. Consulta PG, CA, habilidades, equipo, conjuros y recursos. En combate, decide tu acción y finaliza el turno. Puedes huir del encuentro del molino sin abandonar toda la misión; el movimiento y las reacciones siguen contando.

La voz usa controles de iconos sobre el diario. El seguimiento con voz natural es **aproximado**, basado en duración; la voz del dispositivo usa eventos de palabra cuando están disponibles. El navegador puede requerir pulsar Reproducir por su política de audio.

Mantén pulsado el micrófono para dictar; suéltalo para revisar. Donde no hay dictado en vivo, se graba mientras mantienes pulsado y se transcribe después. Máximo 45 s. **Nunca se envía automáticamente.** Corrige el borrador y pulsa Enviar. El reconocimiento puede equivocarse; no se garantiza captura ni reconocimiento sin Internet. No se conservan grabaciones en el servidor.

## Guardados y copias privadas

La identidad del MVP es una cookie opaca HttpOnly de ese navegador, sin cuentas ni sincronización entre dispositivos. Perder la cookie puede impedir continuar: descarga antes una copia desde el menú.

Las copias están cifradas y autenticadas, ocultan los secretos del Master y no contienen credenciales ni cookies. **Solo pueden importarse con la misma clave de instalación** (`.data/save-key`). Para migrar o restaurar, respalda toda `.data` con el servidor detenido, incluida esa clave. La importación crea otra partida privada y conserva la original.

El historial antiguo 0.3 se conserva como archivo de lectura, sin inventarle ficha o tiradas. Sin conexión puedes consultar la última proyección y la ilustración guardadas; las acciones esperan al servidor. Los borradores se guardan por separado.

## Móvil y PWA

La mesa usa escena/chat/ficha/dados en escritorio y pestañas Diario/Ficha/Dados en móvil. Instalar está dentro del menú. Android ofrece instalación si el navegador la admite; en iPhone se usa Safari → Compartir → Añadir a pantalla de inicio.

El teléfono necesita una dirección **HTTPS accesible y backend activo**; `localhost` del PC no es una dirección del teléfono. Configura `APP_ORIGIN` con el origen exacto al publicar o probar por red. Véase [despliegue y límites](docs/mvp/DESPLIEGUE.md).

## Desarrollo, pruebas y arquitectura

Trabajo en `develop`; la demo 0.4.1 está integrada en `main`. Alojamiento elegido: Vercel Hobby + Supabase Free; configuración y verificación de la URL en docs/mvp/DESPLIEGUE.md. El dominio puro está en `src/game`, persistencia/Master/API en `src/server` y mesa/hooks en `src/app`. No hay motor mecánico alternativo en la prosa de la IA.

```powershell
npm test
npm run typecheck -- --incremental false
npm run lint
npm run build
npm run test:e2e
```

Los E2E usan un proveedor simulado local y SQLite de pruebas. El RNG controlado se carga **solo en el proceso de pruebas**, nunca por endpoint ni en la aplicación de producción. Si Playwright no tiene Chromium instalado, indica un ejecutable compatible mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; la verificación local usó Brave aislado.

Consulta [documentación del MVP](docs/mvp/README.md), [evidencia y límites](docs/mvp/ESTADO.md), [arquitectura](docs/mvp/ARQUITECTURA.md), [reglas](docs/mvp/REGLAS.md), [catálogo](docs/mvp/CATALOGO.md), [pruebas](docs/mvp/PRUEBAS.md) y [guía para agentes](AGENTS.md). El grafo estructural de código está en `graphify-out`; su informe registra las limitaciones de extracción.

## Atribución

Esta obra incluye material procedente del Documento de Referencia del Sistema 5.2.1 de Wizards of the Coast LLC, disponible en [D&D Beyond](https://www.dndbeyond.com/srd), bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode). La selección, síntesis y adaptaciones se explican en la documentación. Valdumbría, sus personajes y sus escenas locales son originales. No es un producto oficial de Wizards of the Coast. [Aviso](public/attribution.txt).

## Despliegue gratuito 0.4.1

La versión cloud usa **Vercel Hobby + Supabase Free**, conservando Cloudflare para IA. `GAME_STORE=supabase` activa el repositorio remoto; en Vercel se rechaza SQLite o una configuración incompleta. Las tablas están en un esquema privado; únicamente el backend puede operar mediante RPC con su credencial privada. La clave publicable por sí sola no da acceso a partidas.

Variables de servidor: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DND_BACKEND_SECRET`, `SAVE_KEY_BASE64`, `APP_ORIGIN` y las credenciales existentes de Cloudflare. Nunca usar `NEXT_PUBLIC_` para secretos. La cuota compartida de esta demo es inicialmente 100 llamadas IA/día UTC (`DEMO_AI_DAILY_LIMIT`), además de la cuota de Cloudflare. Caché de imagen/voz persistida: 24 entradas de hasta 2 MB. Guardado cloud máximo 2 MB/sesión y límite global de demo; los errores conservan el estado.

No se activan cuentas ni multijugador en esta versión. La cookie pertenece al dominio donde juegas. Los guardados locales se conservan en el PC; para trasladar una partida usa Exportar/Importar con la misma clave de instalación, nunca copies cookies. `.env.cloud.local` es una configuración privada ignorada por Git y usada por `npm run test:integration`, que ejecuta pruebas contra un proyecto Supabase dedicado. Detalles en [despliegue](docs/mvp/DESPLIEGUE.md).
