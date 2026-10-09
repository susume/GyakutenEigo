# Speaking classroom audit — 9 October 2026

The student conversation screen was audited and repaired with Japanese middle-school tablets and Chromebooks as the primary devices. Phones are a fallback, not the main design target.

**Verdict:** the checked classroom layouts and interactions work after the fixes. All 22 panel checks across 13 viewport sizes passed: no document overflow, covered controls, undersized checked touch targets, or drawers intersecting the dialogue. This is a browser simulation, not physical-device certification.

**Subsequent refinement requested by the user:** short microphone captions remain visible; the duplicate status subtitle is visually hidden and remains available as a live announcement. Help retains its label while loading, keeping the smaller toolbar stable. The restored caption was verified at 1280×640; frontend typecheck and lint passed. [Latest microphone controls](13-mic-caption-only.jpg). The audit captures and measurements below record the earlier footer.

## Findings and fixes

| Priority | Finding | Repair | Evidence |
| --- | --- | --- | --- |
| P1 | At 1024×768, Language Support covered the dialogue and Replay. | Support now docks beside the conversation from 960px wide. | [Before](01-before-tablet-support.jpg), [after](02-tablet-landscape.jpg) |
| P2 | A portrait-tablet support drawer covered half of Mika's face. | At 700–959px wide, Mika and support occupy separate columns above the dialogue. Smaller drawers share only the avatar's row. | [Portrait tablet](03-tablet-portrait.jpg) |
| P2 | Rotating a tablet could close support and lose keyboard focus. | Closing at the breakpoint returns focus to the visible control that opened support. | Repeated landscape-to-portrait checks; regression added to the E2E source. |
| P2 | Focusing controls could move the conversation four pixels because the enlarged decorative background created a scrollable overflow. | The scene uses clipping that cannot be scrolled by focus. Microphone captions also reserve two lines, and loading labels have bounded widths. | [Processing](05-processing.jpg), [state measurements](state-checks.json) |
| P2 | The microphone error's retry target was only 34px high. | Retry is now at least 44px high. | [Microphone recovery](08-microphone-recovery.jpg) |
| P2 | Replay looked available before the teacher started the activity or while it was paused, although the handler rejected playback. | Replay follows the session's disabled state. | [Waiting](09-waiting.jpg), [paused](10-paused.jpg) |

## Flow checked

1. **Open an active task.** Mika renders in WebGL, the café background loads, and Finish and the microphone remain reachable. [Chromebook](04-chromebook.jpg)
2. **Open support and conversation; rotate the tablet.** Support stays beside or above the dialogue. Conversation uses the avatar row. Escape closes drawers and rotation restores visible focus. The checked visible controls are at least 44×44 CSS pixels. [Tablet](02-tablet-landscape.jpg), [portrait](03-tablet-portrait.jpg)
3. **Record, process, replay, and stop playback.** Synthetic recording and TTS fixtures exercise the real student UI state transitions without requesting a microphone or sending speech to an external service. Dialogue and microphone bounds stayed identical through listening, processing, playback, and delayed hint loading. One avatar canvas was present in each check. [Processing](05-processing.jpg)
4. **Read a long partner message.** Keyboard scrolling reaches the end inside the dialogue card; Replay remains fixed and Space does not start recording while the reading region has focus. [Long dialogue](06-long-dialogue.jpg)
5. **Use the Japanese interface.** Japanese operational labels, including the delayed hint label, fit at 1024×600 while English practice content remains in English. [Japanese](07-japanese.jpg)
6. **Recover from a blocked microphone.** The simulated permission-denied message and 44px Retry button are visible and usable without hiding the speaking controls. [Recovery](08-microphone-recovery.jpg)
7. **Wait for the teacher or pause.** The reason is visible above the screen; recording and Replay are disabled. The student can still read the existing conversation and support. [Waiting](09-waiting.jpg), [paused](10-paused.jpg)
8. **Finish the local practice fixture.** Finish navigates to the result screen. The fixture has no real student speech, so it displays an unscored attempt instead of fabricated scores. [Result viewport](11-finish-result.jpg)

## Device sizes and validation

Primary tablet/Chromebook sizes checked: 1366×768, 1280×640, 1024×600, 960×512, 959×768, 1180×820, 900×1440, and 768×1024. Short/split-window checks: 844×390, 640×480, and 600×960. Narrow fallback checks: 390×844 and 320×568. A separate screenshot also verifies the 1024×768 landscape tablet layout. [Detailed bounds and hit tests](viewport-checks.json)

- Frontend tests: **378 passed**, zero failures or skips.
- Frontend typecheck, including E2E source: passed.
- Production frontend build: passed. The earlier complete workspace build also passed; server/shared code did not change in this audit.
- ESLint on the modified TSX and E2E file: passed.
- Git whitespace check: passed.
- Browser interaction checks used the Codex in-app browser and local QA fixtures. The Playwright CLI suite was not run during this audit; its regression source was extended and typechecked.
- The installed `default.vrm` and your exported `Mika 1.0.vrm` have identical SHA-256 hashes and sizes (17,733,740 bytes).

## Evidence limits

No physical Chromebook, iPad, or Android tablet was available in this audit. Actual touch gestures, school-managed microphone permissions, external transcription/AI services, classroom network contention, and device-specific frame rate remain unverified. These checks do not establish full accessibility compliance. The real Mika model and scene backgrounds were loaded, but recording, replies, and TTS timing were synthetic fixtures.

The screenshots were captured and inspected during this audit. Rejected cropped portrait captures were excluded. The retained JPEGs are compressed copies of those captures; measurements are retained separately.
