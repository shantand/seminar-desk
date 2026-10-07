# Seminar Desk

This is the app built to solve real-world workflow problem of data collection and management.

Client was using the free webinars for collecting the data of potential sales prospects that may be interested in buying course online.

## Requirements Gathering
1. Webinar date-time is fixed with the guest panel or with internal team working on course content preparation
2. Flyer is generated, along with registration form for people to show their interest.  **Data Collection**
3. Once all the candidates posted their data, whats app message for meeting link usually (Google Meet) link is shared.
4. All interested participant could join the seminar and ask questions with expert panel or course instructor. Fees and Schedule is conveyed in the same session
5. Post this webinar there needs to be follow up done for all the interested candidate ( Sales - lead generation)
6. Sometimes multiple follow ups was needed to convince the participant about how will it benefit them.

## Solutions built ( With Claude & Cursor only. Using CloudFlares free hosting)

## Seminar Desk
1. Solution built with typescript(next.js) and database is D1 which cloudflare specific.
2. same stack can be run easily for any other tenant with different deployment id. Exact steps added in depployment.pdf
3. Automatically generates Flyer for the course based on the content used to create webinar.
4. One clikc Personalised Whatsapp messages with seminar links to attend. ( This needs to be automated so bult messages can be sent)
5. Same interface can be accessed from mobile or web.
6. After seminar the followup conversations can be recorded with notes. 







## AI Generated
<details>
<summary>Click to expand</summary>

Your hidden content goes here.

A mobile-first, persistent MVP for recurring webinar registrations and course follow-ups. Built with React/Vinext, Cloudflare Workers, and D1. All invitation sending is explicitly simulated; no WhatsApp account, token, or real messaging provider is configured.

## Included

- Three mobile tabs: Today, Webinars, People.
- Fixed registration template with editable webinar title, course, batch, description, organizer, dates, and joining link.
- Webinar creation, editing, duplication, and draft/open/closed states.
- A registration URL per webinar, separate webinar-message and course-follow-up permissions, phone normalization, same-webinar duplicate protection, a honeypot, and per-webinar/IP rate limiting.
- One contact per normalized phone per workspace, separate registrations for each webinar, and historical notes across batches.
- Dated follow-ups in India Standard Time, notes, outcomes, optional attendance, and contact-wide outreach suppression.
- Individual invitation previews triggered in one selected batch. The database prevents duplicate simulated invitations even if two triggers run concurrently.
- Workspaces start empty. You create webinars and collect registrations yourself.
- Network-only installable app shell. No contact data or authenticated pages are cached offline.
- Private authenticated workspace with server-side user scoping on every admin operation.

## Demo boundaries

Each authenticated user gets an empty workspace. Webinars, registrations, and notes you add afterward are saved in D1. Previously generated sample webinars and fictional contacts are removed on the next workspace load.

The invitation action creates `Simulated` message records. It does **not** send a message, create a WhatsApp delivery receipt, or contact any external account. Joining URLs you enter should be real meeting links for your batch.

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

Sign-in is a single shared admin account: a password (`ADMIN_PASSWORD`) checked against a signed, HttpOnly session cookie (`SESSION_SECRET`). Set both as local secrets (e.g. in `.dev.vars`, which Wrangler loads automatically and which stays out of git) before running `npm run dev`, then sign in at `/signin`. There is no self-serve signup and no other account tier — this app is built for exactly one operator.

## Validation

```sh
./node_modules/.bin/tsc --noEmit
node tests/mvp.mjs
npm run build
```

The integration script needs Playwright and a compatible Chromium binary. Set `PLAYWRIGHT_MODULE` to its package path if it is not at the bundled runtime path, `TEST_BROWSER_PATH` for an existing browser, and `TEST_ORIGIN` for a nondefault local preview. It writes only local QA records and screenshots under ignored `outputs/`. It never sends messages.

Checks cover browser flows, phone layout, history, authenticated API access, duplicate registration, safe URLs, callback validation, stale writes, concurrent invitation triggers, opt-outs, closed webinars, and persistence after reload.

## Safety checks before committing a schema change

Schema, migrations, and TypeScript types are hand-maintained in four
separate places (`db/schema.ts`, `drizzle/*.sql`, `drizzle/meta/*_snapshot.json`,
`lib/types.ts`) — nothing enforces they stay in sync automatically. Two
scripts guard against the two most common ways that drifts apart:

- `npm run verify:schema` — replays every migration against a throwaway
  local D1 database (no network or account needed) and cross-checks the
  result against `db/schema.ts` and the latest snapshot. Catches a
  renamed/added column that only made it into one of the three places,
  or a migration file with broken SQL, before it ever reaches production.
- `npm run verify:sql` — a static scan of every `db.prepare(...).bind(...)`
  call in `lib/server.ts` and the API routes, flagging any place where the
  number of `?` placeholders doesn't match the number of bound arguments.

Run both (or `npm run verify`, which runs them together) before
committing any change that touches `db/schema.ts`, `drizzle/`, or a
`db.prepare(...)` call. Neither script touches your real database. It's
worth also running `npm run lint` and `npx tsc --noEmit` on any files
you touch — the repo has a few pre-existing lint findings elsewhere
that aren't part of this gate, so a clean `npm run verify` doesn't
imply a clean full-repo lint.

## Real WhatsApp integration later

1. Configure an official Meta Cloud API test sender and verify the allowed demo recipients.
2. Confirm approved template name, language, parameter order, phone number ID, and Graph API version. Keep tokens and webhook secrets in hosted secret storage, never in browser code or Git.
3. Add a separate provider adapter and durable queue. Retain the manual preview/trigger and recheck consent and contact suppression immediately before every send.
4. Record provider message IDs and accept delivery updates only after validating webhook signatures. API acceptance must not be labeled delivery. Handle ambiguous timeouts through reconciliation rather than blind resending.
5. Keep live and simulated message records separate. The current unique key includes message kind so a future live adapter can use a different kind without treating demo previews as sent invitations.
6. Decide on and connect a reply inbox, then test end-to-end with the verified recipients before enabling live sending.

## Storage and operations

Schema is in `db/schema.ts`; generated migrations are in `drizzle/`. Runtime code uses prepared D1 statements through `lib/database.ts`. Multi-record registration and follow-up updates use transactional batches. Public endpoints return no contact records, notes, owner IDs, or meeting URLs.

D1 has ~30 days of built-in point-in-time recovery, but there is no separate backup-export job in this MVP; run `wrangler d1 export DB --remote --output backup.sql` periodically (e.g. from cron) before relying on this for real participant data. Users requesting correction or deletion should contact the organizer; an operator-facing deletion workflow can be added before a public pilot.

## Feature flags (per deployment)

Some features can be switched on or off per deployment without touching code, via lib/flags.ts and the FEATURE_FLAG_DEFS registry in lib/types.ts. These are deployment-level, not admin-level: there is no in-app toggle, and changing one means updating the Worker var and redeploying that specific instance. This is intentional if you run more than one deployment (e.g. one per customer) and want each to ship with its own defaults, without giving any signed-in admin a switch that affects everyone.

Each flag reads from an env var named `FEATURE_<KEY_UPPERCASED>` (e.g. the "registrations_table_view" flag reads `FEATURE_REGISTRATIONS_TABLE_VIEW`), accepting `1`/`0`, `true`/`false`, `on`/`off`, or `yes`/`no` (case-insensitive). If the var is unset, the flag's built-in default in `FEATURE_FLAG_DEFS` applies.

To turn a flag off for one deployment:
```
wrangler secret put FEATURE_REGISTRATIONS_TABLE_VIEW   # or use a plain wrangler var if it doesn't need to be secret
# enter: false
npm run deploy
```

To add a new flag: add an entry to `FEATURE_FLAG_DEFS` in `lib/types.ts` (key, label, description, default), add its type to `cloudflare-env.d.ts`, and read `flags.<key>` from `DeskState` wherever it should gate behavior — `getDeploymentFlags()` in `lib/flags.ts` picks it up automatically.

## Deploying your own instance

This runs as a Cloudflare Worker with a D1 database, in your own Cloudflare account — not through any third-party hosting layer.

1. `wrangler d1 create seminar-desk-db` and note the returned database id.
2. Apply migrations to it: `wrangler d1 execute DB --remote --database-id <id> --file drizzle/0000_parched_purple_man.sql` (and any later files `npm run db:generate` produces, in order).
3. Set two Worker secrets: `wrangler secret put ADMIN_PASSWORD` and `wrangler secret put SESSION_SECRET` (a long random string for the second one, e.g. `openssl rand -hex 32`).
4. Build with `D1_DATABASE_ID=<id> npm run build`, then `wrangler deploy` (pointing at the built worker's generated config, or your own `wrangler.toml` with the same `DB` binding).
5. Visit your `*.workers.dev` URL (or a custom domain you attach in the Cloudflare dashboard) and sign in at `/signin` with the password from step 3. The app is installable from there on any phone or desktop browser (Add to Home Screen) — no separate app build is needed.

</details>
