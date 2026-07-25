# Temple Runoff

## Overview

Temple Runoff is an original, symmetrical 40-player jungle-temple battlefield with two genuinely walkable elevations:

- Lower level: a recessed flooded canal, retaining banks, drain pillars, debris cover, and two roofed sluice mouths.
- Upper level: north and south temple terraces containing the Sun Bridge, Rain Court, Rain God monument, Rootway, ruins, and team approaches.
- Connections: four broad stone ramps—two north and two south—link the river floor to the monument tier.
- Teams: 20 Alpha / 20 Bravo, with 15 upper-level and 5 lower-level spawn positions per team.
- Playable footprint: 217 × 198 world units.
- Elevation difference: 7.5 world units between the canal and temple terraces.

Elevation is gameplay-authoritative. The server stores and broadcasts player height, validates movement against the current surface, and prevents projectiles and bots from targeting through the vertical separation.

## Two-level layout

```text
                         NORTH TEMPLE TERRACE · UPPER
  BLUE SHRINE   Sun Bridge / monuments / repair screens     RED EXPEDITION
       │                  ╲ ramp      ramp ╱                       │
       ├───────────────────╲──────────╱────────────────────────────┤
       │               FLOODED CANAL · LOWER                      │
       │        west sluice ~ river cover ~ east sluice           │
       ├───────────────────╱──────────╲────────────────────────────┤
       │                  ╱ ramp      ramp ╲                       │
  BLUE APPROACH    Rain Court / Rain God / Rootway       RED APPROACH
                         SOUTH TEMPLE TERRACE · UPPER
```

The canal is not a painted strip on the upper floor. Its water and cover sit at ground elevation, while the two terrace slabs and their monuments sit 7.5 units above it. The ramps interpolate continuously between those heights.

## Route identity

### Upper north: Sun Bridge

An exposed medium-to-long-range route with repaired deck sections, broken parapets, sun monuments, and timber scaffolding. Alternating cover interrupts a full base-to-base sightline.

### Lower center: Flooded Canal

A fast close-to-medium-range basement route with shallow water, segmented banks, drain pillars, debris, waterfalls, and roofed sluice openings. Five spawns per team seed this level so it is active from the beginning of a round.

### Upper south: Rain Court and Rootway

Rain Court supports larger fights around the Rain God Statue, altars, columns, and collapsed temple wings. Rootway provides a tighter outer flank through roots, rocks, camp cover, and jungle dressing.

### Vertical rotations

Four wide ramps create redundant level changes. Players cannot climb the terrace cliff directly; they must commit to a readable connector. This makes elevation a strategic choice without allowing one ramp to become a single choke point.

## Multiplayer behavior

- Spawn and respawn selection retains the selected floor elevation, including late joins.
- Client movement follows the river, terrace, and ramp surface heights continuously.
- The server recomputes the authoritative elevation from horizontal position instead of trusting a client-supplied height.
- Remote character models, badges, and selection rings preserve their replicated world height while animating.
- Crouching and gravity resolve relative to the current floor.
- Projectiles and bot targeting reject opponents separated by more than 5.5 vertical units.
- Water uses a distinct footstep surface; upper temple paths use stone.

## Performance

Representative local browser capture on Medium quality with a generated 40-player session:

| Metric | Result | Budget |
|---|---:|---:|
| Draw calls | 398 | ≤ 400 |
| Triangles | 208,358 | monitor; character-heavy |
| Static batches | 5 | bounded |
| Instanced vegetation draws | 3 | bounded |
| Observed FPS | 64 FPS | ≥ 30 FPS |
| Observed p95 frame time | 20.4 ms | ≤ 33 ms |

Large overhead badges remain suppressed above 24 players to keep the overview inside the draw-call budget. Hardware and background load affect FPS, so a physical Chromebook certification run is still recommended.

## Verification

Automated coverage includes:

- 20 unique spawns per team, split 15 upper / 5 lower.
- River, terrace, and all four continuous ramp height functions.
- Late-join safe-spawn elevation retention.
- Server-authoritative movement relative to the current floor.
- Cross-floor projectile rejection.
- Remote character animation preserving world elevation.
- Visual/server collision parity and raised-floor placement.
- Art-pass cleanup and quality-scaled vegetation.
- Full shared, server, and web regression tests.
- TypeScript checks and production build.

Browser verification covered the angled two-level overview, recessed river readability, raised terrace silhouette, 10-player clarity, and 40-player performance counters.

## Known limitations

- The sluices are short roofed basement pockets rather than long underground corridors.
- Water is intentionally shallow and does not change movement speed or add buoyancy.
- Decorative vegetation remains non-blocking to avoid invisible collision disagreements.
- Travel-time and connector balance still need live classroom telemetry.
