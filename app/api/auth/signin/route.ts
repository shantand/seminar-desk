import { NextResponse } from 'next/server';
import { createSessionToken, safeReturnTo, verifyPassword, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE, signInPath } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
    const form = await request.formData();
    const password = String(form.get('password') || '');
    const returnTo = safeReturnTo(String(form.get('return_to') || '/'));
    const url = new URL(request.url);
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
