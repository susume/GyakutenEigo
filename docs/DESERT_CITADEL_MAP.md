# Desert Citadel — Split Crown rebuild

Date: 2026-08-06

## Classification and intent

**LEVEL 3 — Rebuild.** The previous Fountain Court / mirrored market / southern
Skywalk layout is retired. The replacement keeps the desert fortress theme,
stone-and-cloth palette, palms, water accent, and fortified silhouette, but uses
a new route graph, elevations, spawn architecture, landmarks, objectives, and
combat spaces.

The design target is 20 Blue versus 20 Red. Geometry is authored in raw map
units and scaled by the shared `ARENA_SCALE`. The controller's 0.8-unit step
limit is authoritative: main stairs rise 8 units over 12 steps (0.667 per step)
and upper stairs rise 20 units over 28 steps (0.714 per step).

## Battlefield proposal

- Blue occupies the west Assembly Bastion; Red occupies its exact east mirror.
  Each bastion holds twenty players in five rows and has three protected exit
  bands. Offset baffles prevent direct first-frame fire while allowing a full
  spawn wave to split immediately.
- **North — Shaded Souk:** lower-level close/mid combat. Six staggered stall
  walls, cloth canopies, palms, and the Falcon Obelisk break the lane into
  successive fights without creating a single doorway.
- **Center — Royal Causeway:** an 8-unit raised east-west processional route.
  Two broad end stairs and four side stairs provide six approaches. Low
  parapets and two cover plinths divide the long sightline.
- **South — Dry Cistern:** lower-level flank and rotation route. Six staggered
  low covers and a central well produce short crossings and two-sided peeks.
- **Upper — Crown Rampart:** a 20-unit northern wall walk. It has two team-side
  stairs and two exposed field stairs, three cover merlons, and open sightline
  counterplay from the Souk and Royal Causeway.
- Outer alleys at both ends connect all three macro routes. The four side stairs
  connect Souk/Cistern pressure into the Royal Causeway. The two field stairs
  let either team contest the Rampart without crossing the enemy half first.

Expected opening distribution per team is approximately 6 North, 7 Center,
5 South, and 2 Upper. Mid-round rotations should create four or more concurrent
fights: each lane's near-side contact, the Royal Causeway center, and the Crown
Rampart contest.

## Navigation graph

```text
                    [Crown Rampart — upper]
                     /    |       |    \
 [Blue Bastion] -- [Shaded Souk — lower] -- [Red Bastion]
       |              \   |       |   /             |
       +---------- [Royal Causeway — main] ----------+
       |              /   |       |   \             |
       +---------- [Dry Cistern — lower] ------------+
```

No floating labels, floor text, or route signs are used. The minimap keeps
color-only route bands and objective icons; in the world, the Falcon Obelisk,
raised gold Causeway, northern crenellated Rampart, turquoise Cistern well, and
the remaining Red objective cloth provide orientation.

## Authoritative Phase 3 geometry manifest

No gameplay-relevant or visible structure may be added during implementation
unless this manifest is updated first.

| Group | Exact IDs | Reason |
|---|---|---|
| Perimeter shell | `citadel-north-wall`, `citadel-south-wall`, `citadel-west-wall`, `citadel-east-wall` | Close all boundaries with four edge-touching fortress walls. |
| Authored surfaces | `blue-assembly-paving`, `red-assembly-paving`, `shaded-souk-paving`, `dry-cistern-paving`, `royal-causeway-floor`, `royal-causeway-foundation`, `crown-rampart-floor`, `crown-rampart-foundation` | Establish readable lower, main, and upper surfaces; raised foundations are solid and deterministic. |
| Assembly enclosure | `blue-assembly-north-wall`, `blue-assembly-south-wall`, `red-assembly-north-wall`, `red-assembly-south-wall` | Bound each 20-player spawn while leaving three forward exit bands. |
| Spawn sight screens | `blue-screen-north-outer`, `blue-screen-north-inner`, `blue-screen-south-inner`, `blue-screen-south-outer`, `red-screen-north-outer`, `red-screen-north-inner`, `red-screen-south-inner`, `red-screen-south-outer` | Form three broad spawn exits and block direct cross-map firing. |
| Spawn exit baffles | `blue-baffle-north`, `blue-baffle-center`, `blue-baffle-south`, `red-baffle-north`, `red-baffle-center`, `red-baffle-south` | Offset each exit's first sightline without reducing wave capacity to one doorway. |
| Royal Causeway stairs | `blue-royal-stairs`, `red-royal-stairs`, `royal-north-west-stairs`, `royal-north-east-stairs`, `royal-south-west-stairs`, `royal-south-east-stairs` | Give the main level six independent approaches and four cross-lane rotations. Each expands to exactly 12 authored steps. |
| Crown Rampart stairs | `blue-crown-stairs`, `red-crown-stairs`, `crown-west-field-stairs`, `crown-east-field-stairs` | Give the upper route mirrored team access plus two exposed contest routes. Each expands to exactly 28 authored steps. |
| Royal Causeway parapets | `royal-parapet-north-west`, `royal-parapet-north-center`, `royal-parapet-north-east`, `royal-parapet-south-west`, `royal-parapet-south-center`, `royal-parapet-south-east` | Prevent accidental falls while preserving four side-stair openings. |
| Royal Causeway cover | `royal-cover-west`, `royal-cover-east` | Break the central long sightline without creating a dominant bunker. |
| Crown Rampart rails | `crown-rail-north`, `crown-rail-south-west`, `crown-rail-south-center`, `crown-rail-south-east` | Bound the wall walk while leaving both field-stair mouths open. |
| Crown Rampart cover | `crown-cover-west`, `crown-cover-center`, `crown-cover-east` | Create three contestable upper positions with lateral counterfire. |
| Shaded Souk combat architecture | `souk-stall-west-outer`, `souk-stall-west-inner`, `souk-stall-center-west`, `souk-stall-center-east`, `souk-stall-east-inner`, `souk-stall-east-outer`, `falcon-obelisk`, `falcon-obelisk-crown` | Stagger the north lane into multiple close/mid engagements and provide its landmark. |
| Dry Cistern cover | `cistern-cover-west-outer`, `cistern-cover-west-inner`, `cistern-cover-center-west`, `cistern-cover-center-east`, `cistern-cover-east-inner`, `cistern-cover-east-outer` | Shape the lower flank into alternating two-sided peeks without closing the lane. |
| Major props | `red-bastion-banner`, `souk-canopy-west`, `souk-canopy-east`, `souk-palm-west`, `souk-palm-east`, `cistern-palm-west`, `cistern-palm-east`, `cistern-cart-west`, `cistern-cart-east`, `crown-banner-east` | Keep the Red objective cue and desert atmosphere without adding a Blue placement flag or extra signage. |
| Major cylinders | `royal-sundial-ring`, `royal-sundial-core`, `cistern-well-rim`, `cistern-well-water` | Create the central main-level landmark and the southern water landmark; only the two outer rings collide. |

## Objective distribution

- Capture zones: Shaded Souk, Royal Causeway, Dry Cistern, West Gate Court,
  East Gate Court, and Crown Rampart.
- Search/retrieve items: Falcon Seal in the Souk, Royal Tablet on the Causeway,
  and Cistern Ledger by the well.
- Delivery zones remain inside the mirrored Assembly Bastions.

## Validation gates

- Exact manifest equality for blocks, stair flights, props, and cylinders.
- No interior overlap between same-level colliders.
- Twenty clear spawns per team with no direct tested Blue/Red first-frame line.
- All ten stairs continuous and at or below the controller step limit.
- Bot paths to all three lanes, all six objectives, and the Crown Rampart.
- Travel-time asymmetry below 15% for equivalent Blue/Red routes.
- Render inspection at lower, main, upper, and overview viewpoints.
