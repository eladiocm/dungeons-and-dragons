# Estado del MVP 0.4.2

5 de noviembre de 2026. Repositorio original dungeons-and-dragons. Demo integrada en `main` por petición del usuario; se conserva `develop` para desarrollo. Plataforma aprobada: Vercel Hobby + Supabase Free + Cloudflare AI. Persistencia migrada y demo publicada: [https://dungeons-and-dragons-eladiocm.vercel.app](https://dungeons-and-dragons-eladiocm.vercel.app).

## Implementado

- Creación editable de nivel 1: cuatro clases, cuatro especies, cuatro trasfondos, atributos, habilidades/pericia, dotes, magia, equipo e idiomas. Revisión obligatoria antes de iniciar; 64 combinaciones recomendadas válidas.
- Motor SRD 5.2.1 del catálogo reducido: d20, ventaja/desventaja, armas/maestrías, magia, concentración, economía de acciones, recursos, daño, curación, muerte y descansos. No pretende ser un simulador de todo el SRD.
- Aventura original de cinco lugares con acciones libres y objetivos: ruta social/sigilo/combate; victoria completa/parcial, fracaso, retirada y muerte. Escapar del encuentro conserva la misión y cuenta movimiento/reacciones.
- Autoridad del servidor: cookie privada, SQLite local/Supabase cloud, control de versiones, comandos idempotentes, trabajos de IA y proyección sin secretos. Copias cifradas ligadas a la clave de instalación.
- Mesa de escritorio y móvil, ilustración permanente, ficha/inventario/magia, dados animados con resultados reales, menú de tres puntos e instalación PWA. Proyección/imagen de lectura offline y borrador separado; historial 0.3 preservado como archivo.
- Narración automática tras inicio, iconos, pausas/repetición, voz/velocidad/volumen y resaltado aproximado. Dictado mantener/soltar, transcripción en vivo donde existe o grabada al soltar; revisión y envío explícito, nunca automático.
- Documentación funcional, reglas, catálogo, arquitectura, pruebas, despliegue y agentes. Grafo estructural de código y memoria Engram.

## Verificación

- Unitarias: **152 correctas**, incluidas reglas, magia, aventuras, SQLite, API, copias, reintentos, controlador de dictado y seguimiento.
- Tipos, lint y build de producción correctos.
- E2E: **31 recorridos correctos**, incluidos finales de aventura, recuperación, voz/dictado y PWA.
- Auditoría npm: cero vulnerabilidades conocidas en el lockfile comprobado.
- Navegador: Brave/Chromium aislado, build de producción, API/SQLite reales y proveedor simulado local. RNG controlado únicamente por código de pruebas. Móvil a 320/390/768 px, sin overflow horizontal; capturas de creador y mesa revisadas.
- Revisión independiente: cuatro hallazgos importantes reproducidos y corregidos con regresiones; última revisión focal 37/37 y veredicto sin bloqueos importantes. Incluye consumo de pociones, concentración de trampa, reacciones de enemigos incapacitados y escape del encuentro. También se corrigieron recuperación estable, reintento de prosa y superposición de controles.
- Master real: una intención de examinar mapa produjo un plan válido; se precisaron ejemplos de kind tras detectar salida con type. No se ejecutaron campañas reales completas en cada prueba.
- Voz real: Aura española, muestra 28.224 bytes/4,704 s decodificada en navegador y transcrita por Whisper. La transcripción fue inteligible pero tuvo errores de palabras; se mantiene revisión manual. No equivale a probar un micrófono físico.

## Limitaciones y pendientes explícitos

- Mundo abierto, multijugador conectado, cuentas, niveles superiores, otras clases y catálogo completo todavía no habilitados.
- No se han probado micrófonos/permisos ni instalación física en Android/iOS. Las simulaciones prueban cancelaciones y contratos, no hardware.
- La voz natural no trae timestamps por palabra. El resaltado es estimado; las voces del sistema y las políticas de reproducción varían por dispositivo.
- Cuota de IA compartida y limitada; no uso ilimitado. La aplicación no activa planes de pago ni un proveedor de pago alternativo.
- PWA publicada por HTTPS, con backend activo. Offline solo lectura/borrador. Instalación y micrófono en teléfonos físicos siguen pendientes.
- SQLite local requiere disco persistente; la publicación usa Postgres remoto con cuotas compartidas. La cookie privada conserva acceso por navegador y dominio, pero no equivale a un sistema de cuentas recuperables.
- La copia descargada requiere la misma clave: `.data/save-key` en local y `SAVE_KEY_BASE64` en cloud. Respaldar esa clave fuera de Git; las cookies locales no se trasladan al dominio publicado.
- El grafo estructural actualizado cubre código/pruebas: 841 nodos y 2315 relaciones, sin extremos no resueltos en el exportado; conserva 2 autollamadas. La migración SQL no está en el grafo por falta del parser opcional. Advertencias en GRAPH_HEALTH.md; no sustituye la revisión ni las pruebas reales de SQL.

## Próximas etapas

Probar con el usuario la URL publicada y equipos reales; revisar uso de cuotas y futura autenticación. La demo ya se integró en main y se publicó en Vercel/Supabase gratuitos. Multijugador y mundo abierto requieren sus contratos y pruebas, manteniendo el motor como autoridad.

## Release cloud

6 de noviembre: servicio/API async, Supabase remoto transaccional, presupuesto compartido de IA, caché de voz persistida y clave estable de copias. Proyecto y variables cifradas de producción preparados. Deployment de producción `dpl_9ycTWyEMFSzcjgtHBZczbd2gKAbt`, commit funcional `28fccf0`, confirmado READY y servido por HTTPS. Revisar secciones cloud de ARQUITECTURA/DESPLIEGUE: las referencias previas a disco/SQLite se conservan para desarrollo local.

Comprobación remota: home/API/manifest/SW 200, cookie Secure, propietario ajeno 404, origen ajeno 403, creación/guardado/recuperación, replay y exportar/importar correctos. Master real ejecutó viaje al molino y narró; imagen de 807.459 bytes y voz de 261.936 bytes generadas. Audio decodificado en navegador: 43,656 s, caché persistente verificada. Navegador de producción sin errores JS; captura escritorio y móvil a 390 px sin overflow, partida conservada tras recargar. Estas pruebas usaron datos sintéticos y una muestra corta de cuota, no una campaña completa real ni hardware de micrófono.

## Chat y cuotas 0.4.2

Aclaraciones persistentes dentro del chat, Enter envía/ShiftEnter escribe nueva línea; reintentos idempotentes y borradores editados conservados. Enrutador Groq→Gemini→Cloudflare preparado, contrato validado por intento y pausas persistentes respetando Retry-After. Contexto compacto y voz dispositivo por defecto para usuarios nuevos; las preferencias anteriores se conservan.152 unitarias,31 E2E completas,2 integraciones Supabase reales y tipos/lint/build correctos; revisión independiente corregida con regresiones. No equivale a una campaña completa con proveedores nuevos.

**Activación pendiente:** GROQ_API_KEY y GEMINI_API_KEY siguen vacías al cerrar la verificación local; el usuario se comprometió a guardarlas en .env.providers.local. Sin ellas se conserva Cloudflare; no se han afirmado pruebas reales de Groq/Gemini. El presupuesto interno de producción sigue100 hasta configurar los proveedores y no explica por sí mismo el bloqueo:32 operaciones observadas, voz Aura consume la cuota compartida de10000 neuronas. Recomendar voz dispositivo en el menú para instalaciones con voz natural guardada.
