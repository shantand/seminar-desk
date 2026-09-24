import { env } from 'cloudflare:workers';
export function database() { if (!env.DB)
    throw new Error('Storage is not available. Please try again shortly.'); return env.DB; }
export async function hash(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join(''); }
