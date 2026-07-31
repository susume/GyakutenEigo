# QuizStrike Development Handoff

Handoff date: 2026-07-29  
Source baseline: `main` at `8e19028` before this documentation update

## Project at a glance

QuizStrike is a working browser classroom game inside GyakutenEigo. Teachers author multiple-choice quizzes, create private sessions, manage students and cosmetics, run live matches, and export reports. Students join by room code, answer questions for currency, buy equipment, and play a server-authoritative Three.js arena.

This is no longer a small UI prototype. It has a real multiplayer authority boundary, two maps, three game modes, persistence, reconnect behavior, bots, character customization, touch/controller input, quality presets, audio/VFX, and automated classroom/load coverage.

Read `architecture.md` before changing networking, persistence, collision, combat, or appearance code.

## Current working slice

- Teacher signup/login with JWT authentication.
- Classes, quiz sets, question CRUD, text-to-question drafting, and dashboard folders.
- Private session creation with join codes, QR/copy links, configurable modes, maps, rewards, economy, teams, and customization policy.
- Student join/rejoin with classroom-safe nickname checks and private player tokens.
- Flag Mode, Zombie Mode, and Classic Tag Practice.
- Server-owned movement validation, ammo, cooldowns, damage, elimination, economy, objectives, bots, rounds, and results.
- Desert Citadel and The Iron Junction.
- Starter, Quick, and Heavy Snowball Launchers plus Warm Vest and Speed Boots.
- Independent weapon/perk slots and loadout preservation for living players between rounds.
- Quiz-to-earn loop, practice-to-respawn flow, shop shortcuts, scoreboard, minimap, spectator state, and reports.
- Mouse/keyboard, touch, and standard gamepad support.
- Shared skinned characters, procedural animation states, bounded VFX, audio, and Low/Medium/High rendering presets.
- Student character presets, color controls, optional processed decals, teacher moderation/removal, and classroom-wide reset.
- PostgreSQL-backed runtime snapshots when configured; memory-only local fallback.

## Most recent changes

The latest code on `main` improved the character creator and free-tier hosted login behavior:

- clearer creator guidance and layout;
- more resilient API warm-up, timeout, retry, and hosted fallback behavior;
- expanded endpoint/retry tests;
- preserved the previously added classroom customization lifecycle and 40-client browser/server coverage.

Earlier recent changes fixed gameplay HUD overlap, movement/weapon stalls, audio event coverage, launcher/perk loadout preservation, animation/VFX state coverage, and arena art/performance.

## Repository map

| Path | What to look for |
| --- | --- |
| `README.md` | Product scope, setup, current slice, safety vocabulary, performance baseline |
| `architecture.md` | Runtime boundaries, protocols, persistence, invariants, deployment |
| `packages/shared/src/index.ts` | Canonical types, constants, sanitized settings, deterministic rules |
| `apps/server/src/index.ts` | Express routes, Socket.IO, live state, bots, rounds, persistence calls |
| `apps/server/src/roundFlow.ts` | Round conclusion planning |
| `apps/server/src/appearanceSecurity.ts` | Processed PNG/WebP inspection |
| `apps/server/src/decalStore.ts` | Expiring, bounded in-memory decal bytes |
| `apps/web/src/App.tsx` | Main product UI and teacher/student orchestration |
| `apps/web/src/api/client.ts` | API selection, auth/player headers, endpoint calls |
| `apps/web/src/api/endpoints.ts` | URL candidate and timeout mechanics |
| `apps/web/src/studentCommandTransport.ts` | Socket acknowledgement with HTTP fallback |
| `apps/web/src/game/ArenaPreview.tsx` | Three.js arena, controls, prediction, collision, VFX |
| `apps/web/src/game/characters/` | Character rendering, equipment, appearance, animation, LOD |
| `apps/web/src/ui/CharacterCreator.tsx` | Student customization UI |
| `apps/web/src/ui/TeacherDecalGallery.tsx` | Teacher decal review UI |
| `prisma/schema.prisma` | Migrations plus current `RuntimeSnapshot` storage table |

## Getting started

Requirements: a current Node/npm installation. PostgreSQL is optional for ordinary local development and required to verify durable state.

```bash
npm install
copy .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Local services:

- Web: `http://localhost:5173`
- Server health: `http://localhost:4000/api/health`
- Adminer: `http://localhost:8080`
- Development-only Character Lab: `http://localhost:5173/character-lab`

The root `npm run dev` watches shared, server, and web workspaces together. If shared types appear stale, build `@quizstrike/shared` before debugging the consumers.

## Verification

Use this sequence before handing off a gameplay, networking, or persistence change:

```bash
npm run typecheck
npm test
npm run build
npm run test:load
npm run test:e2e
```

Playwright needs Chromium once per machine:

```bash
npx playwright install chromium
```

Also perform focused manual checks when relevant:

- Teacher: sign up/login, create a quiz, create room, add bot, start/end, download CSV.
- Student: join, refresh/rejoin, answer, purchase, fire, eliminate/respawn, disconnect/reconnect.
- Modes: complete one Flag round, one Zombie conversion/end, and one Classic respawn loop.
- Rendering: both maps at Low/Medium/High, including minimap/collision alignment.
- Customization: save preset/colors, upload processed sticker, teacher review/remove/reset, reconnect.

The load test is not a substitute for physical device certification. The current Chromebook/Edge/ten-minute soak matrix remains incomplete.

## Non-negotiable design rules

1. The server owns all meaningful outcomes. Clients send intent and may predict presentation only.
2. Shared rules live in `packages/shared`; do not duplicate economy, combat, objective, or sanitization logic in the UI.
3. Rendered buildings and characters are not authoritative hit/collision geometry.
4. Keep launcher and perk slots independent.
5. Never expose correct quiz choices in student question payloads.
6. Verify teacher ownership and player tokens on every private operation.
7. Do not expose uploaded image bytes in room/session snapshots or unauthenticated moderation lists.
8. Preserve the original school-safe terminology: snow tags, snowball launchers, warmth, gear, arena, Blue Team, and Red Team. Do not add realistic weapons, gore, public chat, public matchmaking, or copied Counter-Strike content.

## Important implementation realities

### Persistence is a snapshot, not the normalized schema

Although Prisma defines normalized classroom tables, the runtime serializes teachers, classes, quizzes, sessions, and answers into `RuntimeSnapshot("primary")`. Do not write a new feature directly to a normalized Prisma model and assume the running app will read it.

No `DATABASE_URL` means no durable data. Production `start.ts` applies migrations before starting the server.

### The server is single-instance

Live sessions, Socket.IO bindings, timers, bots, rate limits, and decals are held in one Node process. Multiple replicas will diverge and route players inconsistently. Add shared coordination before scaling horizontally.

### Decal bytes are intentionally temporary

Clothing/preset choices can survive through the runtime snapshot. Uploaded decal bytes cannot:

- processed PNG/WebP only;
- maximum 512 × 512 and 384 KiB after client processing;
- 32 MiB room cap;
- three uploads per player per minute;
- eight-hour expiry;
- process-local storage;
- active decal references are stripped during server hydration.

The AI skin integration is a disabled interface, not a shipped feature. Keep it fail-closed until there is an authenticated, moderated server adapter.

### Navigation is custom

Routes use `history.pushState` and a small `modeForRoute` helper. There is no React Router. Static hosting therefore needs SPA fallback/rewrite behavior for `/quiz-strike`, `/join`, and `/game`.

### API fallback is network-oriented

The client can move from a configured API URL to a hosted fallback after timeout/network failure. Ordinary HTTP errors still come from the active server and should be handled as application errors; do not indiscriminately retry non-idempotent requests.

## Known risks and unfinished work

- `apps/server/src/index.ts` and `apps/web/src/App.tsx` are large integration hubs and are becoming expensive to change safely.
- HTTP and Socket.IO payload contracts are partly structural rather than centralized/versioned. `packages/shared/PROTOCOL.md` predates the acknowledged answer/purchase socket commands.
- The current public session endpoint returns the room object directly. Review projections before adding any sensitive player field.
- Normalized persistence, multi-instance play, external object storage, and distributed rate limits are not implemented.
- Bot movement and objective play are functional but intentionally simple.
- Flag interaction is one authoritative button action, not a timed progress interaction.
- Free-for-all spawn metadata exists, but live modes are team-based.
- General vertical traversal/pathfinding is not implemented.
- Characters and environments are code-authored production placeholders; final artist-authored GLB/animation assets are still an art gate.
- Physical Chromebook, explicit Edge, integrated-GPU, GPU-memory, and ten-minute soak certification remain pending.
- Some historical implementation docs describe an earlier state. Prefer current code, `README.md`, this handoff, and `architecture.md` when they conflict.

## Recommended next engineering steps

1. Extract a versioned protocol module from the shared package for HTTP payloads, socket payloads, and public/private session projections.
2. Split the server into transport, classroom repository, session engine, and realtime gateway modules without changing authority.
3. Split `App.tsx` by route/product flow while preserving lazy loading and the current browser URLs.
4. Decide whether production persistence should remain a documented snapshot model or migrate fully to normalized repositories.
5. Complete the physical performance/cross-browser matrix before raising player-count or visual-quality claims.
6. Only after the above, plan multi-instance state, Socket.IO adapter, shared object storage, and distributed timers/locks.

## Change guide

| If changing... | Update/check... |
| --- | --- |
| Session or player shape | Shared type, sanitizer/defaults, hydration compatibility, client rendering, tests |
| Game rule or gear value | Shared rule first, server application, UI copy, rule tests |
| Socket event | Shared protocol type, server validation, reconnect behavior, HTTP fallback if needed, `PROTOCOL.md` |
| Map geometry | Shared obstacles/spawns/bounds and client collision proxies before visual shell |
| Persistence | Snapshot hydration, debounce/flush, migration/startup path, restart test |
| Appearance | Shared allowlist, server policy, upload security, remote character rendering, teacher moderation |
| Public/player data | Explicit projection and security tests |
| Hosting | `VITE_*` build variables, server runtime variables, CORS, SPA rewrite, WebSockets |

## Definition of done

A change is ready to hand off when:

- authority and security boundaries still hold;
- typecheck, unit tests, and production build pass;
- load/E2E tests pass when the affected surface warrants them;
- the relevant two-browser or visual flow was manually checked;
- environment/migration requirements are documented;
- `README.md`, `architecture.md`, `HANDOFF.md`, or focused docs are updated if the operating model changed;
- known limitations are stated rather than hidden behind optimistic UI.
