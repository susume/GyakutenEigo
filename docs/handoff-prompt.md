# GyakutenEigo / Quiz Strike Handoff Prompt

You are taking over the `susume/GyakutenEigo` repository. It is a TypeScript monorepo with a public English-learning site named GyakutenEigo and a separate private classroom multiplayer game named Quiz Strike.

## Product and live URLs

- GyakutenEigo landing page: `https://www.gyakuteneigo.com/`
- Quiz Strike host/teacher entry: `https://www.gyakuteneigo.com/quiz-strike/`
- Student join: `https://www.gyakuteneigo.com/join/`
- Student arena: `https://www.gyakuteneigo.com/game/`
- Live API and Socket.IO server: `https://api.gyakuteneigo.com/`
- API fallback for restricted school networks: `https://gyakuteneigo-api.onrender.com/`
- Health check: `https://api.gyakuteneigo.com/api/health`

The apex URL, `https://gyakuteneigo.com`, can also be used by visitors. It is an allowed frontend origin even if the site ultimately redirects to `www`.

## What the game does

Teachers create accounts, build multiple-choice quiz sets, create private sessions, and share a generated code or one-click join link. Students join with a code or `/join?code=...` link and a classroom-safe nickname, answer questions to earn in-game money, buy gear or snowballs, and play a live Three.js arena. Teachers can add bots for testing, monitor the roster, end the session, review results, and export CSV.

The default game is Flag Mode: Red Team carries the flag to Blue base, then protects it while Blue tries to capture it. Zombie Mode and Classic Tag Practice are also selectable. Flag/Zombie/Classic objectives, quiz economics, purchases, tagging, eliminations, respawns, movement validation, and player-token checks are server-authoritative.

Use only the existing school-safe language: snowballs, snowball launchers, warmth, gear, arena, Blue Team, and Red Team. Do not introduce Counter-Strike assets/names/maps, realistic weapons, blood, gore, public matchmaking, public chat, or voice chat.

## Project structure

- `apps/web`: React + Vite web app. Includes the landing site, Quiz Strike entry, teacher dashboard, student join flow, Three.js/WebGL arena, and mobile controls.
- `apps/server`: Node, Express, and Socket.IO API. It owns teacher auth, quiz/session data, bots, reports, and authoritative game simulation.
- `packages/shared`: shared types, rules, map scale/spawns, validation, report helpers, and deterministic game logic.
- `architecture.md`: current system and deployment reference. Read this first.
- `docs/online-play.md`: step-by-step deployment guide.
- `.github/workflows/deploy-web.yml`: GitHub Pages web deployment.

Important source files:

- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/endpoints.ts` and `apps/web/src/api/endpoints.test.ts`
- `apps/web/src/game/ArenaPreview.tsx`
- `apps/web/src/game/arenaMaps.ts`
- `apps/web/src/game/mapTypes.ts`
- `apps/web/src/game/desertCitadelMap.ts` (including the raised house-roof blockout)
- `apps/web/src/game/ironJunctionMap.ts`
- `apps/web/src/navigation.ts`
- `apps/web/src/game/desertCitadelMap.test.ts`
- `apps/server/src/index.ts`
- `apps/server/src/origins.ts` and `apps/server/src/origins.test.ts`
- `apps/server/src/start.ts`
- `apps/server/package.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/sessionRules.test.ts`
- `packages/shared/src/studentSecurity.test.ts`

## Current production deployment

The web app is hosted by GitHub Pages on `www.gyakuteneigo.com`. The API/socket server runs on Render as the `gyakuteneigo-api` service, using `api.gyakuteneigo.com`. DNS is managed through Namecheap.

GitHub Pages builds the web app with:

```text
VITE_API_URL=https://api.gyakuteneigo.com
VITE_API_FALLBACK_URL=https://gyakuteneigo-api.onrender.com
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
```

Render uses:

```text
Build: npm ci --include=dev && npm run build -w @quizstrike/shared && npm run build -w @quizstrike/server
Start: npm start -w @quizstrike/server
```

The server start script resolves to `node dist/start.js`. The start wrapper runs `prisma migrate deploy` with the repository-level schema when `DATABASE_URL` is configured. The current Render service has PostgreSQL configured and the latest deployment successfully applied the `RuntimeSnapshot` migration. The API health check reports `storage: "postgres"`.

Its required environment variables are:

```text
NODE_ENV=production
NODE_VERSION=22
JWT_SECRET=<secret stored only in Render>
TRUST_PROXY=true
CLIENT_ORIGIN=https://gyakuteneigo.com,https://www.gyakuteneigo.com,https://susume.github.io
DATABASE_URL=<internal PostgreSQL URL stored only in Render>
```

Keep all supported hosted origins in `CLIENT_ORIGIN`, including `https://susume.github.io` when the default Pages URL may be used. Both Express and Socket.IO use this allow-list. The production server also supplies the three known hosted origins by default. The web client retries `gyakuteneigo-api.onrender.com` if a school network cannot reach `api.gyakuteneigo.com`, then uses the successful endpoint for Socket.IO.

The `api` DNS record is a CNAME to `gyakuteneigo-api.onrender.com`. The Render custom-domain page must report verification and an issued HTTPS certificate.

The current production deployment is on `main` at commit `98aac2f` (`Fix Prisma schema path on Render`) and Render shows that commit as live. GitHub Actions CI, the Pages deployment, and the Render API deployment are green. The web bundle and API must both be refreshed after a deployment before testing a new session.

### Persistence status

Render PostgreSQL database `gyakuteneigo-db` is active in the Oregon Production environment. The server persists teachers, classes, quiz sets, sessions, players, and answer logs through the single `RuntimeSnapshot` record and hydrates them at startup. The database is on Render's Free PostgreSQL tier: 1 GB, no managed backups, and a 30-day lifetime. It is scheduled to expire on **August 14, 2026** unless it is upgraded or migrated.

**Neon Free** is the preferred free alternative to evaluate. It is PostgreSQL-compatible and can use the existing Prisma schema and `DATABASE_URL`; its current limits are 0.5 GB per project, 100 compute-hours per month, and scale-to-zero when idle.

## TODO checklist

- [ ] Export the current Render `RuntimeSnapshot` before the August 14, 2026 expiry date.
- [ ] Create a Neon Free PostgreSQL project and run the Prisma migrations against it.
- [ ] Migrate the exported runtime snapshot to Neon and update Render's `DATABASE_URL`.
- [ ] Verify `GET /api/health` returns `storage: "postgres"` after the migration.
- [ ] Test teacher login, quiz-set creation, session creation, student join, reports, and restart recovery.
- [ ] Decide whether to upgrade Render PostgreSQL ($6/month Basic-256mb) or remain on Neon Free before classroom launch.
- [ ] Replace the single JSON runtime snapshot with normalized repositories and add scheduled backups.

## Audit and handoff status (2026-07-15)

The local live multiplayer audit used independent teacher/student browser stores plus a server bot. Flag, Zombie, and Classic flows were exercised through room setup, joining, start, timeout/results, quiz rewards, selected purchases, refresh/reconnect, late-join, duplicate/full-room, and Flag carrier disconnect scenarios. The detailed evidence is in `docs/live-multiplayer-qa/`.

Implemented and verified:

- Zombie-specific outcomes and Human/Zombie terminology; clean overlays and ended `0:00` state.
- Cause-specific join errors instead of appending invalid-code guidance to every error.
- New identities are rejected after round start; authenticated existing-player rejoin remains allowed.
- Authenticated Socket.IO room joins, last-socket Offline tracking, carried-Flag reset, five-second reconnect grace, and Flag/Zombie resolution after grace.
- Starter launcher removed from the Buy Menu and blocked as a server-side downgrade. Quick is `$3000`; Heavy/AWP is `$6000`; ranges are Starter `36`, Quick `48`, Heavy `120`.
- Teacher Copy Link control and student `/join?code=<SESSION_CODE>` flow, so linked students enter only a nickname.
- Desert Citadel house roofs raised by `+2.25` map units before scaling.
- Projector waiting room with QR join, large session code, roster, Copy Link, and keyboard focus management.
- Server-stamped synchronized countdowns with an upper-duration clamp.
- Classic Tag now advances to the next configured round over Socket.IO without browser refresh; round winners use score then tags, with draw handling.
- Flag and Classic Tag use a four-second synchronized result intermission, then announce the next round as it begins. The final Classic Tag screen names the winner and displays Game Over.
- Zombie Mode records conversion order and announces up to six best players at Game Over: surviving Humans first, then the latest Humans converted.
- Bots pursue active opponents and detour around cover; live socket verification observed changing bot positions.
- Network-resilient API client with branded API primary and Render-hostname fallback for restricted school networks.
- Automated validation: 53 shared tests, 4 server tests, 41 web tests, server/web typechecks, and a full production build.

The current implementation is on `main` at commit `98aac2f`. It is deployed to GitHub Pages and Render, but this remains a classroom playtest deployment rather than a full production certification.

Remaining live QA work:

- Complete Flag placement, capture, hold countdown, and simultaneous objective races.
- Exercise Zombie projectile conversion, near-simultaneous conversions, and all-Humans-converted resolution.
- Verify knocked-out refresh/rejoin, host browser disconnect, multi-tab/network-drop behavior, and reconnection outside grace.
- Verify human-vs-human damage, same-team fire rejection, full weapon/reload/zoom matrix, and hold/release Tab scoreboard semantics.
- Run 40-player scale, long soak, real Chromebook, FPS/heap/GPU/long-task/HAR/WebSocket instrumentation, and browser edge-case coverage.
- Attempt safe live client-message mutation/replay tests against server authority.
- Confirm the PostgreSQL snapshot survives a planned Render restart/redeploy and document the recovery check.
- Evaluate Neon Free as the no-cost replacement before the Render Free database expiry.
- Verify first-load/cold-start behavior on a school network; the Render Free service can take 50 seconds or more to wake.

Audit references:

- `docs/LIVE_MULTIPLAYER_QA_PLAYTEST.md`
- `docs/live-multiplayer-qa/AUDIT_CONTINUATION_2026-07-13.md`
- `docs/live-multiplayer-qa/FIX_VERIFICATION_2026-07-13.md`

## Map selection and The Iron Junction

Teachers choose a battlefield in the Create Session form. The selected `mapId` is sent inside `SessionSettings`, sanitized by `packages/shared`, stored on the session, and broadcast to every connected client. Desert Citadel is the default; `iron_junction` selects The Iron Junction.

The Iron Junction is the railway-yard map generated from the supplied design brief. Its web geometry is in `apps/web/src/game/ironJunctionMap.ts` and includes:

- North Lane: Maintenance Depot with repair bays, train cars, tool cages, hydraulic lifts, and work lamps.
- Mid Lane: Sorting Tracks and Gantry with staggered track beds, boxcars, the central rail switch, and a sorting booth landmark.
- South Lane: Timber Line and Gorge with log stacks, loader machinery, guard walls, rock barriers, a water tower, and a timber drop-down landing.
- Rear service, central rail-switch, and timber rotation markings, plus map-specific minimap labels and palette.

The shared server uses map-specific team spawn fallbacks, movement obstacles, bot roaming cover, and projectile line-of-sight proxies so the selected map is authoritative for gameplay as well as visuals.

## Known operational limits

- The current Render deployment uses PostgreSQL-backed runtime snapshots. Teacher accounts, quizzes, sessions, answer logs, and player tokens are restored after restart, but the data is stored in one JSON snapshot rather than normalized tables.
- Render Free PostgreSQL has a 1 GB limit, no managed backups, possible maintenance restarts, and a 30-day expiry. Export or migrate the data before August 14, 2026. Neon Free is the planned alternative if a paid Render database is not desired.
- The Render Free plan may take a while to wake after inactivity. The first API request can be slow; retry only after the service has started.
- The system is single-instance only. Do not scale to multiple server processes without persistent storage and shared Socket.IO state.
- Socket bindings and disconnect grace timers are process-local; the live disconnect/rejoin fix assumes one server process.
- GitHub Pages can host the static web app, but it cannot host the Node/Socket.IO game server.
- The web bundle may warn that it exceeds 500 kB because it contains Three.js. Treat that as an expected warning, not a failed build.

## Working rules

- Preserve the GyakutenEigo landing page at `/`. Quiz Strike belongs at `/quiz-strike`; it is not the site root.
- Prefer existing helpers in `packages/shared` for game logic. Do not duplicate or move authoritative rule decisions into the browser.
- Keep the server authoritative for answers, money, snowballs, gear, player movement, targets, tagging, eliminations, respawns, and objectives.
- Do not trust client-provided answers, ammo counts, coordinates, target IDs, or player tokens without server validation.
- Do not commit `.env`, secrets, `node_modules`, `dist`, build caches, or local databases. Intentional QA evidence under `docs/live-multiplayer-qa/` is already part of the audit handoff; add new evidence only when it supports a reproducible finding or verification.
- There may be user changes in the worktree. Inspect and preserve them; do not reset or discard unrelated work.

## Local development and verification

```bash
npm install
copy .env.example .env
npm run dev
```

Local web: `http://localhost:5173`
Local API: `http://localhost:4000`

Before committing code changes, run:

```bash
npm run typecheck
npm test
npm run build
```

The current baseline is 53 shared tests, 4 server tests, and 41 web tests. When touching the live multiplayer lifecycle, also repeat the two-browser/socket checks documented in `docs/live-multiplayer-qa/FIX_VERIFICATION_2026-07-13.md` plus the Classic Tag round-transition and API-fallback checks described above.

For deployment verification, check both `https://api.gyakuteneigo.com/api/health` and `https://gyakuteneigo-api.onrender.com/api/health` first. Confirm CORS for `https://gyakuteneigo.com`, `https://www.gyakuteneigo.com`, and `https://susume.github.io`. Then use two separate browser sessions: create or sign in as a teacher at the Quiz Strike page, create a quiz/session, select **The Iron Junction**, join from the other session, start the round, and confirm that both the teacher preview and student arena show the selected map. For Classic Tag, allow a short round to expire and confirm the same browser reaches round 2 without refresh. If the map or connection falls back unexpectedly, verify that the API and web app are both on the latest deployment before investigating client cache.

## Recommended next work

1. Complete the remaining live QA matrix above, prioritizing objective races, reconnection edge cases, and human-vs-human authority checks.
2. Add end-to-end smoke tests covering teacher signup, session creation, copy-link join, round start, quiz answer, purchase/downgrade rejection, disconnect/rejoin, and report export.
3. Migrate from the single runtime snapshot to normalized persistent storage, and choose between Render Basic-256mb ($6/month) and Neon Free for the long-term database.
4. Add durable logging, monitoring, rate limits, token revocation, and a shared Socket.IO adapter if scaling beyond one process.
5. Add quiz import/export or seed flows so content survives service restarts.
6. Continue accessibility, mobile, Chromebook performance, and map traversal polish without weakening server authority or live-game controls.
