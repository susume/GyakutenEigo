# Online play and deployment runbook

**Current status verified:** 1 September 2026 (JST)
**Canonical system source:** [`../SYSTEM.md`](../SYSTEM.md)

This runbook describes the live hosting path and the remaining optional
same-origin cutover. It is intentionally separate from historical migration,
performance, and classroom QA notes.

## Live production topology

~~~mermaid
flowchart LR
  Browser[Teacher or student browser]
  Pages[GitHub Pages<br/>React/Vite static build]
  API[Render: gyakuteneigo-api<br/>Express + Socket.IO]
  DB[(Supabase PostgreSQL)]
  Gemini[Gemini API]

  Browser -->|HTML, JS, assets| Pages
  Browser -->|HTTPS / Socket.IO<br/>explicit API origin| API
  API -->|Prisma session pooler| DB
  API -->|server-only Speaking requests| Gemini
~~~

| Component | Current value |
| --- | --- |
| Static artifact | `apps/web/dist` |
| Website | `https://gyakuteneigo.com`, `https://www.gyakuteneigo.com` |
| Static host | GitHub Pages |
| API custom hostname | `https://api.gyakuteneigo.com` |
| API native hostname | `https://gyakuteneigo-api.onrender.com` |
| Render service | `gyakuteneigo-api`, one Node instance |
| Database | Supabase PostgreSQL, Quiz Strike Production, Sydney |
| Database access | Server-only Prisma session pooler |
| Live room state | Process-local authoritative runtime |
| Speaking provider | Gemini, selected on the server |

The apex and `www` website hosts currently serve Pages. The `api` DNS record
points to Render and its health endpoint is live. The website
`/api/health` path currently returns 404; this is expected while the
Cloudflare Worker remains undeployed/not in the live website path.

## Render API release

The service builds and starts with:

~~~text
Build:
npm ci --include=dev && npm run build -w @quizstrike/shared && npm run build -w @quizstrike/server

Start:
npm start -w @quizstrike/server
~~~

When `DATABASE_URL` is present, `apps/server/src/start.ts` runs
`prisma migrate deploy` before the runtime is imported and the server listens.
Render supplies the runtime `PORT`; local development defaults to 4000.

Server-only configuration names:

~~~text
NODE_ENV=production
NODE_VERSION=22
JWT_SECRET=<long random secret>
DATABASE_URL=<Supabase session-pooler URL>
CLIENT_ORIGIN=https://gyakuteneigo.com,https://www.gyakuteneigo.com,https://susume.github.io
TRUST_PROXY=true
RUNTIME_STORE=in-memory
SPEAKING_MOCK_MODE=false
SPEAKING_AI_PROVIDER=gemini
SPEAKING_TRANSCRIPTION_PROVIDER=gemini
SPEAKING_GEMINI_API_KEY=<Render secret>
SPEAKING_GEMINI_MODEL=gemini-2.5-flash-lite
SPEAKING_GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash-lite
~~~

Never put `DATABASE_URL`, `JWT_SECRET`, provider keys, Supabase credentials,
teacher tokens, player tokens, or private decal bytes in the web build or Git.

The old Render PostgreSQL database is retired. The final local native backup is
outside Git at `database-backups/quizstrike-render-20260801-231819.dump`.

## GitHub Pages release

The `Deploy Web` workflow runs on pushes to `main` or manual dispatch. It
uses Node 22, builds `@quizstrike/shared` and `@quizstrike/web`, creates SPA
fallbacks, writes the optional CNAME, and deploys `apps/web/dist`.

Current workflow defaults:

~~~text
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
VITE_API_URL=https://gyakuteneigo-api.onrender.com
VITE_ALLOW_PRODUCTION_API_OVERRIDE=true
~~~

`VITE_API_URL` is the compatibility path that keeps the live website usable
while website-origin API routes are not available. If the repository-level
Actions variables differ from these defaults, verify the artifact and update
[`../SYSTEM.md`](../SYSTEM.md).

After a Pages deployment, open direct routes in a fresh browser tab:

- `/`;
- `/quiz-strike`;
- `/join`;
- `/game`;
- `/speak`;
- `/check`;
- `/diagnostics`;
- `/tournament-study/<released-id>` when applicable.

## Health verification

The live API checks are:

~~~powershell
Invoke-RestMethod https://api.gyakuteneigo.com/api/health
Invoke-RestMethod https://gyakuteneigo-api.onrender.com/api/health
~~~

Require `ok: true`, `service: quizstrike-server`, and
`storage: postgres`. Website-origin `/api/health` should not be used as a
release gate until the Worker cutover is complete.

For realtime verification:

~~~powershell
curl.exe -i "https://api.gyakuteneigo.com/socket.io/?EIO=4&transport=polling"
~~~

The response should be an Engine.IO opening payload. Do not paste tokens or
full database URLs into diagnostics.

## Database release rules

- Use `npx prisma validate` before migration changes.
- Use `prisma migrate deploy` through the controlled Render startup path.
- Do not use `prisma db push` or `prisma migrate dev` against production.
- Confirm Render logs show migration completion before the listening message.
- Confirm the health response reports `storage: postgres`.
- Verify teacher login, library reads/writes, room creation, student join, and
  report writes after a schema release.
- Keep `RuntimeSnapshot` and normalized rows compatible when changing
  persistence or hydration behavior.

## Classroom smoke test

1. Sign in as a teacher at `/quiz-strike` and open Library.
2. Select a study set and create a room. Exercise game mode, arena/rules, and
   advanced setup.
3. Confirm the waiting room shows a join URL/QR, roster, bot controls,
   appearance controls, and Start Game.
4. Join from two student browsers. Verify handshake, role-scoped snapshot,
   question, answer result, money, scoreboard, and event feed.
5. Run at least one current mode: Classic, Flag, Zombie, or Athletics. For
   Athletics, verify the selected variant’s progress/role/hazard behavior.
6. Test purchase controls where applicable.
7. Disconnect and rejoin one student; verify the authoritative snapshot restores
   the room.
8. Pause and resume as the owning teacher; verify actions and deadlines freeze
   and resume correctly.
9. Confirm Learning Pulse is visible to the teacher but absent from student
   snapshots.
10. End the room and verify the teacher-scoped report and export.
11. If Speaking changed, create an activity, join it, make one recording, use
    Help, finish, and verify the student result plus teacher result list.

Repeat on the target classroom network. Physical iPad/Chromebook performance and
network behavior are not covered by desktop automation alone.

## Cloudflare same-origin cutover (planned)

The Worker in `infrastructure/cloudflare/src/index.ts` intentionally proxies
only:

~~~text
/api/*       -> https://gyakuteneigo-api.onrender.com
/socket.io/* -> https://gyakuteneigo-api.onrender.com
~~~

Before enabling it:

1. Confirm the domain owner is ready to delegate DNS to Cloudflare; current
   nameservers remain `dns1.registrar-servers.com` and
   `dns2.registrar-servers.com`.
2. Preserve the Pages origin records and make the relevant hostname records
   proxied.
3. Deploy the committed Worker with `npx wrangler deploy` from
   `infrastructure/cloudflare`.
4. Verify both `https://gyakuteneigo.com/api/health` and
   `https://www.gyakuteneigo.com/api/health` as applicable.
5. Verify Socket.IO polling and WebSocket upgrade through the website origin.
6. Verify `/check`, login, student join, reconnect, and a short classroom room.
7. Only then set `VITE_ALLOW_PRODUCTION_API_OVERRIDE=false` and remove the
   direct `VITE_API_URL` compatibility value.
8. Update [`../SYSTEM.md`](../SYSTEM.md) with the evidence and commit.

Do not attach the Worker to `/*`, turn it into a generic forwarder, or put
server secrets in Worker variables/source. Keep the static Pages site as the
origin for ordinary browser routes.

## Scaling limit and rollback

Keep exactly one Render instance. The room store, sockets, timers, bot memory,
room leases, disconnect grace, rate limits, deduplication, and transient decal
or Athletics state are process-local. `RUNTIME_STORE=redis` is rejected until
distributed ownership and fan-out are implemented.

For a web-only issue, redeploy the previous Pages artifact. For an API,
protocol, or shared-type issue, roll the web and server to a compatible pair.
Never reverse a production migration by hand; use the approved backup/recovery
procedure and reconcile any production writes first.

For a Worker issue, disable only the API/socket routes or restore the previous
backend origin. Keep the Pages artifact and DNS intact.
