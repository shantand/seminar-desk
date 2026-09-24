export type Webinar = {
    id: string;
    owner: string;
    title: string;
    course: string;
    batch: string;
    description: string;
    organizer: string;
    starts_at: string;
    closes_at: string;
    join_url: string;
    status: 'draft' | 'open' | 'closed';
    created_at: string;
    sample: number;
    certificate: number;
    contact_phone: string;
};
export type Lead = {
    id: string;
    webinar_id: string;
    contact_id: string;
    name: string;
    phone: string;
    situation: string;
    college: string;
    study: string;
    goal: string;
    webinar_consent: number;
    followup_consent: number;
    status: string;
    next_at: string | null;
    attendance: string;
    created_at: string;
    do_not_contact: number;
    sample: number;
    course: string;
    batch: string;
    webinar_title: string;
    webinar_starts_at: string;
    join_url: string;
    organizer: string;
    invitation_state: string | null;
    last_note: string | null;
    version: number;
};
export type Activity = {
    id: string;
    registration_id: string;
    text: string;
    outcome: string;
    created_at: string;
};
export type Message = {
    id: string;
    registration_id: string;
    kind: string;
    body: string;
    state: string;
    provider_message_id: string | null;
    created_at: string;
};
export type DeskState = {
    webinars: Webinar[];
    leads: Lead[];
    activities: Activity[];
    messages: Message[];
    mode: 'demo';
    whatsapp_configured: boolean;
};
export const STATUSES = ['Not contacted', 'Follow-up required', 'Interested', 'Joined course', 'Not interested in this batch'] as const;
export const SITUATIONS = ['Studying', 'Graduate looking for work', 'Working', 'Other'] as const;
export const ATTENDANCE = ['Unknown', 'Attended', 'Did not attend'] as const;
export const ZONE = 'Asia/Kolkata';
export function formatDate(s: string, withTime = true) { return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric' as const, minute: '2-digit' as const } : {}), timeZone: ZONE }).format(new Date(s)); }
export function dayKey(s: Date | string = new Date()) { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE }).format(new Date(s)); }
export function monthKey(s: string) { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: ZONE }).format(new Date(s)); }
export function monthLabel(key: string) { const [y, m] = key.split('-').map(Number); return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: ZONE }).format(new Date(Date.UTC(y, m - 1, 1))); }
export function inputDate(s: string) { const d = new Date(new Date(s).getTime() + 330 * 60000); return d.toISOString().slice(0, 16); }
export function fromInput(s: string) { return new Date(s + ':00+05:30').toISOString(); }
export function initials(s: string) { return s.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
export function isActive(l: Lead) { return !l.do_not_contact && !!l.followup_consent && !['Joined course', 'Not interested in this batch'].includes(l.status); }
export function invitation(name: string, w: Pick<Webinar, 'title' | 'starts_at' | 'join_url' | 'organizer'>) { return `Hi ${name.split(' ')[0]}, your registration for ${w.title} is confirmed.\n\n${formatDate(w.starts_at)} IST\nJoin here: ${w.join_url}\n\nSee you there!\n${w.organizer}`; }
export function consentCopy(organizer: string) { return { webinar: `I agree to receive webinar details and invitations on WhatsApp from ${organizer}.`, followup: `You may call or message me about this course. I can opt out at any time.` }; }
