# RuntimeSnapshot migration map

| Snapshot field | Phase 5 destination | Authority during rollout |
| --- | --- | --- |
| `users`, `classes`, `quizSets`, `questions` | Existing normalized Prisma models | Runtime cache mirrors normalized writes |
| `folders` | `Folder` plus `QuizSet.folderId` | Normalized mutation service, runtime cache for active UI |
| `reports` | `Report` metadata plus `detailJson` | Normalized report repository; legacy snapshot read fallback |
| `sessions`, players, answers | Existing `GameSession`, `PlayerSession`, and `AnswerLog` models | Runtime state remains authoritative for live simulation |
| round/objective state | Session runtime state | Not written every frame |
| transforms, velocity, sockets, timers, streaks | Ephemeral runtime memory | Never persisted per frame |

`scripts/database/backfill-runtime-snapshot.mjs` is idempotent and preserves
unknown snapshot fields by leaving `RuntimeSnapshot` untouched. It reports
counts and skips malformed or cross-owner records instead of silently coercing
them into another teacher's data. The migration is additive and does not reset
or delete production data.
