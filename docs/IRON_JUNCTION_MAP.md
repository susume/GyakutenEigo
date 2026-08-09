# Iron Junction — Multi-level route brief

Iron Junction keeps its derelict rail-yard identity while adding two authored
high-ground routes above the existing yard floor:

- **Yard (Y=0):** maintenance depot, sorting tracks, boxcars, timber sheds, and
  the central rail switch.
- **Highline (Y=10):** a long east-west Signal Highline above the timber route,
  with two wide side ramps, railings, signal lamps, and exposed flank sightlines.
- **Catwalk (Y=16):** a shorter Signal Gantry Catwalk over the north approach,
  with a dedicated ramp, supports, warning lamp, and a quick high-ground peek.

The original 350 × 320 design footprint remains intact so existing base spacing
and travel expectations remain stable. The new routes are additive: the yard
remains playable beneath both platforms, and the elevated routes have authored
rail bounds rather than invisible full-height blockers.

Primary routes are the North Maintenance Lane, Central Sorting Tracks, South
Timber Line, the exposed Highline flank, and the short Catwalk rotation. The
Highline has west/east ramps; the Catwalk has one readable north approach ramp.
Decorative additions are constrained to signals, work lamps, hooks, supports,
and deck markers so each prop communicates route identity or combat intent.

The shared floor resolver, server movement, line-of-sight, and bot A* all preserve
Y. A player at the same X/Z can remain on the Yard while another player occupies
the Highline or Catwalk above. The FPS world uses no printed route labels or
signs; the minimap uses color bands, stair markers, objective icons, and base
zones from shared map data.

Local 40-player Medium captures reported approximately 47–80 FPS depending on
camera, with 441–620 draw calls and 209k–237k triangles. The exposed Highline is
above the conservative 400-call target; the isolated Catwalk view is well below
it. Physical Chromebook and real network-match certification remain pending.
