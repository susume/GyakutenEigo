# QuizStrike Monolith Extraction

This document records the behavior-preserving extraction completed on the
`refactor/finish-monolith-extraction` branch. The work keeps the existing
runtime wiring and public behavior while giving each route, runtime concern,
and arena subsystem a clear owner.

## Server ownership

`apps/server/src/runtime.ts` remains the composition root. It owns startup,
Socket.IO registration, shared runtime state, lifecycle timers, and the
position broadcaster. Route bodies now live under `apps/server/src/routes/`:

- `teacherLibrary.ts` owns folders, quiz-set library, and teacher reports.
- `quizSets.ts`, `questions.ts`, and `reports.ts` own quiz and report routes.
- `sessionRoutes.ts` owns session creation, start/end, and round commands.
- `playerRoutes.ts` owns student join, team, answer, purchase, and combat commands.
- `appearanceRoutes.ts` owns character/decal policy and appearance operations.

`botRuntime.ts` owns bot state, decision ticks, movement, firing integration,
and respawn scheduling. `roundRuntime.ts` owns round mutation, preparation and
transition guards, pending-round execution, and round broadcasts. The runtime
creates both through dependency objects, so there is one bot tick and one
round-transition owner.

## Client arena ownership

`ArenaPreview.tsx` now composes the arena rather than containing every
construction concern:

- `arenaMapBuilder.ts` owns map materials, static batching, cover proxies,
  objective markers, and map-specific art passes.
- `characterSync.ts` owns character factory/manager creation, VFX and animation
  subscriptions, player synchronization, and cleanup.
- `ArenaMinimap.tsx` owns minimap layout and coordinate presentation.
- `arenaLoop.ts` owns the explicit start/stop requestAnimationFrame lifecycle.

The scene effect uses stable map helpers and live session/player refs. Socket
updates therefore refresh synchronized gameplay state without remounting the
WebGL scene. Cleanup stops the loop, removes listeners, unsubscribes VFX and
animation handlers, disposes pooled and static resources, and removes the
canvas. The smoke test observed one canvas before and after a reload.

## Hook cleanup

The starting ESLint baseline had 38 React Hooks exhaustive-deps warnings and
zero errors. The final result is zero warnings and zero errors. The fixes use
primitive dependency aliases, stable setter/callback aliases, action refs for
long-lived keyboard listeners, and live refs for socket event handlers. No
blanket lint suppression was added.

## Validation

- `npm run typecheck`: pass for shared, server, web, and web e2e configs.
- `npm run test`: pass — 89 shared, 47 server, and 141 web tests.
- `npm run lint`: pass with zero errors and zero warnings.
- `npm run build`: pass for shared, server, and web. The local Node 20.16
  runtime still reports the existing Vite engine warning; Vite also reports
  the existing large-chunk warning for the main and Three.js chunks.
- `npm run test:e2e`: pass — 1 Playwright classroom scenario.
- Static relative-import DFS check: pass — 105 production TypeScript modules,
  zero dependency cycles.

The browser smoke test used the Codex in-app browser against local server and
preview processes. A real student joined a real in-memory room, the live
Desert Citadel arena entered preparation mode, and the page exposed one
`arena-webgl` canvas with 156 draw calls and 75,832 triangles. Reloading the
student page remounted the arena with one canvas and the same live render
metrics. No console errors or warnings were captured. Other maps, low-end GPU
profiles, full 40-player rendered sessions, and every combat branch remain
outside this focused smoke test.

## Size change

Measured against the parent of the first extraction commit:

| File | Before | After |
| --- | ---: | ---: |
| `apps/server/src/runtime.ts` | 3,211 lines | 1,882 lines |
| `apps/web/src/game/ArenaPreview.tsx` | 2,503 lines | 1,479 lines |

The largest extracted files are intentionally scoped: `arenaMapBuilder.ts`
has 1,051 lines of map construction, `botRuntime.ts` has 585 lines of bot
runtime coordination, and `roundRuntime.ts` has 385 lines of round flow.

## Commits

New local commits, in order:

1. `ab243ee` — extract teacher library routes
2. `29770aa` — extract quiz and report routes
3. `ec8cfa0` — extract session and player routes
4. `7b98740` — extract bot runtime orchestration
5. `c774dc7` — move round mutations into round flow
6. `6ad6dab` — extract arena map construction
7. `ee07c24` — extract arena character synchronization
8. `766038a` — extract arena minimap
9. `caabc96` — extract arena render loop lifecycle
10. `66339ca` — clean arena extraction boundaries

The final hook cleanup is in `6107768` and this documentation is in `9119748`.
The completed branch has been fast-forwarded into `main` and pushed to GitHub.
