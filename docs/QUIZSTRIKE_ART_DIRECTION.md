# QuizStrike environmental art direction

## Pilot

The pilot is **Iron Junction**: a stylized competitive railway depot in a
mountain gorge. Its visual job is to make locations easy to name during a
classroom match: the locomotive, control tower, freight warehouse, dispatch
platform, and maintenance crane are the map's shared vocabulary.

## Target style

Stylized competitive multiplayer game + colorful educational game. The world
should feel authored and energetic without becoming a military simulator,
preschool toy world, gritty photorealistic scene, or random asset-store collage.

## Shape language

- Chunky, readable silhouettes at first-person distance.
- Large hero shapes before small surface noise.
- Simple forms with a few strong structural breaks: wheels, beams, windows,
  doors, rails, and rooflines.
- Detailed GLBs are visual-only; gameplay collision remains simple and explicit.

## Materials

- Moderate roughness with restrained metalness.
- Clean, slightly weathered steel, concrete, brick, timber, and painted railcars.
- Shared material response across sourced assets; the runtime clamps extreme
  roughness/metalness values when a GLB is loaded.
- Use 1K textures for gameplay-facing environment pieces and 2K textures for
  hero architecture, control towers, station facades, and other major
  landmarks when the extra material detail survives first-person distance.
- Reuse a shared atlas or material family wherever possible. Do not reduce a
  texture below its authored/source resolution merely to hit a default budget;
  reduce only after measured frame time and download cost justify it.

## Color system

| Use | Color language |
| --- | --- |
| Industrial base | blue-gray steel, charcoal, warm concrete, rust brown |
| Gameplay landmark | amber/orange warning paint and signal lights |
| Blue navigation | cyan/blue signs, spawn accents, container markings |
| Red navigation | coral/red signs, spawn accents, container markings |
| Objectives | yellow answer pads and rings |
| Wayfinding text | warm white on deep blue-gray boards |

Red and blue identify teams and routes; they do not wash entire districts in
team color.

## Composition rules

1. Put one memorable silhouette in each major district.
2. Use signage only where a player needs to communicate a location.
3. Keep objective pads, player silhouettes, and sightlines visually quieter than
   the landmark behind them.
4. Repeat rail, beam, warning-stripe, and sign motifs so sourced assets feel
   like one QuizStrike map.
5. Prefer three meaningful props over a dozen filler barrels.

## Performance budget

The pilot ships six curated/generated GLBs plus one reused native-resolution
train atlas and a 2K embedded hero atlas. Hero architecture may carry a 2K material atlas;
gameplay-facing props target 1K–2K based on visible benefit. Low quality reduces
secondary geometry, lights, and effects rather than automatically swapping
every texture for a low-resolution copy. The renderer keeps procedural geometry
as a fallback, reuses cached GLB scenes, and never uses detailed GLB meshes as
authoritative collision. The measured pilot runtime payload is about 2.05 MB
before normal browser compression.
