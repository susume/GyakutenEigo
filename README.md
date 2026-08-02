# GyakutenEigo / Quiz Strike

GyakutenEigo is a browser-based English-learning site. Quiz Strike is its live
classroom game: teachers author quizzes and private rooms, while students join
with a code, answer questions, earn in-game currency, and play school-safe team
arena modes.

## Current production state

The production web service is 'gyakuteneigo-api' on Render. Render hosts the
Node.js/Express/Socket.IO process only; production PostgreSQL is the Supabase
project **Quiz Strike Production** in Sydney ('ap-southeast-2'). The former
Render PostgreSQL database was retired after the 1 August 2026 cutover and is no
longer recoverable from Render.

The final validated local backup is retained at:

    database-backups/quizstrike-render-20260801-231819.dump

The backup directory is ignored by Git. Do not move credentials or database
URLs into this repository.

## Repository layout

| Path | Responsibility |
| --- | --- |
| 'apps/web' | React/Vite application, teacher flows, student flows, Three.js arena |
| 'apps/server' | Express API, Socket.IO gateway, authoritative simulation, persistence orchestration |
| 'apps/server/src/routes' | Teacher, quiz, session, player, report, and appearance route modules |
| 'apps/server/src/botRuntime.ts' | Bot decisions, firing, respawn, and the single bot tick |
| 'apps/server/src/roundRuntime.ts' | Round mutation, transitions, deadlines, and round broadcasts |
| 'packages/shared' | Shared types, protocol schemas, validation, map data, deterministic game rules |
| 'prisma' | PostgreSQL schema and committed migrations |
| 'scripts/database' | Auditing, migration, backup, and idempotent snapshot backfill tools |
| 'docs' | Focused feature, map, performance, and migration notes |
| 'architecture.md' | Current system architecture and authority boundaries |
| 'HANDOFF.md' | Current operator/developer handoff and next actions |

## Local setup

Use Node.js 20.19+ or 22.13+. '.nvmrc' selects Node 22.13.

~~~powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
~~~

The local app runs at:

- Web: 'http://localhost:5173'
- API: 'http://localhost:4000'
- Health: 'http://localhost:4000/api/health'
- Development character/map lab: 'http://localhost:5173/character-lab'

For durable local data, start the included PostgreSQL container first:

~~~powershell
docker compose up -d
npm run prisma:migrate
~~~

Without 'DATABASE_URL', the server intentionally uses in-memory persistence and
all classroom data disappears on restart.

## Routes

| Route | Use |
| --- | --- |
| '/' | Public GyakutenEigo landing page |
| '/quiz-strike' | Teacher authentication and dashboard |
| '/join?code=ROOM' | Student room-code entry |
| '/game' | Student arena |
| '/character-lab' | Development-only rendering/performance harness |

The app uses a small History API router; React Router is not installed. Static
hosts must serve 'index.html' for these paths.

## Game and product scope

- Teacher signup/login, classes, quiz sets, question CRUD, folders, reports,
  session creation, join links, and classroom controls.
- Student join/rejoin with private player tokens and classroom-safe nicknames.
- Classic Tag Practice, Flag Mode, and Zombie Mode.
- Server-authoritative movement, damage, health, economy, purchases, objectives,
  rounds, bots, answer rewards, and results.
- Desert Citadel, The Iron Junction, and Temple Runoff maps.
- Starter, Quick, and Heavy Snowball Launchers plus Warm Vest and Speed Boots.
- Shared skinned characters, bounded decals, teacher moderation, touch/gamepad
  input, audio, minimap, VFX pools, and Low/Medium/High quality presets.

## Architecture at a glance

~~~mermaid
flowchart LR
  B[Teacher or student browser] -->|HTTPS / WSS| R[Render Node service]
  R --> S[Authoritative in-memory room engine]
  R --> P[Prisma normalized repositories]
  P --> U[(Supabase PostgreSQL)]
  R --> C[(RuntimeSnapshot checkpoint)]
~~~

The server owns meaningful outcomes. The browser sends intent and may predict
presentation, but it does not decide correctness, damage, money, eliminations,
objectives, round results, or authoritative positions.

Durable teacher and history data are normalized Prisma models. 'RuntimeSnapshot'
with id 'primary' remains a recoverable active-session checkpoint and a legacy
backfill source; it is not the authority for new teacher-library writes.

The current runtime is single-instance. Live sockets, room state, timers, bot
memory, rate limits, and uploaded decal bytes are process-local. Keep one Render
instance and require sticky room affinity. 'RUNTIME_STORE=redis' fails closed in
this build because Redis adapters have not been implemented. The current route,
bot, round, and arena ownership boundaries are documented in
[architecture.md](architecture.md).

The monolith extraction is complete on 'main': 'runtime.ts' and
'ArenaPreview.tsx' remain composition points, while route bodies, bot
orchestration, round flow, map construction, character synchronization,
minimap rendering, and render-loop lifecycle each have focused owners. See
[docs/quizstrike-monolith-extraction.md](docs/quizstrike-monolith-extraction.md)
for the handoff metrics and commit history.

Read [architecture.md](architecture.md) before changing persistence, networking,
collision, combat, or scaling boundaries.

## Production configuration

Server-only values:

~~~text
NODE_ENV=production
NODE_VERSION=22
JWT_SECRET=<long random secret>
DATABASE_URL=<Supabase session-pooler URL>
CLIENT_ORIGIN=https://gyakuteneigo.com,https://www.gyakuteneigo.com,https://susume.github.io
TRUST_PROXY=true
RUNTIME_STORE=in-memory
~~~

Build-time web values:

~~~text
VITE_API_URL=https://api.gyakuteneigo.com
VITE_API_FALLBACK_URL=https://gyakuteneigo-api.onrender.com
VITE_BASE_PATH=/
~~~

Never put 'DATABASE_URL', 'JWT_SECRET', Supabase keys, or private decal data in
'VITE_*' variables or committed files.

Render start-up runs 'prisma migrate deploy' before the server listens. The
Supabase session pooler is used for the long-running Node process. Do not use
'prisma db push' or 'prisma migrate dev' against production.

## Verification commands

Run from the repository root:

~~~powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:load
npm run test:e2e
~~~

The current validated baseline is 277 unit tests, plus the 40-client load
harness and the Playwright classroom scenario. Lint exits cleanly with zero
errors and zero React Hook dependency warnings. Build warnings about Node
version or large Vite chunks are non-fatal; use the declared Node version for
hosted builds.

Database tools:

~~~powershell
npm run prisma:validate
npm run prisma:deploy
npm run db:backfill -- --dry-run
npm run db:verify
~~~

The production cutover and backup record is documented in
[docs/supabase-database-migration.md](docs/supabase-database-migration.md).

## Safety rules

1. Keep game authority on the server and deterministic shared rules in
   'packages/shared'.
2. Keep rendered meshes separate from client/server collision proxies.
3. Keep launcher and perk slots independent.
4. Never include a question's correct choice in a student question payload.
5. Check teacher ownership and player tokens on every private operation.
6. Keep decal bytes bounded, authenticated, expiring, and out of snapshots.
7. Use only school-safe language: snow tags, snowball launchers, warmth, gear,
   arena, Blue Team, and Red Team. Do not add gore, realistic weapon branding,
   public matchmaking, public chat, voice chat, or copied Counter-Strike content.

## Documentation index

- [Architecture](architecture.md)
- [Development handoff](HANDOFF.md)
- [Monolith extraction report](docs/quizstrike-monolith-extraction.md)
- [Production database migration](docs/supabase-database-migration.md)
- [Runtime snapshot migration](docs/runtime-snapshot-migration.md)
- [Teacher library and reports](docs/teacher-library.md)
- [Online hosting runbook](docs/online-play.md)
- [Protocol contract](packages/shared/PROTOCOL.md)
- [Phases 7-10 implementation report](docs/phases-7-10-implementation-report.md)
- [Chromebook certification matrix](docs/performance/CHROMEBOOK_CERTIFICATION.md)
- [Security audit](AUDIT.md)

Schools should review privacy, safeguarding, accessibility, retention, and local
policy requirements before classroom deployment.
