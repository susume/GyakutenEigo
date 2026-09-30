# QuizStrike Athletics design review

30 September 2026. Audience: upper elementary through high school.

This review is based on the authored course, shared jump/collision rules,
authoritative server runtime, student and teacher interfaces, automated
gameplay tests, and desktop/tablet browser captures. It is an implementation
review; student playtesting has not been conducted.

![Updated course at the starting landing](athletics-upgrade-preview.png)

## Course assessment

Skyline Adventure Park has a coherent climbing fantasy: learn near the
entrance, weave through the midway, cross attraction decks, traverse the
Ferris/coaster structures, ride the tower, and reach the skyline summit.
The common course lets a class learn the geography in Classic and reuse
that knowledge in the other modes.

Measured from the shared course definition:

| Element | Current course |
| --- | --- |
| Main route | 65 landings, 64 transitions, approximately 1,325 horizontal world units |
| Chapters / checkpoints | 6 / 6 |
| Height | 0 to 79 world units |
| Optional branches | 3 shortcuts |
| Moving interactions | 6 |
| Genuine authored jump transitions | 57, all with positive air gaps |
| Median / maximum ordinary gap | 6.98 / 8.87 units |
| Maximum shortcut gap | 8.92 units |
| Average landing footprint | 14.97 × 12.77 units |
| Standard jump | 15.5 upward velocity, 36 gravity, 14.8 horizontal speed |

The geometry validator and jump-envelope tests pass. The route already has
an accessible opening, large chapter checkpoints, and optional narrower
shortcuts. The largest problems were communication and hazard fairness:
stacked paths make projected progress an unreliable landing guide, and fast
surprise hazards can punish a correct jump.

## Implemented map changes

- **Follow the next actual landing.** Guidance now follows authored
  transitions from the surface under the player. The old `progress + 0.018`
  lookup could skip a nearby landing, mix an optional branch into the main
  path, or change targets during a jump. Guidance holds its target in flight,
  follows a shortcut after entering it, and hides at the finish.
- **Teach lift boarding.** The Drop Tower and final summit transitions rise
  beyond the standard jump apex. Their cyan marker follows the lift until
  boarding; a rider then sees the exit pad. This avoids presenting an
  unreachable static platform as the next jump.
- **Make direction persistent.** Cream chevrons point toward each landing's
  exit, including Low quality. Shortcut chevrons are gold. Shape provides
  direction without requiring colour recognition.
- **Make risk a choice.** Each shortcut entrance has a gold sign explaining
  that it has harder jumps. The normal route remains the default guide.
- **Improve chapter readability.** Checkpoint signs face the course tangent,
  and normal platform edge colours consistently follow their chapter.

All cues are decorative. The established surfaces, collision, checkpoint
validation, energy economy, and anti-skip authority remain the gameplay
contract. Permanent chevrons use the existing static batching system.

## Mode assessment and changes

| Mode | Classroom purpose | Implemented improvement |
| --- | --- | --- |
| Classic | Learn the route and build movement confidence | Reliable landing/lift cues, shortcut risk signs, a three-step lobby briefing, and checkpoint-based unfinished results |
| Zeus | Practise reacting while maintaining a jump rhythm | Longer warning windows, a fixed full-size hit ring plus a closing countdown ring, and vertical hit separation |
| Hunters & Runners | Combine station strategy with runner movement | Hunters are displayed separately from race ranks, with station, hits, and points; final Hunter results show their contribution |
| Chaos Climb | Use learned movement under changing pressure | Advance spawn warnings, local hazard travel, consistent route-distance sampling, recognisable objects, and wind that preserves required jump speed |

### Zeus

| Tier | Warning before / after | Cooldown before / after |
| --- | --- | --- |
| Lower | 1.8 / 2.4 seconds | 7.8 / 8.2 seconds |
| Middle | 1.5 / 2.1 seconds | 6.1 / 6.5 seconds |
| Upper | 1.25 / 1.8 seconds | 4.7 / 5.2 seconds |
| Rage | 1.05 / 1.6 seconds | 3.0 / 4.2 seconds |

Rage still asks for faster reactions and affects up to two targets. The
warning's outer ring now displays the entire authoritative strike radius;
the inner ring communicates the remaining time. The old ring initially
showed only 78% of that radius. Ring placement uses player eye height to
align a standing target's warning with the landing.

The strike check now rejects targets more than five vertical units from
their warning snapshot. Standard jumps remain within the strike column;
crossing to another storey of the stacked course is a legitimate escape.
Answering to break a freeze and automatic freeze expiry remain available.

### Chaos Climb

Every wave is published **1.6 seconds before its hazards activate**. Amber
rings mark the starting locations and arrows show the direction of travel.
The server skips impact checks during this warning. Rendering also separates
the warning from the active object and hides expired objects.

Hazards now traverse 4.5–7% of the route instead of 12–21%, over approximately
4.5–6.3 seconds instead of 2.5–4.1 seconds. This creates local encounters
across a few jumps, with time to make a movement decision. Seeds, event
variety, shields, and the 18-object cap remain in use.

Path sampling now uses horizontal segment lengths, matching course progress.
Previously it treated every segment as the same length, causing different
positions and variable physical speeds on unequal segments. Wind affects
knockback without reducing normal movement speed: slowing a racer during a
mandatory gap can make an otherwise valid jump fail.

Ducks have heads, beaks and eyes; carts have wheels; barrels are cylinders;
bumpers have rings; giant balls are spheres at their actual authored radius.
These procedural models need no additional downloads or third-party licences.
Existing imported park scenery continues to load through the existing asset
kit and quality settings.

### Student feedback

The lobby gives each mode three concrete rules and accurate keyboard/touch
controls before GO. Hunters are no longer labelled unsuccessful racers for
doing their assigned job. Unfinished runners see checkpoints reached and a
plain "Time up" result, alongside their quiz report.

Tablet screenshot review also exposed the mode action bar overlapping Answer
and the joystick. Touch mode now uses the existing touch HUD/actions, hides
the duplicate mode bar, and reserves a separate bottom row for the menu.
The tablet test taps Answer and verifies that its question actually opens.

## Verification

- Full production build and web/e2e TypeScript checks pass.
- Shared Athletics course, geometry, movement, mode and resource tests pass.
- Navigation tests cover every main landing, all shortcut landings, both
  required lifts, lift exits, airborne target retention, and the finish.
- Visual tests cover warning-to-active-to-expired Chaos states, teardown,
  Zeus ground alignment, the full hit radius, and the countdown ring.
- The server suite passes: 173 passed, one existing skip. Its initial run
  under concurrent verification had a two-lap timeout; the four Athletics
  integration tests passed in isolation and the complete server rerun passed.
- The shared suite passes: 146 tests. The web suite passes: 295 tests,
  including all existing rendering/asset tests. All seven proxy tests pass.
- Browser checks cover Classic, Zeus, Hunters & Runners, and Chaos Climb;
  both tablet checks cover briefing fit, jump/crouch controls and opening a
  movement-energy question by touch.

Browser screenshots are written to Playwright's `apps/web/test-results/`
output. The implementation has not been deployed.

## Classroom validation still needed

Automated checks establish correctness and basic presentation, not enjoyment
or age suitability. A small mixed-skill classroom session should measure:

- first-landing success and whether students can board each required lift;
- completion and checkpoint reach by age and control device;
- question time versus movement time, especially after repeated falls;
- whether Zeus warnings are visible during a jump and Chaos warnings are
  understood before the first hit;
- whether Hunters feel useful and runners understand their role swap.

The existing three-correct-answer fall recovery is retained. It deserves
particular observation with younger learners: repeated falls can turn a
movement challenge into a long sequence of recovery questions. Any future
recovery/difficulty presets should be judged against those classroom results.
