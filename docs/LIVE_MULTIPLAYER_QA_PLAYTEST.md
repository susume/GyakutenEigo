# Live Multiplayer QA Playtest

Date: 2026-07-12 (Asia/Tokyo)
Target: local authorized development environment
Build: workspace state at test time; production code was not modified

> **Post-audit status:** The five findings in this report were subsequently implemented and retested. All five are resolved in the current workspace. See `docs/live-multiplayer-qa/RETEST_AFTER_FIXES.md` and evidence 12–19. The original findings below are retained as the before-fix audit record.

> **Continuation status (2026-07-13):** Further live recovery and Flag testing found two new High issues and one Low issue: active late joins are not host-controlled, disconnected players remain Active/Online, and non-code join errors append invalid-code guidance. See `docs/live-multiplayer-qa/AUDIT_CONTINUATION_2026-07-13.md` and evidence 21.

> **Current fix status (2026-07-13):** The three continuation issues were implemented and verified with automated tests plus live API/Socket.IO checks. See `docs/live-multiplayer-qa/FIX_VERIFICATION_2026-07-13.md`. The remaining gaps below are still not release certification.

## 1. Executive summary

True live browser testing was completed with **two simultaneous independent browser stores**: one teacher/host in the Codex in-app browser and one player in a regular Chrome profile. A third independent Chrome Incognito context opened, but two consecutive Windows capture/control timeouts prevented joining it; it is not counted as a tested session. One server-controlled bot supplied an opposing player, but is not represented as a browser session.

Flag Mode, Zombie Mode, and Classic Tag Practice each ran from room creation through timeout/results. The reliable core was room creation/join, roster synchronization, authoritative initial Zombie selection, visually synchronized countdowns, quiz rewards, accuracy reporting, and actionable invalid-code handling. The largest confirmed gameplay defect is that Zombie Mode ends with generic Red/Blue/tie semantics even when a Human remains, so the intended survivor outcome is not reported.

Issue count: **0 Critical, 1 High, 3 Medium, 1 Low**.

This was a bounded live audit, not full certification. Objectives, every weapon, disconnect races, 40-player scale, long-duration performance, and safe message tampering could not be verified with the available independent browser control.

## 2. Test environment

- Windows desktop, timezone Asia/Tokyo.
- Local Vite web client at `http://localhost:5173`.
- Local game server at `http://localhost:4000`.
- Codex in-app browser: host context, 1280×720 CSS px, DPR 1.75.
- Chrome profile `ユーザー 1`: player context; default live area about 1098×531 CSS px, DPR 1.75.
- Explicit Chrome checks at 1280×720 and 1366×768.
- Quiz: `Live Multiplayer QA`, four generated multiple-choice questions.
- No browser console errors/warnings captured in the lobby or Flag result; no server exceptions printed.

## 3. Sessions and identities

| Context | Identity | Role | Independence |
|---|---|---|---|
| In-app browser | QA Teacher | Host | Separate browser store from Chrome. |
| Chrome regular profile | BlueQA | Flag player, Blue | Separate store from host. |
| Chrome regular profile | ZombieQA | Zombie player, Human | Sequential identity in player context. |
| Chrome regular profile | ClassicQA | Classic player, Blue | Sequential identity in player context. |
| Chrome regular profile | ErrorQA | Invalid-code check | Sequential identity in player context. |
| Server bot | Atlas Bot 1 | Opponent / initial Zombie | Not a browser session. |
| Chrome Incognito | Intended RedQA | Intended third player | Opened, but capture/control timed out twice; not used. |

Room codes used: `SWWJCT` (Flag), `6W92NE` (Zombie), `E82XP8` (Classic).

## 4. Test coverage matrix

| Area | Coverage | Result |
|---|---|---|
| Room creation and join | All three modes | Confirmed working. |
| Complete configured match | One 60-second match per mode | Reached results in all three. |
| Restart / another match | Flag → Zombie → Classic | Confirmed; stale dialog defect found. |
| Team/role assignment | Player + bot | Flag/Classic split Blue/Red; Zombie selected one Human and one Zombie. |
| Visual timer sync | Paired host/player screenshots | Flag 0:44/0:44; Zombie 0:43/0:43. |
| Quiz/reward/accuracy | Classic, one correct answer | $0 → $400; final 100%. |
| Scoreboard structure | Host in all modes | Columns present; bot/role labels present; no-attempt accuracy shown as `-`. |
| Error handling | Invalid room code | Clear, actionable message. |
| Chromebook-like layout | 1280×720, 1366×768 | No horizontal clipping observed on result view. |
| FPS movement/fire | Brief keyboard input at round boundary | Inconclusive; no pass claimed. |
| Weapons / zoom / hits / reload | Not completed | Unverified. |
| Flag lifecycle / races | Not completed | Unverified. |
| Zombie conversion | Not completed | Unverified. |
| Disconnect/reconnect | Not completed | Unverified. |
| Security message tampering | Not completed | Unverified. |
| 40-player / long soak | Not completed | Unverified. |

## 5. Features confirmed working

- Teacher account, quiz creation, sample question generation, and room creation.
- Player join by code and nickname from a separate browser store.
- Live roster updates and bot indicator.
- Opposing Flag/Classic teams with one player and one bot.
- Authoritative Zombie start selection: all observed views agreed on ZombieQA as Human and Atlas Bot 1 as Zombie.
- Active host/player countdowns remained visually synchronized in paired captures.
- Correct Classic answer awarded exactly $400 in the observed HUD and produced a 100% result.
- Scoreboard columns: Player Name, Tags, Respawns, Question Accuracy.
- No-attempt accuracy displayed `-`, never `NaN%`.
- Invalid code message explained the problem and the next step.
- 1280×720 and 1366×768 result layouts remained readable without horizontal clipping.

## 6–9. Issues by severity

### Critical issues

No Critical issues were confirmed.

### High issues

#### QA-LIVE-001 — Zombie timeout reports a generic tie instead of the surviving Human outcome

- **Severity:** High
- **Classification / confidence:** Confirmed defect / High
- **Frequency:** 1/1 completed Zombie matches
- **Environment / sessions:** Local Windows; host in-app browser and Chrome player; Zombie Mode; ZombieQA + Atlas Bot 1
- **Reproduction:** Create a 60-second Zombie room with one starting Zombie; join one player; add one bot; start; allow time to expire while the Human remains.
- **Observed:** Active state correctly showed 1 Human and 1 Zombie. At timeout the player result said “The teams finished tied”; host final score remained “Blue 0 – Red 0.”
- **Expected:** A Zombie-specific survivor result, such as Humans win/survive, with Human/Zombie outcome data rather than Red/Blue scoring.
- **Impact:** Students and teacher receive the wrong competitive meaning at the most important moment; classroom scoring and comprehension are undermined.
- **Evidence:** `07-zombie-host-active.png`, `08-zombie-player-active.png`, `session-timeline.md`; result text captured in the live DOM observation.
- **Console / network / timing:** No console error; no server exception; occurred once at the configured 60-second timeout. HAR/socket-frame export unavailable.
- **Likely subsystem:** Match resolution and result-view mode mapping.
- **Likely root cause (inference):** Zombie timeout falls through to the generic team-score result formatter instead of evaluating remaining Humans.
- **Suggested correction:** Add explicit Zombie timeout resolution and mode-specific result payload/copy; remove Blue/Red score fields from Zombie results.
- **Regression risks:** Elimination-end logic, duplicate end events, reports, and stored outcomes.
- **Validation:** Repeat with Human survivor, all Humans converted before timeout, simultaneous conversion at zero, and multiple Humans/Zombies; compare all clients and report records.

### Medium issues

#### QA-LIVE-002 — Quiz dialog persists over results and into the next room

- **Severity:** Medium
- **Classification / confidence:** Confirmed defect / High
- **Frequency:** 2/2 matches that ended with the quiz open
- **Environment / sessions:** Chrome player; reproduced after Flag and Classic; carryover observed on Flag → Zombie join
- **Reproduction:** Open Q Quiz near round end; leave it open through timeout; view results; choose Join Another Game and join the next room.
- **Observed:** Quiz dialog remained above the ended-session summary. After joining Zombie Mode, the previous quiz dialog was still open until Return to Arena was pressed.
- **Expected:** All gameplay dialogs close on round/session end and a new room starts with clean UI state.
- **Impact:** Results and next-room instructions are obscured; a student can believe an old question is still active.
- **Evidence:** `06-flag-player-results-stale-quiz.png`; Zombie lobby DOM observation in `session-timeline.md`.
- **Console / network / timing:** No console error; immediate at timeout; no network failure observed.
- **Likely subsystem:** Client modal/menu lifecycle and session-state reset.
- **Likely root cause (inference):** Quiz-open state is local component state not cleared on session ID/status changes.
- **Suggested correction:** Clear quiz/buy/settings/scoreboard/zoom states on round end, session end, leave, and successful join.
- **Regression risks:** Practice-while-out flow and preserving an intentionally open quiz during respawn.
- **Validation:** End each mode with every overlay open, then join another room and refresh/reconnect.

#### QA-LIVE-003 — Zombie lobby and feed use Blue-team terminology

- **Severity:** Medium
- **Classification / confidence:** Confirmed defect / High
- **Frequency:** 1/1 Zombie joins
- **Environment / sessions:** Host and Chrome player; Zombie Mode
- **Reproduction:** Join a waiting Zombie room before start.
- **Observed:** Player heading read “Blue Team Ready Room”; host feed said “ZombieQA joined Blue Team,” although the HUD/scoreboard classified the player as Human.
- **Expected:** Waiting copy and feed should use Human/Zombie or neutral pre-selection terminology.
- **Impact:** Students cannot tell whether Blue means Human, a team, or a stale role; teacher feed contradicts the scoreboard.
- **Evidence:** Live DOM observations; `session-timeline.md`; active role state in `07-zombie-host-active.png` and `08-zombie-player-active.png`.
- **Console / network / timing:** No console/network failure; appears immediately on join.
- **Likely subsystem:** Shared join-event formatter and ready-room heading.
- **Likely root cause (inference):** Generic team labels render before/without a Zombie-mode branch.
- **Suggested correction:** Use mode-aware role labels throughout lobby, feed, HUD, scoreboard, and result UI.
- **Regression risks:** Flag/Classic team labels and initial-Zombie reveal timing.
- **Validation:** Join before start, join during start, reconnect, and convert roles while observing all sessions.

#### QA-LIVE-004 — Ended-session HUD resets timer to the configured duration

- **Severity:** Medium
- **Classification / confidence:** Confirmed defect / High
- **Frequency:** 3/3 completed matches
- **Environment / sessions:** Chrome player; Flag, Zombie, Classic
- **Reproduction:** Let a 60-second match expire and view the ended session.
- **Observed:** HUD changed to Session Ended but timer displayed 1:00 rather than 0:00/final elapsed state; stale arena objective/HUD remained visible.
- **Expected:** Freeze at 0:00 or hide the active timer/HUD in favor of results.
- **Impact:** Misleading state suggests a new round is ready or the timer restarted.
- **Evidence:** `06-flag-player-results-stale-quiz.png`, `09-classic-results-1280x720.png`, `10-classic-results-1366x768.png`.
- **Console / network / timing:** No console error; occurs at transition to ended state.
- **Likely subsystem:** Client timer fallback and ended-state layout.
- **Likely root cause (inference):** Missing end timestamp causes the display to fall back to configured duration.
- **Suggested correction:** Persist final remaining time or explicitly render 0:00/hide timer once ended.
- **Regression risks:** Waiting-room timer, restart flow, multi-round intermission.
- **Validation:** Timeout, elimination, flag capture, Zombie conversion end, manual end, refresh on results.

### Low issues

#### QA-LIVE-005 — Late quiz answer returns a wrong-state teacher message

- **Severity:** Low
- **Classification / confidence:** Confirmed defect / Medium
- **Frequency:** 1/1 answer submitted as the Flag timer expired
- **Environment / sessions:** Chrome player; Flag Mode
- **Reproduction:** Open quiz with about four seconds left; submit an answer while the session transitions to ended.
- **Observed:** Answer was not counted, which is defensible, but the UI alert said “The teacher has not started the active round yet” while the page simultaneously showed Session Ended.
- **Expected:** A precise message such as “The round ended before this answer was submitted; no reward was awarded.”
- **Impact:** Student may blame the teacher or retry an impossible action.
- **Evidence:** `06-flag-player-results-stale-quiz.png`; live result DOM observation.
- **Console / network / timing:** Submission crossed the final seconds; no console error or captured network failure.
- **Likely subsystem:** Quiz rejection error mapping.
- **Likely root cause (inference):** Multiple inactive-session states share one generic message.
- **Suggested correction:** Map server rejection reasons to ended/not-started/knocked-out/offline messages.
- **Regression risks:** Practice answers outside active rounds.
- **Validation:** Submit immediately before, at, and after zero; repeat on manual end and disconnect.

## 10. Multiplayer synchronization findings

- Host roster reflected the Chrome player and bot without manual refresh.
- Paired rendered screenshots are authoritative: Flag showed 0:44 on both; Zombie showed 0:43 on both.
- Human/Zombie counts and roles agreed across host and player at start.
- Quiz reward appeared in the player HUD within the observation cycle and final accuracy matched the answer log.
- No permanent desynchronization, duplicate player, ghost, or winner disagreement was observed in the limited two-browser run.
- Exact socket latency, movement interpolation delay, and projectile timing were not measurable with available instrumentation.

## 11. Flag Mode findings

One full configured timeout round completed with BlueQA vs Atlas Bot 1. Join, opposing assignment, start, synchronized timer, and results worked. The flag lifecycle, placement/capture, carrier knockout/disconnect, race conditions, and all win conditions were not exercised; no claims are made for them.

## 12. Zombie Mode findings

Initial selection was authoritative in the observed two-actor match: ZombieQA Human, Atlas Bot 1 Zombie. Counts agreed. Conversion, stale projectile, multiple Zombies, tag credit, and all-Humans-converted termination were not exercised. Timeout/result semantics are defective (QA-LIVE-001), and pre-start copy leaks team terminology (QA-LIVE-003).

## 13. Weapon findings

The Starter Snowball Launcher rendered with 10 snowballs and 0.16-second cadence. A brief keyboard-input attempt occurred at a round boundary, but no reliable ammo, hit, damage, reload, knockout, cooldown, zoom, sound, or server-authority observation resulted. Quick and Heavy/AWP behavior is unverified; no weapon pass is claimed.

## 14. Scoreboard and statistics

Host scoreboards rendered all required columns, bot and role/team indicators, mode grouping, and `-` for no-question accuracy. Classic final result showed 100% after one correct answer. Hold/release Tab behavior, live visible updates, long/duplicate names, reconnects, role switches, and large rosters were not verified.

## 15. Reconnection findings

Not verified. Closing, refreshing, carrier recovery, duplicate identity, host disconnect, and stale-socket behavior remain open risks.

## 16. Performance findings

- Local service startup: Vite reported ready in about 3.8 seconds; shared build had zero errors.
- Active WebGL scenes rendered at the tested view sizes without a blank canvas or asset error.
- Browser control timed out once while opening the Classic quiz, then recovered on the next snapshot. This is recorded as an instrumentation/performance concern, not an app defect.
- Browser instrumentation did not expose FPS, frame-time trace, heap data, long tasks, GPU load, or HAR/WebSocket frames.
- No 15–60 minute soak was run; degradation is unverified.

## 17. Chromebook findings

At 1280×720 and 1366×768, the Classic result/arena remained readable and no horizontal clipping was observed. The ended timer defect is clearly visible. A real Chromebook, low-power CPU/GPU throttling, 1024×768, browser zoom, touchpad pointer lock, and managed-school policies were not tested. **Assessment: not Chromebook-ready for release certification; layout has encouraging smoke-test results, but performance and input readiness remain unverified.**

## 18. Security and rule enforcement

Only normal UI behavior was exercised. No message tampering, cooldown bypass, self-awarded tags/money, role changes, stale message replay, or unauthorized objective completion was attempted because the available live tooling did not provide safe, inspectable socket-frame mutation. Server authority is therefore unverified beyond observed role selection and quiz reward behavior.

## 19. Untested or unverifiable areas

- A third controlled player browser; Incognito capture/control timed out twice.
- Human-vs-human damage, same-team damage, bots, every weapon, zoom states, reloads, audio stacking.
- Flag pickup/drop/place/capture/hold and simultaneous objective actions.
- Zombie projectile conversion, credits, equipment, near-simultaneous conversion, exact end-on-zero-Humans.
- Pointer lock, sprint/crouch/jump/collision/map traps, sustained movement and shooting.
- Tab hold/release semantics and keyboard navigation in forms.
- Disconnect, refresh, reconnect, identity reuse, host loss, server restart.
- Browser back/forward, fullscreen, zoom matrix, tab-away recovery, slow/offline network.
- Full room, duplicate name, session-started join, quiz with no questions.
- 40-player target, bot scale, particle stress, audio stress, soak, FPS/memory/network profiling.
- Client-side rule violation and replay tests.

## 20. Prioritized remediation plan

1. Fix Zombie timeout resolution and make result/report payloads mode-specific.
2. Clear all local overlays and transient input state on round/session/join transitions.
3. Replace generic Blue/Red labels with mode-aware Human/Zombie terminology end-to-end.
4. Correct ended-state timer/HUD behavior and specific quiz rejection messaging.
5. Add automated multiplayer integration coverage for mode result payloads and UI state reset.
6. Re-run with three to four controllable independent contexts, objective races, weapon matrix, reconnect scenarios, and 40-player/Chromebook performance capture.

## Evidence paths

- Report: `docs/LIVE_MULTIPLAYER_QA_PLAYTEST.md`
- Evidence directory: `docs/live-multiplayer-qa/`
- Index: `docs/live-multiplayer-qa/README.md`
- Post-fix retest: `docs/live-multiplayer-qa/RETEST_AFTER_FIXES.md`
- Audit continuation: `docs/live-multiplayer-qa/AUDIT_CONTINUATION_2026-07-13.md`
- Current fix verification: `docs/live-multiplayer-qa/FIX_VERIFICATION_2026-07-13.md`
