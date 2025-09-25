# 🧟 Calabozos y Dragones - Aventura de Supervivencia con IA

[![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Google AI](https://img.shields.io/badge/Google_AI-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

---

Un juego de aventura conversacional de supervivencia estilo Calabozos y Dragones con narrativa generada por IA y gráficos en estilo pixel art. Cada decisión que tomes influirá en tu historia de supervivencia en este mundo

## 🎮 Características

- **Narrativa Generada por IA**: Cada historia es única gracias a Google Gemini
- **Imágenes Dinámicas**: Visuales en estilo pixel art generadas automáticamente
- **Aventura Conversacional**: Interactúa usando lenguaje natural
- **Supervivencia**: Toma decisiones críticas para sobrevivir
- **Interfaz Moderna**: UI responsive y elegante con TailwindCSS
- **AI-Native Components**: Construido con [AI Elements](https://ai-sdk.dev/elements/overview), la librería de componentes especializada en aplicaciones de IA

## 🚀 Demo

¡Experimenta el universo Calabozos y Dragones como nunca antes! Cada partida es una aventura completamente diferente.

## 🛠️ Tecnologías

- **Framework**: [Next.js 15](https://nextjs.org/) con Turbopack
- **Frontend**: [React 19](https://reactjs.org/) con TypeScript
- **Estilos**: [TailwindCSS 4](https://tailwindcss.com/)
- **IA**: [Google Gemini](https://ai.google.dev/) para narrativa e imágenes
- **UI Components**: [AI Elements](https://ai-sdk.dev/elements/overview) de Vercel
- **Linting**: [Biome](https://biomejs.dev/)

## 📦 Instalación

1. **Clona el repositorio**
   
```bash
git clone https://github.com/eladiocm/dungeons-and-dragons.git
cd dungeons-and-dragons
```

2. **Instala las dependencias**
   
```bash
pnpm install
```

3. **Configura las variables de entorno**
   
```bash
cp .env.example .env.local
```
   
Añade tu clave de API de Google AI:
   
```env
GOOGLE_GENERATIVE_AI_API_KEY=tu_clave_aqui
```

4. **Inicia el servidor de desarrollo**

```bash
pnpm dev
```

5. **Abre tu navegador**

Visita [http://localhost:3000](http://localhost:3000) y comienza tu aventura de supervivencia.

## 🎯 Cómo Jugar

1. **Inicio**: El juego comenzará automáticamente con una escena inicial del universo de Calabozos y Dragones
2. **Interactúa**: Describe qué quieres hacer, adónde ir, qué examinar o cómo reaccionar
3. **Sobrevive**: Cada decisión afectará tu historia y tus posibilidades de supervivencia
4. **Explora**: El mundo se genera dinámicamente basado en tus acciones

### Ejemplos de Acciones

- "Busco un arma en la habitación"
- "Me dirijo hacia una salida"
- "Examino los sonidos"
- "Intento comunicarme con otros"

## 🔧 Scripts Disponibles

- `pnpm dev` - Inicia el servidor de desarrollo con Turbopack
- `pnpm build` - Construye la aplicación para producción
- `pnpm start` - Inicia el servidor de producción
- `pnpm lint` - Ejecuta el linter con Biome
- `pnpm format` - Formatea el código con Biome

## 🌟 Características Técnicas

- **Server Components**: Aprovecha las últimas características de React 19
- **Streaming**: Respuestas de IA en tiempo real
- **Optimización**: Turbopack para builds ultrarrápidos
- **AI-First Design**: Componentes nativos para IA con AI Elements de Vercel
- **Responsive**: Diseño adaptable a todos los dispositivos
- **Type Safety**: TypeScript estricto para mayor confiabilidad

---

<div align="center">

**¿Sobrevivirás a este universo? 🐲**

</div>