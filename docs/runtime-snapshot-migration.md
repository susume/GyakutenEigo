# RuntimeSnapshot migration map

| Snapshot field | Phase 5 destination | Authority during rollout |
| --- | --- | --- |
| `users`, `classes`, `quizSets`, `questions` | Existing normalized Prisma models | Prisma authority; legacy snapshot fallback read only |
| `folders` | `Folder` plus `QuizSet.folderId` | Prisma authority; runtime cache for active UI |
| `reports` | `Report` metadata plus `detailJson` | Normalized report repository; legacy snapshot read fallback only |
| `sessions`, players, answers | Existing normalized history plus `RoomStateStore` | Room owner is authoritative live; checkpoint snapshot supports recovery |
| round/objective state | Session runtime state | Not written every frame |
| transforms, velocity, sockets, timers, streaks | Ephemeral runtime memory | Never persisted per frame |

`scripts/database/backfill-runtime-snapshot.mjs` is idempotent and preserves
unknown snapshot fields by leaving `RuntimeSnapshot` untouched. It reports
counts and skips malformed or cross-owner records instead of silently coercing
them into another teacher's data. The migration is additive and does not reset
or delete production data. New snapshot writes contain only recoverable session
and answer compatibility data; durable teacher-library fields are not dual-written.

## Staging rehearsal (1 August 2026)

The migration was rehearsed on a separate Supabase PostgreSQL 17.6 project made
from a verified native backup of the live Render PostgreSQL 18.4 database. The
full migration chain, dry run, real backfill, and idempotency rerun passed. Final
normalized counts were 4 users, 0 classes, 0 folders, 8 quiz sets, 288 questions,
73 sessions, 522 players, 5,246 answers, and 0 reports, with no skipped or failed
records. The legacy `RuntimeSnapshot` remained unchanged, count reconciliation
passed, and Prisma reported no schema drift.

This rehearsal was followed by the production cutover on 1 August 2026. The
Render web service now uses the Supabase session pooler. Startup restored all 4
teachers, 8 quiz sets, and 73 sessions; health and post-cutover count checks
passed. The retired Render database was deleted only after its final checksum was
matched to the validated local backup.
