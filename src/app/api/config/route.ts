import { publicConfig } from '@/lib/ai-provider';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(publicConfig(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
