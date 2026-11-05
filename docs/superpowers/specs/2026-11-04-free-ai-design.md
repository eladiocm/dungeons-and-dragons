# Aventura con IA gratuita

El usuario delegó la elección y autorizó todas las correcciones. Conservar aventura conversacional en español e ilustraciones pixel art. No añadir reglas de D&D nuevas.

## Enfoques considerados
- Cloudflare: Llama 3.3 70B y FLUX.1 Schnell, cuota gratuita renovable, una cuenta. Elección del implementador por sencillez y ambas modalidades.
- Groq: buena alternativa gratuita para texto, necesita otro proveedor de imágenes.
- Ollama: texto local sin cuota; requiere instalar y descargar modelo. Se admite como alternativa, con imágenes opcionales de Cloudflare.
- Pollinations: requiere claves y Pollen; no asumir API ilimitada gratuita.

## Comportamiento y límites
Cloudflare predeterminado, claves solo en servidor, JSON estructurado validado, errores en español y reintentos explícitos. Imágenes opcionales con reintento independiente. Guardar texto y descripción de escenas localmente, sin imágenes grandes. Restaurar sin regenerar. Cancelar trabajo antiguo al reiniciar, evitar inicio doble en Strict Mode. Enviar solo role/content y limitar contexto, tamaño, tiempo y frecuencia. No cambiar a proveedores de pago automáticamente. No afirmar IA real verificada sin credenciales.

## Mantenimiento y pruebas
Actualizar dependencias a versiones estables del registro. Retirar plantillas no utilizadas y sus dependencias, preservar chat oscuro adaptable. Fuentes de sistema, metadatos correctos y secretos excluidos de Git. Pruebas de contratos, proveedores y errores; navegador con APIs simuladas, tipos, lint, audit y build. Trabajo en copia aislada y sincronización controlada sin tocar credenciales ni cambios ajenos.
