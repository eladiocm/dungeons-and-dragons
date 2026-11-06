# Proveedores gratuitos y sesiones largas

> Ejecución: superpowers:executing-plans, con pruebas antes del código.

Objetivo autorizado: jugar en la nube combinando cuotas gratuitas, sin facturación ni promesas de uso ilimitado. El usuario preparará GROQ_API_KEY y GEMINI_API_KEY en el archivo privado ignorado .env.providers.local.

Arquitectura: enrutador de JSON del Master separado de imágenes/voz. Orden Groq GPT-OSS 120B, Gemini 3.1 Flash-Lite y Cloudflare actual; omitir claves ausentes. Un intento por proveedor, fallback ante cuota, credenciales/modelo no disponible, fallo temporal o JSON malformado. Registrar pausas de proveedor compartidas en Postgres, respetar Retry-After, sin rotar cuentas/claves para eludir límites. El motor sigue validando planes y narrando solo eventos confirmados. El historial enviado pierde metadatos redundantes y el catálogo se limita a conjuros del personaje; el guardado no se recorta.

Voz del dispositivo por defecto para instalaciones nuevas, conservar preferencias guardadas; voz natural opcional con aviso de cuota. Subir el tope interno diario a 1000 operaciones únicamente al configurar los proveedores, no atribuirle capacidad real de inferencia. Las cuotas de cuenta siguen mandando.

- [x] T1: tests RED de orden/fallback, JSON, cooldown persistente, errores sin secretos, claves ausentes; implementar router nativo fetch y RPC de cooldown protegida por credencial backend. Probar unitarias y Supabase real.
- [x] T2: tests RED del contexto compacto y voz inicial sin API; aplicar contexto, integrar singleton router/runtime y voz. Mantener pruebas de voz natural con selección explícita. Ejecutar unidad/tipos/lint/build/E2E.
- [ ] T3: comprobar claves sin imprimir, verificar llamadas reales mínimas cuando estén disponibles, configurar variables cifradas en Vercel dentro del alcance autorizado. Revisión independiente final, corregir bloqueos, documentar y actualizar grafo. Integrar develop→main, publicar y verificar HTTPS/chat.

Revisión focal: no duplicar efectos al cambiar proveedor; ninguna credencial en logs/config pública; no ignorar pausas tras un arranque frío; guardar borradores si todos fallan; magia innata/elfa/rituales sigue disponible; el límite del demo no sustituye las cuotas gratuitas; las preferencias de voz existentes se conservan.

Fuentes oficiales comprobadas 2026-11-06: console.groq.com/docs/rate-limits y /docs/openai; ai.google.dev/gemini-api/docs/pricing y /docs/rate-limits; developers.cloudflare.com/workers-ai/platform/pricing. DeepSeek API no tiene plan gratuito permanente; Copilot no se usa como API del juego. No añadir servicios que requieran tarjeta o pago.

Evidencia:152 unitarias,31 E2E completas,2 integraciones Supabase reales, tipos/lint/build correctos. Revisión independiente: dos hallazgos importantes (contrato antes de aceptar proveedor y Retry-After en errores temporales/CF) corregidos con RED→GREEN. Conservación de saltos de línea elevada a requisito de borrador y corregida RED→GREEN. Simulador separa palabras Unicode para no confundir cámara con Mara; recorrido completo verde. Sin menores diferidos.

Pendiente dependiente del usuario: ambas claves siguen vacías; no se puede verificar disponibilidad, cuotas particulares ni calidad real de Groq/Gemini. Publicar la corrección del chat y el enrutador preparado es independiente. Tope100 vigente hasta activar nuevos proveedores; no elevarlo como supuesto remedio de las neuronas de CF.
