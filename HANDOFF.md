# QuizStrike development and operations handoff

Last verified: 11 August 2026
Repository: `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo`
Branch: `main`

This handoff describes the current implementation and deployment boundaries.
Read [`architecture.md`](architecture.md) for the deeper authority model and
[`docs/online-play.md`](docs/online-play.md) for the release runbook.

## Current status

QuizStrike is a live classroom browser game with:

- teacher signup/login, classes, folders, quiz-set authoring, question audio,
  reports, session history, join links, and QR invites;
- student join/rejoin using room-scoped player tokens;
- Classic Tag, Flag, and Zombie modes;
- Desert Citadel, The Iron Junction, and Temple Runoff arenas;
- server-authoritative movement acceptance, combat, health, respawns, teams,
  rounds, objectives, bots, quiz correctness, rewards, purchases, and reports;
- Starter, Quick, and Heavy Snowball Launchers plus Warm Vest and Speed Boots;
- answer-driven money, snowball packs, freeze streak announcements, dead-player
  practice, and mode-specific round phases;
- shared character models, accessories, footwear, poses, bounded decals, audio,
  VFX, minimap, touch/gamepad input, and quality settings;
- teacher read-only Spectator View that changes the local camera target only;
- owner-only teacher attention pause/resume with room-scoped timer shifting and
  reconnect-safe state;
- teacher-only Learning Pulse derived from authoritative current-session
  answers, with bot exclusion, deduplication, caching, and no student exposure;
- a public Competition platform and a teacher-owned Tournament Center with
  study packs, invitations, approval/check-in, brackets, official room locking,
  and server-verified result linking;
- normalized Prisma persistence in Supabase PostgreSQL, with a recoverable
  `RuntimeSnapshot` checkpoint for active/legacy state.

The current hosted design is deliberately single-instance. Do not scale the
Render service horizontally until the shared-runtime work listed below is
complete.

## Production facts

| Item | Current value |
| --- | --- |
| Static web | GitHub Pages with custom-domain support |
| Web origin | `https://www.gyakuteneigo.com` / custom-domain aliases configured in the deployment workflow |
| API and Socket.IO | `https://api.gyakuteneigo.com` |
| Render fallback | `https://gyakuteneigo-api.onrender.com` |
| Render service | `gyakuteneigo-api`, one Node instance |
| Database | Supabase project `Quiz Strike Production`, Sydney (`ap-southeast-2`) |
| Database access | Private server-side Prisma connection using the Supabase session pooler |
| Runtime store | `in-memory` only |
| Required hosted Node | 20.19+ or 22.13+; CI and Pages use Node 22 |
| Health endpoint | `GET https://api.gyakuteneigo.com/api/health` |

The former Render PostgreSQL database is retired. Do not point production at
the old Render database or reintroduce its connection string. Keep production
database credentials out of Git and out of all `VITE_*` variables.

## Local setup

Use Node 20.19+ or 22.13+. The repository `.nvmrc` selects Node 22.13.

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
```

Local URLs:

- web: `http://localhost:5173`;
- API: `http://localhost:4000`;
- health: `http://localhost:4000/api/health`;
- character/map lab: `http://localhost:5173/character-lab`.

For durable local state, start PostgreSQL and apply migrations:

```powershell
docker compose up -d
npm run prisma:migrate
```

Without `DATABASE_URL`, the server intentionally uses in-memory persistence.
That is useful for UI work but all teachers, quiz data, sessions, and reports
disappear on restart. `apps/server/src/start.ts` runs
`prisma migrate deploy` before listening whenever `DATABASE_URL` is present.

Important environment variables:

```text
DATABASE_URL=server-only PostgreSQL URL
JWT_SECRET=long random production secret
PORT=4000
CLIENT_ORIGIN=comma-separated allowed browser origins
TRUST_PROXY=true in Render
RUNTIME_STORE=in-memory
INSTANCE_ID=optional process identifier
ROOM_LEASE_MS=15000
ROOM_LEASE_RENEW_MS=5000
VITE_API_URL=http://localhost:4000
VITE_API_FALLBACK_URL=optional
VITE_BASE_PATH=/
```

`RUNTIME_STORE` rejects any value other than `in-memory`. This is intentional,
not a missing configuration.

## Repository ownership map

| Area | Start here |
| --- | --- |
| Product routing and teacher/student screens | `apps/web/src/features/quizstrike/QuizStrikeApp.tsx` |
| API/fallback transport | `apps/web/src/api/client.ts`, `studentCommandTransport.ts` |
| Socket handshake and room binding | `apps/web/src/features/multiplayer/connection.ts`, `apps/server/src/realtime/protocolGateway.ts` |
| Server composition | `apps/server/src/runtime.ts` |
| Teacher/session HTTP routes | `apps/server/src/routes/teacherLibrary.ts`, `quizSets.ts`, `questions.ts`, `sessionRoutes.ts`, `reports.ts` |
| Student HTTP routes | `apps/server/src/routes/playerRoutes.ts`, `appearanceRoutes.ts` |
| Live mutation | `apps/server/src/runtime.ts` handlers plus `combat.ts`, `roundFlow.ts`, `roundRuntime.ts` |
| Bots | `botRuntime.ts`, `botAI.ts`, `botNavigation.ts` |
| Persistence | `persistence/normalizedLibrary.ts`, `prisma/schema.prisma`, `prisma/migrations/` |
| Maps | `apps/web/src/game/*Map.ts`, `arenaMapBuilder.ts`, shared map definitions |
| Character system | `apps/web/src/game/characters/` and `characterSync.ts` |
| Protocol contract | `packages/shared/PROTOCOL.md`, `packages/shared/src/protocol/` |
| Competition platform | `competitionDomain.ts`, `routes/competitionRoutes.ts`, `features/quizstrike/competition/` |
| Tournament Center | `tournamentDomain.ts`, `routes/tournamentRoutes.ts`, `features/quizstrike/tournament/` |

## Live game behavior to preserve

### Room lifecycle

1. A teacher creates a private room from a quiz set and a sanitized settings
   snapshot.
2. Students join over HTTP with a room code, nickname, team choice, and an
   optional appearance. The server issues a scoped player token.
3. The browser performs the protocol v1 Socket.IO handshake and receives the
   authoritative `session_state` snapshot.
4. The teacher starts the room. Flag and Classic enter preparation; Zombie
   enters the initial Zombie selection phase.
5. Each active round runs server-owned deadlines, combat, quiz rewards, bots,
   objectives, and round conclusions. Inter-round phases can expose the shop.
6. The teacher can end the session or let the configured rounds finish. The
   server writes the session/report data and the teacher reviews it in Reports.

At any active phase, the owning teacher may enter `controlState:
"teacher_paused"` for classroom attention. This is separate from the round
result `status`: it freezes student commands, bot ticks, and countdown display
without resetting the round. Resume shifts deadlines and room-owned timers by
the pause duration. Waiting and ended rooms cannot be paused.

Reconnect is a fresh handshake plus `join_session_room`; the snapshot is the
authority. A disconnected player has a grace period. A flag carrier drops the
flag on disconnect, and runtime-only per-player state is cleared when the
player is finally resolved or removed.

### Mode rules

- **Classic Tag:** team freezes/tags, respawns and quiz earnings contribute to
  round resolution and tie-breaking.
- **Flag:** Red picks up and carries the flag into the Blue base, then protects
  it for the configured hold time. Blue can capture a placed flag. Placement
  and capture progress are server state, not a client animation decision.
- **Zombie:** initial Red Zombies are selected during the selection phase.
  Humans use energy to sprint and can regain energy through correct answers.
  A valid human elimination converts the player into a Red Zombie. The match
  ends when no humans remain or when the timed round expires with humans alive.

### Current equipment and rewards

Weapons: Starter Snowball Launcher, Quick Snowball Launcher, and Heavy
Snowball Launcher. Perks: Warm Vest and Speed Boots. Weapon and perk slots are
separate. The shared package owns item IDs, prices, range, damage, cooldown,
health, speed, snowball-pack, answer-reward, and input bounds; use it rather
than duplicating values in the UI.

Freeze streak announcements are generated only after server-validated
eliminations. Clients may display them but cannot submit or increment a streak.

## Security and persistence handoff

- Teacher auth is application-owned signed JWT auth, not Supabase Auth.
- Every teacher mutation checks ownership; every player mutation checks the
  session code, player ID, and scoped token.
- Student question responses omit `correctChoice`; answer correctness is
  computed on the server.
- Socket commands are protocol-validated, bounded, rate-limited where needed,
  deduplicated by request/event ID, and rejected when the socket has no room
  binding.
- Teacher sockets receive a separate room projection with Learning Pulse data;
  student sockets receive only public gameplay state. Learning Pulse is derived
  and cached from authoritative answer logs, excludes bots and unrelated
  sessions, and is stripped from runtime checkpoints.
- Prisma is the only database client. Supabase Data API, Realtime, Storage,
  and browser-side database access are out of scope.
- `prisma/migrations/20260805000000_harden_public_tables_rls/` enables RLS and
  revokes direct `anon`/`authenticated` table privileges where present. Keep
  migrations deployed in order and verify RLS in the target Supabase project.
- `RuntimeSnapshot` is a checkpoint and compatibility source. New teacher
  library/report writes use normalized models and repository ownership checks.
- Decal uploads are bounded, processed, authenticated, ephemeral, excluded
  from snapshots, and cleaned on player/session end or policy reset.

## Deploy and operator runbook

### Web

`.github/workflows/deploy-web.yml` runs on pushes to `main` or manually. It:

1. installs with `npm ci`;
2. builds shared and web packages with Node 22;
3. injects `VITE_API_URL`, optional fallback, and `VITE_BASE_PATH`;
4. copies the SPA entry point to `404.html` and `/quiz-strike`, `/join`, and
   `/game` route fallbacks;
5. writes `CNAME` when the custom-domain variable is set;
6. publishes `apps/web/dist` to GitHub Pages.

### API

Render runs `npm start -w @quizstrike/server`. Startup applies pending Prisma
migrations before the server listens. A failed migration must fail the deploy.
Keep the service at one instance and ensure the configured browser origins are
included in `CLIENT_ORIGIN`.

After deploy:

```powershell
Invoke-RestMethod https://api.gyakuteneigo.com/api/health
```

Require `ok: true` and the expected PostgreSQL storage status. Inspect logs for
the migration result and normalized restore counts without printing
`DATABASE_URL`.

### Classroom smoke test

Use a teacher browser plus two student browsers or devices:

1. Sign in at `/quiz-strike` and select a quiz.
2. Create one Flag room, review map/advanced settings, and invite with the QR
   code or join link.
3. Confirm the roster and green Start Game action; start the game.
4. Verify question assignment, answer rewards, scoreboard, movement, snowball
   firing, damage, respawn/practice behavior, event feed, and reconnect.
5. Verify the Flag objective once: Red pick-up/placement, Blue capture path,
   hold countdown, event announcement, and disconnect drop behavior.
6. Repeat a short smoke with Zombie and Classic Tag so mode-specific phase and
   result behavior is exercised.
7. Open teacher Spectator View. Select a learner from the picker and use
   Previous/Next. Confirm the camera target changes but no movement, firing,
   answer, or room command is sent.
8. Pause the game, confirm the student attention overlay and blocked commands,
   reconnect a student, resume the game, and verify deadlines continue from
   their shifted values.
9. Confirm the teacher Learning Pulse updates after an answer while the
   student snapshot contains no Learning Pulse data.
10. End the room and open/export the learning report. Confirm history actions
   remain teacher-only.

## Verification commands

From the repository root:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:load
npm run test:e2e
npx prisma validate
```

Focused files are covered by tests under `apps/server/src` and
`apps/web/src/game`. `npm run test:load` exercises the authenticated 40-client
Socket.IO/load matrix. `npm run test:e2e` builds and runs the Playwright
classroom scenario. WebGL smoke checks are local browser checks and should be
repeated when changing scene setup, character lifecycle, map geometry, input,
or cleanup.

The latest local documentation-refresh checks passed: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, `npm run test:load`,
`npm run test:e2e`, `npx prisma validate`, and `git diff --check`.

## Known limitations and next work

1. Horizontal scaling is not safe. Implement and test shared room state,
   Socket.IO fan-out, lease takeover, reconnect routing, distributed rate
   limits, and decal storage before adding a second instance.
2. The unversioned/inferred protocol v0 compatibility adapter remains until
   one stable v1 deployment cycle completes; remove it deliberately afterward.
3. Competition and Tournament Center data models are broader than the core
   classroom flow. Keep their public projections sanitized and do not expose
   private rosters, answers, or organizer-only fields.
4. Character customization defaults to ephemeral room choices; teachers can
   opt into remembering compact appearance choices, while uploaded decals
   remain ephemeral. AI skin generation is not enabled.
5. The server process is the live room authority. A process restart requires
   reconnect/rejoin behavior and should not be treated as a zero-downtime match
   handoff.

When changing gameplay, update the shared types/rules, server mutation path,
client presentation, protocol docs, relevant tests, and this handoff together.
