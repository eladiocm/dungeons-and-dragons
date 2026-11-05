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

## Pendiente antes de implementar

- Revisar diseño y catálogo propuesto con el usuario, especialmente seguimiento aproximado de voz y dictado al soltar donde no exista reconocimiento en vivo.
- Confirmar propuesta de cuatro especies, magia acotada, combate sin tablero y aventura original.
- Crear plan de implementación detallado tras aprobar diseño.

## Etapas aún no implementadas

Motor SRD y creación; repositorio de sesión; módulo de aventura; mesa nueva y dados; dictado; nueva narración automática con resaltado; E2E de partida completa; integración y despliegue. No marcarlas terminadas por la existencia de estos documentos.
