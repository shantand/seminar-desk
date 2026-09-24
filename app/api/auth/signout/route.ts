import { NextResponse } from 'next/server';
import { safeReturnTo, SESSION_COOKIE_NAME } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
    const url = new URL(request.url);
    let returnTo = url.searchParams.get('return_to') || '/';
    try {
        const form = await request.formData();
        const fromForm = form.get('return_to');
        if (typeof fromForm === 'string' && fromForm) returnTo = fromForm;
    }
    catch {
        // No form body (e.g. an empty POST) - fall back to the query param above.
    }
    const response = NextResponse.redirect(new URL(safeReturnTo(returnTo), url.origin), { status: 303 });
    response.cookies.set(SESSION_COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
}
