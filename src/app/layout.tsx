import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Calabozos y Dragones · Tu aventura',
  applicationName: 'Tu aventura',
  appleWebApp: {
    capable: true,
    title: 'Tu aventura',
    statusBarStyle: 'black-translucent',
  },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-180.png' },
  description:
    'Una aventura de fantasía en español. Tú decides y la IA narra el siguiente capítulo.',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#141820',
  interactiveWidget: 'resizes-content',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="dark antialiased">{children}</body>
    </html>
  );
}
