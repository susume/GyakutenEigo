# Athletics player audit — 4 October 2026

## Scope and player goal

Review the earlier hazard UX changes by playing the live local game, then repair problems that interrupt running, obscure the course, or make controls unresponsive. The goal is to see danger, choose an avoidance action, and resume racing quickly after answering or falling.

The in-app browser was used for keyboard movement and jumping, joystick movement, touch buttons, answering, three-correct fall recovery, Zeus warning/dodge cycles, Chaos ability charging and activation, a six-player Hunters & Runners match with five bots, and teacher pause/resume. Viewports included desktop 1280 × 720, tablet 768 × 1024 / 1024 × 768, and short landscape 812 × 375. Chaos was also played with the Low school-device graphics setting.

These are browser/device-size simulations, not physical tablet or Chromebook performance measurements. Manual play covered the opening course sections and the player recovery/ability loop. Full two- and three-lap completion is covered by server integration simulations rather than a claimed manual finish of every stage.

## Flow evidence

Screenshots are from this audit run and stored locally in the ignored `product-audit-athletics/` folder. Step 4's final image comes from the new automated player-flow scenario; the three-answer recovery was also completed manually in the tablet Zeus session.

| Step | Player action | Health after repairs | Saved evidence |
| --- | --- | --- | --- |
| 1 | Join and read the course briefing | Healthy: rules, route and controls are discoverable | [Lobby](../product-audit-athletics/01-lobby-before.png) |
| 2 | Run and jump through the opening hurdles | Healthy: movement, jump and energy consumption worked | [Hurdles](../product-audit-athletics/03-hurdles.png) |
| 3 | Open a fuel question and return to running | Improved: four answers fit in short landscape, with 44px targets | [Before](../product-audit-athletics/04-question-before.png), [after](../product-audit-athletics/09-landscape-question-after.png) |
| 4 | Fall, answer three correctly and return to the course | Improved: one recovery explanation/progress bar, automatic return after the third correct answer | [Before](../product-audit-athletics/06-recovery-before.png), [after](../product-audit-athletics/10-recovery-after.png) |
| 5 | React to Zeus warnings and rotate the viewport | Healthy: compact warning, readable controls, full canvas after resize | [Tablet warning](../product-audit-athletics/07-tablet-zeus-warning.png), [landscape](../product-audit-athletics/08-landscape-after.png) |
| 6 | Charge a Chaos ability, press R, then run/jump | Improved: R activates the shield, meter resets, shield count increases; airborne Answer explains the restriction | [Ability](../product-audit-athletics/12-chaos-ability-after.png), [running](../product-audit-athletics/13-chaos-run.png) |
| 7 | Enter a live Hunters & Runners match with CPU players | Fixed: race placement counts runners, matching the scoreboard; CPU throw direction/range and impact rules are covered by rule tests | [CPU match](../product-audit-athletics/14-hunters-runners.png) |
| 8 | Pause and resume with teacher controls | Fixed: player controls pause; attack, projectile and effect deadlines preserve their remaining duration | [Paused](../product-audit-athletics/15-teacher-pause.png) |

## Issues repaired

1. **Attack fairness after pause.** Only the race start/end times had been shifted. Zeus strikes, Chaos paths/events, foam impacts, ability duration, freeze/stagger, and recovery deadlines could expire during a pause. Resume now shifts those deadlines, including the room's pending projectiles and cooldowns. Client hazard visuals use the teacher's pause timestamp while paused.
2. **Duplicate recovery UI.** A large recovery card, a second question card and a world overlay repeated the same instruction. The question card now owns one explanation and a semantic progress bar. The outside recovery banner remains available when the question panel is closed.
3. **Short landscape obstruction.** The tutorial could cover the timer and the question card placed choices C/D below the viewport. Landscape spacing now keeps ordinary short questions and all four choices visible. Longer prompts, audio and explanations retain scrolling.
4. **Resize robustness.** Arena dimensions previously depended on a window resize event. A ResizeObserver now tracks the actual container so orientation changes and panel resizing keep the camera and drawing buffer aligned.
5. **Silent airborne touch Answer.** The touch callback returned without feedback while jumping. It now passes local grounded state to the existing question handler, which tells the player to land first.
6. **Incomplete keyboard activation.** Touch action buttons only listened for pointer events. They now accept keyboard/assistive activation without duplicating pointer actions.
7. **Misleading ability shortcut/status.** The touch button advertised A without an ability handler, conflicting with left movement. R now activates the ready ability and appears on the controls. Activation feedback says activated rather than ready after spending the charge.
8. **Incorrect Hunter question reward.** Hunters saw the runner's movement-energy title/reward. Their card now shows foam refill and the actual bounded ammo reward, including streak bonuses. New labels have Japanese translations.
9. **Duplicate Chaos event display.** The event already appears in the compact HUD; its second bottom chip was removed.
10. **Hunters counted as racers.** The HUD included hunters in the race denominator while the scoreboard correctly excluded them. Runner standings now use the same filter, and the hunter HUD hides place/lap and shows runners remaining.
11. **Generic feed recreated hazard messages.** A new live playthrough found Zeus dodge messages arriving through `game_event`, after the dedicated handler had correctly suppressed its own toast. Athletics timer audit events now stay in the server log and do not recreate notification text or countdown audio. The desktop mode action strip is also bounded to 340px rather than covering the full bottom of the course.
12. **Chaos landscape overlap.** With a charged ability, the three variant cards wrapped into two rows and overlapped the joystick. Short landscape now keeps them in one row. A new browser scenario checks HUD clearance, touch target size and activation in that state.

## Environment asset pass

The follow-up covers the actual world rendered by every Athletics mode. [Epic's Fall Guys course guidance](https://dev.epicgames.com/documentation/fortnite/working-with-fall-guys-islands-in-fortnite-creative) recommends using colors, patterns and icons to guide players and communicate obstacles. [Nintendo's Bowser's Fury overview](https://supermario3dworld.nintendo.com/bowsers-fury/) provides a reference for recognizable landscape destinations. Applying those ideas here means consistent district materials and landmarks beside the route, while keeping the jumping space clear.

- Added native Three.js environment assets: canyon rock banks, garden shade pavilions and benches, a high lookout, festival pennants, distant hills, clouds and a surrounding meadow. These are authored mesh assets rendered in the game, rather than HUD illustrations.
- Replaced the shared brown atlas tiles for Athletics with quiet rubber/paint, wood-grain and panel textures. Corrected this map's atlas Y orientation so wood does not appear in pale markings. Painted pads use a matte response without noisy bump mapping.
- Added solid district fascias beneath platform tops, high-contrast hurdle stripes and bands on slalom posts. White route chevrons and the authoritative course geometry remain consistent with the earlier movement audit.
- Repainted the perimeter and grandstands, raised tree crowns above the walls, corrected the oval track/infield scaling axis and moved the stadium sign onto its course-facing side.
- Reduced the dense descent supports to spaced spans and painted them blue, opening the background that previously looked like one black wall.
- Reused the existing licensed Ferris wheel, entrance, stalls and coaster GLBs. No new external asset downloads or asset licenses were introduced.

Repeated clouds, hills, rocks and flags use instancing; decorative boxes join the existing static batches. Low adds fewer than 5,000 scenery triangles, and the deferred GLB payload remains within its existing test budget. Tests check new props against every main-route/shortcut landing plus nine units of headroom. This is a geometry/render budget check, not a physical Chromebook frame-rate measurement.

The updated opening was played with desktop keys and tablet-size joystick/Jump controls on Low graphics; the first hurdle was crossed and the question panel opened afterward. Later districts were inspected with the existing course-camera viewer, rather than described as manually completed laps. Saved evidence: [overview before](../product-audit-athletics/16-environment-overview-before.png), [overview after](../product-audit-athletics/17-environment-overview-after.png), [canyon](../product-audit-athletics/20-canyon-environment-after.png), [summit](../product-audit-athletics/23-summit-environment-after.png), and [Low tablet play](../product-audit-athletics/22-tablet-low-environment-after.png).

Chaos Climb was checked again on Low in 812 × 375 landscape: three correct answers refilled energy and charged Shield; tapping Shield spent the charge and added a shield. After the card-layout repair, measured clearance between HUD and joystick was 36px. [Charged ability and environment](../product-audit-athletics/24-chaos-landscape-environment-after.png). Temporary graphics/touch preferences and the viewport override were restored afterward.

## Strengths and remaining evidence limits

Course arrows, a fixed Zeus ring, explicit three-answer recovery, automatic recovery return and the compact energy meter make the player loop understandable. Routine CPU attacks no longer require reading central announcements. The [earlier research and hazard decisions](athletics-hazard-ux.md) remain the basis for warning timing and committed trajectories.

Keyboard/touch activation, visible target size, recovery progress semantics and viewport reflow were checked. This does not establish full screen-reader or WCAG conformance. Physical low-end frame rate, classroom-scale network latency and pupil pacing still need a real classroom device playtest. A local development-process interruption required restarting the in-memory audit server; production failover behavior was not evaluated or changed.

## Validation

- Workspace type checks passed; the updated web/e2e types passed again after the control changes.
- Server and web production builds passed; the web join CSS synchronization check passed.
- ESLint on changed TypeScript and `git diff --check` passed.
- 21 focused shared-rule, mode-authority, renderer and teacher-pause checks passed.
- Five server race integration checks passed, including question recycling, fall recovery authority, ability use and full two-/three-lap completion.
- All six Athletics browser scenarios passed. The three affected scenarios passed again after adding R activation and stronger resize/question/recovery checks.
- All seven Athletics browser scenarios passed across the environment full run and focused reruns. Orientation checks wait for the drawing-buffer aspect ratio and settled HUD/control spacing, retaining the same eight-pixel clearance requirement. The new charged-Chaos scenario uses touch taps so Auto input detection stays in tablet mode.
- Nine focused imported-asset, hazard-renderer and new scenery checks passed, including jump-space clearance, Low geometry budget and preservation of other maps' default material response.

Follow-up classroom verification should measure how often players fall, how quickly they understand the rings/arrows, and whether dodging stays comfortable on actual Chromebooks and tablets. Tune warning timings from that observation rather than adding more announcements.
