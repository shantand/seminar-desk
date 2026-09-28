import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', { owner: text('owner').primaryKey(), createdAt: text('created_at').notNull() });
export const webinars = sqliteTable('webinars', {
    id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(), course: text('course').notNull(), batch: text('batch').notNull(), description: text('description').notNull(), organizer: text('organizer').notNull(), startsAt: text('starts_at').notNull(), closesAt: text('closes_at').notNull(), joinUrl: text('join_url').notNull(), status: text('status').notNull().default('draft'), createdAt: text('created_at').notNull(), sample: integer('sample').notNull().default(0), certificate: integer('certificate').notNull().default(0), contactPhone: text('contact_phone').notNull().default('')
}, t => [index('idx_webinars_owner').on(t.owner)]);
export const contacts = sqliteTable('contacts', {
    id: text('id').primaryKey(), owner: text('owner').notNull(), phone: text('phone').notNull(), name: text('name').notNull(), doNotContact: integer('do_not_contact').notNull().default(0), sample: integer('sample').notNull().default(0), createdAt: text('created_at').notNull()
}, t => [uniqueIndex('idx_contacts_owner_phone').on(t.owner, t.phone)]);
export const registrations = sqliteTable('registrations', {
    id: text('id').primaryKey(), webinarId: text('webinar_id').notNull().references(() => webinars.id), contactId: text('contact_id').notNull().references(() => contacts.id), name: text('name').notNull(), situation: text('situation').notNull(), college: text('college').notNull().default(''), city: text('city').notNull().default(''), email: text('email').notNull().default(''), goal: text('goal').notNull().default(''), webinarConsent: integer('webinar_consent').notNull().default(0), followupConsent: integer('followup_consent').notNull().default(0), consentText: text('consent_text').notNull(), consentAt: text('consent_at').notNull(), status: text('status').notNull().default('Not contacted'), nextAt: text('next_at'), attendance: text('attendance').notNull().default('Unknown'), createdAt: text('created_at').notNull(), version: integer('version').notNull().default(0)
}, t => [uniqueIndex('idx_registrations_webinar_contact').on(t.webinarId, t.contactId), index('idx_registrations_contact').on(t.contactId)]);
export const activities = sqliteTable('activities', {
    id: text('id').primaryKey(), registrationId: text('registration_id').notNull().references(() => registrations.id), text: text('text').notNull(), outcome: text('outcome').notNull(), createdAt: text('created_at').notNull()
}, t => [index('idx_activities_registration').on(t.registrationId)]);
export const messages = sqliteTable('messages', {
    id: text('id').primaryKey(), registrationId: text('registration_id').notNull().references(() => registrations.id), kind: text('kind').notNull().default('demo_invitation'), body: text('body').notNull(), state: text('state').notNull().default('Simulated'), providerMessageId: text('provider_message_id'), createdAt: text('created_at').notNull()
}, t => [uniqueIndex('idx_messages_registration_kind').on(t.registrationId, t.kind)]);
export const rateLimits = sqliteTable('rate_limits', { key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull() });
