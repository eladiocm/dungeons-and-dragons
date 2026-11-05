import { mediaApi } from '@/server/runtime';
export const runtime = 'nodejs';
export const maxDuration = 65;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return mediaApi().speech(request, (await context.params).id);
}
