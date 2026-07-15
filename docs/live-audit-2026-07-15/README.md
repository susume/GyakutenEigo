# Live classroom readiness audit — 15 July 2026

## Scope

Two-browser teacher/student playthrough of the local QuizStrike experience: landing page, student join, room creation, live round, quiz reward, purchase, scoreboard synchronization, session ending, and learning report.

## Launch verdict

The core classroom loop is functional on the teacher computer. The production build, type checks, and all 89 automated tests pass. A teacher can create a room, a student can join, the round can start, answers and purchases synchronize, and the final report is produced.

The current local launch is not yet ready for separate student devices. The generated join link uses `localhost`, which points each student device back to itself. The Wi-Fi address serves the frontend, but its API requests currently resolve to the frontend port instead of the game server. Use a deployed URL, or restart the local web app with `VITE_API_URL=http://10.134.132.1:4000` and open the teacher page at `http://10.134.132.1:5173` before sharing a link.

The main launch risk is the countdown: immediately after a 3:00 round began, the teacher view displayed 3:27 while the student view displayed 3:12. Both later converged, but the initial overrun can confuse a live class and suggests the display depends on each device clock rather than a server-synchronized clock.

## Flow evidence

1. **Home landing — healthy.** Strong headline and clear teacher/student entry points. The hero map preview is softer and less vivid than the surrounding page, and three different Quiz-Strike CTAs compete for the same action.
   - Evidence: `01-home-landing.png`
2. **Student join — healthy with recovery friction.** The code/name form is immediate and visually obvious. Visible text relies on placeholders, so instructions disappear while typing; there is no code-length hint or quick recovery message for students who mistype the room code.
   - Evidence: `02-student-join.png`
3. **Student active game — functional, visually crowded.** The arena, touch controls, status HUD, quiz, buy menu, and scoreboard work. The top status chips collide with the minimap at this width, and a focused skip link covers the first status chip. Keyboard letters remain in the touch labels.
   - Evidence: `03-student-active-game.png`
4. **Teacher live control — functional.** Join code, link, roster, scoreboard, live feed, bot control, and end-session flow all update correctly. The narrow layout preserves the key code, but the join URL truncates and the experience would benefit from a projector-focused waiting-room view with a QR code.
   - Evidence: `04-teacher-live-control.png`
5. **Student session end — healthy.** Controls disable correctly and the student gets a clear winner, accuracy, money, score, and next action.
   - Evidence: `05-student-session-ended.png`
6. **Teacher learning report — functional but not narrow-screen safe.** Accuracy, quiz money, reteach signals, student rows, and CSV export are present. The page overflows horizontally in the narrow teacher browser and hides report content without scrolling.
   - Evidence: `06-teacher-learning-report.png`

## Highest-impact polish

1. Make the generated student link reachable from student devices in local-network play.
2. Synchronize countdown displays to server time and clamp the first visible value to the configured duration.
3. Add a projector waiting-room mode with a large join code, QR code, player count, and one Begin Round control.
4. Collapse the student HUD to the three most important live states and prevent objective text from sitting under the minimap.
5. Make reports responsive by turning each student row into a stacked card below the table breakpoint and removing page-level horizontal scrolling.
6. Keep persistent visible labels and helper text on the join form; automatically uppercase the code and explain its expected length.
7. Sharpen or replace the landing hero preview with a vivid in-game action image and consolidate the repeated teacher CTAs.

## Accessibility evidence limits

The DOM exposes headings, buttons, labels, tables, dialogs, live status messages, a timer, and a skip link. Screenshots confirm large touch targets and clear end-state feedback. This pass did not verify color-contrast ratios, full keyboard order, screen-reader announcements, browser zoom beyond the captured narrow view, or reduced-motion behavior.
