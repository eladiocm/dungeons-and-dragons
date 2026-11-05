import { splitSpeechText } from './speech-contract.ts';
export function narrationWords(
  text: string,
): { text: string; start: number; end: number }[] {
  return [...text.matchAll(/\S+/gu)].map((m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}
export function wordAtCharacter(text: string, charIndex: number): number {
  return narrationWords(text).findLastIndex((w) => w.start <= charIndex);
}
/** Aura exposes audio duration, not word timestamps. This is a visual estimate only. */
export function wordAtTime(
  text: string,
  current: number,
  duration: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current))
    return -1;
  const words = narrationWords(text);
  if (!words.length) return -1;
  const weights = words.map(
      (w) =>
        Math.max(3, w.text.length) +
        (/[.!?…]$/.test(w.text) ? 4 : /[,;:]$/.test(w.text) ? 2 : 0),
    ),
    total = weights.reduce((a, b) => a + b, 0),
    target = Math.max(0, Math.min(1, current / duration)) * total;
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (target < sum) return i;
  }
  return words.length - 1;
}
export function narrationChunks(
  text: string,
): { text: string; firstWord: number }[] {
  let firstWord = 0;
  return splitSpeechText(text).map((chunk) => {
    const part = { text: chunk, firstWord };
    firstWord += narrationWords(chunk).length;
    return part;
  });
}
