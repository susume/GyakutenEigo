# Temple Runoff — 40-Player Map Audit and Redesign

## Pre-implementation audit

### A. Existing map classification

**LEVEL 3 — Rebuild.**

Temple Runoff is named in the design brief but is not present in the current runtime. The selectable and authoritative map IDs are only `desert_citadel` and `iron_junction`; there is no Temple Runoff geometry, collision set, spawn table, objective data, minimap treatment, or map-specific visual pass to improve in place. Building it as a complete third battlefield is therefore safer and more honest than disguising Desert Citadel with jungle props.

### B. Current strengths worth preserving

- The shared arena footprint already supports a large 20v20 battlefield.
- The renderer separates visible geometry from simplified authoritative collision.
- Existing maps demonstrate reusable, quality-aware blocks, props, static batching, material sharing, spawn selection, and low-cover jump rules.
- The Temple Runoff fantasy from the brief is strong: ancient jungle architecture, water infrastructure, ruins, and layered-looking spaces.

### C. Critical problems

- The map is absent from the shared map union, session sanitizer, selector UI, Character Lab, renderer registry, server collision lookup, and tests.
- The client draws Desert Citadel spawns, bases, capture zones, and retrieve markers regardless of the selected map.
- Objectives and buy/base presentation are not routed through map-specific getters.
- The movement model is a flat authoritative X/Z simulation. Client jump height is sent as transient `y` only for clearing low obstacles; players cannot stand on authored elevated support surfaces. A visually elevated route must therefore remain non-playable until a separately tested server-authoritative height system exists.

### D. 40-player flow problems

There is no Temple Runoff flow to validate. A naive single river crossing would funnel both teams into one central fight. The rebuild must instead provide:

- three full-width macro routes;
- two spawn-side distribution hubs;
- three cross-lane rotation bands;
- eight combat districts with different ranges;
- at least three genuine exits from each 24-point team spawn;
- no mandatory single bridge, doorway, or tunnel.

### E. Competitive balance

No Temple Runoff balance data exists. The new battlefield uses mirrored travel opportunities with asymmetric local cover silhouettes. Both teams receive equivalent distances to the central causeway, canopy flank, runoff flank, rotation gates, and contested objectives.

### F. Collision and movement problems

- Collision is intentionally simplified to rectangles and circles.
- The authoritative controller accepts 14.8 units/second sprint movement, clamps to the shared arena bounds, and rejects swept movement through non-jumpable obstacles.
- Client standing eye height is 1.68, crouched eye height is 1.08, body radius is 0.45, jump velocity is 5.8, and gravity is 15.5.
- Decorative arches, water sheets, vegetation, floor markings, and overhead temple massing must not create invisible blockers.
- Low cover marked `jumpable` must remain low enough for the real jump path and server `y >= 5` clearance rule.

### G. Visual and environmental problems

There is no Temple Runoff visual identity. The rebuild needs recognizable districts rather than repeated boxes: shrine spawn courts, a canopy ruin, a processional causeway, a sunken altar court, runoff terraces, cistern houses, and a monumental central temple silhouette. Water must read as managed temple runoff with basins, spillways, and bridges rather than a random blue strip.

### H. Bot navigation problems

Bots currently use direct pursuit plus one perpendicular detour rather than a navmesh. Dense mazes, thin doorways, concave pockets, and dead ends are unreliable. Temple Runoff must use broad connected lanes and offset cover islands that the existing detour logic can negotiate.

### I. Performance risks

- Individually authored foliage can inflate draw calls and geometry count.
- Transparent water and excessive point lights are expensive on Chromebooks.
- Too many collision proxies increase every movement and line-of-sight query.

The rebuild should reuse the existing material cache and static batcher, keep the collision set compact, use a small number of water surfaces, and reserve extra vegetation for higher quality tiers.

### J. Exploits

The absent map has no current exploits, but the design must prevent:

- direct spawn-to-spawn and mid-to-spawn fire;
- gaps between boundary blockers;
- unintentional hiding inside temple massing;
- jumpable cover paths that escape the arena;
- dominant central positions without at least two counters.

### K. Redesign plan

#### Navigation graph

```text
BLUE SHRINE COURT                         RED SHRINE COURT
  ├─ Canopy Gate ─ Canopy Ruins ─ Orchid Court ─ Canopy Gate ─┤
  ├─ Causeway Gate ─ West Basin ─ SUN ALTAR ─ East Basin ─────┤
  └─ Runoff Gate ─ Cistern Walk ─ Cascade Gardens ─ Cistern ──┘
                     │              │              │
                 West Rotation  Mid Spillway  East Rotation
                     └──── connects all three macro routes ────┘
```

#### Route identities

- **Canopy Trail (north):** protected close/medium-range flank through broken walls and vegetation.
- **Processional Causeway (centre):** fastest contested route, medium-range, with offset structural cover and multiple bridge-width crossings.
- **Cascade Runoff (south):** safer waterworks flank with cistern houses, staggered sightlines, and short-range rotation pockets.

#### Combat districts

1. Blue Shrine Court
2. Red Shrine Court
3. Canopy Ruins
4. Orchid Court
5. West Catch Basin
6. Sunken Altar
7. East Catch Basin
8. Cascade Gardens

#### Vertical structure

The first implementation uses vertical **massing and sightline control**—towers, terraces, aqueducts, overhead roots, and stepped silhouettes—while keeping all intended player routes on the authoritative ground plane. This avoids client/server elevation disagreement. Playable upper and lower support surfaces are explicitly deferred until the shared movement protocol owns player height.

#### Expected timing

At 14.8 units/second sprint speed, approximately 50–70 scaled units from spawn rows to first contact yields roughly 3.5–5 seconds to the nearest engagement and 6–9 seconds to central objectives, depending on route and cover.

## Validation record

### Implemented structure

- Added `temple_runoff` as a third authoritative map ID and valid session setting.
- Added 24 distinct spawn points per team in protected four-by-six shrine courts.
- Added a compact 41-proxy authoritative collision set matching every visible collidable block and cylinder.
- Added map-specific capture zones, retrieve items, delivery zones, spawn markers, minimap palette, district labels, route metadata, and selection UI.
- Added 42 structural/environment blocks, six cylinders, five route marks, 20 authored props, quality-scaled instanced ferns, and high-quality-only runoff mist.
- Kept all intended traversal on the server-supported ground plane. Overhead aqueducts and the temple crown are non-colliding silhouettes, not false playable floors.

### Automated validation

- Full workspace typecheck: passed.
- Shared, server, and web tests: passed.
- Existing 40-client authenticated Socket.IO load test: passed.
- All 48 Temple Runoff team spawns accept an initial authoritative movement step.
- Visible and authoritative collision ID sets match exactly.
- Sampled north, centre, and south routes traverse from the Blue court to the Red court without a blocked segment.
- Representative spawn-to-mid and spawn-to-spawn lines of sight are blocked.
- The map sanitizer preserves `temple_runoff` rather than falling back to Desert Citadel.

### Browser/WebGL validation

Character Lab, 40 generated players:

| View | Quality | Draw calls | Triangles | Observed FPS |
| --- | --- | ---: | ---: | ---: |
| Overview | Medium | 249 | 57,600 | 54 |
| Overview | Low, steady sample | 247 | 50,324 | 55 |
| First person | Low | 311–319 | about 56,000 | automation sample was unstable |

The overview samples are below the documented Medium target of 400 draw calls. First-person automated FPS was also unstable on Desert Citadel in the same in-app browser run, so it is not used as a device-certification result. No browser console errors or WebGL render fallback appeared.

### Post-implementation traversal and flow findings

- Three independent macro routes and three cross-lane rotation bands remain connected.
- The centre altar and catch basins break the longest sightline without closing the causeway.
- North and south routes bypass the central objective, preventing a single mandatory fight.
- Spawn screen walls and centre piers block direct fire while leaving north, centre, and south exits.
- Low cover is server-authoritatively jumpable; major structural cover is not.
- Water, arches, foliage, floor markings, aqueduct silhouettes, and mist do not add collision.

### Remaining risks

- A real 20v20 playtest is still needed to tune first-contact density, respawn-wave route choice, and objective weighting.
- Physical Chromebook certification is still required; browser automation is not a substitute for the device matrix.
- Bot pursuit uses the existing direct-plus-perpendicular detour system, not a navmesh. Broad routes were designed around it, but extended bot-only soak testing is still warranted.
- Playable upper terraces and lower channels remain deferred until the shared protocol and server simulation authoritatively support player height and support surfaces.
