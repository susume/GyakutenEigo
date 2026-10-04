# QuizStrike combat-map visual audit

Reviewed 4 October 2026 in the existing Character Lab using the production arena renderer, generated 40-player data, High quality, and fresh in-app-browser captures. No live classroom data was used. Screenshots are local evidence in `product-audit-maps/`.

## Research and design constraints

[Riot's environment-art workflow](https://playvalorant.com/en-gb/news/dev/the-art-of-valorant-map-environments/) prioritizes collision-matched architecture, memorable callouts, quiet values around opponents, details above player height, instancing, and scenery outside playable space. [Valve's TF2 rendering paper](https://cdn.cloudflare.steamstatic.com/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf) supports readable silhouettes and restrained surface detail. These principles inform this pass; the existing QuizStrike art direction and licensed models remain the visual foundation.

## Baseline observations, captured before editing

1. **Desert Citadel — needs improvement.** `desert-before.png` and `desert-fps-before.png`: clear central causeway, authored stalls and lamps, but a nearly empty sky above flat perimeter walls. Fog flattens the northern district. Wall trims sample unrelated atlas tiles; sand/floor surfaces have a synthetic grid. The FPS view needs recognizable architecture beyond the immediate cover box.
2. **Iron Junction — needs improvement.** `iron-before.png`: locomotive, control tower and depot layout provide useful landmarks. The distant warehouse and station wash out; the gorge is a row of small stones. Generic fortress-style wall caps and pale trim weaken the railway setting. Ground grid and dark metallic surfaces dominate the yard.
3. **Temple Runoff — needs improvement.** `temple-before.png`: canal, bridge and imported gatehouses establish the three layers. Jungle plants read as scattered cones rather than a canopy. A flat rectangular perimeter and haze undermine the flooded-city setting. Stone details need temple-specific rhythm rather than generic industrial-looking trim.

## Implementation and verification

The existing playable map geometry and authoritative collision definitions were retained. New skyline scenery is strictly outside the arena; shallow facade relief follows authored cover. Existing licensed GLBs and their textures remain in use.

| Audit step | Final health | Changes and evidence |
| --- | --- | --- |
| Desert Citadel | Improved; reviewed | Grounded dunes, a sandstone city with domes and varied tower heights, wall-bound piers and corrected facade lengths, Falcon Obelisk relief, quieter ashlar/sand materials. Reviewed the market, causeway and rampart in the playable camera. `desert-after.png`, `desert-market-fps.png`, `desert-lookout-fps.png`, `desert-tablet-low.png`. |
| Iron Junction | Improved; reviewed | Mountain ridge and pine skyline, brighter brick/concrete/painted steel, industrial windows and ribs, industrial wall caps, correctly tiled gravel and platforms. Reviewed the yard and loading platform. Fixed merged procedural train/tower fallbacks that remained drawn over imported assets. Low now retains both cars of the central train; incomplete carriage groups retain the full readable fallback. `iron-after.png`, `iron-ground-fps.png`, `iron-loading-fps.png`, `iron-tablet-low.png`. |
| Temple Runoff | Improved; reviewed | Broadleaf canopy outside the arena, varied tree silhouettes, shaped fern leaves and fuller foreground crowns, brighter moss stone, wall and ruin carvings, consistent paving scale. Reviewed the canal, main court and upper bridge. `temple-after.png`, `temple-main-fps.png`, `temple-river-low.png`, `temple-bridge-medium.png`, `temple-tablet-low.png`. |

Shared fixes correct the atlas upload orientation, remove the blockout ground grid, reduce shiny/bumpy facade response, push overview fog beyond important landmarks, and release temporary batch geometries after merging. Replaceable fallback batches preserve their visibility owner and transform, including single-mesh fallbacks.

Desktop captures use the browser's default viewport; tablet-size checks use 1024×768 at Low with generated 40-player data. Keyboard walks and jumps were verified through the rendered minimap/player-position diagnostics. These are production-renderer/controller checks in the existing development lab, not full multiplayer-match or physical-tablet benchmarks. Browser logs were clear in the final inspected railway view. Full-page captures retain lab context; the focused Temple image is an unedited browser region capture. Temporary viewport overrides were reset.

The new scenery uses at most three instanced draws plus the existing facade batches, no added dynamic lights and no additional external scenery downloads. Automated bounds checks cover all three maps at all three quality levels, with fewer than 6,000 new skyline triangles on Low and 16,000 on High. Existing spawn, navigation, collider and route-fairness tests remain in the regression run. Device frame rates still need a physical Chromebook/tablet benchmark; the in-app browser reported a slow 40-character capture, so this audit does not claim a hardware performance result.

The full regression run also found and repaired a missing Japanese translation for `+220 movement energy` from the earlier athletics pass.

Final validation: **317 web tests pass**, including atlas orientation, fallback visibility/transforms, partial asset loading, skyline budgets and all existing map collision/navigation checks. The production build and typecheck pass. `git diff --check` passes. The build retains the existing Three.js chunk-size advisory.

## Final screenshots

### Desert Citadel

![Desert Citadel after the environment pass](C:/Users/hungb/OneDrive/Documents/GitHub/GyakutenEigo/product-audit-maps/desert-after.png)

### Iron Junction

![Iron Junction after the environment pass](C:/Users/hungb/OneDrive/Documents/GitHub/GyakutenEigo/product-audit-maps/iron-after.png)

### Temple Runoff

![Temple Runoff after the environment pass](C:/Users/hungb/OneDrive/Documents/GitHub/GyakutenEigo/product-audit-maps/temple-after.png)
