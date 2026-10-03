# Athletics hazard flow

Research and implementation: 3 October 2026.

The classroom playtest found that repeated CPU attack announcements obscure the course and that hazards arriving from behind feel unfair. The goal is to let runners read threats while continuing to move.

## Comparable games researched before changing the modes

| Reference | Source observation | Application to Athletics (design inference) |
| --- | --- | --- |
| Fall Guys: Big Shots and Short Circuit | Mediatonic describes dodging launched props while balancing and racing through an obstacle circuit. Its Season 4 changes also made characters more resilient to incidental hits. [Official release](https://www.fallguys.com/news/season-4-is-out-now?lang=en-US) | Let the obstacle itself communicate danger; leave space and time to dodge, with short hit reactions. |
| Fall Guys: Party Crasher | The projectile travels in a straight line before detonation or proximity impact. [Official Survival update](https://www.fallguys.com/news/fall-guys-survival-update?lang=en-US) | Commit attacks to a visible path instead of following the runner after launch. |
| Returnal | Housemarque explicitly highlights emissive enemy features to telegraph upcoming attacks, with projectile patterns driving avoidance. [Developer article](https://blog.playstation.com/2021/04/14/creating-returnals-otherworldly-enemies-vfx-driven-tentacle-tech-and-deep-sea-inspirations/) | Use world warning rings and direction arrows, reserve alert audio for the threatened runner, and keep attack timing predictable. |
| Super Mario 3D World + Bowser's Fury | Nintendo describes Bowser's meteor and beam attacks and instructs players to take cover. [Official game page](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Super-Mario-3D-World-Bowser-s-Fury-1832228.html?nsuid=70010000034440) | Each warning should communicate an available movement response, rather than demand that players read a large announcement. |

These sources describe mechanics, not controlled evidence that a particular warning duration is optimal. The timings below are course-specific design choices and should be tuned with another classroom playtest.

## Changes

- Zeus attacks and Chaos events no longer replace the room announcement. Start, finish, and role transitions retain their announcements.
- Routine attacks, dodges, and prop impacts no longer generate duplicate feedback toasts. Targeted Zeus warnings retain one sound; non-targeted runners get no repeated alert.
- Zeus places a fixed warning three metres along the course ahead of the runner. The ring does not track movement. Its radius remains accurate while its countdown closes. A compact HUD status replaces the separate freeze banner; actual freeze questions still open when hit.
- Zeus reaction windows are 2.2–2.8 seconds, with 5.8–9 seconds of rest after a strike. Higher tiers still increase difficulty.
- The first Zeus/Chaos warning starts three seconds after GO, allowing the opening overlay to clear before any reaction window begins.
- Every Chaos prop travels against race progress: it approaches runners following the course, including the descent. Waves begin every 8.5 seconds, warn for at least 2.2 seconds, and stagger additional launches by 0.9 seconds.
- Prop radii are 0.9–1.8 metres and lane offsets stay within 1.5 metres of the route centre. Standard jumps can clear every prop. Moving arrows stay visible under active props; ducks and carts face their actual travel direction.
- Speed-round timing is committed at launch. Starting or ending an event cannot rewind an already travelling prop.
- CPU Hunters only target runners within a 60-degree front cone (120 degrees total), 8–48 metres away and within five metres vertically. Human Hunters keep their aiming control. Foam balls take 1.1 seconds to reach the fixed launch target, with 1.8 seconds between throws; their world-space trail stays continuous.
- English and Japanese briefing/HUD text explain the new avoidance rules.
- Touch controls leave a gap between Jump and Answer. The portrait HUD clears the utility bar, the landscape HUD uses a shorter layout, and the jump tutorial yields to an active lightning warning.

Front means against the marked race route for Chaos and Zeus, and the runner's current camera-facing direction at launch for CPU Hunters. Players may turn around while an already launched object continues on its committed path.

## Verification targets

Check every mode on desktop and a narrow touch viewport. Observe multiple attack cycles, including a Chaos event. Confirm the course stays visible, a normal jump or sidestep avoids a prop, turning or dodging does not attract homing shots, and freeze/recovery questions remain usable. Unit checks cover direction, launch staggering, jump clearance, CPU front/range/storey eligibility, and renderer/server trajectory agreement. Browser checks cover repeated attacks without announcement overlays or unsolicited question panels.

The subsequent [player audit](athletics-player-audit.md) adds live keyboard/joystick play, recovery and ability checks, stronger browser regressions, and repairs to pause timing, resizing and landscape question layout. Physical classroom-device performance and pupil pacing still need a classroom playtest.
