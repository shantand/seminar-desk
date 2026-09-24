import { NextResponse } from 'next/server';
import { createSessionToken, safeReturnTo, verifyPassword, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE, signInPath } from '@/lib/auth';
import { database, hash } from '@/lib/database';
export const dynamic = 'force-dynamic';

// Two windows: a tight per-minute burst limit and a looser hourly ceiling,
// so a patient slow-drip guesser is stopped too, not just rapid retries.
async function withinRateLimit(ip: string): Promise<boolean> {
    const db = database();
    const minute = Math.floor(Date.now() / 60000);
    const hour = Math.floor(Date.now() / 3600000);
    const bump = async (key: string, ttlMs: number) => db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(await hash(key), Date.now() + ttlMs).first<{ count: number }>();
    const [perMinute, perHour] = await Promise.all([
        bump(`signin:${ip}:m:${minute}`, 120000),
        bump(`signin:${ip}:h:${hour}`, 3700000)
    ]);
    await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()).run();
    return (perMinute?.count ?? 0) <= 8 && (perHour?.count ?? 0) <= 20;
}

export async function POST(request: Request) {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const form = await request.formData();
    const password = String(form.get('password') || '');
    const returnTo = safeReturnTo(String(form.get('return_to') || '/'));
    const url = new URL(request.url);

    if (!(await withinRateLimit(ip))) {
        const to = new URL(signInPath(returnTo) + '&error=rate', url.origin);
        return NextResponse.redirect(to, { status: 303 });
    }

    let ok = false;
    try {
        ok = await verifyPassword(password);
    }
    catch {
        ok = false;
    }
    if (!ok) {
        const to = new URL(signInPath(returnTo) + '&error=1', url.origin);
        return NextResponse.redirect(to, { status: 303 });
    }
    const token = await createSessionToken();
    const response = NextResponse.redirect(new URL(returnTo, url.origin), { status: 303 });
    response.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_COOKIE_MAX_AGE });
    return response;
}
