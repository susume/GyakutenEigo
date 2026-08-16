# QuizStrike VFX architecture

## Decision

QuizStrike keeps a small project-specific VFX runtime in
`apps/web/src/game/ArenaVfx.ts`. It extends the existing semantic event bus and
fixed pool instead of adding a general-purpose particle dependency.

`three.quarks` was investigated on 2026-08-16. It is an MIT-licensed,
TypeScript-native Three.js VFX engine with batching, billboard and mesh
renderers, flipbook behaviors, trails, and JSON-authored effects. The current
published package (`0.17.1`) declares a peer dependency on Three.js
`>=0.182.0`, while QuizStrike is intentionally on `0.178.0`. Adopting it would
require a renderer upgrade, add roughly 1.2 MB of unpacked runtime package
weight plus `quarks.core`, and introduce a second lifecycle/batching model for
effects that currently fit within a fixed 6/12/16 event budget. The dependency
was therefore not adopted. Revisit it only if the project moves to a newer
Three.js version and measured VFX demand exceeds this pool.

## Runtime shape

```text
semantic event
      |
      v
ArenaVfxPool
  - admission priority
  - distance culling
  - 6/12/16 active effect slots
  - shared geometry
  - pooled sprite/mesh materials
      |
      +-- Combat: muzzle, tracer, impact, snowball, hit confirmation
      +-- Learning: correct-answer reward burst and purchase feedback
      +-- Player: spawn, elimination, healing, damage
      +-- Objective: pickup, plant, progress, capture
      +-- Round: start, result, victory, defeat
      +-- Environment: localized footstep dust/water/metal accents
```

Gameplay code emits `emitArenaVfx({ kind, x, y, z, team, surface, local })`; it
does not construct a mesh, sprite, or particle emitter itself. The network
transports gameplay events only. Each client generates cosmetic VFX locally and
never synchronizes particle state.

## Performance policy

- Performance / Low: 6 active effects, up to 6 pooled sprites, one sprite
  layer per slot, 120-unit
  remote view range, no expensive distortion or soft particles.
- Balanced / Medium: 12 active effects, up to 24 pooled sprites, two sprite
  layers per slot, 200-unit remote view range.
- High: 16 active effects, up to 48 pooled sprites, three sprite layers per
  slot, 280-unit remote view range.
- Local feedback bypasses distance culling and receives higher admission
  priority. Major objective/round cues displace low-priority ambient cues.
- Each effect is recycled; no per-event geometry is allocated. Shared torus,
  octahedron, sphere, and beam geometry is disposed once with the pool.
- Remote cues are reduced by distance and are dropped when the global pool is
  full. Active effect, sprite, emitted, and dropped counts are exposed through
  `data-vfx-*` attributes and the development debug overlay.

## Accessibility and readability

VFX reinforce, but do not replace, HUD text, answer feedback, audio cues, and
the directional damage indicator. Correct answers use a short teal/gold burst
plus a DOM reward animation that travels toward the currency/energy HUD. Wrong
answers use a small muted red cue only. No blood, gore, persistent screen shake,
or full-screen red overlay is used.

## Debugging

In a development build, open Character Lab with `?vfxDebug=1` to show the
developer-only VFX trigger panel. It exercises representative combat, reward,
player, objective, and round events and reports the current pool budget and
dropped count. The panel is gated by `import.meta.env.DEV` and cannot appear in
production gameplay.
