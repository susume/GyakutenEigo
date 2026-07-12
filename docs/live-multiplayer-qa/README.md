# Evidence index

- `FIX_VERIFICATION_2026-07-13.md` - verification of the three continuation fixes against live API/Socket.IO behavior.

- `01-flag-host-lobby.png` — host waiting room with BlueQA and opposing bot.
- `02-flag-player-lobby.png` — BlueQA ready room.
- `03-flag-host-active.png` / `04-flag-player-active.png` — paired Flag active views; both visibly show 0:44.
- `05-flag-host-results.png` — host Flag result.
- `06-flag-player-results-stale-quiz.png` — quiz dialog obscuring ended-session summary.
- `07-zombie-host-active.png` / `08-zombie-player-active.png` — paired Zombie active views; both visibly show 0:43 and 1 Human / 1 Zombie.
- `09-classic-results-1280x720.png` / `10-classic-results-1366x768.png` — Chromebook-like result captures; ended timer reset to 1:00.
- `11-invalid-room-code.png` — actionable invalid-code handling.
- `12-retest-zombie-host-results-fixed.png` / `13-retest-zombie-player-results-fixed.png` — paired post-fix Zombie results with mode-specific outcome, clean overlay state, and 0:00 timer.
- `14-heavy-zoom-level-1.png` — inconclusive transition capture; buy menu had not yet closed, retained for audit transparency.
- `15-heavy-zoom-level-2.png` through `18-heavy-verified-normal.png` — Heavy launcher zoom-cycle evidence; medium/deep/normal states.
- `19-heavy-deep-scope-before-refresh.png` — deep-scoped state immediately before the inconclusive active refresh recovery check.
- `21-disconnected-flag-carrier-still-active-host.png` — teacher still shows the closed Flag carrier as active.
- `console-retest-zombie.json` — post-fix host/player console capture (no warnings/errors).
- `console-audit-continuation.json` — continuation host console capture (no warnings/errors).
- `RETEST_AFTER_FIXES.md` — implementation verification and extended live coverage.
- `AUDIT_CONTINUATION_2026-07-13.md` — recovery, capacity, late-join, disconnect, and Flag pickup findings.
- `console-lobby.json`, `console-flag-results.json` — captured browser errors/warnings (none).
- `flag-start-timing.json` — DOM automation timing note. Visual screenshots are authoritative because the accessibility snapshot briefly exposed stale timer text.
- `performance-summary.json` — viewport/canvas facts and instrumentation limitations.
- `session-timeline.md` — chronological test record.
- `browser-viewport-matrix.md` — sessions and resolutions.
- `server-runtime-notes.txt` — runtime and server-log summary.
