# Teacher library and report persistence

Teacher-facing report names use the format `YYYY-MM-DD:HH:MM:Quiz Set Name:JOINCODE`.
The server stores `createdAt` in UTC and formats the display name in UTC so the
same report has a stable name across teachers and deployments. The UI also shows
the browser-local date when listing reports. CSV downloads sanitize the display
name for Windows filenames without changing the stored quiz title.

Each teacher keeps at most 15 reports. The normalized `Report` transaction sorts
by database `createdAt` and then stable `id`, inserts or updates the session
report, and removes only that teacher's oldest excess rows. Report detail is
stored as an immutable JSON snapshot so reports remain readable after a quiz is
renamed, edited, or deleted. The `quizSetId` relation is nullable and uses
`SET NULL`; the report retains `quizSetName` and detail data.

Folders are normalized `Folder` rows with an explicit self-relation and each
quiz set has a nullable `folderId`. The runtime map remains a compatibility
cache during rollout, while folder/report mutations mirror the normalized
repository. `RuntimeSnapshot` is retained for active-session recovery and legacy
fallback; new report snapshots are no longer embedded in it.

Use `npm run db:backfill -- --dry-run` to inspect an existing `RuntimeSnapshot`,
or omit `--dry-run` to upsert supported users, classes, quiz sets, questions,
folders, sessions, players, answers, and reports while preserving the legacy
snapshot. The script preserves stable IDs, validates ownership and references,
logs skipped malformed records, and is safe to rerun.
