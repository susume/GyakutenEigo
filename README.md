# GyakutenEigo

GyakutenEigo is a browser-based English learning site. Its first hosted game is Quiz Strike, a private classroom arena where teachers create quiz sets and sessions while students answer questions, earn in-game money, buy school-safe gear, and play live team modes.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment defaults:

   ```bash
   copy .env.example .env
   ```

3. Optional local database services, required for durable local data:

   ```bash
   docker compose up -d
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Start the local app:

   ```bash
   npm run dev
   ```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:4000`. The public site is `/`, the Quiz Strike host page is `/quiz-strike`, student entry is `/join`, and the arena is `/game`.

The local-only Character Lab at `/character-lab` includes both maps, all three quality presets, and 10–60 player stress scenarios.

## Online Play

For a hosted playtest, deploy the web app and game server separately:

- Build `apps/web` and host `apps/web/dist`.
- Build and run `apps/server` on a Node host with WebSocket support.
- Set `VITE_API_URL` in the web build to the public server URL.
- Set `CLIENT_ORIGIN` on the server to the public web origin.
- Set a real `JWT_SECRET` before using `NODE_ENV=production`.

See [docs/online-play.md](docs/online-play.md) for the GitHub Pages and Render deployment checklist.

## Current Vertical Slice

- Teacher signup/login, class management, and multiple-choice quiz authoring
- Private session creation with generated join codes and copyable join links
- Student join by code and classroom-safe nickname
- Flag Mode, Zombie Mode, and Classic Tag Practice with server-authoritative rules
- Live Three.js FPS arena with movement, firing, objectives, minimap, HUD, quiz, shop, scoreboard, and touch controls
- Desert Citadel and The Iron Junction with map-specific spawns, cover, landmarks, lighting, and minimap labels
- Shared skinned student-athlete characters and modular launcher/equipment silhouettes
- Invisible gameplay collision proxies with separate modular rendered structures
- Atlas-batched static scenery and scalable Low/Medium/High quality presets
- Directional locomotion plus event-driven hit, respawn, jump, landing, flag interaction, victory, and defeat animation states
- Pooled combat, healing, objective, round, heavy-fire, zoom, cooldown, elimination, and results VFX with strict coverage caps
- Live teacher roster, bots, practice respawn questions, server-validated purchases, and CSV reports
- Independent weapon/perk loadout slots: buying Warm Vest or Speed Boots preserves the equipped launcher, including Heavy/AWP; living players retain the full loadout between rounds
- PostgreSQL-backed runtime snapshots when `DATABASE_URL` is configured; in-memory fallback for local development

## Arena Rendering Architecture

Gameplay and presentation deliberately have separate sources of truth:

- `packages/shared` owns map IDs, arena bounds, spawn tables, objectives, buy zones, simplified server collision, projectile cover, validation, and deterministic rules.
- `apps/server` owns authoritative movement, combat, economy, objectives, session lifecycle, bots, and results.
- `apps/web` owns Three.js scene assembly, rendered map metadata, invisible client collision proxies, modular visuals, lighting, effects, UI, and diagnostics.

Rendered buildings no longer expose collider boxes as their visible bodies. `ArenaPreview` creates invisible box proxies for movement and cover, then assembles separate modular visual shells. Static decorative meshes are vertex-tinted through a shared 2K surface atlas and merged into six or fewer material batches per map.

Characters use a shared `THREE.SkinnedMesh` skeleton with palette-cached geometry and a single-draw body. Equipment remains modular. Event effects are world-space, pooled, and limited to 6/12/16 active effects on Low/Medium/High to protect screen readability and frame time.

Important files:

- `apps/web/src/game/ArenaPreview.tsx`: scene assembly, invisible client collision proxies, modular structures, FPS controls, minimap, VFX, and profiling integration.
- `apps/web/src/game/arenaMaps.ts`: map catalog and lookup.
- `apps/web/src/game/desertCitadelMap.ts`: Desert Citadel layout and landmarks.
- `apps/web/src/game/ironJunctionMap.ts`: Iron Junction layout, routes, and industrial props.
- `apps/web/src/game/IronJunctionArtPass.ts`: frost transitions, industrial lighting, crane landmark, and maintenance storytelling.
- `apps/web/src/game/ArenaStaticBatch.ts`: shared surface atlas, vertex tinting, and static geometry batching.
- `apps/web/src/game/characters/SharedSkinnedStudent.ts`: shared character skin, skeleton, and palette cache.
- `apps/web/src/game/ArenaAnimation.ts`: typed event bus for gameplay-driven character animation cues.
- `apps/web/src/game/ArenaVfx.ts`: typed event bus and bounded VFX pool.
- `apps/web/src/game/ArenaPerformance.ts`: frame-time, long-task, renderer-memory, heap, and draw-count capture.
- `packages/shared/src/index.ts`: shared game contracts, map constants, spawns, and deterministic rules.
- `apps/server/src/index.ts`: authoritative HTTP, Socket.IO, and game simulation.

## Performance and Verification

The latest 40-player Medium baseline is:

| Map | Draw calls | Triangles | Local sample |
| --- | ---: | ---: | --- |
| Desert Citadel | 356 | 66,528 | 45 FPS, 29.4 ms p95 |
| The Iron Junction | 338 | 63,236 | 55 FPS, 22.8 ms p95 after ~60 seconds |

These measurements are useful regression baselines, not physical-device certification. Physical Chromebook, explicit Microsoft Edge, integrated-GPU desktop, GPU-memory, and ten-minute soak runs remain pending. See [docs/performance/CHROMEBOOK_CERTIFICATION.md](docs/performance/CHROMEBOOK_CERTIFICATION.md).

Run before pushing:

```bash
npm run typecheck
npm test
npm run build
```

The current automated baseline is 59 shared tests, 5 server tests, and 53 web tests: 117 total. The Vite bundle warning for the Three.js chunk is expected and is not a build failure.

## Known Limits

- Invisible collision proxies intentionally remain authoritative underneath modular visual meshes. Visual edits must not silently change server or client collision.
- The environment and character set are code-authored and production-minded, not imported DCC-authored assets.
- Rooftop and aqueduct routes are readable and collidable, but the player controller still uses mostly flat movement.
- Free-for-all spawn metadata exists for future support; current live session flows remain team-based.
- The server is single-instance. Process-local socket bindings, timers, and simulation state require a shared adapter before horizontal scaling.
- Production persistence currently uses one PostgreSQL `RuntimeSnapshot`, not normalized repositories.

## Documentation

- [architecture.md](architecture.md): system architecture, runtime ownership, deployment shape, and risks.
- [docs/handoff-prompt.md](docs/handoff-prompt.md): copy/paste handoff for another developer or coding agent.
- [docs/art-pass/README.md](docs/art-pass/README.md): visual direction, before/after evidence, and quality counts.
- [docs/performance/CHROMEBOOK_CERTIFICATION.md](docs/performance/CHROMEBOOK_CERTIFICATION.md): profiling baseline and physical certification matrix.
- [docs/live-multiplayer-qa/README.md](docs/live-multiplayer-qa/README.md): multiplayer audit evidence and continuation notes.

## Safety and Design Rules

This is an educational prototype. Schools should review privacy, safeguarding, accessibility, and local policy requirements before classroom deployment.

Use original school-safe terminology only: snow tags, snowball launchers, warmth, gear, arena, Blue Team, and Red Team. Do not add Counter-Strike assets, names, maps, or sounds; realistic weapon names; blood or gore; public matchmaking; public chat; or voice chat.
