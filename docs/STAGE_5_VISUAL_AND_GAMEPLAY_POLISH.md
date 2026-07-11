# Stage 5 Visual and Gameplay Polish

Stage 5 improves the presentation and classroom workflow without changing the existing session, scoring, Flag Mode, Zombie Mode, or accessibility foundations.

## Visual game pass

- Desert Citadel now uses a brighter sky dome, more deliberate fog, improved hemisphere/directional lighting, and team base beacons. These use shared low-poly geometry and at most a few static accent lights, not post-processing.
- Flag Mode has a physical flag marker, objective ring, flag glow, and a minimap flag icon. Blue and Red base beacons make side identity easier to read at a glance.
- Zombie Mode shifts the arena palette toward cool violet fog and lighting while retaining readable contrast for players and objectives.
- First-person presentation has a refined crosshair, distinct 2× and 4× scope treatments, a small weapon-cooldown bar, stronger arena framing, and higher-contrast HUD surfaces.
- The HUD now identifies team/role, weapon cadence, objective mode, round timer, and resource state with a more game-like hierarchy. Existing reduced-motion rules still suppress nonessential motion.

## Landing pages

- Rebuilt the GyakutenEigo home page into a product narrative: hero, product qualities, mode overview, classroom flow, FAQ, and final actions.
- Updated the Quiz-Strike host page with an objective-led value proposition, an in-product arena preview, teacher/student actions, and a concise classroom-feature rail.
- All messaging describes implemented product behavior only; there are no testimonials, school claims, or unsupported performance claims.

## Teacher dashboard

- Restructured Dashboard Home as a classroom command center with a live-room callout, live/recent session context, visible quiz inventory, clear next actions, and a three-step classroom workflow.
- Kept the existing sidebar workflow, live session controls, reports, error handling, and empty states. Navigation now exposes the current section semantically.

## Weapon tuning

### Quick Snowball Launcher

- `QUICK_BLASTER_COOLDOWN_MS = 125` ms (previously 85 ms).
- It remains faster than the Starter Snowball Launcher (160 ms), retains auto-fire, and still follows the existing authoritative projectile/damage path.
- The slower cadence also reduces procedural audio and muzzle-flash repetition because those effects only occur on accepted local shots.

### Heavy Snowball Launcher

- `HEAVY_GUN_COOLDOWN_MS = 1350` ms (previously 1200 ms).
- The cooldown is still enforced by the server-side `playerNextFireAt` guard, so input spam, zoom changes, and gear switching cannot bypass a heavy shot that has already been fired.
- Right click now cycles `normal → 2× → 4× → normal` while pointer lock is active.
- Named FOV constants: `HEAVY_GUN_ZOOM_LEVEL_0_FOV = 72`, `HEAVY_GUN_ZOOM_LEVEL_1_FOV = 46`, and `HEAVY_GUN_ZOOM_LEVEL_2_FOV = 30`.
- Named accuracy tiers: `HEAVY_GUN_UNSCOPED_HIT_RADIUS = 0.52`, `HEAVY_GUN_SCOPED_HIT_RADIUS = 0.82`, and `HEAVY_GUN_DEEP_SCOPED_HIT_RADIUS = 0.98`.
- Fire intents carry `zoomLevel`; the server uses that value in the existing authoritative projectile target calculation. Heavy shots work at normal, 2×, and 4× scope.
- Zoom resets when the Heavy Launcher is no longer equipped, the player is knocked out, the round ends, an arena menu pauses play, pointer lock is lost, or the arena is cleaned up.

## Chromebook and performance decisions

- Stage 4 quality settings remain intact. The default Auto quality continues to choose the safe balanced path on high-density screens.
- The visual pass deliberately avoids post-processing, large downloaded textures, per-frame React rendering, and particle systems. The new sky, markers, rings, and beacons use small procedural meshes and reusable scene materials.
- Base/flag accent lights are omitted in Performance quality. Dynamic lighting count stays low.

## Validation

- `npm install`
- `npm run typecheck`
- `npm run lint` was attempted; this repository does not define a lint script.
- Existing shared and web tests, plus new weapon zoom/tuning tests (run before release).
- Local browser playtest performed at `127.0.0.1:5173`: opened both landing pages, created a local teacher, created a quiz from the sample builder, created a Flag session, joined as a student, started a round, added a bot, fired the launcher, opened quiz/buy/scoreboard UI, answered questions, purchased the Quick Snowball Launcher, and checked console warnings/errors.
- The browser environment did not grant pointer lock to automation, so the final right-click pointer-lock sequence needs one physical desktop pass. The pure zoom-cycle tests and in-game scope implementation cover the sequence structurally.

## Recommended Stage 6 work

- Add a real-device playtest matrix with Chromebook hardware, physical mouse pointer lock, and a controller.
- Add visual regression/E2E coverage for the landing pages, dashboard, Flag marker, and scope overlay.
- Consider lightweight instanced environmental props and a pooled impact-puff system only after recording Chromebook frame-time baselines.
