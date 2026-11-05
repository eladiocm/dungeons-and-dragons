import { mediaApi } from '@/server/runtime';
export const runtime = 'nodejs';
export const maxDuration = 130;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return mediaApi().image(request, (await context.params).id);
}
