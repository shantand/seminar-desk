import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type AdminUser = { userId: string; displayName: string };

const COOKIE_NAME = 'seminar_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SIGN_IN_PATH = '/signin';

function encoder() { return new TextEncoder(); }

function base64url(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlToBytes(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const bin = atob(padded);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function sessionSecret(): string {
    const secret = env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET is not configured.');
    return secret;
}

async function hmac(data: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', encoder().encode(sessionSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder().encode(data));
    return base64url(new Uint8Array(signature));
}

export async function createSessionToken(): Promise<string> {
    const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
    const payload = base64url(encoder().encode(JSON.stringify({ exp })));
    return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    if (!timingSafeEqual(signature, await hmac(payload))) return false;
    try {
        const { exp } = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload))) as { exp?: unknown };
        return typeof exp === 'number' && exp > Date.now();
    }
    catch {
        return false;
    }
}

async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', encoder().encode(value));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(candidate: string): Promise<boolean> {
    const expected = env.ADMIN_PASSWORD;
    if (!expected) throw new Error('ADMIN_PASSWORD is not configured.');
    // Compare fixed-length digests rather than the raw strings, so password length is never leaked.
    const [a, b] = await Promise.all([sha256Hex(candidate), sha256Hex(expected)]);
    return timingSafeEqual(a, b);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;

export async function getAdminUser(): Promise<AdminUser | null> {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;
    if (!(await verifySessionToken(token))) return null;
    return { userId: 'admin', displayName: 'Admin' };
}

export async function requireAdminUser(returnTo: string): Promise<AdminUser> {
    const user = await getAdminUser();
    if (user) return user;
    redirect(signInPath(returnTo));
}

function safeRelativeReturnPath(value: string): string {
    if (!value.startsWith('/') || value.startsWith('//')) return '/';
    let url: URL;
    try {
        url = new URL(value, 'https://app.local');
    }
    catch {
        return '/';
    }
    if (url.origin !== 'https://app.local') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
}

export function signInPath(returnTo: string): string {
    return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}
export function safeReturnTo(value: string): string {
    return safeRelativeReturnPath(value);
}
