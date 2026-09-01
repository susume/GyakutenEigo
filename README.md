# GyakutenEigo / QuizStrike

GyakutenEigo is a school-safe English-learning platform. QuizStrike is its
live classroom game: teachers author study sets and private rooms, students
join with a code, answer questions, earn in-game rewards, and play
server-authoritative arena or Athletics modes. Speaking Practice adds
teacher-created AI conversation activities with student results.

## Live status

| Service | Location | Status |
| --- | --- | --- |
| Web app | [gyakuteneigo.com](https://gyakuteneigo.com) and [www.gyakuteneigo.com](https://www.gyakuteneigo.com) | GitHub Pages static build |
| API/realtime | [api.gyakuteneigo.com](https://api.gyakuteneigo.com) | Render service `gyakuteneigo-api` |
| Database | Supabase PostgreSQL | Production data store, Sydney region |
| Speaking AI | Gemini | Server-side conversation, help, evaluation, and transcription |

The API health endpoint is [api.gyakuteneigo.com/api/health](https://api.gyakuteneigo.com/api/health).
The public website is static Pages, so its `/api/*` path is not same-origin yet.
The checked-in Cloudflare Worker is prepared for a future cutover; the current
web build uses the Render API origin explicitly.

The production service is currently one Render instance because live rooms,
Socket.IO bindings, timers, bots, rate limits, and other transient state are
process-local. Production PostgreSQL is the Supabase project **Quiz Strike
Production**. The former Render PostgreSQL database was retired after the
1 August 2026 migration; the final local native backup is kept outside Git at
`database-backups/quizstrike-render-20260801-231819.dump`.

For the complete current-state description, read
[`SYSTEM.md`](SYSTEM.md) first.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `apps/web` | React/Vite client, teacher/student flows, Three.js arena, Speaking UI |
| `apps/server` | Express API, Socket.IO, authoritative runtime, bots, providers, persistence |
| `packages/shared` | Shared TypeScript types, protocol schemas, game rules, Athletics and Speaking contracts |
| `prisma` | PostgreSQL schema and committed migrations |
| `infrastructure/cloudflare` | Prepared selective API/Socket.IO Worker proxy; not currently live |
| `.github/workflows` | CI and GitHub Pages deployment |
| `scripts/database` | Database audit, backup, migration, and snapshot tools |
| `docs` | Feature, migration, performance, and QA notes |
| `SYSTEM.md` | Canonical current-state system source of truth |
| `architecture.md` | Compact authority and boundary map |
| `HANDOFF.md` | Release, troubleshooting, and operator handoff |

## Local setup

Use Node.js 20.19+ or 22.13+; `.nvmrc` selects Node 22.13.

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
- development-only character/map lab: `http://localhost:5173/character-lab`.

For durable local data:

~~~powershell
docker compose up -d
npm run prisma:migrate
~~~

Without `DATABASE_URL`, the server intentionally uses in-memory persistence
and data disappears when the process exits. Local Speaking uses mock providers
unless real provider values are explicitly configured.

## Main routes

| Route | Use |
| --- | --- |
| `/` | Public GyakutenEigo home |
| `/quiz-strike` | QuizStrike landing, authentication, and competition entry |
| `/quiz-strike/teacher/*` | Unified teacher workspace |
| `/join?code=ROOM` | Student room-code entry |
| `/game` | Student live arena |
| `/speak` | Speaking Practice entry |
| `/speak/join/:activityCode` | Speaking student join |
| `/quiz-strike/organizer` and competition routes | Organizer and tournament features |
| `/tournament-study/:id` | Released tournament study page |
| `/check` and `/diagnostics` | Network/API/realtime diagnostics |
| `/character-lab` | Local development rendering harness |

The app uses a small History API router; React Router is not installed. The
Pages workflow supplies `404.html` and direct route entry points.

## Product scope

- Teacher signup/login, classes, folders, Discover, Library, study-set editing,
  question CRUD, question audio, reports, and classroom controls.
- Private QuizStrike rooms with join links/QR codes, student rejoin, bots,
  appearance customization, touch/gamepad input, audio, minimap, VFX, and
  Low/Medium/High quality presets.
- Server-authoritative Classic, Flag, Zombie, and Athletics game modes.
- Athletics variants: Classic Athletics, Zeus, Hunters & Runners, and Chaos
  Climb, using the authored Stadium Loop course.
- Standard arena maps: Desert Citadel, Iron Junction, and Temple Runoff.
- Teacher-only Learning Pulse derived from authoritative non-bot answers.
- Teacher-owned Competitions/Tournament Center with study packs, team approval,
  deterministic brackets, official room locking, and result linking.
- Speaking Practice activities with scenario prompts, help, server-side AI
  conversation/transcription/evaluation, bounded session lifetimes, and
  teacher/student result views.

## Production configuration

Server-only Render values:

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
SPEAKING_GEMINI_API_KEY=<server-only secret>
SPEAKING_GEMINI_MODEL=gemini-2.5-flash-lite
SPEAKING_GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash-lite
~~~

Web build values:

~~~text
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
VITE_API_URL=https://gyakuteneigo-api.onrender.com
VITE_ALLOW_PRODUCTION_API_OVERRIDE=true
~~~

Never put database URLs, JWTs, provider keys, Supabase credentials, player
tokens, or private decal bytes in `VITE_*` variables or committed files.
Render starts with:

~~~text
npm start -w @quizstrike/server
~~~

The service runs `prisma migrate deploy` before listening when
`DATABASE_URL` is configured. Do not use `prisma db push` or
`prisma migrate dev` against production.

## Verification

Run from the repository root:

~~~powershell
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
~~~

Use the focused checks when relevant:

~~~powershell
npm run test:load
npm run test:e2e
npm run test:proxy
npm run typecheck:proxy
~~~

The current protocol is version 1; its wire contract is documented in
[`packages/shared/PROTOCOL.md`](packages/shared/PROTOCOL.md). For deployment,
rollback, and classroom smoke testing, use [`HANDOFF.md`](HANDOFF.md). For
boundary ownership and state authority, use [`architecture.md`](architecture.md).

## Documentation

- [System source of truth](SYSTEM.md)
- [Architecture](architecture.md)
- [Developer/operator handoff](HANDOFF.md)
- [Online hosting runbook](docs/online-play.md)
- [Cloudflare proxy runbook](docs/cloudflare-api-proxy.md)
- [Speaking Practice](docs/speaking-practice.md)
- [Production database migration](docs/supabase-database-migration.md)
- [Runtime snapshot migration](docs/runtime-snapshot-migration.md)
- [Teacher library and reports](docs/teacher-library.md)
- [Tournament Center](docs/tournament-center.md)
- [Game rules](docs/game-rules.md)
- [Multiplayer protocol](packages/shared/PROTOCOL.md)
- [Security audit](AUDIT.md)

No repository license is currently declared. Schools should review privacy,
safeguarding, accessibility, retention, and local policy requirements before
classroom deployment.
