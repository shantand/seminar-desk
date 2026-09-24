'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Users, Sun, Plus, ArrowUpRight, ArrowRight, Clock3, MessageCircle, GraduationCap, Headphones, Phone, FlaskConical, Search, Copy, ExternalLink, RefreshCw, Check, CheckCircle2, Send, Settings2, History, Ban, Smartphone, LogOut, LoaderCircle, CalendarCheck, Link2, ChevronDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { type DeskState, type Webinar, type Lead, STATUSES, ATTENDANCE, formatDate, dayKey, monthKey, monthLabel, inputDate, fromInput, initials, isActive, invitation } from '@/lib/types';
const empty: DeskState = { webinars: [], leads: [], activities: [], messages: [], mode: 'demo', whatsapp_configured: false };
type Mutation = (body: Record<string, unknown>) => Promise<unknown>;
function Choice({ value, onChange, items, label }: {
    value: string;
    onChange: (v: string) => void;
    items: readonly string[] | {
        value: string;
        label: string;
    }[];
    label: string;
}) { return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="choice"><SelectValue /></SelectTrigger><SelectContent>{items.map(x => <SelectItem key={typeof x === 'string' ? x : x.value} value={typeof x === 'string' ? x : x.value}>{typeof x === 'string' ? x : x.label}</SelectItem>)}</SelectContent></Select>; }
function Status({ value }: {
    value: string;
}) { return <span className={'status ' + (value === 'Interested' ? 'interested' : value === 'Follow-up required' ? 'followup' : value === 'Not contacted' ? 'new' : 'closed')}>{value}</span>; }
function Empty({ title, body }: {
    title: string;
    body: string;
}) { return <div className="empty-state"><CheckCircle2 size={30}/><h3>{title}</h3><p>{body}</p></div>; }
function WebinarRow({ webinar: w, leadCount, eligibleCount, openPeople, setInviteId, setEditor }: {
    webinar: Webinar;
    leadCount: number;
    eligibleCount: number;
    openPeople: (w?: Webinar, status?: string) => void;
    setInviteId: (id: string) => void;
    setEditor: (v: { webinar?: Webinar; duplicate?: boolean } | null) => void;
}) {
    const ended = w.status === 'open' && new Date(w.closes_at) < new Date();
    return <Collapsible className="webinar-row"><div className="webinar-row-main"><div className="webinar-row-title"><strong>{w.title}</strong><span className="webinar-row-date"><CalendarDays size={14}/>{formatDate(w.starts_at)} IST</span></div><div className="webinar-row-actions"><a className="icon-button" href={`/register/${w.id}`} target="_blank" rel="noreferrer" aria-label={`Preview ${w.title} registration form`}><ExternalLink size={16}/></a><button className="icon-button" aria-label={`Duplicate ${w.title}`} onClick={() => setEditor({ webinar: w, duplicate: true })}><Copy size={16}/></button><Button className="primary-button row-invite" onClick={() => setInviteId(w.id)} disabled={w.status !== 'open' || new Date(w.starts_at) < new Date()}><Send size={15}/>Invite{eligibleCount > 0 && <span className="button-count">{eligibleCount}</span>}</Button><button className="icon-button" aria-label={`Copy ${w.title} registration link`} onClick={async () => { try {
        await navigator.clipboard.writeText(`${location.origin}/register/${w.id}`);
        toast.success('Link copied. This private demo requires site access.');
    }
    catch {
        toast.error('Copy unavailable. Open the form and copy its address.');
    } }}><Link2 size={16}/></button><CollapsibleTrigger asChild><button className="icon-button row-toggle" aria-label={`More details for ${w.title}`}><ChevronDown size={16}/></button></CollapsibleTrigger></div></div><CollapsibleContent className="webinar-row-details"><div className="webinar-row-meta"><span className="course-label">{w.course}</span><span className={'status ' + (w.status === 'open' ? 'interested' : w.status === 'draft' ? 'followup' : 'closed')}>{ended ? 'Registration ended' : w.status[0].toUpperCase() + w.status.slice(1)}</span><span><GraduationCap size={14}/>{w.batch}</span></div><p className="webinar-description">{w.description}</p><div className="webinar-row-footer"><button className="registration-count" onClick={() => openPeople(w)}><span><Users size={17}/><strong>{leadCount}</strong> registered</span><span>View people<ArrowRight size={15}/></span></button><Button variant="outline" onClick={() => setEditor({ webinar: w })} aria-label={`Edit ${w.title}`}><Settings2 size={16}/>Edit</Button></div></CollapsibleContent></Collapsible>;
}
export default function Desk({ displayName = 'Your workspace' }: {
    displayName?: string;
}) {
    const [data, setData] = useState<DeskState>(empty), [loading, setLoading] = useState(true), [error, setError] = useState(''), [tab, setTab] = useState('today'), [search, setSearch] = useState(''), [courseFilter, setCourseFilter] = useState('all'), [statusFilter, setStatusFilter] = useState('all'), [todayFilter, setTodayFilter] = useState('all');
    const [selectedId, setSelectedId] = useState<string | null>(null), [editor, setEditor] = useState<{
        webinar?: Webinar;
        duplicate?: boolean;
    } | null>(null), [inviteId, setInviteId] = useState<string | null>(null), [webinarView, setWebinarView] = useState<string | null>(null), [showInfo, setShowInfo] = useState(false), [installPrompt, setInstallPrompt] = useState<any>(null);
    const load = useCallback(async () => { setError(''); setLoading(true); try {
        const r = await fetch('/api/desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'initialize' }) });
        const b = await r.json() as {
            error?: string;
            state: DeskState;
            result: unknown;
        };
        if (!r.ok)
            throw new Error(b.error || "Could not load workspace.");
        setData(b.state);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the workspace.');
    }
    finally {
        setLoading(false);
    } }, []);
    useEffect(() => { void load(); const install = (e: Event) => { e.preventDefault(); setInstallPrompt(e); }; window.addEventListener('beforeinstallprompt', install); if ('serviceWorker' in navigator)
        void navigator.serviceWorker.register('/sw.js').catch(() => { }); return () => window.removeEventListener('beforeinstallprompt', install); }, [load]);
    const mutate: Mutation = async (body) => { const r = await fetch('/api/desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const b = await r.json() as {
        error?: string;
        state: DeskState;
        result: unknown;
    }; if (!r.ok)
        throw new Error(b.error || 'Could not save. Please try again.'); setData(b.state); return b.result; };
    const selected = data.leads.find(l => l.id === selectedId), invitedWebinar = data.webinars.find(w => w.id === inviteId), viewed = data.webinars.find(w => w.id === webinarView);
    const today = dayKey(), active = data.leads.filter(isActive), due = active.filter(l => l.next_at && dayKey(l.next_at) <= today), upcoming = data.webinars.filter(w => w.status === 'open' && new Date(w.starts_at) > new Date()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const eligible = (w: Webinar) => data.leads.filter(l => l.webinar_id === w.id && l.webinar_consent && !l.do_not_contact && !l.invitation_state);
    const pending = upcoming.reduce((n, w) => n + eligible(w).length, 0);
    const monthGroups = useMemo(() => { const groups = new Map<string, Webinar[]>(); for (const w of data.webinars) { const key = monthKey(w.starts_at); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(w); } return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0])); }, [data.webinars]);
    const people = data.leads.filter(l => (!webinarView || l.webinar_id === webinarView) && (courseFilter === 'all' || l.course === courseFilter) && (statusFilter === 'all' || l.status === statusFilter) && `${l.name} ${l.phone} ${l.college} ${l.course}`.toLowerCase().includes(search.toLowerCase()));
    const tasks = active.filter(l => todayFilter === 'new' ? l.status === 'Not contacted' : todayFilter === 'overdue' ? !!l.next_at && dayKey(l.next_at) < today : todayFilter === 'later' ? !!l.next_at && dayKey(l.next_at) > today : todayFilter === 'today' ? !!l.next_at && dayKey(l.next_at) === today : !l.next_at || dayKey(l.next_at) <= today).sort((a, b) => (a.next_at || '9999').localeCompare(b.next_at || '9999'));
    function openPeople(w?: Webinar, status = 'all') { setTab('people'); setWebinarView(w?.id || null); setStatusFilter(status); setCourseFilter('all'); setSearch(''); }
    function navigate(v: string) { setTab(v); if (v === 'people') {
        setWebinarView(null);
        setStatusFilter('all');
    } }
    useEffect(() => { const context = (document as any).modelContext; if (!context?.registerTool)
        return; const lifecycle = new AbortController(); for (const tool of [{ name: 'list_webinars', title: 'List webinars', description: 'Read webinars and registration counts in this workspace.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input: unknown) { if (!input || typeof input !== 'object' || Object.keys(input).length)
                throw new Error('Expected an empty object.'); return data.webinars.map(w => ({ id: w.id, title: w.title, status: w.status, registrations: data.leads.filter(l => l.webinar_id === w.id).length })); } }, { name: 'open_contact', title: 'Open contact', description: 'Open a registration in the contact detail panel. Does not update records or send messages.', inputSchema: { type: 'object', properties: { registrationId: { type: 'string' } }, required: ['registrationId'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input: any) { if (!input || typeof input.registrationId !== 'string' || Object.keys(input).length !== 1 || !data.leads.some(l => l.id === input.registrationId))
                throw new Error('Choose an existing registration ID.'); setSelectedId(input.registrationId); return { opened: input.registrationId }; } }]) {
        try {
            void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => { });
        }
        catch { }
    } return () => lifecycle.abort(); }, [data]);
    function PersonCard({ lead: l, index = 0 }: {
        lead: Lead;
        index?: number;
    }) { return <button className="person-card" onClick={() => setSelectedId(l.id)}><span className={'avatar avatar-' + index % 3}>{initials(l.name)}</span><div className="person-main"><div className="person-title"><h3>{l.name}</h3><Status value={l.status}/>{!!l.do_not_contact && <span className="status closed"><Ban size={12}/>Do not contact</span>}</div><p className="meta">{l.situation}<span>·</span>{l.course}</p><p className="person-note">{l.last_note || l.goal || 'New registration. Start with what they want to learn.'}</p><div className="card-bottom"><span className={'due ' + (l.next_at && dayKey(l.next_at) < today ? 'overdue' : '')}><Clock3 size={14}/>{l.next_at ? `${formatDate(l.next_at)} IST` : l.status === 'Not contacted' ? 'Not contacted yet' : 'No next action'}</span>{data.leads.filter(x => x.contact_id === l.contact_id).length > 1 && <span className="history-hint"><History size={13}/>Returning learner</span>}</div></div><ArrowUpRight className="row-arrow" size={20}/></button>; }
    return <div className="app-shell"><Toaster theme="light" position="top-center"/><header className="topbar"><a className="brand" href="/"><span className="brand-icon"><Headphones size={21}/></span>seminar<span className="brand-light">desk</span></a><Tabs value={tab} onValueChange={navigate}><TabsList className="main-nav" variant="line"><TabsTrigger value="today"><Sun />Home</TabsTrigger><TabsTrigger value="webinars"><CalendarDays />Webinars</TabsTrigger><TabsTrigger value="people"><Users />Registrations</TabsTrigger></TabsList></Tabs><button className="profile" aria-label="Workspace and demo information" onClick={() => setShowInfo(true)}>{initials(displayName)}</button></header><main className="workspace"><div className="page-heading"><div><p className="eyebrow">{tab === 'today' ? new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date()).toUpperCase() : ''}</p><h1>{tab === 'today' ? 'Ready to launch Your Gig!' : tab === 'webinars' ? 'Schedule' : viewed ? viewed.title : 'Active Participants'}</h1><p className="subtitle">{tab === 'today' ? '' : tab === 'webinars' ? '' : viewed ? `${viewed.course} · ${viewed.batch}` : ''}</p></div>{tab !== 'people' && <Button className="primary-button" onClick={() => setEditor({})}><Plus size={18}/>Create Webinar</Button>}</div>
 {error ? <div className="error-box" role="alert"><p>{error}</p><Button onClick={load} variant="outline"><RefreshCw size={16}/>Try again</Button><a href="/signin?return_to=/" target="_top">Sign in again</a></div> : loading ? <div className="loading"><LoaderCircle className="spin"/>Opening your workspace…</div> : <>
 {tab === 'today' && <><div className="stats-grid"><button onClick={() => setTodayFilter('all')}><span>Follow-ups due</span><strong>{due.length}<Clock3 /></strong></button><button onClick={() => setTab('webinars')}><span>Invitations pending</span><strong>{pending}<MessageCircle /></strong></button><button onClick={() => openPeople(undefined, 'Interested')}><span>Interested learners</span><strong>{active.filter(l => l.status === 'Interested').length}<Users /></strong></button><button onClick={() => setTab('webinars')}><span>Upcoming webinars</span><strong>{upcoming.length}<CalendarDays /></strong></button></div><div className="work-grid"><section><div className="section-heading"><h2>Your next conversations</h2><button className="icon-button" aria-label="Refresh workspace" onClick={load}><RefreshCw size={17}/></button></div><Tabs value={todayFilter} onValueChange={setTodayFilter}><TabsList className="filter-tabs"><TabsTrigger value="all">To do</TabsTrigger><TabsTrigger value="overdue">Overdue</TabsTrigger><TabsTrigger value="today">Today</TabsTrigger><TabsTrigger value="new">New</TabsTrigger><TabsTrigger value="later">Later</TabsTrigger></TabsList></Tabs><div className="task-list">{tasks.length ? tasks.map((l, i) => <PersonCard key={l.id} lead={l} index={i}/>) : <Empty title="You're all caught up here." body="Scheduled conversations will appear in the appropriate list."/>}</div></section><aside><div className="section-heading"><h2>Coming up</h2><CalendarDays size={18}/></div>{upcoming[0] ? <button className="webinar-feature" onClick={() => openPeople(upcoming[0])}><span className="overline">NEXT WEBINAR</span><div className="date-block"><strong>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(upcoming[0].starts_at))}</strong><span>{new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(upcoming[0].starts_at)).toUpperCase()}</span></div><h3>{upcoming[0].title}</h3><p>{formatDate(upcoming[0].starts_at)} IST</p><div className="feature-footer"><span>{upcoming[0].batch}</span><ArrowUpRight size={20}/></div></button> : <Empty title="What's next?" body="Create a webinar for your next batch."/>}<div className="quiet-card"><MessageCircle size={23}/><h3>A personal invite, for everyone.</h3><p>{pending ? `${pending} registrants are waiting for an invitation preview.` : 'Your invitation queue is up to date.'}</p><button className="text-button" onClick={() => setTab('webinars')}>View webinars <ArrowRight size={16}/></button></div></aside></div></>}
 {tab === 'webinars' && <div className="webinar-months">{data.webinars.length ? monthGroups.map(([key, webinars]) => <section className="month-group" key={key}><h3 className="month-heading">{monthLabel(key)}</h3><div className="webinar-rows">{webinars.map(w => <WebinarRow key={w.id} webinar={w} leadCount={data.leads.filter(l => l.webinar_id === w.id).length} eligibleCount={eligible(w).length} openPeople={openPeople} setInviteId={setInviteId} setEditor={setEditor}/>)}</div></section>) : <Empty title="No webinars yet." body="Create a webinar to open registration for your next batch."/>}</div>}
 {tab === 'people' && <><div className="filter-row"><div className="search-field"><Search size={18}/><input aria-label="Search people" placeholder="Search name, phone, or college" value={search} onChange={e => setSearch(e.target.value)}/></div><Choice label="Filter course" value={courseFilter} onChange={setCourseFilter} items={[{ value: 'all', label: 'All courses' }, ...Array.from(new Set(data.webinars.map(w => w.course))).map(c => ({ value: c, label: c }))]}/><Choice label="Filter status" value={statusFilter} onChange={setStatusFilter} items={[{ value: 'all', label: 'All statuses' }, ...STATUSES.map(s => ({ value: s, label: s }))]}/>{viewed && <Button variant="outline" onClick={() => setWebinarView(null)}>All webinars</Button>}</div><div className="section-heading"><span className="meta">{people.length} registration{people.length !== 1 ? 's' : ''} · {new Set(people.map(p => p.contact_id)).size} people</span><button className="icon-button" aria-label="Refresh people" onClick={load}><RefreshCw size={17}/></button></div><div className="people-grid">{people.length ? people.map((l, i) => <PersonCard key={l.id} lead={l} index={i}/>) : <Empty title="No matching registrations" body="Try another search or filter."/>}</div></>}
 </>}
 </main>
 {editor && <WebinarEditor initial={editor.webinar} duplicate={editor.duplicate} mutate={mutate} close={() => setEditor(null)} done={() => { setEditor(null); setTab('webinars'); }}/>}
 <Sheet open={!!selected} onOpenChange={o => { if (!o)
        setSelectedId(null); }}><SheetContent className="contact-sheet">{selected && <ContactDetail key={selected.id} lead={selected} data={data} mutate={mutate} close={() => setSelectedId(null)}/>}</SheetContent></Sheet>
 {invitedWebinar && <InvitationDialog webinar={invitedWebinar} data={data} mutate={mutate} close={() => setInviteId(null)}/>}
 <Dialog open={showInfo} onOpenChange={setShowInfo}><DialogContent className="app-dialog account-dialog"><DialogHeader><div className="account-avatar">{initials(displayName)}</div><DialogTitle>{displayName}</DialogTitle><DialogDescription>Signed in</DialogDescription></DialogHeader><div className="info-box"><Smartphone /><div><h3>Keep it on your home screen</h3><p>On iPhone, open this site in Safari, tap Share, then Add to Home Screen. On Android, use your browser's Install app or Add to Home screen option. An internet connection is required.</p>{installPrompt && <Button onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}>Install app</Button>}</div></div><form method="post" action="/api/auth/signout"><input type="hidden" name="return_to" value="/"/><button type="submit" className="signout"><LogOut size={16}/>Sign out</button></form></DialogContent></Dialog>
 </div>;
}
function WebinarEditor({ initial, duplicate, mutate, close, done }: {
    initial?: Webinar;
    duplicate?: boolean;
    mutate: Mutation;
    close: () => void;
    done: () => void;
}) {
    const [form, setForm] = useState({ title: initial?.title || '', course: initial?.course || '', batch: duplicate ? '' : initial?.batch || '', description: initial?.description || '', organizer: initial?.organizer || 'Seminar Desk Academy', starts_at: !duplicate && initial ? inputDate(initial.starts_at) : '', closes_at: !duplicate && initial ? inputDate(initial.closes_at) : '', join_url: duplicate ? '' : initial?.join_url || '', status: duplicate ? 'draft' : initial?.status || 'draft' });
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
    async function submit(e: React.FormEvent) { e.preventDefault(); setError(''); setBusy(true); try {
        await mutate({ action: 'save_webinar', id: !duplicate ? initial?.id : undefined, webinar: { ...form, starts_at: fromInput(form.starts_at), closes_at: fromInput(form.closes_at || form.starts_at) } });
        toast.success(initial && !duplicate ? 'Webinar updated.' : duplicate ? 'New batch webinar created.' : 'Webinar created.');
        done();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the webinar.');
    }
    finally {
        setBusy(false);
    } }
    return <Dialog open onOpenChange={o => { if (!o && !busy)
        close(); }}><DialogContent className="app-dialog wide-dialog"><DialogHeader><DialogTitle>{duplicate ? 'A new webinar for the next batch' : initial ? 'Edit webinar' : 'Create a webinar'}</DialogTitle><DialogDescription>{duplicate ? 'Your content is copied. Set a new batch, date, and joining link.' : 'One registration page, ready to share. All times are IST.'}</DialogDescription></DialogHeader><form onSubmit={submit} className="form-stack"><label>Webinar title<input required minLength={3} maxLength={120} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Your first step into digital marketing"/></label><div className="form-grid"><label>Course<input required minLength={2} maxLength={80} value={form.course} onChange={e => set('course', e.target.value)} placeholder="Digital Marketing"/></label><label>Target batch<input required minLength={2} maxLength={80} value={form.batch} onChange={e => set('batch', e.target.value)} placeholder="January 2027 · Weekends"/></label></div><label>What will participants learn?<textarea required minLength={10} maxLength={2000} rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="A short, practical introduction to…"/></label><div className="form-grid"><label>Webinar date and time · IST<input required type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)}/></label><label>Registration closes · IST<input type="datetime-local" value={form.closes_at} onChange={e => set('closes_at', e.target.value)} max={form.starts_at || undefined}/><span className="helper">Defaults to the webinar start.</span></label></div><label>Webinar joining link<input required type="url" value={form.join_url} onChange={e => set('join_url', e.target.value)} placeholder="https://meet.google.com/…"/></label><div className="form-grid"><label>Organizer<input required minLength={2} maxLength={80} value={form.organizer} onChange={e => set('organizer', e.target.value)}/></label><label>Registration status<Choice label="Registration status" value={form.status} onChange={v => set('status', v)} items={[{ value: 'draft', label: 'Draft' }, { value: 'open', label: 'Open registration' }, { value: 'closed', label: 'Closed' }]}/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button><Button className="primary-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}Save webinar</Button></div></form></DialogContent></Dialog>;
}
function ContactDetail({ lead: l, data, mutate, close }: {
    lead: Lead;
    data: DeskState;
    mutate: Mutation;
    close: () => void;
}) {
    const [status, setStatus] = useState(l.status), [date, setDate] = useState(l.next_at ? inputDate(l.next_at) : ''), [note, setNote] = useState(''), [outcome, setOutcome] = useState('Conversation'), [attendance, setAttendance] = useState(l.attendance), [dnc, setDnc] = useState(!!l.do_not_contact), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const history = data.leads.filter(x => x.contact_id === l.contact_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const activities = data.activities.filter(a => a.registration_id === l.id);
    const message = data.messages.find(m => m.registration_id === l.id);
    async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try {
        await mutate({ action: 'update_lead', lead: { id: l.id, version: l.version, status, next_at: date ? fromInput(date) : null, attendance, note, outcome, do_not_contact: dnc } });
        toast.success('Conversation and next step saved.');
        close();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save.');
    }
    finally {
        setBusy(false);
    } }
    return <><SheetHeader className="contact-heading"><span className="avatar avatar-0 large-avatar">{initials(l.name)}</span><SheetTitle>{l.name}</SheetTitle><SheetDescription>{l.situation}{l.sample ? ' · Sample contact' : ''}</SheetDescription><p className="contact-phone">{l.sample ? 'Fictional demo number' : l.phone}</p><div className="contact-actions">{!l.sample && !l.do_not_contact ? <>{l.followup_consent && <a className="action-link" href={`tel:${l.phone}`}><Phone size={17}/>Call</a>}{l.followup_consent && <a className="action-link secondary" href={`https://wa.me/${l.phone.replace('+', '')}?text=${encodeURIComponent(`Hi ${l.name.split(' ')[0]}, following up about ${l.course}. Is this a good time to discuss your goals?`)}`} target="_blank" rel="noreferrer"><MessageCircle size={17}/>WhatsApp</a>}{l.webinar_consent && <a className="action-link secondary" href={`https://wa.me/${l.phone.replace('+', '')}?text=${encodeURIComponent(message?.body || invitation(l.name, { title: l.webinar_title, starts_at: l.webinar_starts_at, join_url: l.join_url, organizer: l.organizer }))}`} target="_blank" rel="noreferrer"><Send size={17}/>Seminar link</a>}{!l.followup_consent && !l.webinar_consent && <p className="helper">No outreach permission for this registration.</p>}</> : <p className="helper">{l.sample ? 'Calling is disabled for fictional contacts.' : 'Outreach is paused for this person.'}</p>}</div></SheetHeader><div className="contact-body"><div className="detail-context"><span className="course-label">{l.course} · {l.batch}</span><h3>{l.webinar_title}</h3>{l.college && <p>{l.college}{l.study ? ` · ${l.study}` : ''}</p>}{l.goal && <blockquote>“{l.goal}”</blockquote>}<div className="small-signals"><span>{l.webinar_consent ? 'Webinar messages allowed' : 'No webinar-message permission'}</span><span>{l.followup_consent ? 'Course follow-up allowed' : 'No course follow-up permission'}</span></div></div><form onSubmit={submit} className="form-stack"><h3>Record a conversation</h3><div className="form-grid"><label>Course interest<Choice label="Course interest" value={status} onChange={setStatus} items={STATUSES}/></label><label>Contact outcome<Choice label="Contact outcome" value={outcome} onChange={v => { setOutcome(v); if (['No answer', 'Requested callback'].includes(v) && status === 'Not contacted')
        setStatus('Follow-up required'); }} items={['Conversation', 'No answer', 'Requested callback', 'Information sent', 'Status update']}/></label></div><label>Note<textarea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="What did they say? What should you remember?"/></label>{['Interested', 'Follow-up required'].includes(status) && !dnc && <label>Next follow-up · IST<input type="datetime-local" required value={date} onChange={e => setDate(e.target.value)}/></label>}<label>Webinar attendance · optional<Choice label="Webinar attendance" value={attendance} onChange={setAttendance} items={ATTENDANCE}/></label><label className="check-label"><Checkbox checked={dnc} onCheckedChange={v => setDnc(v === true)} aria-label="Do not contact"/><span>Do not contact<span className="helper">Applies to this person across all webinars.</span></span></label>{error && <p className="form-error" role="alert">{error}</p>}<Button className="primary-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}Save next step</Button></form><section className="history-section"><h3><History size={17}/>Conversation history</h3>{activities.length ? activities.map(a => <div className="timeline-item" key={a.id}><span>{formatDate(a.created_at)} IST · {a.outcome}</span><p>{a.text}</p></div>) : <p className="helper">No notes yet. Your first conversation starts the history.</p>}</section>{message && <section className="history-section"><h3><FlaskConical size={17}/>{message.state === 'Simulated' ? 'Simulated invitation' : 'WhatsApp invitation'}</h3><p className="helper">{message.state === 'Simulated' ? 'Preview only. Not sent or delivered.' : `Status: ${message.state}. Sent via Meta's test template, not this preview text.`}</p><pre className="message-preview">{message.body}</pre></section>}{history.length > 1 && <section className="history-section"><h3>Other registrations</h3>{history.filter(h => h.id !== l.id).map(h => <div className="past-registration" key={h.id}><strong>{h.webinar_title}</strong><p>{h.batch} · {h.status}</p><p>{h.last_note || h.goal}</p></div>)}</section>}</div></>;
}
function InvitationDialog({ webinar: w, data, mutate, close }: {
    webinar: Webinar;
    data: DeskState;
    mutate: Mutation;
    close: () => void;
}) {
    const leads = data.leads.filter(l => l.webinar_id === w.id), eligible = leads.filter(l => l.webinar_consent && !l.do_not_contact && !l.invitation_state);
    const [selected, setSelected] = useState(eligible.map(l => l.id)), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
    const preview = eligible.find(l => selected.includes(l.id));
    const live = data.whatsapp_configured;
    async function send() { setBusy(true); setError(''); try {
        const n = await mutate({ action: 'simulate_invitations', webinar_id: w.id, registration_ids: selected });
        setDone(true);
        toast.success(live ? `${n} invitation${n === 1 ? '' : 's'} sent via WhatsApp.` : `${n} invitation${n === 1 ? '' : 's'} simulated. No messages sent.`);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not simulate invitations.');
    }
    finally {
        setBusy(false);
    } }
    return <Dialog open onOpenChange={o => { if (!o && !busy)
        close(); }}><DialogContent className="app-dialog wide-dialog"><DialogHeader><DialogTitle>{done ? (live ? 'Invitations sent' : 'Invitation demo complete') : 'Prepare webinar invitations'}</DialogTitle><DialogDescription>{w.title}</DialogDescription></DialogHeader><div className="demo-strip"><FlaskConical size={16}/>{live ? <span>WhatsApp is connected. Until a custom template is approved, recipients receive Meta&apos;s standard test message, not this preview text.</span> : <span>Demo only. Nothing will be sent to WhatsApp.</span>}</div>{done ? <div className="empty-state"><CheckCircle2 size={35}/><h3>{live ? 'Your invitations were sent.' : 'Your individual previews are saved.'}</h3><p>Open a contact to review their invitation. Previously {live ? 'invited' : 'simulated'} recipients are excluded from the next run.</p><Button className="primary-button" onClick={close}>Done</Button></div> : <><p className="helper">{eligible.length} pending · {leads.filter(l => !!l.invitation_state).length} already {live ? 'sent' : 'simulated'} · {leads.filter(l => !l.webinar_consent || l.do_not_contact).length} excluded by communication preference</p>{eligible.length ? <><label className="check-label"><Checkbox aria-label="Select all eligible registrants" checked={selected.length === eligible.length} onCheckedChange={v => setSelected(v ? eligible.map(l => l.id) : [])}/><span>Select all eligible registrants</span></label><div className="recipient-list">{eligible.map(l => <label className="check-label recipient" key={l.id}><Checkbox aria-label={`Invite ${l.name}`} checked={selected.includes(l.id)} onCheckedChange={v => setSelected(s => v ? [...s, l.id] : s.filter(x => x !== l.id))}/><span><strong>{l.name}</strong><small>{l.sample ? 'Sample contact' : l.phone}</small></span></label>)}</div><h3>Individual message preview</h3><pre className="message-preview">{invitation(preview?.name || 'Learner', w)}</pre>{error && <p className="form-error" role="alert">{error}</p>}<Button className="primary-button" disabled={!selected.length || busy} onClick={send}>{busy ? <LoaderCircle className="spin" size={17}/> : <FlaskConical size={17}/>}{live ? 'Send' : 'Simulate'} {selected.length} invitation{selected.length !== 1 ? 's' : ''}</Button></> : <Empty title="No invitations waiting" body="New eligible registrations will appear here. Existing previews are never counted as real delivery."/>}</>}</DialogContent></Dialog>;
}
