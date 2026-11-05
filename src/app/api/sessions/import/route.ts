import { sessionApi } from '@/server/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (request: Request) => sessionApi().import(request);
