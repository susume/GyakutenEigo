# Game audio pass

QuizStrike Classroom now uses a small CC0 sample palette from Kenney, loaded by
`apps/web/src/game/GameAudio.ts`.

## Runtime behavior

- Footsteps use five snow variations with different playback rates for walk, run,
  and crouch. This fits the current snowball/arena presentation and avoids a
  repetitive single-step loop.
- Weapon, hit, damage, elimination, shop, quiz, menu, and zoom cues use sampled
  impact/UI/coin sounds with light pitch variation and per-cue voice caps. Quiz
  correct/wrong cues add a restrained two-note goal/retry signature so they read
  as one futuristic arena system instead of unrelated reward sounds.
- Incoming hit and elimination cues use attacker/target coordinates for stereo
  placement, arena-distance attenuation, and high-frequency rolloff. The HUD
  direction cue and the audio direction cue are driven by the same event.
- SFX and the optional looping music phrase have separate buses. SFX stays clear
  over a sparse low-frequency arena bed (rather than a busy arcade arpeggio), and
  the existing Sound Effects and background audio preference still mutes both
  together.
- Samples are prewarmed when sound is enabled. If a file cannot be fetched or
  decoded, the original Web Audio synth cue remains available as a graceful
  fallback.

## Licensing

The bundled files are CC0 1.0 assets from Kenney's Impact Sounds, UI Audio, and
RPG Audio packs. See `apps/web/public/assets/audio/kenney/ATTRIBUTION.md` for
source links and the license URL.

## Tuning

Adjust per-cue `gain`, `playbackRate`, `pitchVariance`, and `maxVoices` in
`GAME_AUDIO_ASSETS`. Keep cue gains below 1.0; the SFX bus is intentionally
attenuated to leave room for simultaneous classroom feedback.

## Inventory coverage notes

The semantic event inventory now covers weapon perspective variants, projectile
and shield impacts, cooldown/equip/scope states, low-health and respawn feedback,
flag state changes, quiz selection/lock/reveal/timer cues, join/leave/round/match
flow, and a separate UI family. Remote fire, impact, and footsteps are spatialized
from the same authoritative arena coordinates used by the HUD.

Surface samples are available for snow, sand, wood, stone, metal, and shallow
water. The current maps expose a reliable map-level default (sand for Desert
Citadel and metal for Iron Junction); per-triangle surface tagging is not present
in the current collision model, so wood/stone/water are exposed as ready-to-use
audio surfaces rather than guessed from visual geometry.

There are no voice announcements or licensed music tracks in this pass. The game
keeps its procedural low-level arena bed and provides a separate Music volume
slider; ambience zones, overtime, assists, out-of-bounds, and detailed respawn
countdown events remain intentionally quiet until the game exposes authoritative
events for them.
