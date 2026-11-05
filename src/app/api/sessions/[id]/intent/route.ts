import { sessionApi } from '@/server/runtime';
export const runtime = 'nodejs';
export const maxDuration = 130;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return sessionApi().intent(request, (await context.params).id);
}
