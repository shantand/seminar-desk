import { z } from 'zod';
import { database, hash } from './database';
import { isWhatsAppConfigured, sendTemplateMessage } from './whatsapp';
import { ATTENDANCE, STATUSES, SITUATIONS, FEATURE_FLAG_DEFS, invitation, consentCopy, type Webinar, type Lead, type Activity, type Message, type FeatureFlags, type FeatureFlagKey } from './types';
export class AppError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
const uid = () => crypto.randomUUID();
const iso = () => new Date().toISOString();
export const webinarInput = z.object({ title: z.string().trim().min(3).max(120), course: z.string().trim().min(2).max(80), batch: z.string().trim().min(2).max(80), description: z.string().trim().min(10).max(2000), organizer: z.string().trim().min(2).max(80), starts_at: z.string().datetime(), closes_at: z.string().datetime(), join_url: z.string().url().max(600).refine(x => new URL(x).protocol === 'https:', 'Use a secure https joining link.'), status: z.enum(['draft', 'open', 'closed']), certificate: z.boolean(), contact_phone: z.string().trim().max(30) });
export async function getFeatureFlags(owner: string): Promise<FeatureFlags> {
    const db = database();
    const rows = await db.prepare('SELECT key,enabled FROM feature_flags WHERE owner=?').bind(owner).all<{
        key: string;
        enabled: number;
    }>();
    const overrides = new Map(rows.results.map(r => [r.key, !!r.enabled]));
    const flags = {} as FeatureFlags;
    for (const def of FEATURE_FLAG_DEFS) flags[def.key] = overrides.has(def.key) ? overrides.get(def.key)! : def.default;
    return flags;
}
export async function setFeatureFlag(owner: string, key: string, enabled: boolean) {
    if (!FEATURE_FLAG_DEFS.some(d => d.key === key)) throw new AppError('Unknown feature flag.');
    const db = database();
    await db.prepare('INSERT INTO feature_flags(owner,key,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,key) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at').bind(owner, key as FeatureFlagKey, +enabled, iso()).run();
}
export async function getState(owner: string) {
    const db = database();
    const [w, l, a, m, flags] = await Promise.all([
        db.prepare('SELECT * FROM webinars WHERE owner=? ORDER BY starts_at DESC').bind(owner).all<Webinar>(),
        db.prepare(`SELECT r.*,c.phone,c.do_not_contact,c.sample,w.course,w.batch,w.title AS webinar_title,w.starts_at AS webinar_starts_at,w.join_url,w.organizer,m.state AS invitation_state,(SELECT text FROM activities WHERE registration_id=r.id ORDER BY created_at DESC LIMIT 1) AS last_note FROM registrations r JOIN webinars w ON w.id=r.webinar_id JOIN contacts c ON c.id=r.contact_id LEFT JOIN messages m ON m.registration_id=r.id AND m.kind='demo_invitation' WHERE w.owner=? ORDER BY r.created_at DESC`).bind(owner).all<Lead>(),
        db.prepare('SELECT a.* FROM activities a JOIN registrations r ON a.registration_id=r.id JOIN webinars w ON r.webinar_id=w.id WHERE w.owner=? ORDER BY a.created_at DESC').bind(owner).all<Activity>(),
        db.prepare('SELECT m.* FROM messages m JOIN registrations r ON m.registration_id=r.id JOIN webinars w ON w.id=r.webinar_id WHERE w.owner=? ORDER BY m.created_at DESC').bind(owner).all<Message>(),
        getFeatureFlags(owner)
    ]);
    return { webinars: w.results, leads: l.results, activities: a.results, messages: m.results, mode: 'demo' as const, whatsapp_configured: isWhatsAppConfigured(), flags };
}
export async function leadsForExport(owner: string) {
    const db = database();
    const r = await db.prepare(`SELECT r.name,c.phone,r.email,r.college,r.city,r.situation,w.course,w.batch,w.title AS webinar_title,w.starts_at AS webinar_starts_at,r.created_at FROM registrations r JOIN webinars w ON w.id=r.webinar_id JOIN contacts c ON c.id=r.contact_id WHERE w.owner=? AND w.sample=0 AND c.sample=0 ORDER BY r.created_at DESC`).bind(owner).all<{
        name: string;
        phone: string;
        email: string;
        college: string;
        city: string;
        situation: string;
        course: string;
        batch: string;
        webinar_title: string;
        webinar_starts_at: string;
        created_at: string;
    }>();
    return r.results;
}
export async function ensureWorkspace(owner: string) {
    const db = database();
    const existing = await db.prepare('SELECT owner FROM workspaces WHERE owner=?').bind(owner).first();
    const stmts = [db.prepare('INSERT OR IGNORE INTO workspaces(owner,created_at) VALUES(?,?)').bind(owner, iso())];
    if (!existing)
        stmts.push(...(await seedWebinars(owner)));
    stmts.push(
        db.prepare(`DELETE FROM messages WHERE registration_id IN (SELECT r.id FROM registrations r JOIN webinars w ON w.id=r.webinar_id WHERE w.owner=? AND (w.sample=1 OR EXISTS(SELECT 1 FROM contacts c WHERE c.id=r.contact_id AND c.sample=1)))`).bind(owner),
        db.prepare(`DELETE FROM activities WHERE registration_id IN (SELECT r.id FROM registrations r JOIN webinars w ON w.id=r.webinar_id WHERE w.owner=? AND (w.sample=1 OR EXISTS(SELECT 1 FROM contacts c WHERE c.id=r.contact_id AND c.sample=1)))`).bind(owner),
        db.prepare(`DELETE FROM registrations WHERE webinar_id IN (SELECT id FROM webinars WHERE owner=? AND sample=1) OR contact_id IN (SELECT id FROM contacts WHERE owner=? AND sample=1)`).bind(owner, owner),
        db.prepare('DELETE FROM contacts WHERE owner=? AND sample=1').bind(owner),
        db.prepare('DELETE FROM webinars WHERE owner=? AND sample=1').bind(owner)
    );
    await db.batch(stmts);
}
// One-time starter content for a brand-new workspace: two free intro webinars for
// CataLife Training Organization programs (catalife.org), in the org's usual WhatsApp
// promo format. Regular (non-sample) rows, so editing or deleting them is permanent —
// they are not recreated on a later load.
async function seedWebinars(owner: string) {
    const db = database();
    const prefix = (await hash(owner)).slice(0, 20);
    const id = (s: string) => `${prefix}-${s}`;
    const organizer = 'CataLife Training Organization';
    const contact = '📞 Contact: 8483844076';
    const webinars = [
        {
            key: 'webinar-python',
            title: 'Master Python – Basic & Advance',
            course: 'Programming',
            batch: 'Free Webinar Batch',
            description: `📢 Python for Beginners Week 2K26 – Free Webinar!

Theme: From Zero to Job-Ready – Build Your Python Foundation for a Data-Driven Career.

🗓️ Date: 4th October 2026
⏰ Time: 7:00 PM onwards
💻 Mode: Live & Free (link shared upon registration)

🎓 Certificate: E-certificate provided to all attendees

A preview of our Python – Basic & Advance program: variables, control statements, functions, data structures, OOPs, exception handling, SQLite connectivity, and real-world mini projects.

Organized by ${organizer}
${contact}`,
            starts: new Date(Date.UTC(2026, 9, 4, 13, 30, 0)).toISOString(),
            join_url: 'https://meet.google.com/python-webinar-oct'
        },
        {
            key: 'webinar-cdm',
            title: 'Advance Diploma in Clinical Data Management',
            course: 'Data Management',
            batch: 'Free Webinar Batch',
            description: `📢 Clinical Data Management Week 2K26 – Free Webinar!

Theme: Building Careers in Clinical Data Management – CRFs, EDC & GCP Essentials for Data Professionals.

🗓️ Date: 11th October 2026
⏰ Time: 7:00 PM onwards
💻 Mode: Live & Free (link shared upon registration)

🎓 Certificate: E-certificate provided to all attendees

A preview of our Advance Diploma in Clinical Data Management: data collection, validation, and management in clinical trials, covering CRF/eCRF, EDC, data validation, GCP, and ALCOA+ principles.

Organized by ${organizer}
${contact}`,
            starts: new Date(Date.UTC(2026, 9, 11, 13, 30, 0)).toISOString(),
            join_url: 'https://meet.google.com/cdm-webinar-oct'
        }
    ];
    return webinars.map(w => db.prepare('INSERT OR IGNORE INTO webinars(id,owner,title,course,batch,description,organizer,starts_at,closes_at,join_url,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id(w.key), owner, w.title, w.course, w.batch, w.description, organizer, w.starts, w.starts, w.join_url, 'open', iso()));
}
export async function ownedWebinar(owner: string, id: string) { const w = await database().prepare('SELECT * FROM webinars WHERE id=? AND owner=?').bind(id, owner).first<Webinar>(); if (!w)
    throw new AppError('Webinar not found.', 404); return w; }
export async function deleteWebinar(owner: string, id: string) {
    await ownedWebinar(owner, id);
    const db = database();
    await db.batch([
        db.prepare('DELETE FROM messages WHERE registration_id IN (SELECT id FROM registrations WHERE webinar_id=?)').bind(id),
        db.prepare('DELETE FROM activities WHERE registration_id IN (SELECT id FROM registrations WHERE webinar_id=?)').bind(id),
        db.prepare('DELETE FROM registrations WHERE webinar_id=?').bind(id),
        db.prepare('DELETE FROM webinars WHERE id=? AND owner=?').bind(id, owner)
    ]);
}
export async function saveWebinar(owner: string, input: unknown, id?: string) { const data = webinarInput.parse(input); if (new Date(data.closes_at) > new Date(data.starts_at))
    throw new AppError('Registration must close by the webinar start time.'); if (data.status === 'open' && new Date(data.starts_at) <= new Date())
    throw new AppError('Choose a future date before opening registration.'); const db = database(); if (id) {
    await ownedWebinar(owner, id);
    await db.prepare('UPDATE webinars SET title=?,course=?,batch=?,description=?,organizer=?,starts_at=?,closes_at=?,join_url=?,status=?,certificate=?,contact_phone=? WHERE id=? AND owner=?').bind(data.title, data.course, data.batch, data.description, data.organizer, data.starts_at, data.closes_at, data.join_url, data.status, +data.certificate, data.contact_phone, id, owner).run();
}
else {
    id = uid();
    await db.prepare('INSERT INTO webinars(id,owner,title,course,batch,description,organizer,starts_at,closes_at,join_url,status,certificate,contact_phone,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, owner, data.title, data.course, data.batch, data.description, data.organizer, data.starts_at, data.closes_at, data.join_url, data.status, +data.certificate, data.contact_phone, iso()).run();
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
export async function simulateInvitations(owner: string, input: unknown) {
    const d = z.object({ webinar_id: z.string(), registration_ids: z.array(z.string()).min(1).max(250) }).parse(input);
    const w = await ownedWebinar(owner, d.webinar_id);
    if (w.status !== 'open' || new Date(w.starts_at) <= new Date())
        throw new AppError('Invitations are available for upcoming, open webinars.');
    const db = database();
    // Registrations that are eligible AND don't already have a demo_invitation row -
    // the unique index on (registration_id, kind) is what makes re-running this idempotent.
    const rows = await db.prepare(`SELECT r.id,r.name,c.phone FROM registrations r JOIN contacts c ON c.id=r.contact_id
        WHERE r.webinar_id=? AND r.webinar_consent=1 AND c.do_not_contact=0
        AND r.id NOT IN (SELECT registration_id FROM messages WHERE kind='demo_invitation')`).bind(w.id).all<{
        id: string;
        name: string;
        phone: string;
    }>();
    const ids = new Set(d.registration_ids);
    const eligible = rows.results.filter(r => ids.has(r.id));
    if (!eligible.length)
        throw new AppError('No eligible registrations selected.');

    if (isWhatsAppConfigured()) {
        // Real send via the WhatsApp Cloud API. Business-initiated sends outside a
        // customer's 24h window must use an approved template - until a custom
        // template exists, this delivers Meta's built-in "hello_world" test content,
        // not the personalized invitation copy (which is still recorded as `body`
        // for the lead's own history).
        let sent = 0;
        for (const r of eligible) {
            const result = await sendTemplateMessage(r.phone);
            const state = result.ok ? 'Sent' : 'Failed';
            const providerMessageId = result.ok ? result.providerMessageId : null;
            const outcome = await db.prepare(`INSERT OR IGNORE INTO messages(id,registration_id,kind,body,state,provider_message_id,created_at)
                SELECT ?,r.id,'demo_invitation',?,?,?,? FROM registrations r JOIN contacts c ON c.id=r.contact_id
                WHERE r.id=? AND r.webinar_consent=1 AND c.do_not_contact=0`)
                .bind(uid(), invitation(r.name, w), state, providerMessageId, iso(), r.id).run();
            if (result.ok) sent += Number(outcome.meta.changes || 0);
        }
        return sent;
    }

    const results = await db.batch(eligible.map(r => db.prepare(`INSERT OR IGNORE INTO messages(id,registration_id,kind,body,state,created_at) SELECT ?,r.id,'demo_invitation',?,'Simulated',? FROM registrations r JOIN contacts c ON c.id=r.contact_id WHERE r.id=? AND r.webinar_consent=1 AND c.do_not_contact=0`).bind(uid(), invitation(r.name, w), iso(), r.id)));
    return results.reduce((n, r) => n + Number(r.meta.changes || 0), 0);
}
export async function publicWebinar(id: string) { return database().prepare('SELECT id,title,course,batch,description,organizer,starts_at,closes_at,status,sample FROM webinars WHERE id=?').bind(id).first<Omit<Webinar, 'owner' | 'join_url'>>(); }
export async function register(id: string, input: unknown, ip: string) {
    const d = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().transform(x => x.replace(/[\s()-]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Include your country code, e.g. +91.')), email: z.string().trim().min(3).max(160).email('Enter a valid email address.'), situation: z.enum(SITUATIONS), college: z.string().trim().min(2, 'Enter your college or institution.').max(120), city: z.string().trim().min(2, 'Enter your city.').max(120), goal: z.string().trim().max(500), webinar_consent: z.boolean(), followup_consent: z.boolean(), website: z.string().max(200).optional() }).parse(input);
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
    await db.batch([db.prepare('INSERT OR IGNORE INTO contacts(id,owner,phone,name,created_at) VALUES(?,?,?,?,?)').bind(cid, w.owner, d.phone, d.name, now), db.prepare(`INSERT OR IGNORE INTO registrations(id,webinar_id,contact_id,name,situation,college,city,email,goal,webinar_consent,followup_consent,consent_text,consent_at,created_at) SELECT ?,?,c.id,?,?,?,?,?,?,?,?,?,?,? FROM contacts c WHERE c.owner=? AND c.phone=? AND EXISTS(SELECT 1 FROM webinars WHERE id=? AND status='open' AND closes_at>?)`).bind(rid, id, d.name, d.situation, d.college, d.city, d.email, d.goal, +d.webinar_consent, +d.followup_consent, JSON.stringify(consent), now, now, w.owner, d.phone, id, now)]);
}
