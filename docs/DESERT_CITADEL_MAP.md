# Desert Citadel — Multi-level route brief

Desert Citadel keeps the market-and-waterworks blockout while making its existing
service arcades intentionally playable:

- **Street (Y=0):** west/east gates, market, aqueduct, north ramparts, and the
  south caravan quarter.
- **Rooftop (Y=6):** west and east Service Arcades above the south approach,
  connected by two side ramps and marked with team banners and lamps.
- **Cistern Crown (Y=12):** a compact central platform above the cistern approach,
  with its own ramp, supports, crown lamp, and banner.

The original 350 × 320 design footprint remains stable. The elevated arcades add
cross-lane rotations without removing the street fight below. Existing stalls,
waterworks, carts, arches, roofs, and rampart debris remain purposeful cover;
new props are limited to route markers, lamps, banners, and the cistern crown.

The shared floor resolver, server movement, line-of-sight, and bot navigation now
understand Street, Rooftop, and Cistern elevations. Minimap labels dim other
levels and show Street, Rooftop, or Cistern based on the player’s physical floor.

Local 40-player Medium captures reported approximately 36–77 FPS depending on
camera, with 462–631 draw calls and 213k–240k triangles. The street view is close
to the conservative 400-call target; elevated views exceed it and should be
profiled on the target Chromebook class. Physical Chromebook and real network
match certification remain pending.
