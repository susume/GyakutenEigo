# Desert Citadel: Split Crown audit and final validation

Date: 2026-08-06  
Target: 40 players, normally 20 Blue vs 20 Red, on school desktops and Chromebooks.

## 1. Final classification

**LEVEL 3 - Rebuild.** The earlier Fountain Court revision still read as one broad
central terrace with side decoration. Split Crown replaces its battlefield,
spawns, floor surfaces, stair network, objective distribution, collision proxies,
bot routes, and preview image. The desert-citadel palette and fortified trade-city
theme remain; the previous route graph and named combat spaces do not.

The shared movement controller, gravity, jump model, player collider, renderer,
network reconciliation, and general spawn-selection logic were inspected and
retained. Evidence showed that the map-specific geometry and shared map data were
the problem, not those shared systems.

## 2. Evidence-backed audit

| ID | Problem | Evidence | Severity | Implemented fix | Verification |
|---|---|---|---|---|---|
| A1 | The prior layout did not create independent 20v20 fronts | One dominant raised court visually and mechanically joined most traffic | Critical | Replaced it with Shaded Souk, Royal Causeway, and Dry Cistern macro routes plus Crown Rampart | Three-lane authorship and 40-player split tests pass |
| A2 | Spawn waves lacked three clearly separated exit bands | Previous courts fed the same central mass | Critical | Built mirrored 20-slot Assembly Bastions with north, center, and south screened exits | 20+20 spacing, clearance, exit, and first-frame LOS tests pass |
| A3 | Route fairness was difficult to reason about | Side destinations and elevation access were tied to different architecture | Critical | Mirrored lane goals, stairs, covers, and base geometry across X=0 | All tested opening paths are reachable, 7-18 seconds, and under 15% asymmetry |
| A4 | Vertical play was an attachment rather than a full rotation | Upper geometry did not provide a four-entry, end-to-end combat route | High | Added a 20-unit-high Crown Rampart with four stair entries and lateral crossing | Bot paths reach every entry and cross the full rampart |
| A5 | Lower play lacked a strong identity | The previous dry yard was mostly an edge rotation | High | Created the Dry Cistern as a full lower route with staggered low cover and a well landmark | Lower objective, spawn, bot, and path checks pass |
| A6 | Center elevation could become a single-door choke | A large raised mass can concentrate 40 players at narrow stairs | Critical | Royal Causeway uses six wide approach flights and open side rotations | All six main flights pass stair continuity and connectivity tests |
| A7 | Upper positions risked uncontested dominance | Long elevated platforms can see too many lower approaches | High | Added rails, three rampart cover islands, four entrances, and lower Souk counter-angles | Upper crossing and multi-entry tests pass; weapon-angle playtest remains required |
| A8 | Client art and server collision could drift | Visual blocks and authoritative obstacles are separate data consumers | Critical | Re-authored both from the same exact footprints and shared stair table | Visual/authoritative footprint parity test passes |
| A9 | Bots could continue targeting retired regions | Bot patrol data referenced the previous map | High | Replaced patrol and flank goals for all Split Crown routes and levels | Bots reach lanes, gates, and upper positions in automated navigation tests |
| A10 | Old map preview did not show the implemented battlefield | `desert-citadel.png` depicted the superseded layout | Medium | Generated a clean thumbnail from the running Split Crown renderer | Production asset inspected after generation and included in the build |
| A11 | Decorative scatter would violate traceability | Random edge dressing cannot be tied to the Phase 3 plan | High | Desert Citadel remains authored-only; no random placement or labels were added | Exact manifest test and visible-geometry policy test pass |
| A12 | Browser performance must be measured | 40 characters, stairs, shadows, and multi-level art are expensive | High | Reused materials/static batching and kept decorative props bounded | Local live measurements recorded below; Chromebook hardware remains untested |

## 3. Battlefield and route structure

- **West/Blue Assembly Bastion** and **East/Red Assembly Bastion:** 20 positions
  per team in four columns by five rows. Screens and staggered baffles stop direct
  spawn fire while leaving three exit bands usable.
- **North - Shaded Souk:** close-to-mid combat around six staggered stalls,
  canopies, palms, and the Falcon Obelisk. It provides ground-level counterplay
  beneath and in front of Crown Rampart.
- **Center - Royal Causeway:** the fastest raised contest, at Y=8, approached by
  six flights. Broken parapets, two cover islands, and the Royal Sundial prevent a
  single uninterrupted firing line.
- **South - Dry Cistern:** lower, longer flank with staggered low ruins, carts,
  palms, and the cistern well. It trades speed for safer rotation and wider fights.
- **Upper - Crown Rampart:** a Y=20 lateral route with two team-side and two
  field-side stair entries. Three cover islands and open stair mouths ensure the
  position can be pinched and cannot be held from one doorway.
- **Cross-lane rotations:** both gate courts, all six Causeway stairs, all four
  Rampart stairs, and open lower space between Souk/Cistern and each bastion.

```text
                         [Crown Rampart Y20]
                      /    /          \    \
          [Blue Bastion]--[Shaded Souk]--[Red Bastion]
               |    \      \      /      /    |
               |     +--[Royal Causeway Y8]--+     |
               |              |                    |
               +---------[Dry Cistern Y0]-----------+
```

The expected opening allocation is 6 Souk / 7 Causeway / 5 Cistern / 2 Rampart
players per team. Automated assignment tests prove that all 40 designated spawn
slots can reach those fronts without disconnecting a route.

Objectives are distributed across Shaded Souk, Royal Causeway, Dry Cistern, both
gate courts, and Crown Rampart. Search items sit at the Falcon Obelisk, Royal
Causeway, and Dry Cistern. Delivery and base zones remain deep and mirrored.

## 4. Authoritative Phase 3 manifest

The complete pre-implementation object list, coordinates, dimensions, gameplay
reasons, objective plan, and route graph are in `docs/DESERT_CITADEL_MAP.md`.
Implementation is checked against that manifest by ID. Its categories are:

- four perimeter walls and six route/foundation surfaces;
- twelve Assembly Bastion walls, screens, and baffles;
- ten shared stair flights (six 12-step flights and four 28-step flights);
- eight Causeway parapet/cover blocks;
- seven Rampart rail/cover blocks;
- eight Souk combat/landmark blocks;
- six Cistern cover blocks;
- twelve fixed visual props and four fixed cylinders.

No Phase 4 object exists outside those categories or manifest IDs. Gameplay
geometry uses exact coordinates; no procedural or approximate placement is used.

## 5. Traversal and multiplayer correctness

- Raw map footprint is 520 x 400; `ARENA_SCALE=0.62` produces a 322.4 x 248
  rendered footprint. Authoritative bounds are raw +/-260 by +/-200.
- Main level is raw Y=8 and upper level is raw Y=20, both derived through the
  existing scale and floor-resolution code.
- Main stairs rise 8 units in 12 steps (0.667 per step). Upper stairs rise 20
  units in 28 steps (0.714 per step). Both remain below the controller's existing
  0.8-unit step tolerance; no movement constant was guessed or changed.
- Floor selection, obstacles, spawn data, objectives, and stair flights live in
  shared map data used by client, server, and bot navigation.
- Solid Causeway/Rampart foundations reject elevation shortcuts. No teleport or
  recovery-height workaround was introduced.
- There are 60 authored FFA spawns across lower, main, and upper floors.

## 6. Balance, sightlines, and 40-player flow

- The automated opening-path envelope is 7-18 seconds at the existing 14.8-unit
  run speed, with each mirrored lane pair under 15% travel asymmetry.
- Spawn tests found no Blue/Red first-frame firing line and no spawn overlap.
- Souk stalls and Cistern ruins are staggered so a single shooter cannot hold the
  entire lane. Causeway parapet gaps expose crossers and create multiple peeks.
- Crown Rampart can pressure Souk and gate rotations, but four entries allow two
  independent pinches and the rampart cover is deliberately discontinuous.
- Architectural navigation replaces labels: blue/red bastion cloth, Falcon
  Obelisk, Royal Sundial, Dry Cistern well, palms, canopies, and the rampart
  silhouette establish orientation.

## 7. Geometry Sanity Pass

The sanity pass was run before final repository validation using exact geometry
tests plus live overview, lower, main, and upper renders.

Findings corrected:

1. Three Souk FFA positions at raw Z=-145 touched the Crown foundation footprint;
   they were moved to raw Z=-138 on supported lower ground.
2. Spawn baffles initially crowded stair mouths and produced nav-grid blockage;
   their existing manifest coordinates were moved inward from X=+/-176 to
   X=+/-166, and center baffles to Z=28. No object was added.
3. The initial Rampart depth left marginal landing clearance. Its existing
   manifest floor was widened from depth 24 to 32 and rails moved to Z=-174.5 and
   -145.5, preserving all four open entries.
4. The upper Character Lab camera began inside the center merlon. The validation
   camera—not gameplay geometry—was moved to raw X=30, Z=-156.

The follow-up pass found 243 blocks (184 deterministic stair steps), 52 colliding
blocks, 12 props, and 4 cylinders. All are in bounds and manifest-traceable. Tests
found no same-level collider intersections, duplicate visual/server footprints,
unsupported blocks, disconnected intended routes, or blocked spawn exits. The
inspected renders showed no detached objects or visible z-fighting.

## 8. Performance results

- Static map rendering used 4 static batches; the 40-character live scene reported
  1,272 static sources.
- Low-quality overview with 40 generated characters: 36 FPS, p95 39.4 ms in the
  Codex desktop browser environment.
- Main playable view: 659 draw calls, 486,966 triangles, 29 FPS, p95 40.4 ms.
- Upper playable view after camera correction: approximately 649 draw calls,
  478,700 triangles, 34 FPS, p95 56.6 ms.
- Production build passed. Vite still warns about the existing large Three.js
  (537.71 kB) and application (636.20 kB) chunks.

These are local browser measurements, not Chromebook certification. Draw calls
remain higher than desired for low-end hardware; a real Chromebook test is a
remaining acceptance risk.

## 9. Tests actually performed

- `npm test`: **passed 302/302** (shared 92, server 66, web 144).
- Desert Citadel focused suite: **passed 11/11**.
- `npm run typecheck`: passed shared, server, web, and e2e TypeScript checks.
- `npm run lint`: passed.
- `npm run build`: passed shared, server, and production web build.
- `npm run test:load`: passed with 40 authenticated Socket.IO clients: 312 ms
  connection, 250 ms start fanout, 7 ms reconnect, 38,509-byte largest initial
  state, 39 observed movement senders, and a 6,255-byte movement batch.
- Live browser render: overview/lower/main/upper inspected; clean production
  thumbnail generated from the running map.
- `npm run test:e2e -w @quizstrike/web`: attempted and **failed 2/2 before any
  map assertion**. The existing tests request `Your name`/`Join` while the UI now
  exposes `Player name`/`Join game`, and request `Teacher Dashboard` while the UI
  exposes `Teacher workspace`. These are stale unrelated UI selectors; they were
  not changed as part of this map rebuild.

## 10. Remaining risks and recommended playtests

1. Run two real 20-player teams for at least three rounds and record first contact,
   deaths in the first 20 seconds, front occupancy, and spawn pressure.
2. Test Low quality on the actual oldest supported Chromebook, recording median
   FPS, 1% low, draw calls, triangles, and long tasks for a full minute.
3. Walk every stair edge, landing, rail, cover corner, foundation edge, and map
   boundary with client and server position telemetry visible.
4. Test Crown Rampart with the longest-range weapon. If it suppresses more than
   one lower route at once, shorten the exposed angle before adding any cover.
5. Run objective modes separately; confirm that Royal Causeway does not attract a
   disproportionate share of 40-player traffic despite the distributed zones.

## 11. Changed files

- `apps/web/src/game/desertCitadelMap.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/botNavigation.ts`
- `apps/web/src/game/desertCitadelMap.test.ts`
- `apps/web/src/features/quizstrike/QuizStrikeApp.tsx`
- `apps/web/public/assets/arena-maps/desert-citadel.png`
- `docs/DESERT_CITADEL_MAP.md`
- `docs/desert-citadel-audit.md`
