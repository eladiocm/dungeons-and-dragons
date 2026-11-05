# Estado del MVP 0.4.0

5 de noviembre de 2026. Repositorio original dungeons-and-dragons. Demo integrada en `main` por petición del usuario; se conserva `develop` para desarrollo. No se ha publicado: está pendiente la elección de alojamiento.

## Implementado

- Creación editable de nivel 1: cuatro clases, cuatro especies, cuatro trasfondos, atributos, habilidades/pericia, dotes, magia, equipo e idiomas. Revisión obligatoria antes de iniciar; 64 combinaciones recomendadas válidas.
- Motor SRD 5.2.1 del catálogo reducido: d20, ventaja/desventaja, armas/maestrías, magia, concentración, economía de acciones, recursos, daño, curación, muerte y descansos. No pretende ser un simulador de todo el SRD.
- Aventura original de cinco lugares con acciones libres y objetivos: ruta social/sigilo/combate; victoria completa/parcial, fracaso, retirada y muerte. Escapar del encuentro conserva la misión y cuenta movimiento/reacciones.
- Autoridad del servidor: cookie privada, SQLite, control de versiones, comandos idempotentes, trabajos de IA y proyección sin secretos. Copias cifradas ligadas a la clave de instalación.
- Mesa de escritorio y móvil, ilustración permanente, ficha/inventario/magia, dados animados con resultados reales, menú de tres puntos e instalación PWA. Proyección/imagen de lectura offline y borrador separado; historial 0.3 preservado como archivo.
- Narración automática tras inicio, iconos, pausas/repetición, voz/velocidad/volumen y resaltado aproximado. Dictado mantener/soltar, transcripción en vivo donde existe o grabada al soltar; revisión y envío explícito, nunca automático.
- Documentación funcional, reglas, catálogo, arquitectura, pruebas, despliegue y agentes. Grafo estructural de código y memoria Engram.

## Verificación

- Unitarias: **133 correctas**, incluidas reglas, magia, aventuras, SQLite, API, copias, reintentos, controlador de dictado y seguimiento.
- Tipos, lint y build de producción correctos.
- E2E: **27 recorridos correctos**, incluidos finales de aventura, recuperación, voz/dictado y PWA.
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
- PWA necesita HTTPS accesible y backend activo. Offline solo lectura/borrador. La publicación en móvil real es el siguiente paso de infraestructura, no está realizada.
- SQLite requiere disco persistente y una instancia. Antes de exposición pública se necesitan autenticación y límites compartidos; la cookie anónima no es un sistema de cuentas.
- La copia descargada requiere la misma `.data/save-key`. Respaldar toda `.data` para migración.
- El grafo es estructural: 470 nodos/1615 relaciones, con 1 extremo no resuelto, 4 relaciones combinadas y 2 autollamadas documentadas en GRAPH_HEALTH.md. No certifica corrección del programa ni extracción semántica de la documentación.

## Próximas etapas

Primero probar esta versión con el usuario en equipos reales y decidir alojamiento HTTPS/disco/acceso. La demo ya se integró en main; publicar según el entorno elegido. Multijugador y mundo abierto requieren sus contratos y pruebas, manteniendo el motor como autoridad.
