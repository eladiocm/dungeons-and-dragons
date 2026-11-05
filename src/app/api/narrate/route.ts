import { handleSpeech } from '@/lib/game-api';
export const runtime = 'nodejs';
export const maxDuration = 65;
export function POST(request: Request) {
  return handleSpeech(request);
}
