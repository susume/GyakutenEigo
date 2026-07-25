# Temple Runoff 2.0

## Outcome

Temple Runoff 2.0 is a symmetrical 20-v-20 battlefield with three simultaneously
walkable elevations:

- **River (Y=0):** a clear east-west canal beneath the central bridge, with sparse
  broken-ruin cover, waterfalls, a broken ford, and a timber crossing.
- **Main (Y=8):** broad team approaches, Rain Court, jungle ruins, bases, and eight
  river ramps.
- **Upper (Y=17):** the iconic north-south temple bridge, jungle terraces, broken
  parapets, scaffolding, and three independent main-to-upper connections.

The source footprint is 470 × 400 design units, or approximately 291 × 248 world
units. This increases playable plan area from 112,000 to 188,000 design units
(+68.1%) while reducing discretionary prop count from 21 to 10 (-52.4%).

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
                              │ side ramp
 BLUE BASE — MAIN ── Rain Court / ruins ── RED BASE — MAIN (Y=8)
       │      ╲    ╲      ╲          ╱      ╱    ╱      │
       │       four west river ramps + four east river ramps
       │                       │
       ├──── broken ford ── FLOODED CANAL (Y=0) ── timber crossing ────┤
       │                       │
       │             CENTRAL TEMPLE BRIDGE
       │             deck above canal (Y=17)
       │              ╱ north ramp  south ramp ╲
 BLUE BASE — MAIN ── jungle ruins / Rain Court ── RED BASE — MAIN (Y=8)
                   SOUTH JUNGLE TERRACE — UPPER (Y=17)
```

The primary lanes are the lower flooded canal, two broad main-level approaches,
the central upper bridge, outer jungle/ruin flanks, the broken ford, and the timber
crossing. Eight river ramps prevent the lower level from collapsing into a single
choke. Two central bridge ramps plus a side terrace ramp give the upper level three
connections. The bridge has four tall supports and leaves a clean playable route
under its deck.

Twenty unique spawns per team are distributed across four main-level rows near
their bases. Objective, search-item, delivery, and base-zone coordinates are
map-specific and retain their authored elevation.

## Collision, navigation, and minimap

- Client gravity and movement resolve the floor relative to current eye height,
  including continuous ramp interpolation.
- Server movement, safe-position recovery, projectiles, and line of sight use
  matching 3D collision bounds.
- Visual blocks and authoritative colliders have exact test-covered parity,
  including minimum and maximum Y.
- Bot A* nodes are generated per floor surface. Height-constrained edges connect
  the ramp sequence; a coordinate index avoids scanning the entire grid at every
  expansion.
- Bot patrol goals include river rotations, and waypoints retain Y.
- The minimap uses the larger map bounds, map-specific bases/objectives, clear
  Blue/Red/Jungle/River/Court labels, and level-aware dimming plus River/Main/Upper
  status.

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
400-call target; exposed main and upper views are not. The map contains 68 block
pieces, 6 cylinders, and 10 discretionary props (84 total authored objects).
Its larger-area object density is approximately 37% lower than before even though
ramps and split floor slabs increase structural piece count.

## Verification

- 72 targeted shared/web map and art-pass tests pass.
- A 600-frame regression holds a player beneath the bridge on the river floor.
- Tests cover identical X/Z positions on lower and upper floors, all eight river
  ramps, all three upper connections, 20 safe spawns per team, 3D collision
  parity, and a bot main-to-river route with vertical waypoints.
- Live probes reported River Y=0, Main Y=8, and Upper Y=17 with no recovery event.
- TypeScript checks and the production build pass.

## Remaining certification

- Run a 10-minute physical Chromebook match with a real 20-v-20 network session.
- Profile and reduce the approximately 600 calls in exposed main/upper views if
  the 400-call budget is a hard ship gate.
- Validate first-contact and base-to-base timing with classroom telemetry; current
  geometry is designed for roughly 10–18 second central contact and 20–30 second
  committed base routes, but those are design estimates rather than match data.
- Sluices remain short covered pockets rather than long tunnels. Water is shallow,
  has no buoyancy, and vegetation remains non-blocking by design.
