# QuizStrike Render PostgreSQL to Supabase Migration

Status: staging rehearsal completed 1 August 2026; production cutover pending.

The 31 July record below reported a completed Supabase cutover. A live Render
configuration recheck on 1 August found that `gyakuteneigo-api` currently points
to Render PostgreSQL, not Supabase. Treat the Render database as production
authority until a new controlled cutover is completed.

## Decision

**STAGING REHEARSAL PASSED; PRODUCTION MIGRATION NOT YET COMPLETED**

The code is compatible with Supabase PostgreSQL. A read-only audit, native
backup, restore into an empty Supabase staging project, exact source/target
verification, full normalized migration chain, backfill, idempotency rerun, and
schema drift check all passed. Production was not modified during this rehearsal.

## Current architecture

- The server is Node.js/Express 5 with Socket.IO 4 and one long-running process.
- Prisma ORM/Client 6.19.3 is the only database library.
- `prisma/schema.prisma` uses PostgreSQL through `DATABASE_URL`.
- `apps/server/src/index.ts` creates one process-wide `PrismaClient`; it does not create a client per request.
- Production startup runs `prisma migrate deploy` before the HTTP/Socket.IO server listens.
- Shutdown flushes pending state and calls `prisma.$disconnect()`.
- Live classroom and game state is held in memory. PostgreSQL is a durable mirror, not the real-time simulation engine.
- Durable application data is one `RuntimeSnapshot` row with id `primary`. Its JSONB document contains teacher accounts (including bcrypt password hashes), classes, quiz sets/questions, sessions/players, and answer logs.
- Writes are coalesced with a one-second timer and serialized through a promise queue.
- Human `player_position` events are broadcast with volatile Socket.IO messages and are not individually written to PostgreSQL.
- Full session broadcasts, bot movement, answers, purchases, combat outcomes, and lifecycle changes can schedule a full JSONB snapshot rewrite, limited to approximately one write per second while busy.
- Process-local socket bindings, timers, throttles, decal bytes, and other temporary maps are not stored in PostgreSQL.

## Database inventory

### Actually migrated by committed SQL

`prisma/migrations/20260711000000_add_runtime_snapshot/migration.sql` creates:

| Table | Purpose | Keys/indexes | Relationships |
| --- | --- | --- | --- |
| `RuntimeSnapshot` | One JSONB document containing all durable runtime state | Primary key on text `id` | None |
| `_prisma_migrations` | Prisma's migration ledger, created/managed by Prisma | Prisma-managed | None |

The live source audit must determine whether any additional tables were created manually or by earlier deployment history.

### Live migration record (31 July 2026)

This subsection is a historical cutover record. The 1 August configuration
recheck supersedes its claim about the current production connection.

- Source: Render PostgreSQL 18.4, 2 application tables, 1 `RuntimeSnapshot` row, 5,056 answer records in the JSONB document, and no custom schemas, triggers, routines, enums, or sequences.
- Backup: `database-backups/quizstrike-render-20260731-095245.dump` (custom-format dump, 392,083 bytes; retained locally under the ignored backup directory).
- Target: Supabase PostgreSQL 17.6 in `ap-southeast-2`; restore completed in one transaction after excluding only the already-managed `public` schema header.
- Verification: source and target table checksums, row counts, columns, indexes, portable constraints, migration ledger, and `RuntimeSnapshot.data` checksum matched. PostgreSQL 18 internal `NOT NULL` catalog rows are compared through portable column nullability because Supabase currently runs PostgreSQL 17.
- Cutover: Render service `gyakuteneigo-api` `DATABASE_URL` was replaced with the tested Supabase session-pooler URL; existing build/start commands and other environment variables were left unchanged. The public health endpoint returned HTTP 200 with `storage: "postgres"` after redeploy.

### Live staging rehearsal (1 August 2026)

- Current production authority: Render PostgreSQL 18.4. The live service
  `DATABASE_URL` resolves to the Render database host.
- Production retention risk: the Render database is scheduled to expire on
  14 August 2026 unless upgraded.
- Backup: `database-backups/quizstrike-render-20260801-224733.dump`, retained
  locally under the ignored backup directory and validated with PostgreSQL 18.4
  tools.
- Target: a separate free Supabase PostgreSQL 17.6 staging project in
  `ap-southeast-2`; Data API exposure is disabled.
- Clone verification: source/target metadata, rows, migration ledger, and logical
  `RuntimeSnapshot` checksum matched exactly before normalization.
- Migration: all four repository migrations applied. Prisma migration status is
  current and the datamodel drift check reports no differences.
- Backfill: dry run, real run, and idempotency rerun passed with 4 users, 0
  classes, 0 folders, 8 quiz sets, 288 questions, 73 sessions, 522 players,
  5,246 answers, and 0 reports; no skips or validation failures.
- Safety: production configuration and data were not modified.

### Declared in Prisma but not used by the running repositories

The schema also declares `User`, `Class`, `QuizSet`, `Question`, `GameSession`, `PlayerSession`, `AnswerLog`, and `RoundLog`, plus `UserRole`, `SessionStatus`, and `Team` enums. These normalized models include:

- unique indexes on `User.email`, `GameSession.sessionCode`, and `(PlayerSession.gameSessionId, PlayerSession.nickname)`;
- cascading teacher, quiz, question, player, answer, round, and session foreign keys;
- `SET NULL` for optional class references;
- JSONB for `GameSession.settingsJson`;
- millisecond timestamps and application-generated CUID text IDs.

There is no committed initial migration for these normalized models. Do not create or populate them as part of this provider migration unless the live source audit proves they already exist. The application reads and writes `RuntimeSnapshot`, not these models.

### Extensions, functions, triggers, and sequences

The committed migration requires no extension, stored procedure, trigger, enum, or sequence. `RuntimeSnapshot.id` is application-supplied text. The live audit script enumerates all of these because the source database may contain objects not represented in Git.

## Compatibility assessment

The repository uses portable PostgreSQL features supported by Supabase: JSONB, text primary keys, timestamps, standard constraints/indexes, enums, and ordinary transactions. IDs are generated in Node, so UUID extensions are not required. No Render hostname, internal URL, Render-specific SQL, raw SQL, prepared statement, database trigger, stored procedure, background database job, or database-specific authentication integration appears in application code.

Supabase Auth, Realtime, Storage, and browser-side database access are out of scope. Existing bcrypt/JWT authentication and Socket.IO remain unchanged.

The main compatibility unknowns are live-only objects, source PostgreSQL version/extensions, and the actual schema/migration ledger. Resolve them with the audit before restoring.

## Storage behaviour and risk

Expected row count is very small because application history lives inside one JSONB value. Database size must still be measured on the source. The audit prints:

- PostgreSQL version and timezone;
- total database and per-table size;
- exact row counts;
- `RuntimeSnapshot` byte size and logical counts for users, classes, quiz sets, sessions, and answers;
- extensions, columns, constraints, indexes, triggers, routines, enums, and sequences.

The material storage risk is write amplification: answer history grows indefinitely inside the JSONB document, and every scheduled persistence operation rewrites the full value. This does not generate position/event rows, but long-term JSONB/TOAST and WAL growth should be monitored. It is not changed during this migration.

## Connection choice

Use the Supabase shared pooler in **session mode (port 5432)** for Render:

```text
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@<REGION>.pooler.supabase.com:5432/postgres?schema=public&sslmode=require&connection_limit=5&pool_timeout=10&application_name=quizstrike
```

Reasons:

- Render runs a persistent Node process, not short-lived serverless functions.
- Session mode works over IPv4 and behaves like a direct PostgreSQL connection.
- The same URL can support Prisma Client and the current startup `prisma migrate deploy`.
- A bounded Prisma pool avoids exhausting a small Supabase project's session pool.
- Transaction mode on port 6543 is unnecessary for the current single-instance, low-query persistence model and would require a separate direct migration URL/configuration.

If Render-to-Supabase IPv6 connectivity is positively tested, Supabase's direct connection is also valid for this long-running backend. Do not guess; test from Render before choosing it.

Only the Render server receives this URL. Do not add it to Vite variables, GitHub Pages settings, source files, or committed `.env` files.

## Prerequisites

1. Install PostgreSQL client tools with the same major version as the Render source (or a newer client version supported by both endpoints): `psql`, `pg_dump`, `pg_restore`.
2. Obtain the Render external connection string and the Supabase session-pooler connection string.
3. URL-encode special characters in passwords.
4. Keep the strings only in the current shell, the ignored `.env.migration.local`, or an approved secret manager.
5. Confirm the Supabase project has no application tables in `public`.
6. Schedule a short maintenance window for the final dump/cutover.

Local setup (placeholders only):

```powershell
Copy-Item .env.migration.example .env.migration.local
```

Open `.env.migration.local` in your editor and replace both placeholder URLs. The file is ignored by Git, neither script prints the URLs, and real credentials must never be pasted into chat. Process environment variables with the same names take precedence if you prefer them.

## Audit

```powershell
npm run db:audit:source
npm run db:target:empty
```

Equivalent direct commands:

```powershell
.\scripts\database\migrate-render-to-supabase.ps1 -Action AuditSource
.\scripts\database\migrate-render-to-supabase.ps1 -Action AssertTargetEmpty
```

Do not continue if the source shows unexpected extensions/objects or the target is not empty.

## Backup and test restore

Create a native custom-format dump. The script keeps credentials in `PGDATABASE`, does not put them in the child process arguments, refuses to overwrite a backup, and validates the archive with `pg_restore --list`.

```powershell
.\scripts\database\migrate-render-to-supabase.ps1 -Action Backup
```

The command prints the exact generated file under ignored `database-backups/`. Restore only that reviewed path:

```powershell
.\scripts\database\migrate-render-to-supabase.ps1 `
  -Action Restore `
  -BackupPath ".\database-backups\quizstrike-render-YYYYMMDD-HHMMSS.dump" `
  -ConfirmTargetRestore
```

Restore uses `--single-transaction` and `--exit-on-error`. It first refuses to proceed if any application table already exists in `public`. It never drops or cleans the source.

For a larger-than-expected database, use Supabase's documented directory-format/parallel restore process from a nearby migration VM instead of the single-file wrapper.

## Verification

```powershell
npm run db:verify
```

Verification compares:

- public table inventory and exact row counts;
- columns, defaults, nullability, and identity state;
- primary, foreign, unique, and check constraints;
- index definitions;
- triggers, public routines, enums, and sequences/current values;
- exact per-table checksums when `--checksums` is enabled;
- exact `RuntimeSnapshot.data::text` checksum and logical record counts.

Differences produce a non-zero exit code. Supabase's extra managed extensions are reported but intentionally not treated as an application-schema mismatch.

Also run on both databases:

```sql
SELECT version();
SELECT pg_size_pretty(pg_database_size(current_database()));
SELECT extname, extversion FROM pg_extension ORDER BY extname;
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

## Test deployment before production

Create a non-production Render service or temporary deployment with the same build/start commands and the target `DATABASE_URL`. Keep production pointed at Render PostgreSQL.

Minimum checks:

1. `/api/health` reports PostgreSQL storage and no startup migration error.
2. Existing teacher login succeeds; dashboard/classes/quizzes load.
3. Create a disposable class, quiz, question, and session.
4. Join two real browser clients, choose teams, start a match, answer correctly/incorrectly, buy gear, fire, score, end, and download the report.
5. Restart the test server and confirm all durable state restores.
6. Run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:load`, and the Playwright classroom flow.
7. Observe Supabase database/pooler logs and Render logs for connection or timeout errors.

The existing 40-client test covers authenticated Socket.IO joins and gameplay commands. It does not replace a physical 40-device classroom test.

### Local validation completed on 30 July 2026

- `npm test`: 140 tests passed (62 shared, 15 server, 63 web).
- `npm run typecheck`: passed for shared, server, web, and Playwright types.
- `npm run build`: production shared/server/web build passed.
- `npm run test:load`: 40 authenticated Socket.IO clients passed; 222 ms connection setup, 123 ms start fan-out, 5 ms reconnect, 41,028-byte largest initial state, movement observed from 39 peers.
- `npm run test:e2e`: the teacher/student customization, reload, and Socket.IO match-start flow passed.

The automated application tests above use in-memory persistence. Live validation additionally covered the native backup/restore, Prisma migration status against Supabase, and the production `/health` endpoint reporting PostgreSQL storage. A full teacher/student production smoke session and a post-cutover process-restart exercise remain recommended follow-ups.

## Final production cutover (pending)

Because QuizStrike has no dual-write or change-data-capture path, a maintenance window is required to prevent writes after the final dump. The following is the required production procedure, not a completed current-state record.

1. A reviewed native backup was created and the source was left untouched.
2. The dump was restored into the empty Supabase project and verified byte-for-byte at the table/JSONB checksum level.
3. Only the Render server `DATABASE_URL` was changed to the tested Supabase session-pooler URL.
4. `JWT_SECRET`, `CLIENT_ORIGIN`, `TRUST_PROXY`, `PORT`, and all Vite variables were left unchanged.
5. Render redeployed successfully; the public health endpoint reports PostgreSQL storage.
6. Keep `gyakuteneigo-db` and the local dump untouched until the recommended post-cutover smoke tests and retention window are complete.

Do not run `prisma migrate dev`, `prisma db push`, or a hand-written normalized schema migration during cutover.

## Rollback

Rollback is safe only while the old database is intentionally retained and before accepting material writes solely on Supabase.

1. Stop the Render web service to prevent more Supabase writes.
2. In Render, restore `DATABASE_URL` to the saved Render PostgreSQL secret.
3. Redeploy/restart.
4. Confirm `/api/health`, teacher login/dashboard, student join, and a saved result.
5. Leave Supabase untouched for diagnosis.

If production writes occurred on Supabase after cutover, switching back creates data loss/split-brain. In that case, keep the service stopped and reconcile/export the new Supabase state before rollback.

## Security

- `.env` and `.env.*` are ignored except sanitized examples.
- `database-backups/` and `*.dump` are ignored.
- The tooling never prints a connection URL or record contents.
- PostgreSQL URLs, passwords, service keys, JWT secrets, and backups must not be committed.
- No Supabase anon/service key is needed.
- No privileged credential belongs in browser JavaScript.

After migration, rotate any credential that was pasted into an insecure terminal, chat, issue, log, or committed file.

## Remaining risks

- The source is PostgreSQL 18.4 and Supabase is PostgreSQL 17.6; the migrated schema uses portable features, but future PostgreSQL-version-specific changes should be tested before deployment.
- The target uses Supabase-managed extensions in addition to the application `plpgsql` extension; they were not required by QuizStrike and were excluded from application-schema equality.
- The committed migration history does not create the normalized Prisma models; the live database remains the authority.
- The single JSONB snapshot has unbounded history and full-document rewrite amplification.
- QuizStrike remains a single-server-instance architecture; this migration does not add distributed state.
- A full teacher/student production smoke test and restart-hydration check are still recommended before deleting the Render database or local backup.
