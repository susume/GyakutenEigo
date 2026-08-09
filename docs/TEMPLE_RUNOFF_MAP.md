# Temple Runoff

## Refinement audit (completed before implementation)

### A. Executive summary

Temple Runoff already solved the hardest technical problem: River, Main, and
Upper are genuinely stacked walkable levels with working connectors, height-aware
collision, projectiles, and bot navigation. The map therefore needs a major
refinement, not a rebuild. The priority is to preserve that system while making
the 40-player combat readable and defensible.

### B. Scale and player capacity

The 470 x 400 design-unit footprint is appropriate for 20-v-20. Twenty spawns per
team are already distributed over four rows, but the rows share long east-west
sightlines. The size is sufficient; protection and distribution are the issues.

### C. Route structure

The arena has more than the required three routes: two Main approaches, the River,
the Sun Bridge, and outer ruin flanks. Eight River connectors and four Upper
connections prevent a single hard choke. However, the old bot patrol had only five
serial goals, causing large teams to converge instead of committing to distinct
route families.

### D. Combat zones

Jungle Ruins, Rain Court, Lower Waterway, Sun Bridge, and Temple Terrace are valid
combat zones. Rain Court and Jungle Ruins have some local cover, but the broad
Main slabs between them have few intermediate decisions or fallback positions.

### E. Sightlines and cover

This is the largest weakness. Every spawn row can look toward its opposing row,
the Sun Bridge supports a nearly uninterrupted end-to-end duel, and the River has
large gaps between its three cover pieces. Cover exists, but its spacing is not
appropriate for forty simultaneous players.

### F. Spawn safety

Spawn coordinates are unique and correctly elevated, with nearby route choices.
They are not embedded in collision. Their forward exits nevertheless lack hard
visual screens, allowing suppressive fire to reach too close to the spawn rows.

### G. Vertical gameplay

Vertical gameplay is the map's strongest feature. The River at Y=0, Main at Y=8,
and Upper at Y=17 have connected traversal, stacked-floor selection, and enough
clearance below the bridge. No connector should be removed or relocated during
this refinement.

### H. Bot and navigation readiness

The navigation graph is height-aware and can route between Main and River.
Obstacle parity is test-covered. The remaining weakness is tactical distribution:
bots need persistent north, inner-north, river, inner-south, and south patrol
families rather than one shared loop.

### I. Visual hierarchy and atmosphere

The Rain God, canal, Sun Bridge, sluices, waterfalls, and jungle vegetation create
a coherent flooded-temple theme. From Main and Upper, though, broad empty slabs
and repeated boxes weaken landmark hierarchy. New cover should read as broken
gate screens, arcade piers, tablets, and altars instead of generic crates.

### J. Performance

The static batching and instanced vegetation are sound. River captures are within
the 400-call target; exposed Main and Upper captures are approximately 600 calls.
The refinement should use batched structural stone, avoid new discretionary props
or dynamic lights, and re-profile all three levels after implementation.

### K. Decision

**Level 2 - Major Redesign.** Preserve footprint, floors, connectors, objectives,
water, and art-pass landmarks. Add spawn shielding, staggered mid-route cover,
River cover islands, offset bridge cover, and five persistent bot route families.

## Outcome

Temple Runoff is a symmetrical 20-v-20 battlefield with three simultaneously
walkable elevations:

- **River (Y=0):** a clear east-west canal beneath the central bridge, with sparse
  broken-ruin cover, waterfalls, a broken ford, and a timber crossing.
- **Main (Y=8):** broad team approaches, Rain Court, jungle ruins, bases, and eight
  River stair flights.
- **Upper (Y=17):** the iconic north-south temple bridge, jungle terraces, broken
  parapets, scaffolding, and four independent main-to-upper stair connections.

The source footprint is 470 × 400 design units, or approximately 291 × 248 world
units. This increases playable plan area from 112,000 to 188,000 design units
(+68.1%) while reducing discretionary prop count from 21 to 10 (-52.4%).

The refinement adds eight broken-gate spawn screens, four staggered arcade piers,
four River cover islands, and two offset Sun Bridge altars. These are structural,
colliding pieces rather than discretionary prop clutter. They preserve the
original floor footprints and every level connector.

## Under-platform teleport: cause and fix

The old client and server both asked for one ground height at each X/Z coordinate.
That helper returned the highest authored surface, so a player below a bridge shared
the bridge's X/Z and was clamped upward on the next movement update. Collision and
bot navigation were also two-dimensional.

The map now exposes every floor surface at an X/Z coordinate and selects only a
surface that is physically reachable from the player's current feet. The server
uses the submitted/current Y only to choose among authored surfaces, then validates
the resulting movement; it no longer overwrites Y with the highest surface.
Colliders carry vertical bounds, line-of-sight checks are height-aware, and bot
navigation builds separate nodes for each stacked floor.

## Layout and routes

```text
                   NORTH JUNGLE TERRACE — UPPER (Y=17)
                              │ side stairs
 BLUE BASE — MAIN ── Rain Court / ruins ── RED BASE — MAIN (Y=8)
       │      ╲    ╲      ╲          ╱      ╱    ╱      │
       │       four west River stairs + four east River stairs
       │                       │
       ├──── broken ford ── FLOODED CANAL (Y=0) ── timber crossing ────┤
       │                       │
       │             CENTRAL TEMPLE BRIDGE
       │             deck above canal (Y=17)
       │             ╱ north stairs  south stairs ╲
 BLUE BASE — MAIN ── jungle ruins / Rain Court ── RED BASE — MAIN (Y=8)
                   SOUTH JUNGLE TERRACE — UPPER (Y=17)
```

The primary lanes are the lower flooded canal, two broad main-level approaches,
the central upper bridge, outer jungle/ruin flanks, the broken ford, and the timber
crossing. Eight River stair flights prevent the lower level from collapsing into
a single choke. Two central bridge stairs plus two side terrace stairs give the
Upper level four connections. The bridge has four tall supports and leaves a clean playable route
under its deck.

Twenty unique spawns per team are distributed across four main-level rows near
their bases. Objective, search-item, delivery, and base-zone coordinates are
map-specific and retain their authored elevation.

## Collision, navigation, and minimap

- Client gravity and movement resolve the floor relative to current eye height,
  including authored step-by-step stair elevations.
- Server movement, safe-position recovery, projectiles, and line of sight use
  matching 3D collision bounds.
- Visual blocks and authoritative colliders have exact test-covered parity,
  including minimum and maximum Y.
- Bot A* nodes are generated per floor surface. Height-constrained edges connect
  the stair sequence; a coordinate index avoids scanning the entire grid at every
  expansion.
- Bot patrol goals include river rotations, and waypoints retain Y.
- Printed floor plates, wall signs, and the floating map-name callout are
  removed from overview and FPS views. The minimap stays label-free and uses
  color bands, stair markers, objective icons, and shared elevation data.

## Performance

Local Chrome-compatible browser captures used Medium quality and a generated
40-player session. Results are camera-sensitive:

| View | FPS | p95 | Draw calls | Triangles |
|---|---:|---:|---:|---:|
| River / under bridge | 69–72 | 18.4 ms | 308–337 | 180,454–184,688 |
| Main approach | 69 | 25.7 ms | 598 | 235,146 |
| Upper bridge | 64 | 26.4 ms | 599 | 235,418 |

For comparison, the previous overview capture recorded 64 FPS, 20.4 ms p95,
398 calls, and 208,358 triangles. The new river view is comfortably inside the
400-call target; exposed main and upper views are not. The refined map contains
226 block pieces, 6 cylinders, and 10 discretionary props (242 total authored
objects). The renderer collapses the visible static facade sources into five
material batches, so the new structural cover does not create a separate draw
call for every piece.

A 2026-07-30 diagnostic separated the remaining budget issue: the same Low-quality
Main view measured 327 calls with 10 players and 1,209 calls with 40 players while
retaining the same five static batches. The approximately 882-call delta is
character rendering, not map geometry. Forty-player total rendering therefore
still fails the 400-call hard gate and needs a separate character-instancing or
character-atlas pass.

## Verification

- All 249 shared/server/web tests pass, including 12 Temple-focused movement, map,
  collision, projectile, and art-pass tests.
- A 600-frame regression holds a player beneath the bridge on the river floor.
- Tests cover identical X/Z positions on lower and upper floors, all eight River
  stair flights, all four Upper connections, 20 safe spawns per team, 3D collision
  parity, no direct sightline between any paired opposing spawn row, and a bot
  main-to-river route with vertical waypoints.
- Live probes reported River Y=0, Main Y=8, and Upper Y=17 with no recovery event.
- TypeScript checks and the production build pass.

## Remaining certification

- Run a 10-minute physical Chromebook match with a real 20-v-20 network session.
- Reduce 40-player character rendering enough to meet the 400-call hard ship gate;
  the map facade itself remains consolidated into five batches.
- Validate first-contact and base-to-base timing with classroom telemetry; current
  geometry is designed for roughly 10–18 second central contact and 20–30 second
  committed base routes, but those are design estimates rather than match data.
- Sluices remain short covered pockets rather than long tunnels. Water is shallow,
  has no buoyancy, and vegetation remains non-blocking by design.
