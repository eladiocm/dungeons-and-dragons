import { GameError, isRecord } from './game-contract.ts';
export const VOICES = [
  { id: 'nestor', label: 'Néstor · serena' },
  { id: 'carina', label: 'Carina · cálida' },
  { id: 'javier', label: 'Javier · expresiva' },
] as const;
export type Speaker = (typeof VOICES)[number]['id'];
export interface SpeechRequest {
  text: string;
  speaker: Speaker;
}
export function validateSpeechRequest(value: unknown): SpeechRequest {
  if (
    !isRecord(value) ||
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.length > 1800 ||
    !VOICES.some((voice) => voice.id === value.speaker)
  )
    throw new GameError('La voz o el texto solicitado no es válido.');
  return { text: value.text.trim(), speaker: value.speaker as Speaker };
}
export function splitSpeechText(input: string): string[] {
  const chunks: string[] = [];
  let rest = input.trim();
  while (rest.length > 1800) {
    const candidate = rest.slice(0, 1800);
    const punctuation = [...candidate.matchAll(/[.!?…](?:\s|$)/g)].at(
      -1,
    )?.index;
    let end =
      punctuation !== undefined && punctuation > 300
        ? punctuation + 1
        : candidate.lastIndexOf(' ');
    if (end < 1) end = 1800;
    const last = rest.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
