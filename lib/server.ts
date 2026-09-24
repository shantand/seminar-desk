import { z } from 'zod';
import { database, hash } from './database';
import { ATTENDANCE, STATUSES, SITUATIONS, invitation, consentCopy, type Webinar, type Lead, type Activity, type Message } from './types';
export class AppError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
const uid = () => crypto.randomUUID();
const iso = () => new Date().toISOString();
export const webinarInput = z.object({ title: z.string().trim().min(3).max(120), course: z.string().trim().min(2).max(80), batch: z.string().trim().min(2).max(80), description: z.string().trim().min(10).max(2000), organizer: z.string().trim().min(2).max(80), starts_at: z.string().datetime(), closes_at: z.string().datetime(), join_url: z.string().url().max(600).refine(x => new URL(x).protocol === 'https:', 'Use a secure https joining link.'), status: z.enum(['draft', 'open', 'closed']) });
export async function getState(owner: string) {
    const db = database();
    const [w, l, a, m] = await Promise.all([
        db.prepare('SELECT * FROM webinars WHERE owner=? ORDER BY starts_at DESC').bind(owner).all<Webinar>(),
        db.prepare(`SELECT r.*,c.phone,c.do_not_contact,c.sample,w.course,w.batch,w.title AS webinar_title,m.state AS invitation_state,(SELECT text FROM activities WHERE registration_id=r.id ORDER BY created_at DESC LIMIT 1) AS last_note FROM registrations r JOIN webinars w ON w.id=r.webinar_id JOIN contacts c ON c.id=r.contact_id LEFT JOIN messages m ON m.registration_id=r.id AND m.kind='demo_invitation' WHERE w.owner=? ORDER BY r.created_at DESC`).bind(owner).all<Lead>(),
        db.prepare('SELECT a.* FROM activities a JOIN registrations r ON a.registration_id=r.id JOIN webinars w ON r.webinar_id=w.id WHERE w.owner=? ORDER BY a.created_at DESC').bind(owner).all<Activity>(),
        db.prepare('SELECT m.* FROM messages m JOIN registrations r ON m.registration_id=r.id JOIN webinars w ON w.id=r.webinar_id WHERE w.owner=? ORDER BY m.created_at DESC').bind(owner).all<Message>()
    ]);
    return { webinars: w.results, leads: l.results, activities: a.results, messages: m.results, mode: 'demo' as const };
}
export async function seed(owner: string) {
    const db = database();
    if (await db.prepare('SELECT owner FROM workspaces WHERE owner=?').bind(owner).first())
        return;
    const prefix = (await hash(owner)).slice(0, 20);
    const id = (s: string) => `${prefix}-${s}`;
    const now = iso();
    const future = (days: number, hour = 12) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); d.setUTCHours(hour, 30, 0, 0); return d.toISOString(); };
    const ws = [{ id: id('webinar-1'), title: 'Your first step into digital marketing', course: 'Digital Marketing', batch: 'Next weekend batch', description: 'Explore the skills behind successful digital campaigns. Get a practical introduction to social media, search, and the projects you can build for your portfolio.', starts: future(4), status: 'open' }, { id: id('webinar-2'), title: 'Build a career with data', course: 'Data Analytics', batch: 'Next evening batch', description: 'Discover how spreadsheets, SQL, and visual storytelling turn data into decisions. Find out what to learn first and how to demonstrate your skills.', starts: future(8), status: 'open' }, { id: id('webinar-3'), title: 'Digital marketing: career essentials', course: 'Digital Marketing', batch: 'Previous batch', description: 'An introduction to practical digital marketing skills and career pathways for students and recent graduates.', starts: future(-40), status: 'closed' }];
    const rows = [{ name: 'Priya Sharma', situation: SITUATIONS[1], college: 'Fergusson College', study: 'B.Com graduate', goal: 'Certification and practical experience for my first job.', status: 'Interested', next: future(0), note: 'Interested in a weekend batch. Wants to discuss certification.', w: 0 }, { name: 'Arjun Mehta', situation: SITUATIONS[0], college: 'Modern College', study: 'Final year · B.Sc', goal: 'Build a portfolio of data projects.', status: 'Follow-up required', next: future(-1, 11), note: 'Asked about practical projects. Call back to discuss the schedule.', w: 1 }, { name: 'Sneha Patel', situation: SITUATIONS[2], college: '', study: 'Marketing associate', goal: 'Improve my digital campaign skills.', status: 'Follow-up required', next: future(0, 13), note: 'Requested a callback after work about course timings.', w: 0 }, { name: 'Rahul Joshi', situation: SITUATIONS[1], college: 'SP College', study: 'B.Sc graduate', goal: 'Understand entry-level analyst roles.', status: 'Not contacted', next: null, note: 'Registered for the upcoming webinar.', w: 1 }];
    const stmts = [db.prepare('INSERT OR IGNORE INTO workspaces(owner,created_at) VALUES(?,?)').bind(owner, now)];
    for (const w of ws)
        stmts.push(db.prepare('INSERT OR IGNORE INTO webinars(id,owner,title,course,batch,description,organizer,starts_at,closes_at,join_url,status,created_at,sample) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)').bind(w.id, owner, w.title, w.course, w.batch, w.description, 'Seminar Desk Academy', w.starts, w.starts, 'https://meet.google.com/example-demo', w.status, now));
    for (const [i, r] of rows.entries()) {
        const cid = id(`contact-${i}`), rid = id(`registration-${i}`);
        stmts.push(db.prepare('INSERT OR IGNORE INTO contacts(id,owner,phone,name,sample,created_at) VALUES(?,?,?,?,1,?)').bind(cid, owner, `+1000000000${i + 1}`, r.name, now));
        stmts.push(db.prepare('INSERT OR IGNORE INTO registrations(id,webinar_id,contact_id,name,situation,college,study,goal,webinar_consent,followup_consent,consent_text,consent_at,status,next_at,attendance,created_at) VALUES(?,?,?,?,?,?,?,?,1,1,?,?,?,?,?,?)').bind(rid, ws[r.w].id, cid, r.name, r.situation, r.college, r.study, r.goal, 'Fictional demo consent; not permission to contact a real person.', now, r.status, r.next, 'Unknown', now));
        stmts.push(db.prepare('INSERT OR IGNORE INTO activities(id,registration_id,text,outcome,created_at) VALUES(?,?,?,?,?)').bind(id(`activity-${i}`), rid, r.note, 'Sample conversation', now));
    }
    stmts.push(db.prepare('INSERT OR IGNORE INTO registrations(id,webinar_id,contact_id,name,situation,college,study,goal,webinar_consent,followup_consent,consent_text,consent_at,status,attendance,created_at) VALUES(?,?,?,?,?,?,?,?,1,1,?,?,?,?,?)').bind(id('registration-history'), ws[2].id, id('contact-0'), 'Priya Sharma', SITUATIONS[0], 'Fergusson College', 'Final year · B.Com', 'Explore marketing careers.', 'Fictional demo consent.', future(-41), 'Not interested in this batch', 'Attended', future(-41)));
    stmts.push(db.prepare('INSERT OR IGNORE INTO activities(id,registration_id,text,outcome,created_at) VALUES(?,?,?,?,?)').bind(id('activity-history'), id('registration-history'), 'Exams overlap with this batch. Would like to revisit after graduation.', 'Not interested in this batch', future(-39)));
    await db.batch(stmts);
}
export async function ownedWebinar(owner: string, id: string) { const w = await database().prepare('SELECT * FROM webinars WHERE id=? AND owner=?').bind(id, owner).first<Webinar>(); if (!w)
    throw new AppError('Webinar not found.', 404); return w; }
export async function saveWebinar(owner: string, input: unknown, id?: string) { const data = webinarInput.parse(input); if (new Date(data.closes_at) > new Date(data.starts_at))
    throw new AppError('Registration must close by the webinar start time.'); if (data.status === 'open' && new Date(data.starts_at) <= new Date())
    throw new AppError('Choose a future date before opening registration.'); const db = database(); if (id) {
    await ownedWebinar(owner, id);
    await db.prepare('UPDATE webinars SET title=?,course=?,batch=?,description=?,organizer=?,starts_at=?,closes_at=?,join_url=?,status=? WHERE id=? AND owner=?').bind(...Object.values(data), id, owner).run();
}
else {
    id = uid();
    await db.prepare('INSERT INTO webinars(id,owner,title,course,batch,description,organizer,starts_at,closes_at,join_url,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, owner, ...Object.values(data), iso()).run();
} return id; }
export async function updateLead(owner: string, input: unknown) {
    const d = z.object({ id: z.string(), version: z.number().int().nonnegative(), status: z.enum(STATUSES), next_at: z.string().datetime().nullable(), attendance: z.enum(ATTENDANCE), note: z.string().trim().max(2000), outcome: z.string().trim().max(80), do_not_contact: z.boolean() }).parse(input);
    const db = database();
    const l = await db.prepare('SELECT r.*,c.do_not_contact FROM registrations r JOIN webinars w ON w.id=r.webinar_id JOIN contacts c ON c.id=r.contact_id WHERE r.id=? AND w.owner=?').bind(d.id, owner).first<Lead>();
    if (!l)
        throw new AppError('Contact not found.', 404);
    if (l.version !== d.version)
        throw new AppError('This record changed. Refresh it before saving your update.', 409);
    const active = ['Follow-up required', 'Interested'].includes(d.status);
    if (active && !d.do_not_contact && !l.followup_consent)
        throw new AppError('This registration does not have permission for course follow-up.');
    if (active && !d.do_not_contact && !d.next_at)
        throw new AppError('Choose the next follow-up date.');
    const next = d.do_not_contact || !active ? null : d.next_at;
    const note = d.note || `Status updated to ${d.status}.`;
    const results = await db.batch([
        db.prepare('INSERT INTO activities(id,registration_id,text,outcome,created_at) SELECT ?,id,?,?,? FROM registrations WHERE id=? AND version=?').bind(uid(), note + (d.do_not_contact ? ' Outreach paused for this contact.' : ''), d.outcome || d.status, iso(), d.id, d.version),
        db.prepare('UPDATE contacts SET do_not_contact=? WHERE id=? AND owner=? AND EXISTS(SELECT 1 FROM registrations WHERE id=? AND version=?)').bind(+d.do_not_contact, l.contact_id, owner, d.id, d.version),
        db.prepare('UPDATE registrations SET status=?,next_at=?,attendance=?,version=version+1 WHERE id=? AND version=?').bind(d.status, next, d.attendance, d.id, d.version)
    ]);
    if (!results[2].meta.changes)
        throw new AppError('Another update was saved. Refresh and try again.', 409);
}
export async function simulateInvitations(owner: string, input: unknown) { const d = z.object({ webinar_id: z.string(), registration_ids: z.array(z.string()).min(1).max(250) }).parse(input); const w = await ownedWebinar(owner, d.webinar_id); if (w.status !== 'open' || new Date(w.starts_at) <= new Date())
    throw new AppError('Invitations are available for upcoming, open webinars.'); const db = database(); const rows = await db.prepare('SELECT r.id,r.name FROM registrations r JOIN contacts c ON c.id=r.contact_id WHERE r.webinar_id=? AND r.webinar_consent=1 AND c.do_not_contact=0').bind(w.id).all<{
    id: string;
    name: string;
}>(); const ids = new Set(d.registration_ids); const eligible = rows.results.filter(r => ids.has(r.id)); if (!eligible.length)
    throw new AppError('No eligible registrations selected.'); const results = await db.batch(eligible.map(r => db.prepare(`INSERT OR IGNORE INTO messages(id,registration_id,kind,body,state,created_at) SELECT ?,r.id,'demo_invitation',?,'Simulated',? FROM registrations r JOIN contacts c ON c.id=r.contact_id WHERE r.id=? AND r.webinar_consent=1 AND c.do_not_contact=0`).bind(uid(), invitation(r.name, w), iso(), r.id))); return results.reduce((n, r) => n + Number(r.meta.changes || 0), 0); }
export async function publicWebinar(id: string) { return database().prepare('SELECT id,title,course,batch,description,organizer,starts_at,closes_at,status,sample FROM webinars WHERE id=?').bind(id).first<Omit<Webinar, 'owner' | 'join_url'>>(); }
export async function register(id: string, input: unknown, ip: string) {
    const d = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().transform(x => x.replace(/[\s()-]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Include your country code, e.g. +91.')), situation: z.enum(SITUATIONS), college: z.string().trim().max(120), study: z.string().trim().max(120), goal: z.string().trim().max(500), webinar_consent: z.boolean(), followup_consent: z.boolean(), website: z.string().max(200).optional() }).parse(input);
    if (d.website)
        return;
    const db = database();
    const w = await db.prepare('SELECT * FROM webinars WHERE id=?').bind(id).first<Webinar>();
    if (!w || w.status !== 'open' || new Date(w.closes_at) <= new Date())
        throw new AppError('Registration for this webinar is closed.', 410);
    const minute = Math.floor(Date.now() / 60000);
    const key = await hash(`${id}:${ip}:${minute}`);
    const limit = await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, Date.now() + 120000).first<{
        count: number;
    }>();
    if (limit && limit.count > 15)
        throw new AppError('Too many attempts. Please wait a minute and try again.', 429);
    await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()).run();
    const now = iso(), cid = uid(), rid = uid();
    const consent = consentCopy(w.organizer);
    await db.batch([db.prepare('INSERT OR IGNORE INTO contacts(id,owner,phone,name,created_at) VALUES(?,?,?,?,?)').bind(cid, w.owner, d.phone, d.name, now), db.prepare(`INSERT OR IGNORE INTO registrations(id,webinar_id,contact_id,name,situation,college,study,goal,webinar_consent,followup_consent,consent_text,consent_at,created_at) SELECT ?,?,c.id,?,?,?,?,?,?,?,?,?,? FROM contacts c WHERE c.owner=? AND c.phone=? AND EXISTS(SELECT 1 FROM webinars WHERE id=? AND status='open' AND closes_at>?)`).bind(rid, id, d.name, d.situation, d.college, d.study, d.goal, +d.webinar_consent, +d.followup_consent, JSON.stringify(consent), now, now, w.owner, d.phone, id, now)]);
}
