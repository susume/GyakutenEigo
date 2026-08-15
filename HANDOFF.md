# QuizStrike system handoff

Last verified: 15 August 2026
Repository: susume/GyakutenEigo
Baseline commit: 60bd853
Audience: the next developer, release operator, or technical owner

Read architecture.md for authority boundaries. Read docs/online-play.md for the
broader production runbook and docs/cloudflare-api-proxy.md for the DNS and
Worker cutover.

## 1. Executive status

QuizStrike is a browser classroom game with teacher authoring, student
join/rejoin, three server-authoritative modes, three authored arenas,
combat/economy, bots, reports, competitions, tournaments, customization,
teacher pause, Learning Pulse, spectator view, and iPad diagnostics.

The important operational fact is the networking rollout:

1. The frontend update changed production API and Socket.IO resolution to the
   page origin.
2. The public domain has not yet been moved to Cloudflare.
3. Live /api/* requests therefore reach GitHub Pages and return 404, while
   Render itself is healthy.
4. The working tree contains a compatibility release configuration that uses
   https://gyakuteneigo-api.onrender.com until Cloudflare is ready.
5. Publish that compatibility configuration to restore teacher login, then do
   the Worker/DNS cutover in the order below.

Do not set the production override to false while the public health route is
not returning {"ok":true}. CI now blocks that mistake.

## 2. Immediate recovery release

The local working-tree changes include:

- VITE_API_URL defaulting to the healthy Render API in the Pages workflow;
- VITE_ALLOW_PRODUCTION_API_OVERRIDE=true during the migration window;
- a production endpoint-resolution regression test;
- a CI health guard for the eventual same-origin cutover;
- architecture and handoff documentation reflecting this two-stage rollout.

After review, publish the changes through the normal repository release path.
Then verify:

~~~powershell
Invoke-RestMethod https://gyakuteneigo-api.onrender.com/api/health
Invoke-WebRequest https://www.gyakuteneigo.com/quiz-strike/teacher/home -UseBasicParsing
~~~

Open the teacher login page, sign in once, and confirm the browser network
panel shows /api/auth/login going to the configured Render compatibility origin.
This is a temporary recovery check, not the final school-safe architecture.

## 3. Current production facts

| Item | Value |
| --- | --- |
| Static host | GitHub Pages |
| Canonical Pages variable | PAGE_CUSTOM_DOMAIN; workflow default is www.gyakuteneigo.com |
| Backend | Render gyakuteneigo-api |
| Backend health | 200, ok: true, storage: postgres at last verification |
| Database | Supabase PostgreSQL via server-side Prisma/session pooler |
| Runtime store | in-memory only |
| Worker source | infrastructure/cloudflare/src/index.ts |
| Worker config | infrastructure/cloudflare/wrangler.toml |
| Live DNS | Registrar nameservers; Cloudflare zone/routing is not active |
| Browser target after cutover | https://gyakuteneigo.com/api/* and /socket.io/* |
| Health after cutover | https://gyakuteneigo.com/api/health |

The Render service is single-instance. Live rooms, timers, bot state, Socket.IO
bindings, leases, rate limits, dedupe, and ephemeral decals are process-local.
Do not scale horizontally.

## 4. Local development

Use Node 20.19+ or Node 22.13+ as specified by .nvmrc and package.json.

~~~powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
~~~

Local URLs:

- web: http://localhost:5173;
- API: http://localhost:4000;
- health: http://localhost:4000/api/health;
- diagnostics: http://localhost:5173/check;
- character/map lab: http://localhost:5173/character-lab.

Without DATABASE_URL, the server deliberately uses in-memory state. For durable
local state:

~~~powershell
docker compose up -d
npm run prisma:migrate
~~~

Do not use prisma db push or prisma migrate dev against production.

## 5. Environment contract

Server-only values belong in Render/server configuration:

~~~text
NODE_ENV=production
PORT=4000
JWT_SECRET=<long random secret>
DATABASE_URL=<Supabase session-pooler URL>
CLIENT_ORIGIN=https://gyakuteneigo.com,https://www.gyakuteneigo.com,https://susume.github.io
TRUST_PROXY=true
RUNTIME_STORE=in-memory
~~~

Public web build values are safe to expose but must not contain secrets:

~~~text
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
VITE_API_URL=https://gyakuteneigo-api.onrender.com
VITE_ALLOW_PRODUCTION_API_OVERRIDE=true
~~~

Cutover values, only after the Worker is live:

~~~text
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
VITE_API_URL=<unset>
VITE_ALLOW_PRODUCTION_API_OVERRIDE=false
~~~

Local development may use VITE_API_URL=http://localhost:4000 and an optional
VITE_API_FALLBACK_URL. Never put DATABASE_URL, JWT_SECRET, Supabase keys,
teacher tokens, or player tokens in any VITE_* variable.

## 6. Repository ownership map

| Change area | Start here |
| --- | --- |
| Browser route/product composition | apps/web/src/BrowserApp.tsx and features/quizstrike/QuizStrikeApp.tsx |
| Teacher workspace | features/quizstrike/teacher/TeacherWorkspace.tsx and TeacherHome.tsx |
| Student join/live UX | features/quizstrike/student/StudentJoinScreen.tsx and StudentExperience.tsx |
| API resolution/errors | apps/web/src/api/client.ts, api/endpoints.ts, studentJoinErrors.ts |
| Socket handshake | features/multiplayer/connection.ts and apps/server/src/realtime/protocolGateway.ts |
| Server composition | apps/server/src/runtime.ts |
| Teacher/library routes | routes/teacherLibrary.ts, studySets.ts, quizSets.ts, questions.ts |
| Session/player routes | routes/sessionRoutes.ts, playerRoutes.ts, appearanceRoutes.ts |
| Reports/organizers | routes/reports.ts, competitionRoutes.ts, tournamentRoutes.ts |
| Room/game authority | realtime/roomAuthority.ts, roundRuntime.ts, roundFlow.ts, combat.ts |
| Bots | botRuntime.ts, botAI.ts, botNavigation.ts |
| Persistence | persistence/normalizedLibrary.ts, prisma/schema.prisma, prisma/migrations/ |
| Shared protocol/rules | packages/shared/PROTOCOL.md and packages/shared/src/ |
| Arena/rendering | apps/web/src/game/ArenaPreview.tsx, arenaMapBuilder.ts, characterSync.ts, arenaLoop.ts |
| Worker | infrastructure/cloudflare/src/index.ts, wrangler.toml, docs/cloudflare-api-proxy.md |

## 7. Release procedure

### Web/API release

1. Confirm the intended commit and database backup state.
2. Run the validation commands in section 10.
3. Confirm Render has DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN, TRUST_PROXY,
   and RUNTIME_STORE=in-memory.
4. Deploy the server and wait for migrations to complete before accepting
   classrooms.
5. Verify Render health and PostgreSQL storage.
6. Deploy the web artifact through .github/workflows/deploy-web.yml.
7. Test teacher login, quiz library, room creation, student join, Socket.IO
   handshake, reconnect, report creation, and /check.

### Cloudflare cutover

Do this only when the compatibility release is stable:

1. Record the current GitHub Pages custom domain and DNS records.
2. Add gyakuteneigo.com to Cloudflare.
3. Move the domain nameservers to Cloudflare and preserve the Pages origin
   record, proxied through Cloudflare.
4. Deploy the Worker with npx wrangler login and npx wrangler deploy from
   infrastructure/cloudflare/.
5. Confirm apex and www Worker routes have valid proxied DNS records.
6. Verify /api/health returns JSON and
   /socket.io/?EIO=4&transport=polling returns an Engine.IO opening response,
   not Pages HTML.
7. Open /check from a normal browser and a physical school iPad.
8. Set VITE_ALLOW_PRODUCTION_API_OVERRIDE=false, remove VITE_API_URL, and let
   the CI guard validate the public route before Pages deploys.
9. Inspect the browser network panel: normal gameplay traffic must stay on the
   website origin.

The Worker routes are limited to /api/* and /socket.io/*. Never attach the
Worker to /*. Keep BACKEND_ORIGIN as an HTTPS origin with no path, credentials,
query, or fragment.

## 8. Health and rollback

Health checks:

~~~powershell
Invoke-RestMethod https://gyakuteneigo-api.onrender.com/api/health
Invoke-RestMethod https://www.gyakuteneigo.com/api/health
curl.exe -i "https://www.gyakuteneigo.com/socket.io/?EIO=4&transport=polling"
~~~

The second and third commands are expected to use the website origin only after
Cloudflare cutover. Before then, use the Render health URL and compatibility
web build.

Rollback order:

- Web-only issue: redeploy the previous Pages artifact with the matching API mode.
- Worker issue: redeploy the previous Worker or disable only the two Worker
  routes; keep Pages DNS/CNAME intact.
- API/protocol issue: roll back compatible server and web versions together.
- Database migration issue: stop classroom launches and use the approved
  recovery procedure; never manually reverse a production migration.

## 9. Classroom verification

Run the full manual procedure in docs/school-ipad-checklist.md. The short
release smoke is:

1. Teacher signs in and opens a quiz set.
2. Teacher creates a room and verifies the join code/QR.
3. Student opens /join, enters a nickname, joins, chooses a team, and reaches
   the lobby.
4. Teacher starts a round.
5. Student renders the arena, uses touch controls, opens the quiz, answers, and
   sees score/state synchronization.
6. Student backgrounds Safari briefly, returns, and reconnects.
7. Teacher pauses/resumes, ends the session, and opens the report.

Repeat once on home Wi-Fi, school Wi-Fi, and a desktop browser. Automated
Chromium iPad emulation is useful regression coverage but does not prove real
Safari/iPadOS behavior.

## 10. Validation commands

From the repository root:

~~~powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:load
npm run test:e2e
npx prisma validate
git diff --check
~~~

Focused checks:

~~~powershell
npm run test:proxy
npm run typecheck:proxy
npm run test -w @quizstrike/web
npm run typecheck -w @quizstrike/web
~~~

The school-iPad work includes proxy path/header/timeout tests, API resolution
tests, friendly join-error tests, API/socket failure and recovery Playwright
coverage, an iPad-sized project, and /check diagnostics. The local environment
cannot validate Cloudflare DNS or a physical iPad.

## 11. Known limits and risks

- Cloudflare is not yet the live DNS edge; the same-origin cutover is a
  deployment, not only a frontend setting.
- School filtering may block WebSocket upgrades. Socket.IO starts with polling
  and can remain functional over polling, with higher latency.
- Render cold starts can make the first request slow. Bounded timeouts and
  classroom-facing retry wording are intentional.
- One Render instance is required for room affinity. A restart can require
  reconnect/rejoin and does not provide zero-downtime live-room handoff.
- GitHub Pages remains a static host; SPA fallback and custom-domain/CNAME
  settings must be preserved during DNS changes.
- WebGL, AudioContext, localStorage, page lifecycle, viewport, and touch
  behavior still need physical Safari confirmation.
- Cloudflare free-plan request/CPU quotas should be monitored during a school
  day, especially if polling fallback is common.
- Uploaded decals are ephemeral and are not a durable classroom asset store.

## 12. Non-negotiable invariants

1. The server is authoritative for identity, correctness, movement acceptance,
   combat, economy, objectives, timers, reports, and role-scoped state.
2. Students never receive correctChoice, Learning Pulse, private roster data,
   or teacher-only projections.
3. Purchases and other ambiguous actions are not retried through two transports.
4. Live API and Socket.IO traffic is never cached.
5. The Worker is not an open proxy and never receives application secrets.
6. RUNTIME_STORE=redis remains disabled until the full multi-instance design is
   implemented and tested.
7. Any production networking change updates this file, architecture.md,
   docs/online-play.md, tests, and release verification steps.
