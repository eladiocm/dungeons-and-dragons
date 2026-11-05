'use client';
import { useEffect } from 'react';
import type { GeneratedImage } from '@/lib/game-contract';

export function useColorExtractor(image: GeneratedImage | undefined) {
  useEffect(() => {
    if (!image) {
      document.documentElement.style.removeProperty('--scene-tint');
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      try {
        ctx.drawImage(img, 0, 0, 32, 32);
        const { data } = ctx.getImageData(0, 0, 32, 32);
        let red = 0;
        let green = 0;
        let blue = 0;
        for (let i = 0; i < data.length; i += 4) {
          red += data[i];
          green += data[i + 1];
          blue += data[i + 2];
        }
        document.documentElement.style.setProperty(
          '--scene-tint',
          `rgb(${Math.round(red / 1024 / 3)} ${Math.round(green / 1024 / 3)} ${Math.round(blue / 1024 / 3)})`,
        );
      } catch {
        /* A failed tint must never interrupt gameplay. */
      }
    };
    img.src = `data:${image.mediaType};base64,${image.base64Data}`;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [image]);
}
