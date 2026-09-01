# GyakutenEigo developer and operator handoff

**Verified:** 1 September 2026 (JST)
**Application baseline:** `76840ec`
**Canonical system document:** [`SYSTEM.md`](SYSTEM.md)

This file is the short “what do I do next?” guide. It deliberately avoids
duplicating the full architecture. Update `SYSTEM.md` whenever a deployment,
authority, persistence, provider, or route fact changes.

## Current status

- The application baseline is `76840ec` (`Add Gemini Speaking providers`);
  documentation commits may be newer.
- GitHub Actions `CI` and `Deploy Web` both succeeded for that commit.
- `gyakuteneigo.com` and `www.gyakuteneigo.com` serve the GitHub Pages web
  artifact.
- `api.gyakuteneigo.com/api/health` and
  `gyakuteneigo-api.onrender.com/api/health` return healthy PostgreSQL-backed
  API responses.
- Production data is in Supabase PostgreSQL. The old Render database is
  retired; the final local native backup is outside Git at
  `database-backups/quizstrike-render-20260801-231819.dump`.
- Production Speaking uses Gemini for both AI and transcription. Provider keys
  are Render-only secrets.
- The service remains one Render instance with process-local live room state.
- The Cloudflare same-origin Worker is prepared in source but is not verified
  live. Website `/api/health` is still a 404, so do not disable the explicit
  Render API origin in the Pages build.

## Start locally

Use Node 20.19+ or Node 22.13+; `.nvmrc` selects Node 22.13.

~~~powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
~~~

Local URLs:

- web: `http://localhost:5173`;
- API: `http://localhost:4000`;
- health: `http://localhost:4000/api/health`;
- local rendering lab: `http://localhost:5173/character-lab`.

For durable local data, start PostgreSQL and migrate:

~~~powershell
docker compose up -d
npm run prisma:migrate
~~~

Without `DATABASE_URL`, the server intentionally uses in-memory persistence.
Users, rooms, answers, reports, and Speaking records disappear when the
process exits. Local Speaking uses mock providers unless real provider values
are explicitly configured.

## Before a release

Run the checks relevant to the change. The normal minimum is:

~~~powershell
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
~~~

Add these for the corresponding changes:

~~~powershell
npm run test:load       # realtime/server load behavior
npm run test:e2e        # browser/classroom flow
npm run test:proxy      # Cloudflare proxy contract
npm run typecheck:proxy
~~~

When a protocol or shared type changes, deploy the compatible server first,
then the web build. When a Prisma migration changes production data, use
`prisma migrate deploy` through server startup; never use `prisma db push` or
`prisma migrate dev` against Supabase production.

## Production configuration checklist

### Render

The service uses:

~~~text
Build: npm ci --include=dev && npm run build -w @quizstrike/shared && npm run build -w @quizstrike/server
Start: npm start -w @quizstrike/server
~~~

Required names (values belong only in Render):

~~~text
NODE_ENV=production
NODE_VERSION=22
JWT_SECRET=<secret>
DATABASE_URL=<Supabase session-pooler URL>
CLIENT_ORIGIN=https://gyakuteneigo.com,https://www.gyakuteneigo.com,https://susume.github.io
TRUST_PROXY=true
RUNTIME_STORE=in-memory
SPEAKING_MOCK_MODE=false
SPEAKING_AI_PROVIDER=gemini
SPEAKING_TRANSCRIPTION_PROVIDER=gemini
SPEAKING_GEMINI_API_KEY=<secret>
SPEAKING_GEMINI_MODEL=gemini-2.5-flash-lite
SPEAKING_GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash-lite
~~~

Do not copy secret values into `.env.example`, GitHub Actions variables,
`VITE_*` values, screenshots, logs, or documentation. Render supplies `PORT`;
the local default is 4000.

### GitHub Pages

The Pages workflow builds on `main` with Node 22. Current default values are:

~~~text
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
VITE_API_URL=https://gyakuteneigo-api.onrender.com
VITE_ALLOW_PRODUCTION_API_OVERRIDE=true
~~~

The workflow copies `index.html` to `404.html` and creates direct entry points
for `/quiz-strike`, `/join`, `/game`, `/check`, and `/diagnostics`. If the
repository-level Pages variables differ from the defaults, verify the actual
artifact and update [`SYSTEM.md`](SYSTEM.md).

## Release sequence

1. Confirm the intended `main` commit and that CI passes.
2. If the server or Prisma changed, watch Render startup for migration output
   and a listening message.
3. Check both API health endpoints:

   ~~~powershell
   Invoke-RestMethod https://api.gyakuteneigo.com/api/health
   Invoke-RestMethod https://gyakuteneigo-api.onrender.com/api/health
   ~~~

   Require `ok: true` and `storage: postgres`.
4. Confirm the web workflow completed and open `/`, `/quiz-strike`, `/join`,
   `/check`, and a direct `/speak` route.
5. Run the classroom smoke test below on the actual target network before
   inviting a class.

## Classroom smoke test

Use a teacher browser and at least two student browsers:

1. Teacher signs in, opens Library, selects a quiz, and creates a room.
2. Waiting room shows join link/QR, roster, bot and appearance controls, and a
   visible Start Game action.
3. Students join and receive a Socket.IO handshake, scoped snapshot, question,
   answer result, money, scoreboard, and event feed.
4. Run at least one current mode. For arena modes, exercise a short Classic,
   Flag, or Zombie round; for Athletics, verify course progress and the chosen
   variant behavior.
5. Test shop/purchases where relevant, reconnect one student, and verify the
   authoritative snapshot restores the room.
6. Pause and resume as the owning teacher. Confirm movement, firing, answers,
   purchases, countdowns, and bot/deadline progress freeze and resume safely.
7. Confirm Learning Pulse appears to the teacher but not in student snapshots.
8. End the room, open the report, export it, and verify teacher-scoped history.
9. If Speaking changed, create a short activity, join it, send one recording,
   request help, finish, and verify the result/evaluation path.

## Troubleshooting

### Render exits during startup

Check the first error after `prisma migrate deploy`:

- missing `JWT_SECRET` fails production configuration;
- missing `SPEAKING_AI_PROVIDER` or
  `SPEAKING_TRANSCRIPTION_PROVIDER` fails production Speaking configuration;
- Gemini mode also requires `SPEAKING_GEMINI_API_KEY` (or the supported
  `GEMINI_API_KEY` alias);
- an unsupported `RUNTIME_STORE` fails closed because the runtime is not
  distributed.

For the original startup failure, set both provider selectors and the
server-only Gemini key in Render, keep `SPEAKING_MOCK_MODE=false`, then
redeploy. Use `SPEAKING_MOCK_MODE=true` only for an intentional non-AI test
deployment.

### Website loads but API calls are 404

This is expected for `https://gyakuteneigo.com/api/*` until the Cloudflare
Worker cutover is complete. Verify the deployed web build still has
`VITE_API_URL=https://gyakuteneigo-api.onrender.com` and
`VITE_ALLOW_PRODUCTION_API_OVERRIDE=true`. Test the API directly at
`https://api.gyakuteneigo.com/api/health`.

Do not “fix” this by attaching the Worker to `/*`, adding a generic proxy, or
putting secrets into the web build.

### WebSocket/reconnect failures

Confirm the browser uses the same API base URL for HTTP and Socket.IO, the
Render service still has one instance, CORS includes the real Pages origin,
and the target network permits Socket.IO polling. The protocol handshake is
`client_hello` → `server_hello` → `join_session_room`; inspect the browser
diagnostics page and Render logs without logging tokens.

### Speaking failures

Confirm the provider selectors match (`gemini`, `openai`, or intentional
`mock`), the selected provider key is present only on Render, the model names
are valid, and the request is within the bounded audio/session limits. The
server stores transcript/evaluation metadata, not raw Speaking audio.

## Scaling and rollback guardrails

Do not add Render replicas. Process-local rooms, sockets, timers, bots, rate
limits, deduplication, and transient assets require room affinity and one
authoritative instance.

For a web-only regression, redeploy the previous Pages artifact. For an API or
protocol regression, stop inviting new rooms and roll web/server back to a
compatible pair. Never reverse a production migration by hand; recover data
through the approved backup procedure and reconcile any writes first.

For a same-origin cutover rollback, disable only the Worker API/socket routes
or restore the previous Worker origin. Keep the Pages static site intact.

## Ownership map

For changes to server authority, persistence, network paths, security, or
product routes, read [`architecture.md`](architecture.md) and
[`SYSTEM.md`](SYSTEM.md) first. Focused feature and migration notes in
`docs/` are supporting evidence, not replacements for the current-state
document.
