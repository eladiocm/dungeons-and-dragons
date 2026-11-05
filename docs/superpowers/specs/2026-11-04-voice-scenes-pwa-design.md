# Voz, escenas y PWA

El usuario delegó previamente la implementación y solicita estos cambios directamente. Mantener el juego gratuito dentro de las cuotas existentes, sin publicar en Internet ni cambiar planes.

- Ocultar proveedor/modelo de la interfaz.
- El modelo decide `shouldIllustrate`: nueva imagen solo ante cambio significativo de lugar, personajes, amenaza o revelación visual; examinar/conversar no obliga a regenerar. Primera escena siempre ilustrable. Enviar descripción de escena actual como contexto. Guardar vínculo de escena para no duplicar imágenes al recargar.
- Solicitar pregunta contextual como campo explícito, incorporarla al texto del mensaje y del audio. Garantizar pregunta de reserva y migrar partidas anteriores sin borrarlas.
- Voz natural española Aura-2 mediante credenciales existentes; usa la misma cuota de Cloudflare. Alternativa explícita del dispositivo (calidad depende de sus voces). Botón escuchar por escena, pausa/reanudación, detener, voz y lectura automática opcional. Leer solo narrador y pregunta, nunca prompts de imágenes. Cancelar al reiniciar o cambiar voz; caché acotada para no regenerar al repetir.
- PWA nativa de Next: manifest, iconos, service worker, instalación cuando navegador la admite e instrucciones iOS. HTTPS necesario fuera de localhost. Sin conexión: abrir app y leer conversación guardada; generar contenido requiere conexión. No cachear APIs, credenciales o audio privado en el service worker.
- Mantener estilo visual, controles táctiles, texto de entrada de 16px y safe areas. Probar móvil y viewport con teclado reducido.

Se comparó voz del navegador (gratis pero calidad variable) frente a Aura vía Cloudflare (más natural y compatible con el backend existente). Se elige Aura predeterminada con alternativa de dispositivo. PWA sin librería adicional evita introducir dependencias de caché innecesarias.
