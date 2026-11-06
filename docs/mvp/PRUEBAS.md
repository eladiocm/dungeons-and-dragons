# Plan de aceptación y evidencia

Estado 0.4.0: **141 unitarias y 27 E2E correctas**, tipos/lint/build correctos. Esta matriz conserva los criterios de diseño; la evidencia ejecutada y límites se registran en ESTADO.md. Micrófonos/instalación físicos Android/iOS no se consideran probados por usar simulaciones.

## Principios

- Probar reglas con ejemplos que puedan calcularse a mano y extremos relevantes. RNG inyectado desde pruebas, sin semillas/overrides públicos.
- Separar pruebas puras, contrato de repositorio/API, UI con proveedores simulados y pequeñas pruebas reales de IA/audio con coste acotado.
- E2E contra build de producción, datos aislados y navegador sin perfil personal. No gastar cuota del usuario por cada test.
- Verificar historias completas: creación → inicio → acción → tirada → consecuencia → ficha → guardado → final; no basta comprobar que apareció un botón.

## Matriz mínima

| Área | Casos que deben pasar |
| --- | --- |
| Creación | cuatro clases; especie/trasfondo combinables; array sin reutilizar valores; mejoras válidas; competencias/pericia; conjuros y maestrías; volver atrás; ficha incompleta bloquea inicio |
| Atributos | modificadores impares/negativos; PG/CA según equipo; escudo/armas/manos; competencia una vez; pericia correcta; Sin armadura de mago no implica CA fija |
| Dados | límites de cada dado; ventaja/desventaja/cancelación; CD igualada; crítico/fallo ataque; habilidad 1/20 no automático; inspiración y Fortuna sin bucles |
| Clases | Tomar aliento usos/recarga; Ataque furtivo condiciones/una vez por turno; orden divina; rituales/recuperación arcana; rasgos de nivel 2 bloqueados |
| Orígenes | cada rasgo disponible cambia el motor; resistencias e inmunidades; herramientas; dotes duplicadas/repetibles; competencia duplicada y elección compensatoria correcta |
| Magia | ataque y salvación; espacios y preparación; daño/curación exactos edición 2024; concentración y fin; componentes y alcance; ritual/tiempo; recursos de dote separados |
| Combate | iniciativa y empates; turno de varios participantes en fixtures; una acción/reacción por ventana; acción adicional solo legal; movimiento/cobertura; enemigos usan mismo motor |
| Inventario | cantidades/peso/monedas; equipar; usar y consumir; botín una vez; objetos de misión; sin cantidades negativas; no duplicar al recargar/reintentar |
| Muerte | daño masivo; 0 PG; tres éxitos/fallos; 1/20; daño a 0; estabilización/curación; impedir acciones estando inconsciente; fin por muerte |
| Descanso | tiempo/seguridad; interrupciones; restricciones; dado de golpe mínimo; recargas por clase; elfo; no curación/espacios ilimitados |
| Misión | caminos social/sigilo/combate; pistas no bloqueadas por un fallo; hitos válidos; tiempo; victoria completa/parcial; fracaso superviviente; retirada; epílogo reconoce hechos |
| Autoridad | cliente no fija PG/dados/inventario; actor ajeno rechazado; secretos fuera de proyección; propuesta IA malformada o no autorizada sin efectos |
| Persistencia | round-trip con versiones; reinicio; guardar evento+estado atómico; cookie privada; exportar/importar válido; archivo legado no se borra |
| Red | doble clic; misma clave y distinto cuerpo; respuesta perdida; dos pestañas/versión en conflicto; resultado de tirada no se repite; fallo IA después de daño no lo reaplica |
| Ilustración | siempre imagen local o generada; conversación conserva imagen; cambio mantiene anterior hasta nueva; fallo/reintento; restauración offline sin inferencia |
| Narración | automática tras iniciar; ajuste desactivado persiste; pausa/resume/repetir/stop; autoplay rechazado recuperable; cambio de escena/voz cancela audio viejo |
| Seguimiento | palabra activa desde reloj correcto; no avanza pausado; velocidad/repetición; sin saltos de líneas; límites por frase claros; device boundary cuando disponible |
| Dictado | mantener muestra borrador; soltar detiene; revisar/editar y envío explícito; texto previo preservado; nunca autoenviar; callbacks tardíos; permiso tras soltar; cancelación/permisos/fin remoto |
| Móvil | 320/390/768 px y paisaje corto; sin scroll horizontal; texto ampliado; teclado abierto; touch targets; fichas/dados accesibles; compositor visible |
| Accesibilidad | teclado; foco de menú/dialogo; nombres de iconos; Escape; contraste; estados sin depender solo de color; reduced-motion; no capturas de teclado globales |
| PWA | manifest/iconos/standalone; instalación en menú; offline lectura; API no cacheada; reconexión no duplica acción ni pierde borrador |

## Recorridos E2E de salida

1. Cargar sin guardado no llama a IA. Crear personaje válido, revisar y volver para corregirlo; Iniciar crea una sola sesión y presenta objetivo/entorno/pregunta.
2. Guerrero completa una ruta de la misión con prueba y combate; las tiradas, recursos y botín coinciden entre chat/ficha/registro/exportación.
3. Pícaro obtiene una solución por sigilo/diálogo sin exigir combate obligatorio; revisar Pericia y Ataque furtivo en fixture de combate.
4. Mago y clérigo lanzan un conjuro, consumen espacio y respetan límites; rechazar cast ilegal sin perder recurso. Comprobar versiones 2024 de Curar heridas y Dormir.
5. Caer a 0 y resolver muerte/estabilización con secuencia determinista. Final bloquea nuevas acciones y ofrece epílogo y nueva partida.
6. Reenviar Tirar tras perder la respuesta devuelve los mismos dados. Recargar durante narración recupera estado; reintento no entrega botín ni resta PG de nuevo.
7. Dictar con implementación de reconocimiento simulada fiel al contrato: texto provisional → soltar → callbacks tardíos descartados → revisión → Enviar. Otra captura/navegación descarta callbacks antiguos.
8. Narrar con fixture de audio decodificable, pausar/reanudar y comprobar resaltado/velocidad. Una promesa `play()` vieja no reactiva audio cancelado. No afirmar que este fixture valida naturalidad de voz.
9. Mesa en móvil con teclado, menú y paneles; escena persiste mientras se conversa. Offline permite lectura; al reconectar el servidor conserva autoridad.
10. Sesión de otro propietario y peticiones falsificadas se rechazan; inspeccionar que secretos del Master y claves no aparezcan en respuestas/caché/bundle.

## Pruebas reales y límites

- Proveedor texto: verificar propuestas estructuradas y narración coherente con hechos de una pequeña secuencia. Las pruebas deterministas usan fixtures; no exigir una frase exacta de la IA.
- Voz real: generar una muestra breve y reproducir/decodificar en navegador. Medir carga y seguimiento; registrar si este es aproximado.
- Micrófono real: comprobar Android Chrome y Safari iOS/PWA cuando se disponga de esos dispositivos. La simulación E2E no demuestra permisos ni captura del hardware. Documentar lo no comprobado en vez de marcarlo verde.
- Presupuesto: pedir muestras cortas y reutilizarlas; no ejecutar campañas completas con voz natural en cada CI.

## Puerta de integración

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`, auditoría apropiada de dependencias si cambian y revisión independiente. Revisar diff/staged y ausencia de secretos/datos privados. Una prueba obligatoria pendiente o fallida se registra y no se declara resuelta.

Guardar evidencia con fecha, rama/commit, comandos, totales, navegador y limitaciones. No merge a `main` ni publicación por el solo hecho de haber diseñado o maquetado la interfaz.

## Ejecución del MVP

`tests/browser/fixture-ai.mjs` simula únicamente el proveedor Ollama. Next arranca de producción con `.data/e2e` y se recorren endpoints privados reales. `deterministic-rng.mjs` se precarga solo en ese proceso; la cola de dados de pruebas no tiene endpoint y no se importa desde src. Pruebas seriales y navegador aislado, sin perfil personal ni cuota real en CI.

La suite incluye victoria, fracaso por tiempo, retirada de misión, muerte tras combate/salvaciones, gasto de espacio de mago, escape conservando misión, dos pestañas, respuesta perdida, prosa pendiente, imágenes, archivo legado/offline, voz, dictado y PWA. El reintento de prosa se prueba con el chat desplazado para detectar superposiciones de controles.

Reinicio SQLite se comprueba cerrando/reabriendo y reenviando el mismo comando de dado con RNG que lanza si vuelve a ejecutarse. La cinta y versión recuperadas deben ser idénticas.

La muestra real de voz usa servicios configurados y se guarda aparte de las pruebas deterministas. Whisper cambió palabras en la frase de muestra: no se exige coincidencia textual perfecta a un reconocedor probabilístico, y tampoco se describe como precisión perfecta. La prueba funcional exige respuesta inteligible y conserva revisión/envío manual.

Cada archivo E2E simula una dirección de cliente de TEST-NET-2 distinta mediante cabecera de prueba. La suite completa produce más de 120 solicitudes por minuto; no se eleva ni se desactiva el límite del servidor para hacerla pasar. Cookies, versiones y reglas siguen siendo reales.

## Resultado final — 5 de noviembre de 2026

Rama `develop`, versión 0.4.0. `npm test`: 133/133, sin omitidas ni fallidas. `npm run typecheck -- --incremental false`, `npm run lint` y `npm run build`: salida 0. `npm run test:e2e` sobre la compilación final: 24/24; `test-results/.last-run.json` registra `passed`, sin pruebas fallidas. `npm audit --json`: cero vulnerabilidades conocidas. Capturas finales de mesa de escritorio, mesa móvil y revisión de personaje inspeccionadas.

Navegador de pruebas: Brave/Chromium firmado, controlado por Playwright; se usa `PLAYWRIGHT_CHROMIUM_EXECUTABLE` porque el ejecutable Chromium descargado está bloqueado por WDAC en esta máquina. Esta particularidad local no es un requisito del producto. La revisión independiente final no encontró bloqueos importantes después de corregir los cuatro hallazgos con regresiones. Micrófono físico, instalación móvil y publicación HTTPS quedan pendientes como se indica en ESTADO.md.

## Ajuste posterior — navegación del creador

5 de noviembre de 2026: al cambiar de paso se restablece el scroll al inicio y el foco al título. Regresión reproducida antes del arreglo en 390/1280 px (scroll 1167/508 px tras avanzar). Después: cinco E2E del creador/campaña correctas, incluidas dos nuevas pruebas de avance, revisión y vuelta; tipos, lint y build correctos. La suite total contiene ahora 26 pruebas; en este ajuste se ejecutó el archivo afectado con 5, no se repitió la suite completa. Editar elecciones dentro del mismo paso no reinicia la lectura.

## Validación para integración de la demo

5 de noviembre de 2026, tras la petición de integrar y desplegar: 133/133 unitarias y 27/27 E2E completas, tipos/lint/build correctos. La primera ejecución de 26 pruebas detectó un evento timeupdate tardío que movía el resaltado después de pausar. Una regresión determinista lo reprodujo (palabra 0→28 mientras estaba pausado); el controlador ahora ignora progreso con audio.paused. La nueva prueba también verifica que el progreso vuelve a funcionar al reanudar. No se ocultó la falla mediante reintentos.

## Migración cloud 0.4.1

137 unitarias iniciales verdes y 27 E2E completas sobre el servicio async. Integración real en Supabase Free: creación idempotente/hashdistinto409, propiedad privada404, dos escritores con una confirmación/CAS409, replay de dado sin nueva aleatoriedad, arrendamientos, enmiendas a pending/base/preview, reabrir repositorio, secreto inválido403, cuota persistida429 y caché. Tipos/lint/build correctos.

Revisión independiente encontró dos carreras: miss de media antes de claim y narración con snapshot pending antiguo/job ya acabado. Cuatro regresiones nuevas se observaron fallar (2 inferencias por medio /1 inferencia de narración innecesaria) y pasan tras recheck bajo claim/cached+relectura.141 unitarias verdes; build/27 E2E repetidas después de los arreglos. No se considera verificado el despliegue hasta comprobar la URL y el flujo remoto. Escaneo del bundle del navegador: ninguna coincidencia de los tres secretos privados actuales.

Resultado final cloud: tipos/lint/build y 27 E2E correctos después de las cuatro regresiones. Supabase real y producción HTTPS verificados. Script privado de smoke efectuó: creación, viaje, replay, recuperación, propietario ajeno 404, origen ajeno 403, copia cifrada ida/vuelta, manifest/standalone/SW. Con cuota real: intención de viaje al molino, prosa, imagen de 807.459 bytes, MP3 de 261.936 bytes decodificado: 43,656 s, repetición desde caché. Navegador firmado aislado abrió producción con datos sintéticos, controles/resaltado correctos, recargó conservando escena, sin errores JS ni overflow a 390 px. Capturas publicadas en entregables locales. No se simuló hardware probado ni campaña completa con IA real.

## Chat y routing gratuito 0.4.2

152/152 unitarias;31/31 E2E completas;2/2 integraciones reales Supabase; tipos/lint/build correctos. Se observaron fallos antes del arreglo para persistencia/replay/CAS de aclaraciones, respuestas a aclaración con historial, JSON válido pero contrato inválido, Retry-After503/CF y edición de salto de línea durante reintento. La voz natural se selecciona explícitamente en sus pruebas; nuevo usuario obtiene dispositivo incluso con voz hosted disponible. Se conservan turnos, finales, dictado, PWA, modo móvil y recuperación. Las respuestas de Groq/Gemini fueron simuladas: claves reales pendientes. El test de voz inicial detectó falso positivo al usar quiet (que sembraba device); se corrigió la prueba, se observó RED con nestor y GREEN con device.

Aviso de infraestructura de pruebas: Playwright/Brave debe poder cerrar sus procesos en Windows; dentro del sandbox hubo runners que no terminaban al limpiar. La suite completa final se ejecutó con permisos de proceso y terminó con código0. El simulador confundía cámara con Mara por límites de palabra ASCII; usa límites Unicode y la aventura completa vuelve a llegar a victoria.
