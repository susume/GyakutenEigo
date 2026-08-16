# QuizStrike VFX asset provenance

All runtime files in this directory are either project-authored or copied from
the source pack named below. The runtime only ships the small subset needed by
the pooled Arena VFX system; the complete source pack is not bundled.

## Kenney Particle Pack 1.1

- Creator: Kenney Vleugels (Kenney.nl)
- Source: https://kenney.nl/assets/particle-pack
- License: Creative Commons Zero (CC0 1.0)
- License file: the source pack's `License.txt` is preserved in the repository
  as `kenney/License.txt`
- Commercial use: allowed
- Attribution: not required
- Date obtained: 2026-08-16
- Runtime treatment: original 512×512 transparent PNGs are retained; Three.js
  tints, scales, rotates, and fades them through shared pooled materials.
- Optimization: only seven source sprites are shipped instead of the full
  80-sprite pack; no source Unity package or black-background variants are
  included.

Every row below records the provenance fields for the shipped external file.
The creator, license, source URL, and obtained date are the same for this
pack; they are repeated per file so the record remains useful if one sprite is
later replaced.

| Runtime file | Source asset | Creator | License | Source URL | Date obtained | Modified? | Modification | QuizStrike usage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `kenney/muzzle_03.png` | `PNG (Transparent)/muzzle_03.png` | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/particle-pack | 2026-08-16 | No | Runtime tint, scale, rotation, and fade only | Remote and pooled launcher muzzle flash |
| `kenney/trace_03.png` | `PNG (Transparent)/trace_03.png` | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/particle-pack | 2026-08-16 | No | Runtime tint, scale, rotation, and fade only | Lightweight tracer accent and local first-person projectile trail |
| `kenney/spark_03.png` | `PNG (Transparent)/spark_03.png` | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/particle-pack | 2026-08-16 | No | Runtime tint, scale, rotation, and fade only | Snow/player/metal impact accents |
| `kenney/smoke_03.png` | `PNG (Transparent)/smoke_03.png` | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/particle-pack | 2026-08-16 | No | Runtime tint, scale, rotation, and fade only | Sand, stone, and footstep dust/smoke |
| `kenney/circle_03.png` | `PNG (Transparent)/circle_03.png` | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/particle-pack | 2026-08-16 | No | Runtime tint, scale, rotation, and fade only | Ground rings, shields, purchase and objective accents |
| `kenney/star_03.png` | `PNG (Transparent)/star_03.png` | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/particle-pack | 2026-08-16 | No | Runtime tint, scale, rotation, and fade only | Reward, capture, victory and hit confirmation accents |
| `kenney/magic_03.png` | `PNG (Transparent)/magic_03.png` | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/particle-pack | 2026-08-16 | No | Runtime tint, scale, rotation, and fade only | Correct-answer energy, spawn and objective activation |

## Project-authored fallback

`/assets/snowball-puff.svg` is authored for QuizStrike and is not an external
asset. It remains the snowball-specific puff layer so the game's playful,
school-safe snow identity is not dependent on a generic combat texture.

## Sources investigated but not shipped

- Brackeys' VFX Bundle: https://brackeysgames.itch.io/brackeys-vfx-bundle — CC0,
  26 MB bundle. Not shipped because the small Kenney subset covered the
  current runtime vocabulary without adding a larger download.
- Kronbits 1000 Free Game Assets: https://kronbits.itch.io/particle-pack — CC0,
  92 MB archive. Not shipped because the current effect set did not require
  that additional payload.
