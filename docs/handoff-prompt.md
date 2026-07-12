# GyakutenEigo / Quiz Strike Handoff Prompt

You are taking over the `susume/GyakutenEigo` repository. It is a TypeScript monorepo with a public English-learning site named GyakutenEigo and a separate private classroom multiplayer game named Quiz Strike.

## Product and live URLs

- GyakutenEigo landing page: `https://www.gyakuteneigo.com/`
- Quiz Strike host/teacher entry: `https://www.gyakuteneigo.com/quiz-strike/`
- Student join: `https://www.gyakuteneigo.com/join/`
- Student arena: `https://www.gyakuteneigo.com/game/`
- Live API and Socket.IO server: `https://api.gyakuteneigo.com/`
- Health check: `https://api.gyakuteneigo.com/api/health`

The apex URL, `https://gyakuteneigo.com`, can also be used by visitors. It is an allowed frontend origin even if the site ultimately redirects to `www`.

## What the game does

Teachers create accounts, build multiple-choice quiz sets, create private sessions, and share a generated code or one-click join link. Students join with a code or `/join?code=...` link and a classroom-safe nickname, answer questions to earn in-game money, buy gear or snowballs, and play a live Three.js arena. Teachers can add bots for testing, monitor the roster, end the session, review results, and export CSV.

The default game is Flag Mode: Red Team carries the flag to Blue base, then protects it while Blue tries to capture it. Zombie Mode is also selectable. Flag/Zombie objectives, quiz economics, purchases, tagging, eliminations, respawns, movement validation, and player-token checks are server-authoritative.

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
- `apps/web/src/game/ArenaPreview.tsx`
- `apps/web/src/game/arenaMaps.ts`
- `apps/web/src/game/mapTypes.ts`
- `apps/web/src/game/desertCitadelMap.ts` (including the raised house-roof blockout)
- `apps/web/src/game/ironJunctionMap.ts`
- `apps/web/src/navigation.ts`
- `apps/web/src/game/desertCitadelMap.test.ts`
- `apps/server/src/index.ts`
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
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
```

Render uses:

```text
Build: npm ci --include=dev && npm run build -w @quizstrike/shared && npm run build -w @quizstrike/server
Start: npm start -w @quizstrike/server
```

The server start script resolves to `node dist/start.js`. The start wrapper runs `prisma migrate deploy` with the repository-level schema only when `DATABASE_URL` is configured. The current Render service has no `DATABASE_URL`, so it starts in memory-only mode and logs a warning instead of failing startup.

Its required environment variables are:

```text
NODE_ENV=production
NODE_VERSION=22
JWT_SECRET=<secret stored only in Render>
TRUST_PROXY=true
CLIENT_ORIGIN=http://www.gyakuteneigo.com,https://www.gyakuteneigo.com,http://gyakuteneigo.com,https://gyakuteneigo.com
```

Keep all four `CLIENT_ORIGIN` values unless the corresponding public URL is retired. Both Express and Socket.IO use this allow-list; a missing HTTPS origin causes browser errors such as inability to create an account or connect to the game server.

The `api` DNS record is a CNAME to `gyakuteneigo-api.onrender.com`. The Render custom-domain page must report verification and an issued HTTPS certificate.

The current map-selection/server deployment is on `main` at commit `f3c4001` and the Render service should show that commit as live. The web bundle and API must both be refreshed after a deployment before testing a new session.

## Audit and handoff status (2026-07-13)

The local live multiplayer audit used independent teacher/student browser stores plus a server bot. Flag, Zombie, and Classic flows were exercised through room setup, joining, start, timeout/results, quiz rewards, selected purchases, refresh/reconnect, late-join, duplicate/full-room, and Flag carrier disconnect scenarios. The detailed evidence is in `docs/live-multiplayer-qa/`.

Implemented and verified:

- Zombie-specific outcomes and Human/Zombie terminology; clean overlays and ended `0:00` state.
- Cause-specific join errors instead of appending invalid-code guidance to every error.
- New identities are rejected after round start; authenticated existing-player rejoin remains allowed.
- Authenticated Socket.IO room joins, last-socket Offline tracking, carried-Flag reset, five-second reconnect grace, and Flag/Zombie resolution after grace.
- Starter launcher removed from the Buy Menu and blocked as a server-side downgrade. Quick is `$3000`; Heavy/AWP is `$6000`; ranges are Starter `36`, Quick `48`, Heavy `120`.
- Teacher Copy Link control and student `/join?code=<SESSION_CODE>` flow, so linked students enter only a nickname.
- Desert Citadel house roofs raised by `+2.25` map units before scaling.
- Automated validation: 50 shared tests, 35 web tests, server/web typechecks, and a full production build.

The current implementation is on branch `agent/fix-live-multiplayer-qa` in draft PR [#2](https://github.com/susume/GyakutenEigo/pull/2). It has been pushed but is not a statement that production has been deployed or certified.

Remaining live QA work:

- Complete Flag placement, capture, hold countdown, and simultaneous objective races.
- Exercise Zombie projectile conversion, near-simultaneous conversions, and all-Humans-converted resolution.
- Verify knocked-out refresh/rejoin, host browser disconnect, multi-tab/network-drop behavior, and reconnection outside grace.
- Verify human-vs-human damage, same-team fire rejection, full weapon/reload/zoom matrix, and hold/release Tab scoreboard semantics.
- Run 40-player scale, long soak, real Chromebook, FPS/heap/GPU/long-task/HAR/WebSocket instrumentation, and browser edge-case coverage.
- Attempt safe live client-message mutation/replay tests against server authority.
- Configure PostgreSQL on Render before treating accounts, sessions, tokens, and reports as durable.

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

- The current Render deployment uses in-memory storage because `DATABASE_URL` is not configured. Any Render restart, redeploy, or sleep clears teacher accounts, quizzes, sessions, answer logs, and player tokens. Configure PostgreSQL before relying on durable classroom data.
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

The current baseline is 50 shared tests and 35 web tests. When touching the live multiplayer lifecycle, also repeat the two-browser/socket checks documented in `docs/live-multiplayer-qa/FIX_VERIFICATION_2026-07-13.md`.

For deployment verification, check `https://api.gyakuteneigo.com/api/health` first. Then use two separate browser sessions: create or sign in as a teacher at the Quiz Strike page, create a quiz/session, select **The Iron Junction**, join from the other session, start the round, and confirm that both the teacher preview and student arena show the selected map. If the map falls back to Desert Citadel, verify that the API and web app are both on the latest deployment before investigating client cache.

## Recommended next work

1. Complete the remaining live QA matrix above, prioritizing objective races, reconnection edge cases, and human-vs-human authority checks.
2. Add end-to-end smoke tests covering teacher signup, session creation, copy-link join, round start, quiz answer, purchase/downgrade rejection, disconnect/rejoin, and report export.
3. Add persistent storage for teachers, quiz sets, sessions, players, player tokens, and reports; configure PostgreSQL before classroom use.
4. Add durable logging, monitoring, rate limits, token revocation, and a shared Socket.IO adapter if scaling beyond one process.
5. Add quiz import/export or seed flows so content survives service restarts.
6. Continue accessibility, mobile, Chromebook performance, and map traversal polish without weakening server authority or live-game controls.
