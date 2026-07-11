# Stage 3 Implementation — Visual System

Stage 3 repairs the existing visual system without replacing Quiz-Strike's product identity or changing game behavior.

## Foundation changes

- Added a compact CSS token layer for typography, color roles, spacing, radii, shadows, motion, focus, z-index, and touch-target size.
- Replaced the undeclared `Inter` dependency with an intentional cross-platform system font stack, including the arena canvas label.
- Standardized shared buttons, fields, panels, sidebars, and navigation around the new token layer.
- Raised shared control targets to 44 px and added consistent hover, pressed, disabled, and focus-visible states.
- Added a skip-to-main-content control and a high-contrast preference treatment.
- Added a shared accessible `StatusMessages` component, reducing repeated error/success markup across teacher and student flows.

## Intentional scope

- The existing navy/green/blue identity remains intact.
- Game HUD and arena-specific colors remain independent where they communicate teams, health, danger, or spatial gameplay.
- No session, scoring, authentication, or game rules changed.

## Validation

- Type checking, tests, and production build are run before release.
- Manual checks cover desktop and mobile public screens, keyboard skip navigation, and visible focus treatment.
- The known ArenaPreview bundle-size warning remains tracked for Stage 4 performance work.
