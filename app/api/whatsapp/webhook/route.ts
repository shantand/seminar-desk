import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { database } from '@/lib/database';
import { verifyWebhookSignature, mapDeliveryStatus } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

// Meta calls this once, on setup, to verify you control the endpoint.
export async function GET(request: Request) {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

// Meta calls this whenever a message we sent changes delivery state
// (sent / delivered / read / failed). We match the update back to our own
// row via the provider_message_id we stored when we sent it.
export async function POST(request: Request) {
    const signature = request.headers.get('x-hub-signature-256');
    const rawBody = await request.text();

    if (!(await verifyWebhookSignature(rawBody, signature))) {
        return new NextResponse('Invalid signature', { status: 401 });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(rawBody);
    }
    catch {
        return new NextResponse('Bad request', { status: 400 });
    }

    const db = database();
    const updates: { providerMessageId: string; state: string }[] = [];

    // Meta's payload shape: { entry: [{ changes: [{ value: { statuses: [{ id, status }] } }] }] }
    const entries = (payload as { entry?: unknown[] })?.entry;
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            const changes = (entry as { changes?: unknown[] })?.changes;
            if (!Array.isArray(changes)) continue;
            for (const change of changes) {
                const statuses = (change as { value?: { statuses?: unknown[] } })?.value?.statuses;
                if (!Array.isArray(statuses)) continue;
                for (const s of statuses) {
                    const id = (s as { id?: unknown })?.id;
                    const status = (s as { status?: unknown })?.status;
                    if (typeof id !== 'string' || typeof status !== 'string') continue;
                    const mapped = mapDeliveryStatus(status);
                    if (mapped) updates.push({ providerMessageId: id, state: mapped });
                }
            }
        }
    }

    if (updates.length) {
        await db.batch(updates.map(u =>
            db.prepare('UPDATE messages SET state=? WHERE provider_message_id=?').bind(u.state, u.providerMessageId)
        ));
    }

    // Meta requires a 200 response to acknowledge receipt, regardless of whether
    // any rows matched (an update for a message we didn't send is not an error).
    return new NextResponse('OK', { status: 200 });
}
