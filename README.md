# Seminar Desk

A mobile-first, persistent MVP for recurring webinar registrations and course follow-ups. Built with React/Vinext, Cloudflare Workers, and D1. All invitation sending is explicitly simulated; no WhatsApp account, token, or real messaging provider is configured.

## Included

- Three mobile tabs: Today, Webinars, People.
- Fixed registration template with editable webinar title, course, batch, description, organizer, dates, and joining link.
- Webinar creation, editing, duplication, and draft/open/closed states.
- A registration URL per webinar, separate webinar-message and course-follow-up permissions, phone normalization, same-webinar duplicate protection, a honeypot, and per-webinar/IP rate limiting.
- One contact per normalized phone per workspace, separate registrations for each webinar, and historical notes across batches.
- Dated follow-ups in India Standard Time, notes, outcomes, optional attendance, and contact-wide outreach suppression.
- Individual invitation previews triggered in one selected batch. The database prevents duplicate simulated invitations even if two triggers run concurrently.
- Sample contacts are clearly identified; calling and manual WhatsApp actions are disabled for fictional numbers.
- Network-only installable app shell. No contact data or authenticated pages are cached offline.
- Private authenticated workspace with server-side user scoping on every admin operation.

## Demo boundaries

The initial workspace is seeded once per authenticated user with four fictional people and three webinars. Registrations and notes entered afterward are saved in D1.

The invitation action creates `Simulated` message records. It does **not** send a message, create a WhatsApp delivery receipt, or contact any external account. Sample webinar joining URLs are examples, not scheduled meetings.

The deployed Site is owner-private. Although registration routes do not require application sign-in, the hosting access policy still restricts all visitors. The owner can preview forms now; outside participants cannot access them until the hosting audience is deliberately changed. Admin data remains scoped by authenticated user even if the site is later made public. A client collaboration/role model is not implemented.

Attendance is an optional manual signal. Payment collection, batch onboarding, social publishing, Meet scheduling, uploads, and automatic attendance sync are intentionally outside this MVP.

## Local development

Requires Node >=22.13.0. Keep the supplied lockfile.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_parched_purple_man.sql
npm run dev
```

Apply that initial migration only once. Additional schema changes use `npm run db:generate`; retain applied migration history and apply new files in order.

Local sign-in uses the starter's loopback-only simulator at `/signin-with-chatgpt?return_to=/`. The hosted build uses platform authentication. The local simulator is not a production login bypass.

## Validation

```sh
./node_modules/.bin/tsc --noEmit
node tests/mvp.mjs
npm run build
```

The integration script needs Playwright and a compatible Chromium binary. Set `PLAYWRIGHT_MODULE` to its package path if it is not at the bundled runtime path, `TEST_BROWSER_PATH` for an existing browser, and `TEST_ORIGIN` for a nondefault local preview. It writes only local QA records and screenshots under ignored `outputs/`. It never sends messages.

Checks cover browser flows, phone layout, history, authenticated API access, duplicate registration, safe URLs, callback validation, stale writes, concurrent invitation triggers, opt-outs, closed webinars, and persistence after reload.

## Real WhatsApp integration later

1. Configure an official Meta Cloud API test sender and verify the allowed demo recipients.
2. Confirm approved template name, language, parameter order, phone number ID, and Graph API version. Keep tokens and webhook secrets in hosted secret storage, never in browser code or Git.
3. Add a separate provider adapter and durable queue. Retain the manual preview/trigger and recheck consent and contact suppression immediately before every send.
4. Record provider message IDs and accept delivery updates only after validating webhook signatures. API acceptance must not be labeled delivery. Handle ambiguous timeouts through reconciliation rather than blind resending.
5. Keep live and simulated message records separate. The current unique key includes message kind so a future live adapter can use a different kind without treating demo previews as sent invitations.
6. Decide on and connect a reply inbox, then test end-to-end with the verified recipients before enabling live sending.

## Storage and operations

Schema is in `db/schema.ts`; generated migrations are in `drizzle/`. Runtime code uses prepared D1 statements through `lib/database.ts`. Multi-record registration and follow-up updates use transactional batches. Public endpoints return no contact records, notes, owner IDs, or meeting URLs.

D1 persistence is provisioned by Sites. There is no separate backup-export interface or scheduled application backup job in this MVP; confirm platform recovery and retention requirements before collecting production participant data. Users requesting correction or deletion should contact the organizer; an operator-facing deletion workflow can be added before a public pilot.

Only the exact owner-private deployment is authorized by the current build. Use Sites hosting tools for source publication and environment management.
