'use client';
import { useEffect, useState } from 'react';
import { GraduationCap, CalendarDays, ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck, FlaskConical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SITUATIONS, consentCopy, formatDate, type Webinar } from '@/lib/types';
export default function RegistrationForm({ id }: {
    id: string;
}) {
    const [w, setW] = useState<Webinar | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState(false);
    const [f, setF] = useState({ name: '', phone: '+91', situation: '', college: '', study: '', goal: '', webinar_consent: false, followup_consent: false, website: '' });
    const set = (key: string, value: string | boolean) => setF(x => ({ ...x, [key]: value }));
    useEffect(() => { fetch(`/api/register/${encodeURIComponent(id)}`).then(async (r) => { const b = await r.json() as {
        error?: string;
        webinar: Webinar;
    }; if (!r.ok)
        throw new Error(b.error || "Request failed. Please try again."); setW(b.webinar); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [id]);
    async function submit(e: React.FormEvent) { e.preventDefault(); setError(''); if (!f.situation) {
        setError('Choose your current situation.');
        return;
    } setBusy(true); try {
        const r = await fetch(`/api/register/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
        const b = await r.json() as {
            error?: string;
            webinar: Webinar;
        };
        if (!r.ok)
            throw new Error(b.error || "Request failed. Please try again.");
        setSuccess(true);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
    }
    finally {
        setBusy(false);
    } }
    const closed = w && (w.status !== 'open' || new Date(w.closes_at) <= new Date());
    const consent = w ? consentCopy(w.organizer) : null;
    return <div className="registration-page"><header className="registration-header"><span className="brand"><span className="brand-icon"><GraduationCap size={23}/></span>seminar<span className="brand-light">desk</span></span><span className="helper">{w?.organizer || 'Webinar registration'}</span></header>{loading ? <div className="loading"><LoaderCircle className="spin"/>Loading webinar…</div> : !w ? <div className="registration-missing"><h1>Registration unavailable</h1><p role="alert">{error || 'This webinar could not be found.'}</p><Button onClick={() => location.reload()}>Try again</Button></div> : <main className="registration-layout"><section className="registration-story"><span className="overline">A STEP TOWARD WHAT'S NEXT</span><h1>{w.title}</h1><p className="registration-description">{w.description}</p><div className="registration-facts"><p><CalendarDays size={20}/><span>{formatDate(w.starts_at)} IST</span></p><p><GraduationCap size={20}/><span>{w.course}<small>{w.batch}</small></span></p></div><div className="registration-note"><FlaskConical size={18}/><span>Demo registration. Your details are saved, but WhatsApp invitations are not sent yet.</span></div></section><section className="registration-form-card">{success ? <div className="registration-success"><CheckCircle2 size={46}/><p className="eyebrow">YOU'RE ON THE LIST</p><h2>Your registration is received.</h2><p>We look forward to seeing you at <strong>{w.title}</strong>.</p><div className="confirmation-date"><CalendarDays size={20}/>{formatDate(w.starts_at)} IST</div><p className="helper">This is a demo. No WhatsApp confirmation has been sent. If you registered before, your existing registration is kept.</p></div> : closed ? <div className="registration-success"><CalendarDays size={40}/><h2>{w.status === 'draft' ? 'Registration opens soon.' : 'Registration is closed.'}</h2><p>Please contact {w.organizer} about the next webinar.</p></div> : <><p className="eyebrow">SAVE YOUR PLACE</p><h2>Let's get to know you.</h2><p className="subtitle">A few details. No account needed.</p><form className="form-stack" onSubmit={submit}><label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Full name"/></label><label>WhatsApp number<input name="tel" type="tel" inputMode="tel" autoComplete="tel" required value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210"/><span className="helper">Include your country code.</span></label><label>Where are you in your journey?<Select value={f.situation} onValueChange={v => set('situation', v)}><SelectTrigger className="choice" aria-label="Current situation"><SelectValue placeholder="Choose your current situation"/></SelectTrigger><SelectContent>{SITUATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></label><div className="form-grid"><label>College / institution <span className="optional">optional</span><input maxLength={120} value={f.college} onChange={e => set('college', e.target.value)} placeholder="Institution name"/></label><label>Area of study <span className="optional">optional</span><input maxLength={120} value={f.study} onChange={e => set('study', e.target.value)} placeholder="e.g. B.Com, final year"/></label></div><label>What would you like to learn? <span className="optional">optional</span><textarea rows={2} maxLength={500} value={f.goal} onChange={e => set('goal', e.target.value)} placeholder="Your goals, questions, or skills you're interested in"/></label><div className="honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={e => set('website', e.target.value)}/></label></div><label className="check-label"><Checkbox aria-label="Webinar WhatsApp permission" checked={f.webinar_consent} onCheckedChange={v => set('webinar_consent', v === true)}/><span>{consent?.webinar}</span></label><label className="check-label"><Checkbox aria-label="Course follow-up permission" checked={f.followup_consent} onCheckedChange={v => set('followup_consent', v === true)}/><span>{consent?.followup}</span></label>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" className="primary-button registration-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <>Register for the webinar<ArrowRight size={18}/></>}</Button><p className="privacy-note"><ShieldCheck size={15}/>Your details are shared with {w.organizer} to manage your registration and the communications you choose. Contact the organizer to correct or remove your details.</p></form></>}</section></main>}<footer className="registration-footer">Seminar Desk · A clear next step.</footer></div>;
}
