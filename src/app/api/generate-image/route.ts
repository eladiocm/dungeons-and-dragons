import { handleImage } from '@/lib/game-api';
export const runtime = 'nodejs';
export const maxDuration = 130;
export function POST(request: Request) {
  return handleImage(request);
}
