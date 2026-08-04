# Tournament Center MVP

The Tournament Center is a teacher-workspace destination for school-safe QuizStrike competitions. It supports single-elimination events with 2–16 registered teams, using a 2/4/8/16 bracket size and automatic byes.

## Workflow

1. Open **Tournaments** in the existing teacher workspace.
2. Create a draft with tournament details, level, date, registration deadline, sponsor presentation, quiz set, and official match settings.
3. Add sanitized study items and set the release time. The shareable study page and QR code expose only term, pronunciation, meaning, example, note, and order.
4. Publish the draft to open registration. Add teams manually or create a one-use invitation code for another signed-in teacher.
5. Approve registrations, generate the deterministic bracket, and schedule matches.
6. For each match, create a normal QuizStrike teacher session using the tournament quiz set and settings, then attach its room code from Match Control. The server stores a settings snapshot and locks the official match.
7. When the existing session ends, link the result. Scores are read from the server-owned session state, the winner advances, and the existing report remains the source of learning detail.

## Statuses

`DRAFT` → `REGISTRATION_OPEN` → `STUDY_PACK_RELEASED` → `CHECK_IN` → `LIVE` → `COMPLETED`. `CANCELLED` is a terminal administrative state. Unsupported status changes are rejected by the server.

## Data ownership and security

Tournament administration is owner- or admin-authorized. Team managers can check in their own team but cannot edit tournament rules or another team. Public study content is served by a separate sanitized projection and is denied before release. Correct choices, question indexes, teacher notes, invitation storage, and private team manager fields are not included in that projection. Sponsor URLs accept only HTTP(S) destinations and are rendered as restrained text presentation.

The Prisma migration adds `Tournament`, `TournamentStudyPack`, `TournamentStudyItem`, `TournamentTeam`, `TournamentMatch`, and `TournamentAuditEvent` models with owner, quiz-set, and session references. The current runtime orchestration mirrors the existing snapshot persistence boundary so `RuntimeSnapshot(primary)` fallback and protocol-v0 compatibility remain unchanged.

## Bracket and match rules

Bracket generation is deterministic by team creation order and stable team ID. The first round assigns approved teams in pairs; empty opponents become `BYE` matches and known bye winners propagate forward. A winner can only be advanced from a participating match, and a verified result cannot be edited from the browser.

Official room attachment verifies owner, quiz set, supported session settings, and completed-session status before result linking. Match results include the source session ID and optional existing report ID. Learning aggregates are intentionally small; detailed accuracy and missed-material reporting remain in the existing report system.

## MVP limitations and next phase

The MVP does not include public matchmaking, public student accounts, email or push notifications, double elimination, round robin, Swiss, betting, advertising scripts, live tournament sockets, or a separate game runtime. A follow-up can add normalized repository read/write adapters for the new Prisma tables, invited-teacher registration UI, participant-to-team room binding, rescheduling/forfeit controls, and richer report rollups without changing the bracket contract.
