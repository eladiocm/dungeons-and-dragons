import { sessionApi } from '@/server/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return sessionApi().get(request, (await context.params).id);
}
