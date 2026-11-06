# Despliegue y uso en móvil

Esta demo está verificada e integrada en main por petición del usuario; se ejecuta localmente y aún no está publicada. No configurar una URL pública hasta disponer de un alojamiento adecuado y proteger la cuota de IA.

## Requisitos del alojamiento

- Node>=24.15 (verificado24.19), proceso Next de producción y disco persistente escribible para `GAME_DATA_DIR`.
- Variables del servidor configuradas como secretos, dominio HTTPS y `APP_ORIGIN` con el origen exacto, incluido puerto si existe.
- Una instancia SQLite. Para múltiples instancias/regiones, cambiar el repositorio a un servicio coordinado antes de escalar.
- Acceso a API de IA elegida. Ollama debe ejecutarse en el mismo host accesible por dirección local; no apunta a la GPU del teléfono.

No sirve una exportación estática. El SQLite de Node no puede trasladarse tal cual a Workers/Edge ni a discos efímeros de funciones. Usar Workers/D1/DurableObjects requeriría otro adaptador y pruebas de contrato; no se declara compatible sin esa migración.

## Publicación posterior

1. Revisar estado y evidencia de esta versión, corregir pendientes aplicables y respaldar `.data` con proceso detenido.
2. Verificar secretos/origen/disco y autenticación/límites compartidos si se ofrece acceso público. La cookie anónima del MVP no es una cuenta ni una barrera de registro contra abuso de cuota.
3. Instalar con `npm ci`, ejecutar unitarias/tipos/lint/build/E2E y revisar la rama.
4. La integración de esta demo en main ya se realizó; desplegar mediante el flujo elegido cuando esté configurado el alojamiento.
5. Probar desde teléfonos reales: creación, teclado, mantener/soltar, permisos, audio, instalación, cierre y recuperación. Usar HTTPS: localhost del PC no es accesible como localhost del teléfono.

Para una prueba privada en red, un túnel HTTPS al servidor Node es una opción, conservando disco y configuración del host. Requiere elegir y configurar el acceso: no se ha creado un túnel ni abierto la aplicación públicamente.

## Copias y recuperación

Conservar `.data/game.sqlite`, WAL/SHM si se copia en caliente (se recomienda detener proceso) y `.data/save-key`. No subir a Git ni a artefactos públicos. Importar una descarga requiere la misma clave. Perder cookie y clave elimina las vías normales de acceso/recuperación; planear el respaldo antes de cambiar de equipo.

La instalación PWA solo instala la interfaz. IA y autoridad de partida siguen necesitando backend/red. Offline es lectura y borrador, no juego autónomo.

## Elección de alojamiento — revisión del 5 de noviembre de 2026

El usuario solicita integrar esta demo en main y desplegar, consultando antes el alojamiento. La autorización de integración sustituye la restricción anterior de mantener main separada; la elección de plataforma sigue pendiente y no autoriza una suscripción de pago por sí sola.

- **Render Starter + disco persistente**: opción descartada tras confirmar el usuario que solo desea servicios gratuitos. Permitía conservar SQLite. Precio de referencia: 7 USD/mes de cómputo + 0,25 USD/mes por 1 GB de disco; impuestos, ancho de banda y otros consumos pueden sumar. Render Free no ofrece disco persistente.
- **Cloudflare Workers + persistencia gestionada (D1 o SQLite de Durable Objects según el adaptador)**: alternativa para priorizar las cuotas gratuitas y la cuenta ya conectada. Necesita adaptar repositorio/transacciones/trabajos/medios/clave de guardados y probar el runtime del framework; no es desplegar el código Node actual sin cambios ni se garantiza que todo entre en límites gratuitos sin medirlo.
- **Railway**: volúmenes persistentes y plan Hobby desde 5 USD/mes de uso mínimo, con posibles extras. Su plan gratuito tiene crédito de consumo reducido; no debe describirse como servidor permanente ilimitado.
- **Vercel**: la versión con SQLite local necesita sustituir el almacenamiento; no ofrece el archivo persistente compartido requerido por este repositorio.

Fuentes oficiales consultadas: [Render precios](https://render.com/pricing), [Render discos](https://render.com/docs/disks), [Railway precios](https://railway.com/pricing), [D1 cuotas](https://developers.cloudflare.com/d1/platform/pricing/), [Workers límites](https://developers.cloudflare.com/workers/platform/limits/), [SQLite en Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel). No se ha contratado alojamiento ni publicado esta demo por esta comparación.

## Restricción vigente: solo servicios gratuitos

El usuario descarta contratar alojamiento de pago y solicita comparar Cloudflare gratuito con Vercel + Supabase. Recomendación para este código: **Vercel Hobby + Supabase Free, conservando Cloudflare Workers AI para texto/imágenes/voz/transcripción**. Es una recomendación pendiente de elección, no un despliegue realizado.

Ambas alternativas necesitan sustituir SQLite local; Vercel + Supabase permitiría conservar la ejecución Next.js y migrar guardado/eventos/idempotencia/trabajos a Postgres, medios a almacenamiento privado con limpieza y clave de copias a secreto de servidor. Cuentas y Realtime quedarían disponibles como base para etapas posteriores, sin declarar implementado el multijugador.

Límites relevantes verificados: Vercel Hobby es para uso personal no comercial y tiene cuotas; Supabase Free incluye 500 MB de base de datos, 1 GB de archivos y puede pausar el proyecto por baja actividad durante 7 días. No activar planes de pago ni complementos facturables. Imágenes/audio deben tener retención acotada. El acceso y las cuotas requieren pruebas antes de publicar.

Fuentes: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase Free](https://supabase.com/pricing), [pausa por inactividad](https://supabase.com/docs/guides/platform/free-project-pausing). La recomendación de menor adaptación corresponde al análisis del repositorio actual; no garantiza servicio ilimitado ni disponibilidad permanente en planes gratuitos.

## Implementación aprobada y preparada — 6 de noviembre de 2026

Plataforma elegida por el usuario: Vercel Hobby + Supabase Free + Cloudflare Workers AI. Proyecto Vercel dungeons-and-dragons-eladiocm (Node 24, iad1), Supabase dedicado djfonndfgosmbjzarfwu (Postgres 17, us-east-1). Origen de producción configurado: https://dungeons-and-dragons-eladiocm.vercel.app. Consultar ESTADO para saber si el deployment está realmente listo; la existencia del proyecto no lo acredita.

La sección inicial sobre SQLite corresponde al backend local. La implementación cloud ya usa SupabaseStore: tablas privadas, RPC autenticada por credencial backend separada, cuotas/CAS persistidos. No necesita disco ni Supabase Storage para esta caché acotada. La migración versionada está en supabase/migrations/202611060001_game_backend.sql; la configuración del hash de credencial se provisiona separadamente, nunca se versiona el secreto.

Variables production cifradas: GAME_STORE=supabase; SUPABASE_URL; SUPABASE_PUBLISHABLE_KEY; DND_BACKEND_SECRET(64hex); SAVE_KEY_BASE64(32bytes); APP_ORIGIN; AI_PROVIDER=cloudflare; CLOUDFLARE_ACCOUNT_ID/TOKEN; ENABLE_IMAGES; DEMO_AI_DAILY_LIMIT=100. El usuario autorizó explícitamente su transferencia únicamente a ese proyecto. Sin valores en documentación/bundles/logs. No activar planes Pro ni complementos de pago. La máquina de build usa los valores gratuitos por defecto.

Mantener origin exacto de producción y Node 24: el valor por defecto de Vercel era 26 y no corresponde a las APIs SQLite locales verificadas. Los previews no tienen credenciales production ni autorización para actuar sobre la base de producción. develop no publica automáticamente; integrar el commit verificado a main antes del release.

La clave de copias es estable y debe respaldarse fuera del repositorio. `.env.cloud.local` se mantiene ignorada. No reemplazarla al redeploy. Cuota demo de 100 llamadas IA/día UTC; caché de 24 entradas de 2 MB; estado de 2 MB máximo y 200 sesiones totales. Límites explícitos para proteger planes gratuitos, sin prometer uso ilimitado. Los proyectos Supabase Free pueden pausarse tras baja actividad; Vercel Hobby es uso personal no comercial. Las pruebas físicas móviles siguen pendientes.

## Publicado y verificado

URL: https://dungeons-and-dragons-eladiocm.vercel.app — deployment dpl_9ycTWyEMFSzcjgtHBZczbd2gKAbt, commit funcional 28fccf0, READY. Comprobadas API privada/guardado/copias/caché, Master/imagen/voz reales y navegador de escritorio/móvil con recarga. Consultar ESTADO/PRUEBAS. No se han activado planes de pago; el límite diario de la demo protege las cuotas compartidas y puede restringir temporalmente las inferencias.

## Preparar routing gratuito 0.4.2

Aplicadas en Supabase las migraciones ai_cooldowns y ai_cooldown_grants: pausas independientes del cache de medios, credencial backend y revocación explícita authenticated. Verificadas autoridad403 y persistencia entre instancias. Configurar GROQ_API_KEY y GEMINI_API_KEY cifradas solo en el proyecto Vercel autorizado, sin facturación en sus cuentas, y redesplegar. El archivo .env.providers.local no se carga automáticamente por Next ni se sube a Git. Claves aún vacías: activación y comprobación real pendientes. Cuando se activen, ajustar DEMO_AI_DAILY_LIMIT a1000 si procede (tope interno, no cuota garantizada). No cambiar SAVE_KEY_BASE64 ni credenciales existentes.
