import { env } from 'cloudflare:workers';

// Thin client for the Meta WhatsApp Cloud API. Kept deliberately small:
// one function to send a template message, one to check whether the
// integration is configured at all, and one to verify inbound webhook
// signatures. Everything else (matching a delivery status back to a
// registration, falling back to the simulated flow) lives in lib/server.ts.

const GRAPH_VERSION = 'v21.0';

export function isWhatsAppConfigured(): boolean {
    return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export type WhatsAppSendResult = { ok: true; providerMessageId: string } | { ok: false; error: string };

/**
 * Sends Meta's built-in "hello_world" test template (or whatever template
 * name/language is configured via WHATSAPP_TEMPLATE_NAME / WHATSAPP_TEMPLATE_LANG)
 * to the given phone number. Business-initiated messages outside a 24-hour
 * customer service window must use a pre-approved template — free-form text
 * (like the app's personalized invitation copy) cannot be sent this way until
 * a custom template is submitted and approved by Meta.
 *
 * `to` should be a phone number in international format, digits only (e.g.
 * "919876543210" for an Indian number) — WhatsApp does not want a leading '+'.
 */
export async function sendTemplateMessage(to: string): Promise<WhatsAppSendResult> {
    const token = env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) return { ok: false, error: 'WhatsApp is not configured.' };

    const templateName = env.WHATSAPP_TEMPLATE_NAME || 'hello_world';
    const templateLang = env.WHATSAPP_TEMPLATE_LANG || 'en_US';
    const digitsOnly = to.replace(/[^\d]/g, '');

    let response: Response;
    try {
        response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: digitsOnly,
                type: 'template',
                template: { name: templateName, language: { code: templateLang } },
            }),
        });
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error contacting WhatsApp.' };
    }

    const body = await response.json().catch(() => null) as
        | { messages?: { id?: string }[]; error?: { message?: string } }
        | null;

    if (!response.ok || !body?.messages?.[0]?.id) {
        return { ok: false, error: body?.error?.message || `WhatsApp API responded with ${response.status}.` };
    }
    return { ok: true, providerMessageId: body.messages[0].id };
}

/**
 * Verifies Meta's X-Hub-Signature-256 header on an inbound webhook request.
 * `rawBody` must be the exact, unparsed request body bytes — the signature is
 * computed over the raw payload, so re-serializing parsed JSON will not match.
 */
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
    const appSecret = env.WHATSAPP_APP_SECRET;
    if (!appSecret || !signatureHeader) return false;
    const expectedPrefix = 'sha256=';
    if (!signatureHeader.startsWith(expectedPrefix)) return false;
    const provided = signatureHeader.slice(expectedPrefix.length);

    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const computed = Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');

    if (computed.length !== provided.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
    return diff === 0;
}

/** Maps a Meta status webhook's `status` field to the app's message state vocabulary. */
export function mapDeliveryStatus(metaStatus: string): string | null {
    switch (metaStatus) {
        case 'sent': return 'Sent';
        case 'delivered': return 'Delivered';
        case 'read': return 'Read';
        case 'failed': return 'Failed';
        default: return null;
    }
}
