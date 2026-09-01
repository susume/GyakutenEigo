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

## Speaking Practice on a real iPad

Chromium iPad emulation does not prove Mobile Safari microphone, audio, page
lifecycle, or permission behavior. On an actual school-issued iPad, test both
a successful run and a controlled failure (for example, deny microphone
permission, then retry after enabling it):

1. Open the Speaking Practice join page.
2. Join a live speaking session.
3. Grant microphone permission.
4. Record speech.
5. Stop recording.
6. Confirm the upload succeeds.
7. Confirm the transcription appears correctly.
8. Confirm the AI response appears.
9. Confirm speech/audio playback works after a user interaction.
10. Complete multiple turns.
11. Finish the activity.
12. Confirm feedback appears correctly.
13. Select Japanese feedback and confirm Japanese renders correctly where applicable.
14. Rotate the device and repeat a short turn.
15. Background Safari, return, and confirm the session remains recoverable.
16. Test reconnect/session recovery after a brief network interruption.

Record the iPadOS/Safari versions, permission result, join code, approximate
time, network, and any console or `/check` evidence. Do not treat a failed
provider/transcription response as a microphone failure; record which stage
failed so the server logs and browser behavior can be compared.

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
