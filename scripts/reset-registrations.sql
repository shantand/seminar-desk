-- Clears all registrations, contacts, and their messages/activities.
-- Webinar listings themselves are left untouched.
DELETE FROM messages WHERE registration_id IN (
    SELECT r.id FROM registrations r JOIN webinars w ON w.id = r.webinar_id WHERE w.owner = 'admin'
);
DELETE FROM activities WHERE registration_id IN (
    SELECT r.id FROM registrations r JOIN webinars w ON w.id = r.webinar_id WHERE w.owner = 'admin'
);
DELETE FROM registrations WHERE webinar_id IN (
    SELECT id FROM webinars WHERE owner = 'admin'
);
DELETE FROM contacts WHERE owner = 'admin';
