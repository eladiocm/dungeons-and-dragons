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

- **Render Starter + disco persistente**: recomendación para publicar la arquitectura actual sin cambiar el repositorio SQLite. Precio de referencia: 7 USD/mes de cómputo + 0,25 USD/mes por 1 GB de disco; impuestos, ancho de banda y otros consumos pueden sumar. Render Free no ofrece disco persistente.
- **Cloudflare Workers + persistencia gestionada (D1 o SQLite de Durable Objects según el adaptador)**: alternativa para priorizar las cuotas gratuitas y la cuenta ya conectada. Necesita adaptar repositorio/transacciones/trabajos/medios/clave de guardados y probar el runtime del framework; no es desplegar el código Node actual sin cambios ni se garantiza que todo entre en límites gratuitos sin medirlo.
- **Railway**: volúmenes persistentes y plan Hobby desde 5 USD/mes de uso mínimo, con posibles extras. Su plan gratuito tiene crédito de consumo reducido; no debe describirse como servidor permanente ilimitado.
- **Vercel**: la versión con SQLite local necesita sustituir el almacenamiento; no ofrece el archivo persistente compartido requerido por este repositorio.

Fuentes oficiales consultadas: [Render precios](https://render.com/pricing), [Render discos](https://render.com/docs/disks), [Railway precios](https://railway.com/pricing), [D1 cuotas](https://developers.cloudflare.com/d1/platform/pricing/), [Workers límites](https://developers.cloudflare.com/workers/platform/limits/), [SQLite en Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel). No se ha contratado alojamiento ni publicado esta demo por esta comparación.
