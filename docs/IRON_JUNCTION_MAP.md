# The Iron Junction

The Iron Junction is the first map generated from the industrial railway brief in `pasted-text.txt`. It keeps the existing arena footprint and movement speeds, but replaces the Desert Citadel visual language with a cold, rusted mountain rail yard.

## Layout and pacing

- Footprint: approximately 217 × 198 scaled world units (350 × 320 authored units at the current `ARENA_SCALE` of 0.62).
- Spawns: East and West signal yards, with 24 protected spawn points per team.
- North Lane: Maintenance Depot, approximately 28–32 units wide, close-range fights, repair bays, train hulls, tool cages, and short vertical silhouettes.
- Mid Lane: Sorting Tracks and Gantry, approximately 34–38 units wide, the most open lane, three staggered track beds, offset railcars, the central rail switch, and a visible sorting booth.
- South Lane: Timber Line and Gorge, approximately 30–34 units wide, mid-range fights, log stacks, loader machinery, retaining walls, a water tower, and safer guard-railed outer edges.
- Rotations: the rear service band is readable from the floor marking, the rail switch is the fastest contested crossing, and the timber drop-down is represented by a dedicated landing platform.

At the current sprint speed of 14.8 units per second, the first meaningful cross-map contact is expected around 5–7 seconds and a spawn-to-centre rotation around 8–11 seconds, depending on lane and cover choices. The map stays within the existing 40-player room limit.

## Competitive intent

- North is dense and cover-rich for fast pushes and ambushes.
- Mid is the primary information and long-range contest, with diagonal offset cover keeping the spawn-to-spawn view broken up.
- South is the safer flank for rotations, but its exposed gorge edge and water-tower silhouette make power positions contestable.
- The sorting booth is deliberately visible from multiple approaches and surrounded by railcar and gantry cover, so it acts as a temporary information position rather than a protected spawn overlook.

## Technical implementation

- Teachers select the map in the Create Session form. The selection is stored in `SessionSettings.mapId` and broadcast with the session to every student.
- The client renderer selects map-specific blocks, props, labels, palette, minimap landmarks, and spawn fallback positions.
- The server selects map-specific spawn metadata, movement collision proxies, bot roaming collision, and projectile line-of-sight obstacles.
- Complex props use simple box/cylinder collision proxies. Decorative rails, cables, foliage, steam, and debris do not block players.
- The map reuses the existing material cache, quality tiers, frustum culling, low-poly geometry, and limited dynamic lights.

## Current limitation

The current game engine is ground-plane based. Iron Junction includes elevated architectural silhouettes and raised cover, but fully walkable catwalks, ramps, and a true water-tower sniper pocket need a future traversal-height pass when the shared movement model supports map-specific vertical surfaces. The base map is playable with reliable ground collision today.
