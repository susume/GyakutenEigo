# Temple Runoff

## Overview

Temple Runoff is an original, symmetrical 40-player jungle-temple battlefield. Four west-to-east routes offer deliberately different combat rhythms while a set of broken walls, canal banks, sluice portals, courtyard pockets, and cross-lane gaps prevents one dominant sightline.

- Playable footprint: 217 × 198 world units
- Teams: 20 Alpha / 20 Bravo
- Spawn exits: four per team, one aligned to each primary route
- Landmark: central Rain God Statue
- Visual elevation bands: bridge/scaffold, main court, canal/sluice
- Movement: reliable ground-plane traversal; water does not slow the player
- Lighting: warm late-afternoon key light with cool turquoise bounce in the canal

## Top-down layout

```text
                        NORTH ESCARPMENT
  BLUE SHRINE                                                   RED EXPEDITION
  ┌──────────┐   A  SUN BRIDGE — monuments — repairs — drops   ┌──────────┐
  │ Sun exit ├═══════╤════════╤══════════╤════════╤═════════════┤ Sun exit │
  │          │       └─┐      cover   cover      ┌─┘             │          │
  │Canal exit├── B  FLOODED CANAL ~ pillars ~ debris ~ falls ───┤Canal exit│
  │          │      west sluice ╲          ╱ east sluice         │          │
  │Court exit├── C  RAIN COURT ── RAIN GOD ── altars/columns ───┤Court exit│
  │          │             ╲ broken causeway ╱                   │          │
  │ Root exit├── D  ROOTWAY — cave — roots — camp — rock ───────┤ Root exit│
  └──────────┘                                                   └──────────┘
                     SOUTH JUNGLE / OUTER FLANK
```

The diagram is schematic. Cover is deliberately offset rather than mirrored prop-for-prop, while route width, spawn protection, and useful travel distance remain balanced.

## Areas and route identity

### A · Sun Bridge

An exposed medium-to-long-range crossing with three repaired deck sections, broken parapets, two sun monuments, timber scaffolding, and side gaps that act as visual drop escapes. Alternating cover breaks the full cross-map sightline without turning the bridge into a tight corridor.

Best fit: Starter and Heavy launchers. Quick launcher players can use the repair screen and broken-wall pockets to advance.

### B · Flooded Canal

A fast lower route made from one efficient shallow-water surface, segmented retaining walls, two drains, pillar cover, floating repair debris, two animated waterfalls, and open sluice portals. Water is visual only and never changes movement speed.

Best fit: Starter and Quick launchers. Short flanks through the bank gaps let players escape pressure instead of becoming trapped in the canal.

### C · Rain Court

The broadest team-fight space. Four collapsed temple wings frame the central Rain God Statue, with two low altars, columns, pottery debris, and multiple entrances. Cover creates several 3–5 player pockets inside a space that can hold 12–16 players without becoming an empty square.

Best fit: all gear. Heavy launchers work from the outer ruins; Quick launchers work between the statue, altars, and column pockets.

### D · Rootway

The safer outer flank. A cave fragment, fallen log, root-covered idol, survey camp, short boardwalk, palms, rocks, and dense edge vegetation keep sightlines short. Vegetation is placed outside critical path centers and has consistent non-blocking collision behavior.

Best fit: Starter and Quick launchers.

### Secondary connections

- West and east sluice portals connect the canal and court bands through roofed, readable openings.
- The Broken Causeway provides a risky court-to-Rootway shortcut.
- Canal bank breaks serve as ramps/rotations to the upper routes.
- Broken Sun Bridge parapets provide several lateral escape gaps.
- The outer jungle edges create two protected flanking approaches.

## Travel-time estimates

Times use the default 10.8-unit movement pace and include the intended cover detours. Sprinting or cutting a risky exposed line is faster.

| Movement | Expected time |
|---|---:|
| Spawn cluster to its protected exit | 2–4 seconds |
| Spawn to first contested cover | 10–13 seconds |
| Adjacent route rotation through a safe connector | 8–11 seconds |
| Canal-to-Rootway full rotation | 12–15 seconds |
| Base to opposing objective route | 19–23 seconds |
| Exposed sprint line, base to opposing side | 14–17 seconds |

These are design estimates rather than telemetry from a live classroom. The route-connectivity tests guarantee access, but production playtests should tune individual cover pieces if real players consistently beat or exceed these bands.

## Combat ranges

| Route | Typical range | Longest intended sightline |
|---|---|---:|
| Sun Bridge | medium–long | ~55 world units |
| Flooded Canal | close–medium | ~34 world units |
| Rain Court | mixed | ~42 world units |
| Rootway | close | ~26 world units |
| Sluice connectors | close | ~18 world units |

No primary route exposes a clean base-to-base shot. The five-piece base screens interrupt direct spawn sightlines while leaving four generous exits.

## Modular construction set

Temple Runoff reuses the arena renderer's shared geometry/material pipeline and adds no external texture dependency.

- Mossed sandstone wall, ruin, gate, tower, and rock modules
- Sun-stone bridge deck and broken parapet modules
- Timber repair plank, scaffold, crate, log, boardwalk, and survey-camp modules
- Canal water plane, drain cylinder, retaining bank, waterfall plane, and sluice portal
- Column, arch, altar, pottery/debris, banner, lamp, palm, and shade props
- Rain God statue assembled from reusable box, cone, and cylinder primitives
- Instanced trunks, broad leaves, and ferns for jungle dressing

Static temple meshes use the existing surface atlas and are merged by material. Repeated jungle vegetation uses three instanced draws. Transparent rendering is limited to the canal and two waterfall sheets.

## Performance budget

Representative local browser capture, Medium quality, generated 40-player session:

| Metric | Result | Budget |
|---|---:|---:|
| Draw calls | 395 | ≤ 400 |
| Triangles | 208,162 | monitor; character-heavy |
| Static source meshes | 758 | batched |
| Static batches | 5 | bounded |
| Instanced vegetation draws | 3 | bounded |
| Final FPS sample | 77 FPS | ≥ 30 FPS |
| Final p95 frame time | 15.8 ms | ≤ 33 ms |

The initial Temple pass measured 431 calls. Large overhead views were drawing 36 separate player badge sprites that were too small to read. Badges are now suppressed only when an overhead view contains more than 24 players; FPS identification remains unchanged. The resulting 395-call capture is also below the same-run Desert Citadel baseline of 483 calls.

Hardware and background load affect FPS, so draw calls and frame time are the most reproducible local signals. A physical Chromebook certification run is still required before claiming classroom-device certification.

## Multiplayer and gameplay verification

Automated checks cover:

- `temple_runoff` setting sanitization and shared map lookup
- exactly 20 unique spawn positions per team
- four named spawn groups per team
- every spawn starting clear of authoritative collision
- all four primary routes crossing the arena inside their intended route band
- one-to-one parity between every visual collider and all 49 server-authoritative proxies
- Rain God landmark presence
- quality-scaled vegetation counts and art-pass cleanup
- full shared and web regression suites
- TypeScript compilation for shared, server, web, and end-to-end sources
- production Vite build

Browser verification covered the 40-player Medium-quality overview, performance counters, map readability, map selection, and console diagnostics. No browser warnings or errors were reported during the final map render.

## New systems and integration points

- New shared `ArenaMapId`: `temple_runoff`
- Map-specific 20-player spawn arrays and public spawn lookup
- New authoritative Temple Runoff obstacle set used automatically by server movement, bots, projectiles, and line-of-sight checks
- New modular map definition and selection entry
- New `TempleRunoffArtPass` with batched landmark/scaffolding geometry, animated waterfall opacity, and instanced vegetation
- Temple-specific sky, fog, lighting, minimap treatment, labels, and stone footstep surface
- Large-overview badge culling to protect the 40-player draw-call budget

## Known limitations

- The current movement engine uses one ground plane. Bridge, court, and canal levels are communicated through decks, retaining architecture, roofs, scaffolding, and sightline composition rather than true independently walkable stacked floors.
- The two sluices are short roofed connectors, not long subterranean loading corridors.
- Water is intentionally non-physical and has no slowdown, buoyancy, or splash collision.
- Vegetation is non-blocking so decorative leaves cannot create invisible collision disagreements.
- Travel-time values need classroom telemetry for final balance tuning.
- The local desktop capture is not a substitute for testing on the project’s target Chromebook hardware.
