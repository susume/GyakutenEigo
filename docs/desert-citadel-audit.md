# Desert Citadel map audit and redesign

Date: 2026-08-06  
Target: 40 players, normally 20 Blue vs 20 Red, on school desktops and Chromebooks.

## Final classification

**LEVEL 2 - Major redesign.** The prototype had reusable map registration, a recognizable desert palette, a fountain/citadel idea, and working shared movement rules. It did not have a fair 40-player route graph: its asymmetric side objectives measured approximately 117 vs 262 world units from the two team starts to one side objective, and approximately 229 vs 103 to the other. The result was a major layout and collision redesign, not a small polish pass. A full rebuild was unnecessary because the shared controller, renderer, map loader, and server authority were serviceable and were retained.

## Reference study

| Reference | Principle | QuizStrike adaptation | Reason |
|---|---|---|---|
| Counter-Strike lane-based bomb sites | Clear lane hierarchy, controlled sightlines, and contestable chokepoints | Three readable north, center, and south approaches converge on Fountain Court, with side gates and cover breaks instead of one central funnel | 20v20 needs several simultaneous fights; lane identity lets students understand where pressure is forming | No copied bomb-site layout, map name, props, or branded textures |
| Counter-Strike rotation play | Rotations should cost time and expose the mover without becoming a dead end | Four main terrace stairs, a dry south-yard cut, and mirrored market routes create visible but usable rotations | Players can leave a losing lane and still contribute before the next engagement | No copied callout system or recognizable geometry |
| Fortnite multi-POI arenas | Memorable points of interest, strong silhouettes, and small decisions within a larger route | Palm Ruins, Fountain Court, West/East Markets, South Caravan Yard, and Citadel Skywalk each have a distinct silhouette and material accent | Middle-school players benefit from visual memory instead of floating labels | No copied POI shape, branded asset, or color identity |
| Battlefield desert/urban spaces | Believable large-scale setting, macro and micro cover, and varied engagement distances | A fortified trade city frames a long north lane, raised central court, market combat pockets, and an exposed lower caravan yard | Supports long, mid, and close engagements while keeping the battlefield legible | No copied set piece, map layout, or military branding |
| Halo arena vertical layering | Upper positions should create angles and counterplay rather than automatic dominance | Market stairs feed the shared Skywalk; roof rails and multiple ground approaches keep the height useful but contestable | A single upper route adds decision-making without requiring complex traversal or expensive simulation | No copied arena footprint or signature structure |

## Evidence-backed audit

| ID | Problem | Evidence | Severity | Proposed fix | Verification |
|---|---|---|---|---|---|
| A1 | Prototype side objectives were systematically asymmetric | Baseline measurement from `packages/shared/src/index.ts`: one side objective was about 117 vs 262 units from the two starts; the other was about 229 vs 103 | Critical | Replace one-sided bazaar/sun-hall dependency with mirrored West/East Markets and a central Fountain Court | Current opposite-market approach paths: Blue 282.9 vs Red 280.1 units; lane timing test passes |
| A2 | 40 players had too much incentive to stack one space | Original map definition concentrated the strongest identity around one central route and uneven side destinations | High | Author three macro lanes and distribute six capture zones across north, center, south, markets, and upper route | `desertCitadelMap.test.ts`: authored three-lane test and 40-player opening distribution pass |
| A3 | Spawn sightlines were not sufficiently protected for high-capacity waves | 20 spawns per team existed, but the prototype did not provide equivalent architectural screens across the spawn exit | Critical | Keep broad 20-slot courts, move the rows inward, and let the existing raised court foundation provide the first-frame sightline break | 20+20 spawn overlap and every Blue/Red pair line-of-sight test pass |
| A4 | Travel fairness was hidden by route geometry rather than measured | Baseline side-objective timings differed by roughly 9.7 seconds in one comparison | Critical | Mirror side districts and use shared run-speed path measurements | Current north 10.20/10.57 s, center 10.79/10.47 s, south 15.07/14.45 s at 14.8 units/s |
| A5 | Vertical movement and collision data were duplicated or vulnerable to drift | Client map blocks and shared floor/obstacle data were separate; roof stair sampling also exposed bot-grid aliasing | Critical | Author six shared stair flights, use the same floor resolver for client/server/bots, and use a Desert-specific 5-unit nav sample | Stair continuity, movement blockers, collider parity, and bot route tests pass |
| A6 | Upper movement had no reliable lower-to-upper connection | The prototype's upper geometry was not a complete route from both teams | High | Add mirrored market stair flights and a shared Skywalk with roof rails and approach cover | Bots reach both roof approaches and Skywalk; roof crossing test passes |
| A7 | Combat spaces lacked a cover hierarchy | Long sightlines and repeated low-value cover made the central fight too uniform | High | Keep only low court edges, the fountain rim, one monument, ruin walls, and three lower-yard cover pieces; remove filler walls and columns | Static obstacle audit and approach-path tests pass; real-player peeking test remains required |
| A8 | The lower route was visually noisy and the river sat at the map's far edge without a strong gameplay reason | The supplied first-person screenshots showed the lower water feature reading as a detached strip rather than a useful combat space | Medium | Remove the river, bridges, and water pools; retain a dry South Caravan Yard with low cover and the same lower-floor rotation | Focused map test confirms no canal water/pool geometry and the south-yard path remains reachable |
| A9 | Navigation depended on labels rather than architecture | Prototype contained map-specific labels/markers in places where silhouette could do the job | Medium | Remove floor marks and signs; use repeated gates, market colors, palms, obelisk, and arch silhouettes | `floorMarks` and `signs` are empty; no floating navigation labels added |
| A10 | Visual and authoritative collider footprints could diverge | Client collision proxies used extra padding while shared server obstacles used the player radius directly | Critical | Use zero extra proxy padding for Desert Citadel, leaving the shared 0.45-unit player footprint authoritative | Visual/shared collider footprint test passes |
| A11 | Bot goals and patrols were not aligned with the redesigned regions | `apps/server/src/botNavigation.ts` still referenced old diagonal bases and old side-region assumptions | High | Use mirrored base goals, symmetric patrol stages, market approaches, lower caravan-yard goals, and Skywalk goals | Bot route tests cover all three lanes, both markets, and the upper route |
| A12 | Performance risk came from decorative repetition rather than gameplay geometry | Renderer already supports static batching, material reuse, quality levels, shadow gating, LOD, and disposal; map needed a bounded art pass | Medium | Keep a bounded block/prop budget, no floor marks/signs, and reuse the existing batcher/material/quality paths | Build and tests pass; actual Chromebook FPS still needs device measurement |
| A13 | Boundary escapes and hidden shortcut surfaces were not proven | Multi-level geometry can create floor shortcuts or out-of-bounds hiding spots | High | Add deterministic bounds, perimeter walls, the raised foundation, roof rails, and stair-only elevation changes | Shortcut, bounds, and level-surface tests pass; physical 40-client soak remains recommended |
| A14 | Lower players could be lifted onto the upper route from below a roof footprint | `getArenaRecoveryGroundHeight` treated any lower player under a market roof or Skywalk as embedded in a raised structure and set Y directly to 24 | Critical | Remove automatic Y recovery; normal floor resolution and collision rejection now keep lower players on Y=0 | Regression tests cover a lower player below a market roof and below the Skywalk; client/server recovery writes were removed |
| A15 | Repeated cyan arches obscured route reads and placed decorative objects directly in front of the Blue/Red stair approaches | The supplied screenshots show repeated arch pieces filling the stair mouth, upper landing, market route, and Skywalk without changing cover or traversal | Medium | Remove all decorative arch props; retain structural gate blocks, stairs, team banners, market canopies, palms, and objective geometry | Prop budget is now 9 with zero arch props; both base stair-mouth clearance assertions pass |
| A16 | The first simplification still left non-purpose walls in base exits, court edges, market roofs, north ruins, and the lower yard | Live 20-player room traversal and the supplied first-person screenshots showed large blank screens, duplicate cover rows, and filler ruin pieces that narrowed the player view without adding a decision | High | Remove base pavilions/screens, court side and broken walls, the court planter/columns, market roof screens, north ruin filler, duplicate south-yard cover, and replacement spawn covers; move spawn rows inward so the raised court supplies the safety break | Current map is 185 blocks, 9 props, 4 cylinders, and 43 obstacle proxies; final Desert Citadel suite passes 10/10 |
| A17 | High-quality map construction still scattered edge rocks from seeded procedural placement | `apps/web/src/game/arenaMapBuilder.ts` created 34 visible `InstancedMesh` rock instances from randomized positions for every map at detail 2; those objects were not traceable to the Phase 3 Desert manifest | High | Disable that scatter only for Desert Citadel and guard the policy with a regression test; retain authored blocks/props and fixed VFX anchors | `shouldScatterEdgeRocks(2, true)` is false; the manifest sanity test and full web suite pass |

## Redesign proposal

### Teams and macro routes

- Blue starts in the west Assembly Court; Red starts in the mirrored east Assembly Court. Each court has 20 positions across five inward rows; the main exits are open and the raised central court blocks the first-frame cross-map sightline.
- **North Lane - Palm Ruins:** long-range route with the Dawn Obelisk, paired ruin walls, palms, and broken sightlines.
- **Center Lane - Fountain Court:** the main raised court, Lion Gate/Sun Gate pair, fountain rim, Sun Dial Monument, and low parapets. It is the fastest contest route but not a single doorway.
- **South Lane - South Caravan Yard:** lower, exposed route with dry paving, paired cover rows, palms, and south terrace stairs. It is the safest rotation from a losing center fight but has less cover.
- **Upper Route - Citadel Skywalk:** mirrored market stairs lead to roof fighting and a shared upper crossing. Roof rails make the height useful without making it a free win.

Cross-lane rotations are the four main-level stair flights, the open South Caravan Yard, and the market courts. Side districts are mirrored so each team has one near-side market and one contestable far-side market with the same architecture.

### Combat zones and objectives

1. Palm Ruins: long sightlines and medium cover.
2. Fountain Court: primary contest space with multiple gates and approaches.
3. West Market and East Market: mirrored close/mid combat districts with stair courts.
4. South Caravan Yard: lower-level exposed rotation and dry cover fights.
5. Citadel Skywalk: upper cross-map counter-route.

Capture zones and search/retrieve locations are distributed across these spaces. Delivery zones remain deep and mirrored at the west/east boundary rather than forcing a team through the same center doorway.

### Navigation graph

```text
                 [Palm Ruins / North Lane]
                    /       |        \
       [Blue Court] ---- [Fountain Court] ---- [Red Court]
          |  \            /   |   \            /  |
          |   [West Market] [South Stairs] [East Market]   |
          |        \          |          /        |
          +--------- [South Caravan Yard / dry cover] ------+
                         |              |
                    [Market Stairs] -- [Citadel Skywalk]
```

The graph is intentionally architectural: players read gates, palms, dry yard cover, market canopies, roof rails, and the fountain instead of world-space instructional labels.

### Phase 3 authoritative geometry manifest

This is the complete manifest for the implementation. It is deliberately grouped
by gameplay reason; the IDs are the traceability keys used by the visual map and
the shared collision proxies. No wall, structure, or major prop outside this list
is permitted.

| Manifest group | Authored IDs | Gameplay reason |
|---|---|---|
| Perimeter shell | `north-cliff-west`, `north-cliff-east`, `south-wall-west`, `south-wall-east`, `west-city-wall-north`, `west-city-wall-south`, `east-city-wall-north`, `east-city-wall-south` | Close the four map edges, preserve the citadel silhouette, and remove boundary escapes. |
| Lower route slabs | `north-lane-paving`, `south-lane-paving` | Make the north and south approaches readable and stable on the lower floor. |
| Fountain Court support | `court-floor`, `court-foundation` | Create the deterministic main-level surface and block lower-to-main shortcuts through the solid terrace. |
| Main-level stairs | `citadel-west-main-stairs`, `citadel-east-main-stairs`, `citadel-north-main-stairs`, `citadel-south-main-stairs` | Provide four wide, authored lower-to-main connectors. Each flight expands to its exact `-step-1` through `-step-14` pieces. |
| Assembly Court spawn walls | `blue-base-back`, `blue-base-north`, `blue-base-south`, `red-base-back`, `red-base-north`, `red-base-south` | Hold 20 safe positions per team while leaving the forward court exits open. |
| Team gates | `lion-gate-north-pier`, `lion-gate-south-pier`, `lion-gate-lintel`, `sun-gate-north-pier`, `sun-gate-south-pier`, `sun-gate-lintel` | Mark the mirrored center-lane transitions and split the approach without creating one doorway choke. |
| Fountain Court cover | `court-parapet-north-west`, `court-parapet-north-east`, `court-parapet-south-west`, `court-parapet-south-east`, `court-monument` | Supply low and medium cover plus one central landmark for contestable main-level fights. |
| Market structures | `west-market-mass-north`, `west-market-mass-south`, `east-market-mass-north`, `east-market-mass-south`, `west-market-roof`, `east-market-roof`, `west-market-roof-rail-north`, `west-market-roof-rail-south`, `east-market-roof-rail-north`, `east-market-roof-rail-south` | Define mirrored close/mid combat districts and their contestable upper roof surfaces. |
| Shared upper route | `citadel-skywalk`, `citadel-skywalk-rail-north`, `citadel-skywalk-rail-south`, `west-market-roof-stairs`, `east-market-roof-stairs` | Connect both market roofs through the Citadel Skywalk and expose the upper position to ground counterplay. Each roof flight expands to its exact `-step-1` through `-step-40` pieces. |
| Palm Ruins | `ruins-wall-west`, `ruins-wall-east`, `ruins-obelisk`, `ruins-obelisk-crown` | Break the north sightline into readable long-range duels and establish the northern landmark. |
| South Caravan Yard cover | `caravan-yard-cover-north-west`, `caravan-yard-cover-north-center`, `caravan-yard-cover-north-east` | Give the lower rotation lane a single staggered cover row without turning it into a second choke. |
| Major visual props | `west-market-canopy`, `east-market-canopy`, `north-palm-west`, `north-palm-east`, `caravan-yard-palm-west`, `caravan-yard-palm-east`, `blue-base-banner`, `red-base-banner`, `obelisk-banner` | Provide team orientation, market identity, and desert atmosphere without blocking navigation. |
| Major cylinders | `blue-fountain-rim`, `blue-fountain-water`, `caravan-yard-marker-west`, `caravan-yard-marker-east` | Provide the central landmark/water accent and two non-blocking south-yard navigation anchors. |

The four Phase 3 stair entries are expanded by the shared stair table in
`packages/shared/src/index.ts`; that table is the authoritative source for every
step coordinate, elevation, width, and count. Before the final implementation
pass, the Geometry Sanity Pass required one dimensional correction to existing
manifest objects: the four side perimeter segments were shortened from depth 132
to 124 so they meet the north/south walls without overlapping them, and the four
base side returns were moved from x +/-233 / width 26 to x +/-232 / width 24 so they
meet the perimeter without duplicate collision volume. This adds no objects and
preserves the intended spawn exits and route graph.

## Implementation summary

- `apps/web/src/game/desertCitadelMap.ts` was rebuilt around mirrored Assembly Courts, three lanes, Fountain Court, Palm Ruins, West/East Markets, South Caravan Yard, and Citadel Skywalk. The second simplification pass removes non-purpose base, court, roof, ruin, and lower-yard blockers; the decorative pass has nine props and no arch props.
- `packages/shared/src/index.ts` now owns the six Desert Citadel stair profiles, lower/main/upper floor surfaces, mirrored objectives and search/retrieve points, deterministic obstacle proxies, map bounds, and a Desert-specific navigation-grid sample size. It no longer performs the faulty automatic raised-floor recovery.
- `apps/server/src/botNavigation.ts` now patrols and targets the same mirrored regions as the map, including market approaches, lower caravan-yard positions, and roof positions.
- `apps/web/src/game/desertCitadelMap.test.ts` now checks route authorship, dry lower-route geometry, Phase 3 manifest traceability, boundary joins, under-roof floor behavior, prop restraint, base stair-mouth clearance, removed-clutter IDs, floor levels, stair continuity, collider parity, spawn safety, bot reachability, lane timing, upper-route rotation, and a 40-player lane distribution.
- `apps/web/src/game/arenaMapBuilder.ts` uses no extra visual-collider padding for Desert Citadel and disables the shared seeded edge-rock scatter for this map, matching the shared player footprint and keeping every visible object traceable to the manifest.
- `apps/web/src/features/quizstrike/QuizStrikeApp.tsx` uses the authored Skywalk center for the Desert Citadel upper-level Character Lab camera, so render validation no longer starts on a stair step.

## Measured current snapshot

- World footprint: 310 x 223.2 units, bounds +/-155 x +/-111.6.
- Spawns: 20 Blue and 20 Red, all on the lower floor; no tested overlap and no tested direct cross-team spawn line of sight.
- Geometry budget after the river removal and two simplification passes: 185 blocks, 9 props, 4 cylinders; 42 colliding blocks plus 1 colliding cylinder represented by 43 shared obstacle proxies.
- Lane route lengths from the first Blue/Red spawn at run speed 14.8: north 150.9/156.5, center 159.7/155.0, south 223.0/213.9 units.
- Opening travel estimates: north 10.20/10.57 s, center 10.79/10.47 s, south 15.07/14.45 s. The automated acceptance limit is under 15% asymmetry and 7-18 seconds; all three pass.
- Opposite-market approach: Blue to East 282.9 units and Red to West 280.1 units, under 1% difference.
- Upper route from the first spawn: Blue 224.8 units / 15.19 s and Red 216.7 units / 14.64 s.
- No world-space signs or floor arrows are authored. Team orientation uses west/east bases, blue/red cloth, mirrored geometry, and distinct landmark silhouettes.

### Geometry Sanity Pass

The final sanity pass ran before the full repository validation. It found eight
intentional-looking but unacceptable collider intersections at perimeter corners
and base side returns. I corrected those existing manifest objects before the
remaining checks: the four side perimeter segments now use depth 124 instead of
132, and the four base side returns use x +/-232 / width 24 instead of x +/-233 /
width 26. No object was added, and the shared obstacle proxies were updated in
lockstep. The follow-up pass found:

- 185 visible blocks, 42 colliding blocks, 9 props, and 4 cylinders all match the
  Phase 3 manifest; no untraceable geometry remains.
- No floating or out-of-bounds authored blocks, no same-level overlapping
  colliding rectangles, and no duplicate visual/shared collider footprints.
- Lower, main, and upper fixed-camera captures reported ground Y 0, 10, and 24;
  the corrected Skywalk capture reported `currentNavRegion=desert_citadel:upper`
  and `colliderName=none`.
- Generated lower/main/upper and overview screenshots showed no visible
  z-fighting or detached support in the inspected views. Full physical route
  walking and real-player exploit sweeps remain recommended.

## Validation log

### Completed

- The existing audit record before this pass reported a working baseline; the fresh final checks below are the acceptance evidence for the current tree.
- Final repository checks: `npm test` passed all 301 tests (shared 92, server 66, web 143 including the map-builder guard); `npm run typecheck` passed shared/server/web/e2e TypeScript checks; `npm run lint` passed; and `npm run build` passed for shared/server/web. The production build still reports large chunks: Three.js 537.71 kB, application 634.38 kB, and CSS 334.91 kB.
- `npm run build -w @quizstrike/shared`: passed after the redesign.
- `node node_modules/tsx/dist/cli.mjs --test apps/web/src/game/desertCitadelMap.test.ts`: passed all 10 Desert Citadel tests, including the Geometry Sanity Pass.
- `npm run test:load`: passed with 40 authenticated Socket.IO clients: connection 229 ms, start fanout 265 ms, reconnect 6 ms, largest initial state 38,483 bytes, 39 observed movement senders, one movement batch, and 6,264-byte observed movement payload.
- Shared floor resolver checks: all six flights climb continuously and finish at their authored landing values; no accidental stacked floors were introduced.
- Geometry-based bot checks: all three lanes, both market approaches, the shared Skywalk, and roof-to-roof rotation are reachable.
- Movement checks: the raised foundation still rejects invalid shortcuts, base exits are open, and visual and authoritative collider footprints match.
- Spawn checks: 20+20 positions are clear in the static test and protected from direct spawn-to-spawn fire in the tested first frame.
- Browser visual check: headless Chromium loaded Character Lab and generated fixed Desert Citadel lower/main/upper plus overview captures in `.codex-map-preview/desert-citadel-audit-2026-08-06/`. The fixed upper capture reported ground Y 24 and the upper navigation region. The inspected captures had no page errors and no collider name reported. This is a render harness check, not a physical Chromebook certification.

### Not yet proven by this repository run

- No physical 40-client classroom match was available. The 40-player flow result is bot/geometry-based inference, not a real-player playtest.
- No Chromebook hardware was available for certification. The fresh headless Chromium Low captures recorded lower 902 calls / 553,982 tris / 2 FPS / 634.1 ms p95, main 655 calls / 475,306 tris / 2 FPS / 785.6 ms p95, and fixed upper 1,185 calls / 628,758 tris / 1 FPS / 890.9 ms p95; Medium overview recorded 1,203 calls / 518,506 tris / 1 FPS / 943.9 ms p95. These values are software-rendered automation evidence, not device performance claims, and they fail the desired 400-call gate in this environment.
- `npm run test:e2e` was attempted after a successful production build but failed in two existing classroom-flow selectors before a map-specific assertion: `apps/web/e2e/classroom.spec.ts:63` waited for accessible label `Your name` while the rendered join control is labeled `Player name`, and `apps/web/e2e/tournament.spec.ts:43` waited for `Teacher Dashboard` while the rendered public landing control is `TEACHER WORKSPACE`. Failure screenshots were captured at `apps/web/test-results/classroom-student-customiz-be451--match-start-over-Socket-IO/test-failed-1.png` and `apps/web/test-results/tournament-teacher-creates-7feb2-rnament-study-first-bracket/test-failed-1.png`. These are UI-selector mismatches, not evidence of a Desert Citadel geometry failure.
- The Character Lab captures cover lower, main, upper, and overview viewpoints, but they do not replace real traversal through every stair edge, market approach, spawn exit, and boundary. The browser run used generated 40-player characters, not a 40-player classroom match.

## Recommended playtests and remaining risks

1. Run two 20-player teams through three rounds, recording first-contact timestamps by lane, deaths in the first 20 seconds, market/skywalk occupancy, and spawn pressure.
2. Test the low-quality preset on a school Chromebook and record one-minute median FPS, 1% low FPS, renderer draw calls, triangle count, and long-task count with 40 players or bot proxies.
3. Probe every stair, dry-yard cover edge, roof rail, market stairwell, perimeter wall, and short spawn-safety cover with a real client plus a server-side spectator. Pay special attention to stepping off the market stairs and landing on roof slabs.
4. Run a boundary and prop sweep with crouch, jump, sprint, and respawn to find hiding spots that the static obstacle tests cannot discover.
5. Check the center monument and upper Skywalk with actual weapon fire. If either position controls too many lanes, lower or perforate the cover rather than adding more clutter.
