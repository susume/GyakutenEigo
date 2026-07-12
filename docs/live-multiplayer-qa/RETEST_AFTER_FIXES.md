# Implementation retest and extended live coverage

Date: 2026-07-12, Asia/Tokyo

## Fix verification

Two independent browser stores were used again: teacher/host in the in-app browser and player in Chrome. A server bot supplied the opposing actor.

| Original issue | Live retest result | Evidence |
|---|---|---|
| QA-LIVE-001 Zombie timeout reported a tie | **Passed.** Player result: “Humans survived until time expired.” Host final outcome: Humans 1 – Zombies 1. | `12-retest-zombie-host-results-fixed.png`, `13-retest-zombie-player-results-fixed.png` |
| QA-LIVE-002 quiz dialog persisted | **Passed.** Quiz was deliberately open at timeout and was absent from the result DOM/view. | `13-retest-zombie-player-results-fixed.png` |
| QA-LIVE-003 Zombie used Blue/Red terminology | **Passed.** Lobby read “Zombie Mode Ready Room”; feed read “joined the Zombie Mode lobby”; host summary and scoreboard used Humans/Zombies. | `12-retest-zombie-host-results-fixed.png`; live DOM record |
| QA-LIVE-004 ended timer reset to duration | **Passed.** Both ended timer locations displayed 0:00. | `13-retest-zombie-player-results-fixed.png` |
| QA-LIVE-005 wrong late-action message | **Passed by implementation and automated validation.** Server now distinguishes ended from waiting sessions. A second live boundary answer was not forced because only one controlled player browser remained available. | Server change and green build/typecheck |

Browser console errors/warnings during the fixed Zombie retest: none.

## Extended live coverage completed

- Created a five-minute Classic session with $5000 starting money and 30 snowballs.
- Purchased and equipped Quick Snowball Launcher ($1200) and Heavy Snowball Launcher ($2500); money and cadence HUD values updated.
- Starter rapid-input test: six fire inputs (initial arena click plus five `F` presses) reduced ammunition from 30 to 26. Rejected attempts did not consume ammunition, consistent with the 0.16-second server cooldown.
- Quick rapid-input test: six fire inputs over approximately 633 ms reduced ammunition from 26 to 23. The result is consistent with the displayed 0.15-second cadence and shows rapid input did not bypass the cooldown.
- Heavy launcher displayed the 1.50-second cadence and fired from scoped states.
- Heavy right-click sequence visibly cycled medium zoom, deep scope/vignette, then normal. Evidence: `15-heavy-zoom-level-2.png`, `16-heavy-zoom-normal.png`, `17-heavy-verified-scope-2.png`, `18-heavy-verified-normal.png`.
- Refresh after an ended match restored the same identity, Heavy launcher, $1300 balance, and 30 snowballs.
- A refresh while actively deep-scoped caused the Chrome automation channel to lose its old tab handle and then time out on repeated inspection. The tab remained present under a new handle. This is **inconclusive**: it may be browser-control instrumentation rather than an application defect, so no product issue is filed.

## Automated validation

- Web tests: 31 passed.
- Shared gameplay tests: 48 passed.
- Web typecheck: passed.
- Server typecheck: passed.
- Full shared/server/web production build: passed.

## Still not verified live

- Three or four simultaneously controllable human browser sessions; third Incognito control remained unavailable.
- Human-vs-human hit direction/damage/knockout credit and same-team fire.
- Complete Flag pickup/drop/place/capture lifecycle and simultaneous objective races.
- Zombie projectile conversion, near-simultaneous conversions, and all-Humans-converted end.
- Hold/release Tab semantics (the browser API only offered atomic keypress/click operations).
- Knocked-out refresh, flag-carrier refresh, reconnect identity conflicts, host disconnect, and dropped sockets.
- 40-player browser scale, 15–60 minute soak, FPS/heap/GPU/long-task/HAR capture, and a real Chromebook.
- Safe live client-message mutation/replay; authoritative rule functions remain covered by shared tests but were not tampered with in a live socket.
