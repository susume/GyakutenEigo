# Live audit continuation — 2026-07-13

Environment: local authorized development build on Windows, Asia/Tokyo. Two independent browser stores were established: teacher/secondary player in the Codex in-app browser and primary player in a clean Chrome Guest profile. A server bot was used only where noted.

## Newly confirmed working

- Duplicate nicknames are rejected with HTTP/UI conflict feedback.
- Full rooms reject additional players.
- Refresh while alive restored the same player into an active round in approximately 3.6 seconds. The WebGL arena completed its post-refresh render within the next two seconds.
- Teacher-initiated End Session propagated to the player, closed overlays, set both timers to 0:00, and displayed results.
- A late-joining player synchronized immediately and was balanced onto Red while the original player remained Blue.
- Flag Mode with opposing players started successfully.
- Red interaction at spawn picked up the flag; the carrier HUD changed to “Flag carried by Red” and feedback named the carrier.
- Closing the carrier tab returned the objective to “Flag available at Red base”; no stale carried flag remained.
- No host console errors or warnings were captured during this continuation.

## New issues

### QA-LIVE-006 — Non-code join errors incorrectly tell students to check the room code

- **Severity:** Low
- **Classification / confidence:** Confirmed usability defect / High
- **Frequency:** 2/2 applicable errors
- **Environment / sessions / mode:** Local Windows; in-app browser join client; Classic waiting room
- **Reproduction:** Join once as `RecoveryQA`; submit the same nickname again. Then fill the two-player room and submit a new nickname.
- **Observed:** Correct primary errors appeared (“nickname already taken” and “session is full”), but both appended “Check the code with your teacher, then try again.” The code was valid.
- **Expected:** Cause-specific recovery: choose another nickname, or ask the teacher to make space.
- **Impact:** Students may report a valid code as broken and interrupt the teacher unnecessarily.
- **Screenshot/video:** Not captured; exact live DOM alert text was recorded during the run.
- **Console/network/timing:** No console error; immediate server response; HTTP-frame export unavailable.
- **Likely subsystem:** Join-form error rendering.
- **Likely root cause (inference):** The UI unconditionally appends invalid-code guidance to every API error.
- **Suggested correction:** Map `404`, `409`, full-room, ended, and network failures to distinct next-step copy.
- **Regression risks:** Invalid-code and generic offline messaging.
- **Validation:** Repeat missing code, duplicate name, full room, ended room, and unreachable server cases.

### QA-LIVE-007 — Players can join an already active match without host approval

- **Severity:** High
- **Classification / confidence:** Confirmed requirement gap / Medium
- **Frequency:** 1/1 active-room attempts
- **Environment / sessions / mode:** Host + Chrome Guest early player + in-app-browser late player; Classic Tag Practice
- **Reproduction:** Create a three-player room; join `EarlyQA`; start the round; submit the same code as `LateQA` after Round Active is visible.
- **Observed:** `LateQA` joined alive immediately, was assigned Red, appeared in the teacher roster, and changed the active match from 1/1 to 2/2. No host approval or late-entry notice appeared.
- **Expected:** Per the audit requirement, reject with a clear “session already started” message, or expose an explicit teacher-controlled allow-late-join setting.
- **Impact:** Unplanned entrants can change team balance and classroom management after instructions and scoring begin.
- **Screenshot/video:** Live DOM observations in teacher and player sessions; no standalone screenshot.
- **Console/network/timing:** No console error; synchronized within the observation cycle.
- **Likely subsystem:** Server join authorization and session settings.
- **Likely root cause (inference):** Join validation blocks only ended/full sessions, not active sessions.
- **Suggested correction:** Default to lobby lock on start; optionally allow teacher-configured late joins with a clear event and spawn policy.
- **Regression risks:** Rejoin recovery must remain allowed for existing player IDs; distinguish rejoin from new join.
- **Validation:** New identity during start, immediately after start, mid-round, intermission, and authorized rejoin.

### QA-LIVE-008 — Closed player tabs remain Active and Online in the teacher roster

- **Severity:** High
- **Classification / confidence:** Confirmed defect / High
- **Frequency:** 2/2 tab-close tests (Classic player and Flag carrier)
- **Environment / sessions / modes:** Host in in-app browser; closed player tab in a separate active player view; Classic and Flag
- **Reproduction:** Join and start a match; close one player tab; wait at least 3.6 seconds; inspect teacher active count and scoreboard. Repeat while the player carries the Flag.
- **Observed:** Teacher remained at `2/2 active`; the closed player had no Offline marker and stayed eligible in the roster. In Flag, the objective safely reset to Red base, but `FlagRed` still appeared active.
- **Expected:** Mark the socket owner disconnected promptly, reduce active/connected count, show Offline, and reevaluate win/winnability rules.
- **Impact:** Teacher cannot distinguish absent students, elimination/round logic can wait on ghost players, and matches may remain technically active without a participating side.
- **Screenshot/video:** `21-disconnected-flag-carrier-still-active-host.png`.
- **Console/network/timing:** No browser console warning; still stale after more than 3.6 seconds; no network failure shown to teacher.
- **Likely subsystem:** Socket disconnect lifecycle, player connection state, active-player summary, and mode win reevaluation.
- **Likely root cause (inference):** Disconnect cleanup resets carried objectives but does not update/broadcast `connectionState` or exclude disconnected players from active counts.
- **Suggested correction:** Track sockets per player token; on last-socket disconnect mark Offline, broadcast immediately, start a reconnection grace period, and reevaluate Flag/Zombie/Classic resolution after grace expiry.
- **Regression risks:** Brief refreshes and tab switches must not count as permanent leaves; multi-tab identities need last-socket semantics.
- **Validation:** Close/refresh/network-drop with one and two tabs, carrier and non-carrier, reconnect inside/outside grace, and final-player disconnect.

## Continuation severity count

- Critical: 0
- High: 2
- Medium: 0
- Low: 1

## Remaining live gaps

- Flag placement/capture/hold completion and simultaneous objective races.
- Zombie projectile conversion and near-simultaneous conversions.
- Knocked-out refresh/rejoin.
- Host browser close/disconnect (manual End Session is confirmed).
- Hold/release Tab behavior with a controllable key-down/key-up API.
- 40-player, long-soak, real Chromebook, FPS/heap/HAR, and live socket mutation tests.

Chrome testing was paused after a browser password-manager prompt appeared; the prompt was not automated.
