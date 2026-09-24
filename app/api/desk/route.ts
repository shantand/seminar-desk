import { getAdminUser } from '@/lib/auth';
import { AppError, getState, ensureWorkspace, saveWebinar, updateLead, simulateInvitations, deleteWebinar } from '@/lib/server';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function failure(e: unknown) { if (e instanceof AppError)
    return json({ error: e.message }, e.status); if (e instanceof z.ZodError)
    return json({ error: e.issues[0]?.message || 'Check the form fields.' }, 400); console.error('Desk request failed', e); return json({ error: 'Could not save or load your workspace. Please try again.' }, 503); }
export async function GET() { try {
    const u = await getAdminUser();
    if (!u)
        return json({ error: 'Please sign in.' }, 401);
    await ensureWorkspace(u.userId);
    return json(await getState(u.userId));
}
catch (e) {
    return failure(e);
} }
export async function POST(request: Request) { try {
    const u = await getAdminUser();
    if (!u)
        return json({ error: 'Please sign in.' }, 401);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
        return json({ error: 'Request origin not allowed.' }, 403);
    if (Number(request.headers.get('content-length') || 0) > 25000)
        return json({ error: 'Request too large.' }, 413);
    const b = await request.json() as Record<string, unknown>;
    let result: unknown = null;
    switch (b.action) {
        case 'initialize':
            await ensureWorkspace(u.userId);
            break;
        case 'save_webinar':
            result = await saveWebinar(u.userId, b.webinar, typeof b.id === 'string' ? b.id : undefined);
            break;
        case 'update_lead':
            await updateLead(u.userId, b.lead);
            break;
        case 'simulate_invitations':
            result = await simulateInvitations(u.userId, b);
            break;
        case 'delete_webinar':
            if (typeof b.id !== 'string' || !b.id)
                throw new AppError('Missing webinar id.');
            await deleteWebinar(u.userId, b.id);
            break;
        default: throw new AppError('Unknown action.');
    }
    return json({ state: await getState(u.userId), result });
}
catch (e) {
    return failure(e);
} }
