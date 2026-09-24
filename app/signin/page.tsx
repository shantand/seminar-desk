import { redirect } from 'next/navigation';
import { getAdminUser, safeReturnTo } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function SignIn({ searchParams }: { searchParams: Promise<{ return_to?: string; error?: string }> }) {
    const { return_to, error } = await searchParams;
    const returnTo = safeReturnTo(return_to || '/');
    const user = await getAdminUser();
    if (user) redirect(returnTo);
    return <div className="signin-page">
        <form className="signin-card" method="post" action="/api/auth/signin">
            <input type="hidden" name="return_to" value={returnTo}/>
            <h1>Seminar Desk</h1>
            <p className="subtitle">Sign in to your workspace.</p>
            <label>Password<input type="password" name="password" required autoFocus minLength={1} maxLength={200}/></label>
            {error && <p className="form-error" role="alert">That password didn&apos;t match. Try again.</p>}
            <button className="primary-button" type="submit">Sign in</button>
        </form>
    </div>;
}
