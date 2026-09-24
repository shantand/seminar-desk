import { NextResponse } from 'next/server';
import { safeReturnTo, SESSION_COOKIE_NAME } from '@/lib/auth';
export const dynamic = 'force-dynamic';
function signOut(request: Request) {
    const url = new URL(request.url);
    const returnTo = safeReturnTo(url.searchParams.get('return_to') || '/');
    const response = NextResponse.redirect(new URL(returnTo, url.origin), { status: 303 });
    response.cookies.set(SESSION_COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
}
export async function GET(request: Request) { return signOut(request); }
export async function POST(request: Request) { return signOut(request); }
