# Despliegue y uso en móvil

Esta entrega se verifica en develop y se ejecuta localmente; no se ha mezclado en main ni publicado. No configurar una URL pública hasta disponer de un alojamiento adecuado y proteger la cuota de IA.

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
4. Integrar develop en main y desplegar mediante el flujo acordado del repositorio. No se ha realizado en esta entrega.
5. Probar desde teléfonos reales: creación, teclado, mantener/soltar, permisos, audio, instalación, cierre y recuperación. Usar HTTPS: localhost del PC no es accesible como localhost del teléfono.

Para una prueba privada en red, un túnel HTTPS al servidor Node es una opción, conservando disco y configuración del host. Requiere elegir y configurar el acceso: no se ha creado un túnel ni abierto la aplicación públicamente.

## Copias y recuperación

Conservar `.data/game.sqlite`, WAL/SHM si se copia en caliente (se recomienda detener proceso) y `.data/save-key`. No subir a Git ni a artefactos públicos. Importar una descarga requiere la misma clave. Perder cookie y clave elimina las vías normales de acceso/recuperación; planear el respaldo antes de cambiar de equipo.

La instalación PWA solo instala la interfaz. IA y autoridad de partida siguen necesitando backend/red. Offline es lectura y borrador, no juego autónomo.
