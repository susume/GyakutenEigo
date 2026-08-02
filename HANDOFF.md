# Quiz Strike Development Handoff

Last verified: 2 August 2026 (Asia/Tokyo)
Repository: `main` (architecture and handoff refreshed)
Production cutover validation: deployment 89f4920

## Executive status

Quiz Strike is a working classroom multiplayer product, not a UI-only prototype.
The production web service is healthy and now uses Supabase PostgreSQL. Render
hosts the Node process; the former Render PostgreSQL database has been deleted.

The production cutover is complete:

- Supabase project: Quiz Strike Production, Sydney region, PostgreSQL 17.6.
- Render compute: service 'gyakuteneigo-api', one Node instance.
- Production API: 'https://api.gyakuteneigo.com'.
- Health: '/api/health' returns 'ok: true' and 'storage: postgres'.
- Migrations: all four committed Prisma migrations applied.
- Data: 4 users, 8 quiz sets, 288 questions, 73 sessions, 522 players,
  5,246 answers, 0 reports.
- Final backup: 'database-backups/quizstrike-render-20260801-231819.dump'.
- Old Render database: deleted after zero remaining client connections and checksum
  verification.

Do not put production credentials in this file, chat, source, browser variables,
or a committed environment file.

## Read first

1. [README.md](README.md) for setup and commands.
2. [architecture.md](architecture.md) for authority, persistence, protocol, and
   scaling boundaries.
3. [packages/shared/PROTOCOL.md](packages/shared/PROTOCOL.md) before changing
   Socket.IO events or public/private projections.
4. [docs/supabase-database-migration.md](docs/supabase-database-migration.md)
   before touching production database operations.
5. [docs/quizstrike-monolith-extraction.md](docs/quizstrike-monolith-extraction.md)
   for the completed extraction and validation evidence.

## Repository map

| Path | Use |
| --- | --- |
| 'packages/shared/src/index.ts' | Shared types, settings, map data, deterministic game rules |
| 'packages/shared/src/protocol/' | Canonical versioned protocol schemas and adapters |
| 'apps/server/src/start.ts' | Config load and migration-before-listen startup |
| 'apps/server/src/index.ts' | Server integration/bootstrap |
| 'apps/server/src/runtime.ts' | Composition root, authoritative wiring, lifecycle, and HTTP/socket orchestration |
| 'apps/server/src/routes/' | Focused teacher, quiz, session, player, report, and appearance route modules |
| 'apps/server/src/botRuntime.ts' | Bot decisions, firing, respawn, and bot tick ownership |
| 'apps/server/src/roundRuntime.ts' | Round mutations, transition guards, pending rounds, deadline evaluation, and broadcasts |
| 'apps/server/src/persistence/normalizedLibrary.ts' | Normalized teacher/history/report repository |
| 'apps/server/src/scaling/runtimeInfrastructure.ts' | In-memory store, ownership, event, lease, and lifecycle boundaries |
| 'apps/server/src/appearanceSecurity.ts' | Decal processing and security limits |
| 'apps/server/src/decalStore.ts' | Bounded process-local decal bytes |
| 'apps/web/src/App.tsx' | Route and product composition |
| 'apps/web/src/features/quizstrike/QuizStrikeApp.tsx' | Teacher/student application surface |
| 'apps/web/src/features/multiplayer/connection.ts' | Socket construction and protocol handshake |
| 'apps/web/src/api/client.ts' | API URL selection, auth headers, retries, fallback |
| 'apps/web/src/game/ArenaPreview.tsx' | Three.js scene composition, controls, collision, frame updates, and HUD wiring |
| 'apps/web/src/game/arenaMapBuilder.ts' | Map materials, static geometry, collision proxies, and objective art |
| 'apps/web/src/game/characterSync.ts' | Character lifecycle, player synchronization, VFX/animation subscriptions, and cleanup |
| 'apps/web/src/game/ArenaMinimap.tsx' | Minimap rendering and coordinate presentation |
| 'apps/web/src/game/arenaLoop.ts' | Explicit render-loop start/stop lifecycle |
| 'prisma/schema.prisma' | Current normalized schema and RuntimeSnapshot model |
| 'scripts/database/backfill-runtime-snapshot.mjs' | Idempotent snapshot-to-normalized backfill |

## Local development

Requirements: Node 20.19+ or 22.13+.

~~~powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
docker compose up -d
npm run prisma:migrate
npm run dev
~~~

URLs:

- Web: 'http://localhost:5173'
- API: 'http://localhost:4000'
- Health: 'http://localhost:4000/api/health'
- Adminer: 'http://localhost:8080'

The database is optional for UI/gameplay exploration but required to verify
restart durability and normalized writes. Without 'DATABASE_URL', state is
in-memory only.

## Required verification

~~~powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:load
npm run test:e2e
~~~

The validated baseline is 279 unit tests, the authenticated 40-client load
scenario, the Playwright classroom scenario, and a live local WebGL smoke test.
Lint exits zero with zero errors and zero React Hook dependency warnings. Vite
may report large chunks; use the repository Node version so the Node/Vite
warning is avoided.

For a focused change, run the narrow workspace tests first, then the full suite.
Install Playwright Chromium once when needed:

~~~powershell
npx playwright install chromium
~~~

## Production operator runbook

### Health and deploy

1. In Render, inspect the active deployment logs.
2. Require the datasource line to show the Supabase session-pooler host.
3. Require 'No pending migrations to apply'.
4. Require the restore line for teachers, quiz sets, and sessions.
5. Call 'https://api.gyakuteneigo.com/api/health'.
6. Confirm Supabase migration status, normalized row counts, and checkpoint
   checksum when a database change was involved.

Render start command:

~~~text
npm start -w @quizstrike/server
~~~

The startup path runs 'prisma migrate deploy' before listening. Never use
'prisma db push' or 'prisma migrate dev' on production.

### Backups

The final local backup is ignored by Git and should be retained through at least
one normal production cycle and a review of Supabase backup/retention policy.
A new backup must be created before any future destructive schema or provider
operation. Database credentials belong only in a protected temporary handoff or
secret manager.

### Production data model

Normalized models are authoritative for new durable data:

- User, Class, QuizSet, Question, Folder
- GameSession, PlayerSession, AnswerLog, RoundLog
- Report metadata and immutable detail JSON

'RuntimeSnapshot(primary)' is a recoverable session/answer checkpoint and a
legacy migration source. It is intentionally preserved and must not be dropped
until the compatibility and fallback removal milestone is approved.

### Scaling

Use one server instance and sticky room affinity. Do not add a second replica.
The runtime interfaces are ready for future adapters, but Redis/shared live state,
Socket.IO fan-out, distributed leases, reconnect routing, rate limits, and object
storage are not implemented.

## Current refactor state

The server and arena monolith extraction is complete and is on `main`:

- Route bodies are under `apps/server/src/routes/`.
- `botRuntime.ts` owns bot decisions, firing, respawn, and the bot tick.
- `roundRuntime.ts` owns round mutation, transition execution, and the independent
  round deadline/announcement ticker.
- `ArenaPreview.tsx` composes focused map, character, minimap, and loop modules.
- The render loop has explicit start, stop, and cleanup behavior.
- The React Hook warning baseline went from 38 warnings to zero.
- `runtime.ts` is 1,882 lines; `ArenaPreview.tsx` is 1,479 lines.

The latest extraction evidence is in
[docs/quizstrike-monolith-extraction.md](docs/quizstrike-monolith-extraction.md).

## Change guide

- Game rule or economy: update 'packages/shared' first, then server usage, UI
  copy, and rule tests.
- Socket event: update protocol schemas/types, server validation, client
  handshake/command transport, compatibility behavior, and 'PROTOCOL.md'.
- Persistence: update Prisma schema/migration, normalized repository, snapshot
  hydration/fallback, backfill compatibility, and restart tests.
- Map geometry: update shared bounds/obstacles/spawns and client collision proxies
  before visual shells.
- Appearance/decal: update shared allowlists, server processing/quota/policy,
  store lifecycle, remote rendering, and moderation tests.
- Public data: define an explicit projection and add security tests; never return
  database rows directly.
- Hosting: update Vite build variables, Render runtime variables, CORS origins,
  WebSocket behavior, and this handoff.

## Non-negotiable invariants

1. The server owns outcomes; browsers send intent.
2. Teacher ownership and player-token scope are checked on private operations.
3. Correct choices never appear in student question payloads.
4. Rendered geometry is separate from gameplay collision.
5. Launcher and perk slots remain independent.
6. Decals stay processed, bounded, authenticated, expiring, and out of snapshots.
7. Secrets stay server-only.
8. School-safe terminology and content policy remain intact.
9. A second authoritative instance requires a tested shared runtime design.
10. Migrations are additive/reviewed and deployed with 'prisma migrate deploy'.

## Open work

The production migration and requested monolith extraction are finished.
Remaining work is product/scale work:

- complete physical Chromebook/Edge/integrated-GPU and ten-minute soak
  certification;
- continue decomposing the remaining large `QuizStrikeApp.tsx` UI hub when a
  product boundary makes the next extraction low-risk;
- remove temporary protocol-v0 acceptance and snapshot fallback after a clean
  production cycle;
- implement and test Redis/shared runtime adapters before horizontal scaling;
- decide the final artist-authored GLB/animation asset pipeline;
- review retention, privacy, accessibility, and school operational policy.
