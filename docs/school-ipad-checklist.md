# Physical school-iPad validation checklist

The automated iPad-like Playwright profile uses Chromium emulation. It checks
layout, touch-style interaction, the join flow, and the gameplay shell, but it
does not prove real Mobile Safari behavior. Run this checklist on the actual
school-issued iPad.

## Classroom network test

1. Connect to school Wi-Fi.
2. Open `https://gyakuteneigo.com` in Safari.
3. Open `https://gyakuteneigo.com/check`.
4. Confirm **Game API** is Connected.
5. Confirm **Realtime server** is Connected.
6. Confirm **WebSocket** is Available, or record that polling is the only available transport.
7. Join a real game using the teacher’s code.
8. Reach the lobby and confirm the student appears on the teacher screen.
9. Start a round.
10. Move and look using the touch controls.
11. Answer a question.
12. Verify score, answer feedback, and player state synchronize with the teacher.
13. Background Safari briefly by switching apps, then return to QuizStrike.
14. Confirm the reconnect banner clears and the room state is restored.
15. If anything fails, repeat `/check` and give the full result to school IT.

## Comparison tests

Repeat the same join and short-round test once on:

- home Wi-Fi;
- school Wi-Fi; and
- a normal desktop browser.

If home Wi-Fi and desktop work but the school iPad fails, save the `/check`
results and the approximate time of the failure. That evidence helps separate a
school filtering policy from a Safari or backend issue.

## iPad-specific observations to record

- iPadOS version and Safari version;
- whether the iPad reports WebGL and WebGL2;
- whether the first audio starts after a user tap;
- whether rotating the device changes the viewport cleanly;
- whether Safari backgrounding triggers a reconnect and restores the room;
- whether the network allows WebSocket upgrades or only HTTP polling;
- any infinite spinner, stale lobby, missing touch control, or lost score update.
