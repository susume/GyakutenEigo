# QuizStrike Study Sets

## Architecture decision

QuizStrike's existing `QuizSet` model already owns a reusable collection of
questions and is the input to `GameSession`. It is therefore extended as the
Study Set model instead of introducing a second question collection. Existing
rows migrate as `PRIVATE` Study Sets, so existing teacher content is not
published by default.

## Visibility and ownership

- `PRIVATE` Study Sets are returned only when `teacherId` matches the signed-in
  teacher. Unknown or unauthorized IDs return not-found responses.
- `PUBLIC` Study Sets are searchable and previewable by authenticated teachers.
- Public reuse creates a game while retaining original ownership. Editing and
  deletion remain owner-only.
- Duplication creates a new private owner record and cloned questions, with
  `originalSetId` and `originalCreatorId` retained for attribution.
- A published remix displays its current owner as the creator and separately
  shows the original teacher in a `Based on...` attribution. Internal
  provenance IDs and owner folder/class IDs are not returned in public views.
- Public query paths always include `visibility = PUBLIC` and `status = ACTIVE`.

## Game snapshots

`GameSession.questionSnapshotJson` stores the exact question content used when
the room is created. Runtime question selection, answer validation, reports,
and learning views read the session snapshot, so later Study Set edits cannot
change a waiting, active, or historical game.

Snapshot objects are deep enough to detach every question from live authoring
state. QuizStrike-hosted recordings used by an active snapshot cannot be
replaced or deleted; students fetch those recordings with their scoped room
token. Externally hosted audio remains subject to changes at its source.

## Recognition

Contribution values are centralized in `apps/server/src/recognition.ts`.
Events are server-created and idempotent by `eventKey`. Reuse credits are
awarded once per external teacher per Study Set, never for creator self-use.
Completed-game points require an ended game with at least one non-bot student.
Badges are unique per teacher and derived from authoritative event/usage data.
Creation rewards use both a per-set marker and a normalized question-content
fingerprint, preventing deleted/recreated or reordered copies from farming
points. Lifetime profile totals and earned badges remain stable after content
deletion because they are derived from historical contribution events.
Recognition level is derived from total points and does not affect search rank
or student gameplay.

## Migration and indexes

`20260812000000_add_public_study_sets` adds visibility, education metadata,
provenance, counters, immutable game snapshots, usage records, contribution
events, and badges. Existing `QuizSet` rows receive `PRIVATE` and `ACTIVE`
defaults. Search uses database filters, pagination, and indexes on visibility,
metadata, recency, and usage. PostgreSQL trigram indexes support scalable
case-insensitive text search, while the relevance sort prioritizes exact and
prefix title matches before metadata, creator, usage, and recency.

## Remaining follow-ups

- Saved/bookmarked Study Sets are intentionally left as a clean future addition;
  no bookmark table is needed for the current My Sets/Public Library scope.
- Moderation/reporting is not enabled; the `status` field and server validation
  leave room for a later review workflow.
- A future backfill can recompute usage counters from `StudySetUsage` if a
  production repair is ever needed.
