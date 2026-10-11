# Lunar Relay

A fourth QuizStrike combat map: a lunar transmission outpost beneath a ringed planet. Select **Lunar Relay** in teacher game setup or tournament settings. The development preview is available at `/character-lab?map=lunar_relay`.

## Playable layout

- Four shielded five-player spawn fronts per team; 40 players total.
- The Observatory provides a sheltered northern court and two habitat approaches.
- The Service Underpass continues beneath the Relay Bridge. Its ground objective and the bridge objective occupy different floors at the same X/Z coordinate.
- The Relay Bridge rises ten world units, with four broad stair flights, overhead gantries, and partial cover rails.
- The Solar Court provides a southern cargo flank. Three retrieval items and two delivery zones use map-specific positions.

`packages/shared/src/lunarRelayLayout.ts` owns the raw layout used by visual cover and server collision. Every stair rises 0.5 units per tread. Overlapping landings allow the default bot grid to reach the deck from both sides. Map-specific bot patrols, base goals, footsteps, minimap colors, and Japanese map names are included.

## Rendering

The map uses procedural geometry and existing surface materials. It requires no external model or texture downloads. Static details use the existing arena batcher; distant lunar rocks use one instanced draw. Low retains the planet, dish, domes, route markings, and all playable cover. Stars and small panels scale with quality. The setup preview is generated from the shared layout with `node scripts/generate-lunar-relay-preview.mjs` after building the shared package.

## Validation

The visual identity pass adds an orbital relay halo above the central gantries, a roof-mounted observatory telescope, octagonal pressure hatches, and separate cyan relay and amber solar-court markings. The terrain uses a procedural regolith texture and exterior impact craters; a gold lunar lander marks the southern horizon. These landmarks remain present on Low. They use the existing static batching and require no downloaded assets.

Gameplay geometry remains shared with the server. The halo clears a jumping player on the bridge, and the lander and every crater mesh stay outside the playable bounds. The art regression checks these clearances and the original 8,000-triangle Low / 18,000-triangle Medium and High budgets alongside the existing stair, spawn, objective, and navigation checks.

Automated checks cover session sanitization, setup/runtime metadata, every visual collider, all four stair approaches through authoritative movement, stacked floors and shot blocking, protected spawn sightlines, route fairness, and art geometry budgets at all three quality levels. Client checks walk all four flights up and down while standing and crouching, in three lanes and with two movement increments (96 scenarios). All 160 spawn-to-objective routes are sampled along their full length with the FPS support and body collision functions. Every spawn and objective admits the client body on its intended floor.

Final results: 329 web tests pass (run from `apps/web` with test concurrency 2), 153 shared tests pass, and 11 server bot tests pass. The full production build, lint on changed source files, and `git diff --check` pass. The build retains the existing Three.js chunk-size advisory.

Browser checks used generated 40-player data in the production arena renderer at 1440×900 High and 1024×768 Low. Keyboard movement advanced the player and minimap on the bridge. The in-app browser rejected pointer lock; mouse-look needs a normal browser check. These checks do not represent a physical-device frame-rate benchmark or a live multiplayer classroom match.

## Gameplay audit and repairs

The initial stair test checked authoritative movement only. It did not exercise the client body approaching a riser, and the initial browser check began on the bridge. That gap allowed the following defects through:

- **Stairs blocked ordinary walking.** Lunar stair blocks lacked `style: "stair"`, so the FPS controller treated them as solid cover. The client regression failed on the first tread before the fix. Every tread now carries the authored stair tag; the controller's collision and support decisions are directly exercised by tests.
- **Crouching highlighted the wrong minimap floor.** Floor detection subtracted the standing eye height from a crouched player. Local minimap updates now preserve crouching and use the matching eye height. Browser checks reproduced the underpass highlight at physical ground Y=10 and confirmed the corrected bridge highlight while crouching.
- **Bot paths cut through stair sides.** Path visibility omitted stair boxes, allowing diagonal connections through tall risers. Lunar navigation connections now enter flights through their ends. The strengthened route test exposed the invalid paths before the repair and passes all 160 complete routes afterward.

For reproducible keyboard checks, use `/character-lab?map=lunar_relay&lunarStair=west&debugArenaLevels=1`; replace `west` with `east`, `north`, or `south`. This development-only lab starts at the foot of the selected flight facing uphill. Ground diagnostics on the canvas report physical elevation and position. Use W to ascend and S to descend, without Space. Browser checks confirmed all four ascents from ground Y=0 to bridge Y=10, ordinary descent on the north flight, and the crouching minimap repair. The west ascent used 40 players at Medium; the remaining approaches also exercised Low with 10 players. Automated checks additionally cover complete descent, crouched movement, and all approach lanes.

Local captures are in the ignored `product-audit-lunar-relay/` folder:

- `overview-high.jpg`
- `ground-fps-high.jpg`
- `tablet-low.jpg`
- `stairs-audit-fps.jpg` — south landing at physical ground Y=10 after walking uphill with W only.

![Lunar Relay overview](C:/Users/hungb/OneDrive/Documents/GitHub/GyakutenEigo/product-audit-lunar-relay/overview-high.jpg)
