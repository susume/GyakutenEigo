# QuizStrike phases 7-10 implementation report

Date: 2026-08-01 (Asia/Tokyo)

## 1. Starting repository state

Phase 1-6 gameplay and teacher features were present and passing: locomotion,
flag event/deadline snapshots, freeze streaks, the bounded announcement manager,
late join/reconnect snapshots, report naming/deletion/15-item retention, export
filenames, folders, quiz moves/deletion guards, and ownership checks.

Phase 5-6 architecture was partial. `index.ts` and `App.tsx` were thin entry
shims, and `Folder`/`Report` models plus a backfill script existed, but sockets
were unversioned/unvalidated, normalized teacher data could not restore without
the blob, several question/user/history writes were snapshot-only, both durable
and recoverable data were still dual-written, configuration was scattered, and
runtime coordination was direct process-local state.

## 2. Phase 7: protocol

- Canonical location: `packages/shared/src/protocol`.
- Version: 1; supported canonical range 1-1.
- Handshake: `client_hello` → validated version → `server_hello` → authenticated
  `join_session_room` → validated `session_state`.
- Runtime validator: Zod 4, strict schemas, finite/ranged numbers, bounded IDs,
  choices, unexpected-field rejection, 16-KiB command limit, safe errors.
- Unions: canonical `ClientCommand` and `ServerEvent`; stable `type` values match
  Socket.IO event discriminators.
- Compatibility: inferred unversioned version 0 only. Its isolated adapter strips
  repeated credentials from already-bound movement/fire/flag messages. Explicit
  unsupported versions fail and disconnect.
- Event IDs: UUIDs for flag/streak one-time events; client 128-entry/two-minute
  cache; distributed 512-entry/five-minute cache.
- Timestamps: authoritative Unix epoch milliseconds for protocol clock/events.
- Documentation: `packages/shared/PROTOCOL.md` fully replaced with live behavior,
  examples, errors, compatibility, deprecations, and deployment order.
- Tests cover valid/invalid/oversized messages, version admission, serialization,
  timestamp ordering, snapshot validation, legacy adaptation, and deduplication.

## 3. Phase 8: persistence

- `RuntimeSnapshot` now writes recoverable sessions/answer compatibility only.
  Durable teacher fields are normalized-authority with isolated fallback reads.
- Startup loads `User`, `Class`, `QuizSet`/`Question`, and `Folder` from Prisma,
  then fills only missing pre-backfill rows from the legacy snapshot.
- `NormalizedLibrary` owns teacher-scoped user/folder/quiz/question/report/session,
  participant, and answer operations. Teacher library mutations await Prisma.
- Report retention uses serializable isolation plus a PostgreSQL advisory
  transaction lock per teacher and deterministic `(createdAt,id)` ordering.
- Folders have service checks plus database self-parent, same-owner, cycle,
  root-aware sibling-name, and restrictive-delete rules.
- Reports keep immutable detail JSON/name. Sessions capture quiz names. Answers
  capture prompt/correct choice; quiz/question deletion uses `SET NULL`.
- Backfill supports dry-run validation counts, duplicates/failures, stable-ID
  upserts, restart-safe reruns, ownership checks, and `--batch-size` reporting.
- The legacy snapshot remains available for rollback until production counts are
  reconciled. It is not deleted by the migration.

## 4. Phase 9: modularization

- `index.ts` remains a minimal stable server entry and `App.tsx` a minimal stable
  client feature entry.
- New server boundaries: validated config, protocol gateway, normalized library,
  and scaling/runtime infrastructure.
- New client boundary: multiplayer socket construction, hello/join lifecycle,
  version validation, and protocol-error forwarding.
- Raw command validation has one server boundary; socket creation/handshake is no
  longer duplicated by teacher and student React effects.
- Bot/cleanup/lease timers are owned by `LifecycleTimers`; disconnect and
  coalescing timers have explicit shutdown cleanup.
- Runtime environment access is centralized in `config.ts` except the bootstrap
  process environment passed to Prisma migration.
- A static production-module graph check found no runtime dependency cycles.

The large `runtime.ts` and `QuizStrikeApp.tsx` retain cohesive existing gameplay
and page implementation respectively. They were not broadly rewritten; further
feature extraction remains follow-up work.

## 5. Phase 10: scaling foundation

- Interfaces/adapters: `RoomStateStore`, `JoinCodeDirectory`,
  `RealtimeEventBus`, `RoomOwnershipStore`, `IdempotentEventConsumer`, and
  `LifecycleTimers`, with tested in-memory implementations.
- Normal execution uses the interfaces; no WebSocket, function, Three.js object,
  or timer handle enters shared/recoverable state.
- Rooms acquire renewable leases with fencing tokens. Only owned rooms run bot
  simulation/timer conclusions. Ownership uncertainty pauses processing.
- One-time flag/streak events publish through the event bus and are idempotent.
- Join codes reserve case-insensitively through the directory abstraction.
- Reconnect tokens remain signed/scoped player JWTs. Cross-instance reconnect is
  not implemented; sticky room affinity is mandatory.
- Graceful shutdown drains new work, clears timers, releases leases, flushes the
  checkpoint queue, closes event subscriptions/sockets/HTTP/Prisma, and has a
  bounded force-exit timeout.
- Redis status: deferred. `RUNTIME_STORE=redis` fails startup clearly. No claim of
  multi-instance production support is made.

## 6. Important files changed

Created:

- `packages/shared/src/protocol/*`
- `apps/server/src/realtime/protocolGateway.ts`
- `apps/server/src/scaling/runtimeInfrastructure.ts`
- `apps/server/src/config.ts`
- `apps/web/src/features/multiplayer/connection.ts`
- `prisma/migrations/20260801010000_harden_normalized_history/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `docs/phases-7-10-architecture.md`
- this report

Modified:

- `apps/server/src/runtime.ts`
- `apps/server/src/persistence/normalizedLibrary.ts`
- `apps/server/src/networkMetrics.ts`
- `apps/server/src/start.ts`
- `apps/web/src/features/quizstrike/QuizStrikeApp.tsx`
- `apps/web/src/game/GameplayAnnouncements.ts`
- `packages/shared/src/index.ts`, `packages/shared/PROTOCOL.md`
- `prisma/schema.prisma`, backfill/database docs, README, `.env.example`
- workspace package metadata/lockfile for Zod

No files were moved or removed.

## 7. Database and migration changes

- Added quiz-set JSON settings column for forward-compatible normalized metadata.
- Added immutable session quiz name and answer prompt/correct-choice snapshots.
- Made session/question authoring relations optional with `ON DELETE SET NULL`.
- Added report `updatedAt` and deterministic report-list index.
- Added teacher/status session index.
- Hardened folder parent deletion, self-parenting, root sibling uniqueness,
  cross-teacher parenting, and recursive cycles.
- Rollback: application code can continue reading the preserved snapshot; do not
  drop newly added columns during rollback. Disable the trigger only after
  restoring equivalent service enforcement. Back up before migration.

The older teacher-library migration initially assumed that the normalized tables
already existed. The migration was repaired to establish the complete normalized
baseline, then the full four-migration chain was rehearsed successfully against a
production clone in a separate Supabase PostgreSQL 17.6 staging project. Prisma
reports the database up to date and a schema diff against `schema.prisma` reports
no drift.

## 8. Configuration

| Variable | Required | Default | Example | Production implication |
| --- | --- | --- | --- | --- |
| `RUNTIME_STORE` | optional | `in-memory` | `in-memory` | Redis is rejected in this build |
| `INSTANCE_ID` | optional | random UUID | `quizstrike-a` | useful stable log identity |
| `ROOM_LEASE_MS` | optional | `15000` | `15000` | authority lease duration |
| `ROOM_LEASE_RENEW_MS` | optional | `5000` | `5000` | must be below lease duration |
| `SHUTDOWN_TIMEOUT_MS` | optional | `10000` | `10000` | bounded drain window |
| `VITE_APP_VERSION` | optional | omitted | `0.1.0` | advertised build label |

Existing `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PORT`, `TRUST_PROXY`,
and network-debug variables remain unchanged.

## 9. Tests and validation

- `npm test`: pass, 89 shared + 46 server + 141 web = **276 tests**.
- `npm run test:load`: pass, 40 authenticated sockets, 39 movement senders,
  one movement batch, largest initial state 38,535 bytes.
- `npm run test:e2e`: pass, 1 Playwright classroom scenario.
- `npm run typecheck`: pass for shared/server/web/e2e TypeScript configs.
- `npm run build`: pass for shared/server/web; the current local Node 20.16 runtime
  and two chunks over 500 KiB produce warnings but no build failure. The project
  now declares Node 20.19+ or 22.13+ and supplies a Node 22.13 `.nvmrc`.
- `prisma format --check`, `prisma validate`, `prisma generate`: pass using an
  explicit non-secret local-format URL.
- Static runtime dependency-cycle check: pass for 78 production TypeScript
  modules. `npx madge` itself could not run because the local npm global path is
  absent, so a read-only relative-import DFS check was used.
- `npm run lint`: pass with zero errors. ESLint 9, TypeScript, and React Hooks
  rules are configured; 31 existing hook-dependency warnings remain visible for
  deliberate component refactoring rather than unsafe mechanical edits.
- `npm audit --omit=dev`: pass with zero known vulnerabilities after the
  package-manager-recommended PostCSS patch update.
- Supabase staging rehearsal: a verified native backup of the live Render
  PostgreSQL 18.4 database was restored into an empty Supabase PostgreSQL 17.6
  project. Source/target schema, ledger, row counts, and `RuntimeSnapshot`
  checksum matched before normalization.
- Backfill dry run, real run, and idempotency rerun: pass with 4 users, 0
  classes, 0 folders, 8 quiz sets, 288 questions, 73 sessions, 522 players,
  5,246 answers, and 0 reports; no malformed, duplicate, ownership, or validation
  failures. The optimized real run took 140 seconds and the rerun 137.2 seconds.
- Post-backfill reconciliation and Prisma schema drift check: pass. Production
  remained pointed at its Render database and was not changed.
- Redis integration/multi-instance tests: not run; no Redis adapter is claimed.
- Manual physical multiplayer/Chromebook test: not run. Automated Socket.IO load
  and Playwright classroom flows passed.

## 10. Deployment instructions

1. Preserve the verified production backup and the rehearsed Supabase staging
   project until production cutover is complete.
2. Schedule a maintenance window and take a new final production backup.
3. Restore/verify the final source state, deploy the rehearsed migrations, then
   run dry-run, real backfill, count reconciliation, and an idempotency rerun.
4. Deploy the compatibility server (v1 plus inferred-v0 adapter).
5. Deploy the v1 browser and verify handshake/error/reconnect telemetry.
6. Keep `RUNTIME_STORE=in-memory`; configure room-affine sticky routing.
7. Validate teacher CRUD, report retention/history, 40-player movement, flag,
   streak, match completion, and graceful SIGTERM.
8. Provision Redis only with a future tested adapter release.
9. Remove version-0 and legacy snapshot reads after a verified production cycle.

## 11. Remaining limitations

- The implementation is a safe single-instance foundation, not production
  horizontal scaling. Redis pub/sub/store/lease adapters do not exist yet.
- Cross-instance reconnect, command forwarding, socket fan-out, join-code lookup,
  and failover recovery are untested and unsupported.
- Sticky room affinity is required. In-memory leases cannot coordinate separate
  operating-system processes.
- The staging rehearsal is complete, but the equivalent production migration and
  backfill have not been run. A maintenance window is required because there is
  no dual-write or change-data-capture path.
- A live environment recheck on 1 August 2026 found the Render service still
  points to Render PostgreSQL. That database is scheduled to expire on 14 August
  2026 unless upgraded, so the production cutover remains time-sensitive.
- `runtime.ts` and `QuizStrikeApp.tsx` remain large feature implementations.
- Vite warns that local Node 20.16 is below its preferred 20.19 and that two
  generated chunks exceed 500 KiB.
- The temporary inferred-v0 protocol adapter is compatibility debt with an
  explicit removal milestone.
