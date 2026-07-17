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

Loadout state is split into an authoritative weapon slot and independent perk slots. `weapon` holds Starter/Quick/Heavy, `perks` holds Warm Vest and Speed Boots, and `gear` is retained as the current weapon for legacy clients. Buying a perk never replaces a launcher. Living players preserve weapon, perks, and remaining snowballs across round transitions; knocked-out players re-arm with Starter and the configured starting snowballs.

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
- `apps/web/src/game/IronJunctionArtPass.ts`
- `apps/web/src/game/ArenaStaticBatch.ts`
- `apps/web/src/game/ArenaAnimation.ts` and `apps/web/src/game/ArenaAnimation.test.ts`
- `apps/web/src/game/ArenaVfx.ts` and `apps/web/src/game/ArenaVfx.test.ts`
- `apps/web/src/game/ArenaPerformance.ts`
- `apps/web/src/game/characters/CharacterFactory.ts`
- `apps/web/src/game/characters/SharedSkinnedStudent.ts`
- `apps/web/src/game/characters/CharacterAnimator.ts`
- `docs/art-pass/README.md`
- `docs/performance/CHROMEBOOK_CERTIFICATION.md`
- `apps/web/src/navigation.ts`
- `apps/web/src/game/desertCitadelMap.test.ts`
- `apps/server/src/index.ts`
- `apps/server/src/origins.ts` and `apps/server/src/origins.test.ts`
- `apps/server/src/start.ts`
- `apps/server/package.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/sessionRules.test.ts`
- `packages/shared/src/studentSecurity.test.ts`

Loadout-specific implementation points:

- `packages/shared/src/index.ts`: `getPlayerWeaponId`, `getPlayerPerks`, `getPlayerHealthMax`, `getPlayerMoveSpeedMultiplier`, and round-reset compatibility helpers.
- `apps/server/src/index.ts`: authoritative purchase mutation, weapon cooldown/range/damage selection, movement bonuses, and round reset.
- `apps/web/src/App.tsx` and `apps/web/src/game/ArenaPreview.tsx`: weapon HUD/shop state, first-person equipment, zoom, fire cadence, and movement presentation.

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

The latest committed revision includes the weapon/perk loadout preservation fix described above. Always check the latest `main` SHA and deployment status before reporting production state. The Render persistence migration path was previously verified at `98aac2f`; the loadout fix changes the shared contract, server simulation, and client presentation but does not change the persistence schema. Check the Render dashboard and API health before claiming that a later server commit is live.

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

## Audit and handoff status (2026-07-17)

The local live multiplayer audit used independent teacher/student browser stores plus a server bot. Flag, Zombie, and Classic flows were exercised through room setup, joining, start, timeout/results, quiz rewards, selected purchases, refresh/reconnect, late-join, duplicate/full-room, and Flag carrier disconnect scenarios. The detailed evidence is in `docs/live-multiplayer-qa/`.

Implemented and verified:

- Zombie-specific outcomes and Human/Zombie terminology; clean overlays and ended `0:00` state.
- Cause-specific join errors instead of appending invalid-code guidance to every error.
- New identities are rejected after round start; authenticated existing-player rejoin remains allowed.
- Authenticated Socket.IO room joins, last-socket Offline tracking, carried-Flag reset, five-second reconnect grace, and Flag/Zombie resolution after grace.
- Starter launcher removed from the Buy Menu and blocked as a server-side downgrade. Quick is `$3000`; Heavy/AWP is `$6000`; ranges are Starter `36`, Quick `48`, Heavy `120`.
- Weapon/perk loadout preservation: Heavy/AWP remains equipped after Warm Vest and Speed Boots purchases; vest warmth and shoe movement bonuses stack with the selected launcher, and round resets preserve living loadouts while re-arming knocked-out players.
- Teacher Copy Link control and student `/join?code=<SESSION_CODE>` flow, so linked students enter only a nickname.
- Desert Citadel house roofs raised by `+2.25` map units before scaling.
- Projector waiting room with QR join, large session code, roster, Copy Link, and keyboard focus management.
- Server-stamped synchronized countdowns with an upper-duration clamp.
- Classic Tag now advances to the next configured round over Socket.IO without browser refresh; round winners use score then tags, with draw handling.
- Flag and Classic Tag use a four-second synchronized result intermission, then announce the next round as it begins. The final Classic Tag screen names the winner and displays Game Over.
- Zombie Mode records conversion order and announces up to six best players at Game Over: surviving Humans first, then the latest Humans converted.
- Bots pursue active opponents and detour around cover; live socket verification observed changing bot positions.
- Network-resilient API client with branded API primary and Render-hostname fallback for restricted school networks.
- Shared skinned student-athlete body with a unique skeleton per player, palette-cached geometry, bone animation, and a single-draw body.
- Invisible client collision proxies separated from modular rendered building shells, preserving server/client gameplay cover while removing visible collider-box architecture.
- Shared 2K surface atlas, per-vertex tinting, and static geometry batching. Medium is below the former 486-call baseline in both 40-player map captures.
- Directional locomotion, objective-carry posture, hit recoil, respawn rise, jump/landing weight, flag planting/capture, victory, and defeat animation cues on the shared rig.
- Event-driven pooled combat, healing, objective, round, heavy-fire, zoom, cooldown, elimination, and results VFX with Low/Medium/High active-effect caps of 6/12/16 and strict 6-unit/1.1-second coverage limits.
- Iron Junction-specific cold lighting, frost and ballast transitions, switchyard crane landmark, work lights, and maintenance storytelling.
- Character Lab map/quality selectors and frame-time, draw-call, triangle, memory-count, heap, active-VFX, and long-task instrumentation.
- Automated validation: 59 shared tests, 5 server tests, 53 web tests, and a full production build.

The arena feature pass was originally represented by `533946b`; the current `main` history also includes the loadout-preservation fix and its documentation refresh. Check CI and deployment status for the latest SHA before claiming production readiness. The project remains a classroom playtest deployment rather than full production or physical-device certification.

Remaining live QA work:

- Complete Flag placement, capture, hold countdown, and simultaneous objective races.
- Exercise Zombie projectile conversion, near-simultaneous conversions, and all-Humans-converted resolution.
- Verify knocked-out refresh/rejoin, host browser disconnect, multi-tab/network-drop behavior, and reconnection outside grace.
- Verify human-vs-human damage, same-team fire rejection, full weapon/reload/zoom matrix, and hold/release Tab scoreboard semantics.
- Run the physical Chromebook, explicit Microsoft Edge, and integrated-GPU desktop matrix, including GPU-memory, HAR/WebSocket, thermal, and ten-minute 40-player captures. A local 40-player Medium baseline and ~60-second Iron Junction soak are already complete.
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
- A cold industrial sky and fog balance, frost/ballast terrain transitions, snow berms, team work lights, a central switchyard crane, and a maintenance-bench story vignette from `IronJunctionArtPass.ts`.

The shared server uses map-specific team spawn fallbacks, movement obstacles, bot roaming cover, and projectile line-of-sight proxies so the selected map is authoritative for gameplay as well as visuals.

## Arena rendering handoff

The current renderer is intentionally split into five layers:

1. `packages/shared` and the server own authoritative map selection, bounds, spawns, movement validation, objectives, and simplified cover.
2. `ArenaPreview.tsx` builds invisible client collision proxy meshes and derives movement `Box3` bounds from them.
3. The same preview builds separate modular visual structures. Do not make a visual mesh authoritative or remove a collision proxy because a shell appears to match it.
4. `ArenaStaticBatcher` atlas-maps, vertex-tints, transforms, and merges only static opaque decorative meshes. Never batch players, objectives, pooled VFX, transparent water, or first-person equipment.
5. `ArenaPerformanceCapture` and Character Lab expose regression signals; physical certification remains a separate process.

Character rules:

- `SharedSkinnedStudent.ts` merges rigid-weighted body pieces into one `THREE.SkinnedMesh`, caches geometry/material by palette, and creates a unique bone hierarchy per player.
- `CharacterAnimator.ts` animates those bones. Keep the named root, torso, head, arm, and leg interfaces stable unless the factory, animator tests, and hitbox/LOD expectations are updated together.
- `ArenaAnimation.ts` is the typed bridge from authoritative session/combat transitions to player- or team-targeted animation cues. Active cues intentionally bypass idle LOD throttling until they finish.
- `CharacterModel.ts` hides equipment by LOD. Initial scene compilation calls one character update first so distant stress-test characters do not compile hidden full equipment.
- Equipment remains modular and may use several meshes at close range. The body itself should stay a single draw.

VFX rules:

- `App.tsx` translates Socket.IO `game_event`, `damage_result`, and elimination/session outcomes into typed arena events.
- `ArenaPreview` subscribes once per scene and returns effects to the fixed pool on expiry.
- Keep effects world-space and inside the 6/12/16 active-effect caps for Low/Medium/High. Avoid full-screen additive results overlays or unbounded particle creation.
- Secondary effects must stay at or below a 6-unit world radius and 1.1-second lifetime; the web test suite protects these limits.

Current Medium 40-player budgets:

| Map | Static batches | Draw calls | Triangles |
| --- | ---: | ---: | ---: |
| Desert Citadel | 6 | 356 | 66,528 |
| The Iron Junction | 6 | 338 | 63,236 |

Treat `< 400` Medium draw calls as an engineering gate. The local Iron Junction ~60-second sample ended at 55 FPS and 22.8 ms p95, but it is not a substitute for the physical matrix in `docs/performance/CHROMEBOOK_CERTIFICATION.md`.

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

The current baseline is 59 shared tests, 5 server tests, and 53 web tests: 117 total. When touching the live multiplayer lifecycle, also repeat the two-browser/socket checks documented in `docs/live-multiplayer-qa/FIX_VERIFICATION_2026-07-13.md` plus the Classic Tag round-transition and API-fallback checks described above.

When touching arena rendering, also open `/character-lab`, select Medium and 40 players, and verify both maps remain below 400 draw calls. Record p95 frame time, triangles, long tasks, and heap. Use the physical-device checklist instead of extrapolating certification from desktop automation.

For deployment verification, check both `https://api.gyakuteneigo.com/api/health` and `https://gyakuteneigo-api.onrender.com/api/health` first. Confirm CORS for `https://gyakuteneigo.com`, `https://www.gyakuteneigo.com`, and `https://susume.github.io`. Then use two separate browser sessions: create or sign in as a teacher at the Quiz Strike page, create a quiz/session, select **The Iron Junction**, join from the other session, start the round, and confirm that both the teacher preview and student arena show the selected map. For Classic Tag, allow a short round to expire and confirm the same browser reaches round 2 without refresh. If the map or connection falls back unexpectedly, verify that the API and web app are both on the latest deployment before investigating client cache.

## Recommended next work

1. Complete the physical Chromebook, explicit Edge, integrated-GPU desktop, and ten-minute 40-player certification matrix with GPU-memory and trace exports.
2. Complete the remaining live QA matrix, prioritizing objective races, reconnection edge cases, and human-vs-human authority checks.
3. Add automated end-to-end smoke tests for signup, session creation, copy-link join, round start, quiz answer, purchase rejection, disconnect/rejoin, and report export.
4. Add automated Character Lab budget checks so Medium cannot exceed 400 draw calls unnoticed.
5. Migrate from the single runtime snapshot to normalized persistent storage, and choose between Render Basic-256mb and Neon Free for the long-term database.
6. Add durable logging, monitoring, rate limits, token revocation, and a shared Socket.IO adapter before multi-instance scaling.
7. Continue accessibility, reduced-motion, mobile, and map traversal polish without weakening server authority or live-game controls.
