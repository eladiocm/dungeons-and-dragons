import { sessionApi } from '@/server/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => sessionApi().list(request);
export const POST = (request: Request) => sessionApi().create(request);
