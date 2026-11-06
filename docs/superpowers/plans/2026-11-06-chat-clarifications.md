# Corrección del diálogo de aclaración

Usuario confirma el segundo caso del diagnóstico: Enter envía pero la aclaración deja texto en el campo y no conserva el diálogo. Flujo aprobado: usuario y preguntaMaster dentro del historial, campo limpio al aceptar, respuesta visible; conservar borrador en error o si se editó mientras esperaba. Mantener Enter/ShiftEnter y revisión de dictado. Ninguna aclaración gasta tiempo, dados o recursos.

- [x] Reproducir en producción con datos sintéticos y probar RED con unidad/E2E.
- [x] Persistir ambos mensajes en la transacción idempotente del intent, incrementar versión de diálogo, conservar mecánica y recoger caches antiguas sin volver a llamar IA.
- [x] Aclaración disponible al Master al responder; cliente limpia solo el texto enviado y enfoca lectura del resultado propio sin alterar scroll de historias ajenas.
- [x] Verificar unidad/tipos/lint/build/E2E:152 unitarias/31 E2E; integración y publicación en main tras las comprobaciones finales.

Trabajo independiente en paralelo: investigación de cuotas gratuitas/fallback; selección nube confirmada. No prometer inferencia ilimitada. Pendiente claves nuevas en .env.providers.local; pruebas no deben gastar cuota del usuario.
