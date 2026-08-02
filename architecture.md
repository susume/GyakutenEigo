# Quiz Strike Architecture

Last verified: 1 August 2026 (Asia/Tokyo)
Repository baseline: main at dd2f131
Production cutover validation: 1 August 2026, deployment 89f4920

## 1. System boundary

Quiz Strike is a private classroom game inside GyakutenEigo. A teacher manages
quizzes and rooms. Students join with a code, answer questions, earn currency,
buy school-safe gear, and play live team modes.

Production has two hosting responsibilities:

- GitHub Pages/static hosting serves the React/Vite web bundle.
- Render runs one Node.js/Express/Socket.IO service.
- Supabase PostgreSQL stores durable teacher, quiz, history, report, and
  recoverable-checkpoint data.

The retired Render PostgreSQL database is not part of the production topology.

~~~mermaid
flowchart LR
  T[Teacher browser] -->|HTTPS / WSS| W[Static React/Vite web app]
  S[Student browser] -->|HTTPS / WSS| W
  W --> R[Render Node service]
  R --> E[Authoritative room engine]
  R --> N[Normalized Prisma repositories]
  N --> P[(Supabase PostgreSQL)]
  R --> C[(RuntimeSnapshot checkpoint)]
~~~

The public production endpoints are:

| Purpose | Address |
| --- | --- |
| Public site | 'https://www.gyakuteneigo.com' |
| Apex redirect/entry | 'https://gyakuteneigo.com' |
| Primary API and Socket.IO | 'https://api.gyakuteneigo.com' |
| Hosted API fallback | 'https://gyakuteneigo-api.onrender.com' |

## 2. Workspace boundaries

| Area | Owns | Entry points |
| --- | --- | --- |
| 'packages/shared' | Domain types, protocol schemas, sanitizers, map metadata, collision and deterministic rules | 'packages/shared/src/index.ts', 'packages/shared/src/protocol/' |
| 'apps/server' | Auth, HTTP, Socket.IO, room engine, bots, authority, normalized persistence, checkpointing | 'apps/server/src/start.ts', 'apps/server/src/index.ts', 'apps/server/src/runtime.ts' |
| 'apps/web' | Routes, teacher UI, student lifecycle, Three.js scene, controls, HUD, reports | 'apps/web/src/App.tsx', 'apps/web/src/features/quizstrike/QuizStrikeApp.tsx', 'apps/web/src/game/ArenaPreview.tsx' |
| 'prisma' | PostgreSQL schema and migrations | 'prisma/schema.prisma', 'prisma/migrations/' |
| 'scripts/database' | Audit, backup, restore, backfill, and reconciliation tooling | 'scripts/database/' |

'App.tsx' and the server 'index.ts' are integration hubs. Add new rules to
focused modules or 'packages/shared' rather than growing either hub casually.

## 3. Browser application

The custom History API router exposes:

| Route | Use |
| --- | --- |
| '/' | Public landing |
| '/quiz-strike' | Teacher auth and dashboard |
| '/join?code=ROOM' | Student join |
| '/game' | Student arena |
| '/character-lab' | Development-only harness |

Teacher JWTs live in browser local storage. Student rejoin credentials and
appearance preferences use separate local-storage keys. Server authentication is
still required for all private operations.

The web client:

1. Selects a primary API URL and may use a network-failure fallback.
2. Authenticates a teacher or obtains a private student player token.
3. Opens Socket.IO and completes the protocol hello/join flow.
4. Sends compact authenticated intents and receives authoritative snapshots,
   focused state changes, deltas, and presentation events.
5. Keeps camera, prediction, rendering, touch/gamepad controls, and UI local.

The browser never calculates authoritative rewards, health, damage, purchases,
eliminations, objective outcomes, or final positions.

## 4. Shared domain kernel and protocol

'packages/shared/src/index.ts' exports domain types and deterministic rules for:

- sessions, players, quizzes, reports, appearances, maps, teams, and modes;
- session setting sanitization and nickname/player safety checks;
- authoritative movement limits, projectile cover, line of sight, gear, economy,
  and cooldown rules;
- Flag, Zombie, Classic Tag Practice, round, respawn, bot, scoreboard, and CSV
  report behavior.

The canonical protocol lives in 'packages/shared/src/protocol/':

- protocol version 1 is the supported canonical range;
- Zod schemas reject unknown fields, invalid ranges, oversized messages, and
  malformed event payloads;
- Socket.IO handshake is hello, version admission, authenticated room join, and
  validated state;
- one-time event IDs and bounded deduplication protect flag/streak events;
- a temporary server-only version-0 adapter preserves compatibility with older
  clients during rollout.

Update 'packages/shared/PROTOCOL.md' whenever an event, version, or projection
changes.

## 5. Server authority and lifecycle

The server owns:

- teacher authentication and ownership checks;
- classroom authoring and private session operations;
- room membership, tokens, connection bindings, and reconnect handling;
- authoritative movement, firing, damage, health, economy, objectives, rounds,
  bots, quiz correctness, rewards, and reports;
- bounded decal storage and lifecycle cleanup;
- shutdown drain, lease release, checkpoint flush, and Prisma disconnect.

High-frequency movement is broadcast as volatile/batched deltas. State-changing
commands use acknowledged Socket.IO paths when connected and authenticated HTTP
fallbacks where supported. Durable writes are coalesced where safe; authoritative
outcomes are never accepted from client-provided results.

## 6. Persistence authority

The production database is Supabase PostgreSQL 17.6 in Sydney, accessed through
the session pooler. Prisma applies committed migrations at process startup.

| Data | Current authority | Notes |
| --- | --- | --- |
| 'User', 'Class' | Normalized Prisma rows | Teacher data is restored from these rows first |
| 'QuizSet', 'Question', 'Folder' | Normalized Prisma rows | Folder ownership/cycle rules are enforced in service and SQL |
| 'GameSession', 'PlayerSession' | Normalized rows plus live room state | Session labels/settings are retained for history |
| 'AnswerLog', 'RoundLog' | Normalized history | Answer prompt/correct-choice context is immutable |
| 'Report' | Normalized metadata and immutable detail JSON | Per-teacher retention is transactionally enforced |
| 'RuntimeSnapshot(primary)' | Recoverable checkpoint and legacy migration source | New teacher-library fields are not dual-written into it |

Startup loads the snapshot and normalized teacher data in parallel. Normalized
rows are authoritative for durable teacher data; snapshot rows are fallback only
when a corresponding normalized record is absent. Active sessions are hydrated
into the in-memory room engine.

Teacher/library mutations call 'NormalizedLibrary'. Session, player, answer, and
report writes mirror into normalized repositories while the checkpoint preserves
recoverable session/answer compatibility. Uploaded decal bytes are not in the
database: they live in a bounded process-local store and expire.

The migration chain is:

1. '20260711000000_add_runtime_snapshot'
2. '20260801000000_add_teacher_library'
3. '20260801010000_harden_normalized_history'
4. '20260801020000_align_report_updated_at'

The production cutover applied all four migrations. Do not use 'db push' against
production.

## 7. Runtime and scaling model

The current deployment is one Render Node instance with sticky room affinity.
The following remain process-local:

- live room/session state and socket bindings;
- timers, bot memory, rate limits, request deduplication, and leases;
- event bus and join-code directory adapters;
- uploaded decal bytes.

The code exposes 'RoomStateStore', 'JoinCodeDirectory', 'RealtimeEventBus',
'RoomOwnershipStore', 'IdempotentEventConsumer', and 'LifecycleTimers' to make
future adapters explicit. Their current implementations are in-memory. Redis is
not implemented and 'RUNTIME_STORE=redis' fails startup.

Do not add a second authoritative instance until shared live state, Socket.IO
fan-out, leases/fencing, join-code lookup, reconnect routing, rate limits, and
object storage have real adapters and two-instance tests.

~~~mermaid
flowchart TB
  L[Sticky load balancer] --> A[One Render Node instance]
  A --> M[In-memory room engine and lifecycle]
  A --> P[Supabase PostgreSQL]
  A --> D[Process-local bounded decal store]
~~~

## 8. Security and authority invariants

1. Accept client intent, never client-calculated outcomes.
2. Keep shared rules in 'packages/shared'.
3. Verify teacher ownership on every teacher-private operation.
4. Require the scoped student player token for student-private HTTP/socket work.
5. Never expose correct choices in public student question payloads.
6. Keep rendered meshes separate from server/client collision proxies.
7. Keep launcher and perk slots independent.
8. Keep decal uploads processed, bounded, authenticated, expiring, and absent from
   snapshots.
9. Keep JWT/database/provider secrets server-only.
10. Preserve school-safe terminology and prohibit gore, realistic weapon branding,
    public matchmaking, public chat, voice chat, and copied Counter-Strike content.

## 9. Configuration and startup

Important server variables:

| Variable | Required | Default / rule |
| --- | --- | --- |
| 'NODE_ENV' | production | production enables strict secret checks |
| 'JWT_SECRET' | production | must not be the local development fallback |
| 'DATABASE_URL' | production durability | Supabase PostgreSQL URL |
| 'CLIENT_ORIGIN' | hosted browser access | comma-separated allowed origins |
| 'TRUST_PROXY' | hosted proxy | normally 'true' behind Render |
| 'RUNTIME_STORE' | optional | only 'in-memory' is supported |
| 'INSTANCE_ID' | optional | random UUID when omitted |
| 'ROOM_LEASE_MS' | optional | 15 seconds by default |
| 'ROOM_LEASE_RENEW_MS' | optional | 5 seconds by default |
| 'SHUTDOWN_TIMEOUT_MS' | optional | 10 seconds by default |

On start, 'apps/server/src/start.ts' loads configuration, runs 'prisma migrate
deploy' when 'DATABASE_URL' exists, then imports the server. A migration failure
stops startup.

## 10. Deployment and operations

Production deploy shape:

- GitHub Actions builds/deploys the static web bundle.
- Render builds shared/server packages and runs 'npm start -w
  @quizstrike/server'.
- The server connects to Supabase through the session pooler.
- Health is available at '/health' and '/api/health'.

Operational checks:

1. Check Render logs for the Supabase pooler host and 'No pending migrations to
   apply'.
2. Confirm restoration counts and a live 'Your service is live' event.
3. Call '/api/health' and require 'ok: true' and 'storage: postgres'.
4. Check Supabase counts, migration ledger, and snapshot checksum after any
   migration/backfill.
5. Keep the final backup until Supabase backup/retention policy and one normal
   production cycle are reviewed.

## 11. Verification and architecture debt

Run:

~~~powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:load
npm run test:e2e
~~~

The current validated baseline is 276 unit tests, 40 authenticated load clients,
and one Playwright classroom scenario. Physical Chromebook/Edge, integrated-GPU,
GPU-memory, and ten-minute soak certification remain open.

The main remaining engineering debt is deliberate:

- 'apps/server/src/runtime.ts' and 'apps/web/src/features/quizstrike/QuizStrikeApp.tsx'
  remain large integration modules;
- Redis/distributed runtime adapters are not implemented;
- cross-instance reconnect, failover, and Socket.IO fan-out are unsupported;
- decal/object storage is process-local;
- the v0 compatibility adapter and legacy snapshot fallback require a removal
  milestone after a clean production cycle;
- code-authored art remains separate from final artist-authored GLB/animation
  production.
