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
  The menu collapses at 1160px; Escape closes it and returns focus to its toggle.

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

## About page and language

`/about` uses the shared theme and English/Japanese content in
`apps/web/src/ui/aboutContent.ts`. The header language selector persists an
explicit choice under `gyakuteneigo.language`. Without a saved choice, use the
first supported browser language, falling back to English. The interface updates
immediately across the hub, SpeakCheck, QuizStrike, competitions, teacher tools,
and student screens. Switching languages preserves entered values and in-progress
work. The document language follows the selection; English reference sheets
explicitly retain their own language.

Use `useSiteTranslation().t()` for interface copy, with English source strings and
Japanese translations in `apps/web/src/ui/locales/ja.json`. Pass variable values
through placeholders rather than concatenating messages. Translate display labels
while preserving option values, route names, API payloads, and stored enum values.
Keep teacher-authored tasks, quiz questions, student input, English examples,
transcripts, and generated feedback content in their original language. The site
selection controls interface labels; an activity's native language controls its
learning support and generated feedback.

## Private lessons

`/private-lessons` uses the same header, theme tokens and saved language choice.
Its structured English/Japanese content lives in
`apps/web/src/ui/privateLessonsContent.ts`, including the lesson price and enquiry
email. Enquiry links open a draft in the visitor's email app in the selected
language. The About page's closing section links to this page. The portrait is
Peter's supplied headshot in `apps/web/public/assets/peter-hoang-headshot.png`.
