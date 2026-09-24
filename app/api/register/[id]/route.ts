import { publicWebinar, register, AppError } from '@/lib/server';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; try {
    const webinar = await publicWebinar(id);
    return Response.json(webinar ? { webinar } : { error: 'Webinar not found.' }, { status: webinar ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
}
catch {
    return Response.json({ error: 'Registration is temporarily unavailable.' }, { status: 503 });
} }
export async function POST(request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    if (Number(request.headers.get('content-length') || 0) > 10000)
        return Response.json({ error: 'Request too large.' }, { status: 413 });
    const { id } = await params;
    await register(id, await request.json(), request.headers.get('cf-connecting-ip') || 'local');
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
catch (e) {
    if (e instanceof z.ZodError)
        return Response.json({ error: e.issues[0]?.message || 'Check your details.' }, { status: 400 });
    if (e instanceof AppError)
        return Response.json({ error: e.message }, { status: e.status });
    console.error('Registration failed', e);
    return Response.json({ error: 'We could not save your registration. Please try again.' }, { status: 503 });
} }
