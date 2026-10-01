# GyakutenEigo site theme

The site uses a calm classroom identity: navy typography, a neutral page canvas,
white surfaces, and blue primary actions. SpeakCheck's green and QuizStrike's
warm gold identify products; they do not change the meaning of primary buttons.

## Shared sources

- `apps/web/src/styles/tokens.css` owns colours, typography, spacing, radii,
  focus, and motion tokens. Use these variables for new components.
- `apps/web/src/styles/site-theme.css` adapts existing product styles to those
  tokens. It loads once through `main.tsx`. Its explicit `body[data-theme]
  .ge-site` scope keeps the theme stable when legacy CSS loads during navigation.
- `ProductHubHeader` owns public navigation for the homepage, SpeakCheck,
  QuizStrike, and teacher authentication. Set `active` for the current product.
  The menu collapses at 1000px; Escape closes it and returns focus to its toggle.

## Design rules

- Use `--color-action` for primary actions and `--color-action-hover` for hover.
  Secondary actions use a white surface and border; selected navigation uses
  `--color-selected`. Preserve danger and success colours for their states.
- Use `--font-sans` throughout, including Japanese fallbacks. Use sentence case
  for buttons, short uppercase eyebrow labels, and comfortable heading leading.
- Use `--radius-control` (10px) and `--radius-panel` (18px). Prefer subtle panel
  shadows and borders over coloured gradients, glow, or decorative handwriting.
- Public content is capped at 1200px, with 24px desktop and 16px mobile gutters.
  Controls retain a minimum 44px target. Let action groups wrap without clipping.
- Preserve the existing brand assets and product imagery. The dark treatment
  belongs within game artwork and the playable arena; ordinary site surfaces
  share the light theme.
- Maintain visible keyboard focus, readable form labels, semantic error colours,
  and reduced-motion support.

## Scope and verification

The shared theme covers public landing pages, competitions, teacher sign-in,
student entry, speaking setup/results components, and teacher workspace surfaces.
Live arena/HUD `--qs-*` tokens remain separate from web-page aliases.

Check direct entry and in-app navigation in both directions when changing styles:
`/`, `/speak`, `/quiz-strike`, `/quiz-strike/teacher/home`, `/join`, and
`/speak/join`. Verify desktop and mobile, the menu, active navigation, form labels,
and invalid code feedback. The local speaking teacher preview can be used at
`/speak/teacher?teacherPreview=1` without changing a real account.
