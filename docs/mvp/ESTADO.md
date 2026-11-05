# Estado del desarrollo

Actualizado: 5 de noviembre de 2026.

## Disponible actualmente

Aplicación 0.3.0: aventura narrativa libre en español, imágenes condicionadas al cambio visual, pregunta integrada en el texto narrado, voz natural y del dispositivo, controles, guardado local, diseño adaptable y PWA con lectura offline. No implementa todavía reglas SRD, fichas, tiradas ni creación de personaje.

Rama creada para el nuevo trabajo: `develop`. `main` no se ha integrado ni desplegado durante esta fase.

## Acordado con el usuario

- SRD 5.2.1 español, cuatro clases iniciales de nivel 1.
- Primero aventura preparada con acciones libres; posteriormente mundo abierto elegible.
- Un jugador ahora; arquitectura preparada para varios.
- El resto de la petición de interfaz, voz, dictado, personaje y documentación está recogido en la especificación.

## Completado en esta fase de diseño

- Investigación de reglas oficiales y comprobación del código actual.
- Especificación funcional, arquitectura propuesta y matriz de pruebas.
- Consulta del grafo previo (160 nodos), contrastado con código porque no refleja por completo la versión actual.
- Acuerdos de alcance guardados en Engram.
- 19 pruebas unitarias del producto existente ejecutadas: 19 correctas.
- Revisión de construcción independiente: se precisó cómo improvisar hechos persistentes; quedan a revisión del usuario las limitaciones de sincronización/dictado y demás propuestas enumeradas.

## Aprobación y ejecución

- Diseño y catálogo aprobados expresamente por el usuario, incluidos seguimiento aproximado y dictado al soltar.
- Confirmados cuatro especies, magia acotada, combate sin tablero y aventura original.
- Plan creado: ../superpowers/plans/2026-11-05-srd-mvp.md. Ejecución nativa en develop.

## Etapas aún no implementadas

Motor SRD y creación; repositorio de sesión; módulo de aventura; mesa nueva y dados; dictado; nueva narración automática con resaltado; E2E de partida completa; integración y despliegue. No marcarlas terminadas por la existencia de estos documentos.

## Motor implementado en develop (todavía sin mesa nueva)

Tareas 1 a 4: creación y catálogo; dados, daño, muerte y descansos; armas/conjuros/condiciones; sesión de aventura con misión, caminos alternativos y finales. El motor tiene pruebas de ruta social, sigilo y combate, botín único, inspiración, azar persistible por grupos y proyección sin secretos. Incluye tipos de participantes y orden de iniciativa para futuras salas, sin multijugador conectado.

Verificación actual: 97 pruebas unitarias correctas, tipos y lint. La interfaz y servidor siguen en la base 0.3.0 hasta conectar las tareas siguientes. Pendientes: persistencia HTTP/SQLite, Master, creador y mesa visual, controles nuevos de voz/dictado y E2E de producto.

Tarea 5: repositorio SQLite, sesión privada por cookie, control de versiones y comandos idempotentes implementados. Exportación cifrada/importación privada ligada a la clave de instalación. Las rutas nuevas todavía no están conectadas a la mesa. Las siguientes tareas son Master y medios autorizados, creador y mesa, voz/dictado, verificación de producto.

Tarea 6: Master separado en interpretación/prosa, arrendamientos persistidos para reintentos, contexto acotado y operaciones validadas. Rutas de imagen/voz por IDs autorizados; transcripción WAV de hasta45s solo devuelve borrador.115 unitarias correctas, tipos/lint/build. Comprobación real: examinar mapa devuelve interact/inspect válido tras precisar kind del plan en el prompt. UI nueva todavía pendiente.
