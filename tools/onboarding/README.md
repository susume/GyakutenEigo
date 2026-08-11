# QuizStrike teacher onboarding video

This folder contains the repeatable capture and build pipeline for the teacher onboarding video.

The final deliverable is:

- `../../quizstrike-teacher-onboarding.mp4` — 45.025 seconds, 1920x1080, 30 fps, H.264 video, stereo AAC audio.
- `output/quizstrike-teacher-onboarding.mp4` — identical copy for handoff with the other output assets.

## Regenerate

From the repository root:

```powershell
npx playwright test --config tools/onboarding/playwright.config.ts
powershell -NoProfile -ExecutionPolicy Bypass -File tools/onboarding/build-onboarding.ps1
```

The Playwright capture uses the running app and real API flow. It creates named canonical clips in `raw/`:

- `01-account.webm`
- `02-make-quiz.webm`
- `03-create-game.webm`
- `04-invite-students.webm`
- `student-join.webm`
- `05-start-game.webm`

Future Playwright auto-recording artifacts are kept under `raw/.playwright/`; the named clips are the inputs used by the build script.

## Captured product flow

The video follows the current product terminology and real screens:

1. Create account — `Create your account`, `Create account`.
2. Make a quiz — `Question library`, `Create question set`, `Create a set`, `From a study list`, `Create questions`, `Ready to host`.
3. Create a game — `Set up a game`, `Choose the game`, `Team Tag`, `Choose a map`, `Desert Citadel`, `Create game`.
4. Invite students — `Invite students`, `Game code`, `Student Join Link`, `Copy join link`, `Scan to join`.
5. Student join — `Player name`, `Join game`, then Blue Team or Red Team.
6. Start — `Start game`, followed by the live host view, `Run the live game`, and the real `Preparation Time` state.

The capture uses a four-part teacher framing for the chapter cards: create the account, make a quiz, create a game, and start the game. The student join screen appears between game setup and the invite lobby because that is the fastest way to show both sides of the classroom flow.

## Audio and editorial treatment

There is no voice narration. The video is caption-led so the UI remains the source of truth. It uses the existing project-owned `tank-metal.mp3` as quiet background music plus subtle existing click/bell effects at chapter transitions. Asset attribution remains in the existing audio attribution files under `apps/web/public/assets/audio/`.

The local development hostname is masked in the final invite scene so a debug URL is not presented as a shareable classroom address. The real Game code, Student Join Link label, QR code, copy control, and the app's classroom Wi-Fi warning remain visible.

## Validation

`build-onboarding.ps1` performs:

- ffprobe metadata validation for duration, 1920x1080 frame size, 30 fps, H.264, yuv420p, stereo AAC, and 48 kHz audio;
- a full decode check with ffmpeg; and
- representative visual validation frames in `output/validation/`.

The capture and build process only creates video assets and test data. It does not change production app behavior or UI.

## V2 revised cut

The revised deliverable is:

- `../../quizstrike-teacher-onboarding-v2.mp4` - 30.126 seconds, 1920x1080, 30 fps, H.264 video, stereo AAC audio.
- `output/quizstrike-teacher-onboarding-v2.mp4` - identical copy for handoff.

V2 intentionally preserves the original V1 output and reuses the named raw captures listed above. After reviewing the raw recordings, no additional recapture was required: the existing footage contains the real account, quiz, game, student-join, invite, and start-game actions/results needed for the tighter edit.

Regenerate V2 from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/onboarding/build-onboarding-v2.ps1
```

The V2 edit keeps the app visible, uses persistent four-step markers instead of full-screen chapter cards, applies editorial crops/zooms and cursor-visible action windows, shows the student count progressing, and limits the `Preparation Time` transition to a short beat. V2 has no background music and no narration; its audio is a silence bed with sparse project-owned click and confirmation cues only.

V2 metadata, scene timings, representative frames, and the full decode check are written to `output/v2-validation.json` and `output/validation-v2/`.

## V3 corrective rebuild

The corrective V3 deliverable is:

- `../../quizstrike-teacher-onboarding-v3.mp4` - 36.058 seconds, 1920x1080, 30 fps, H.264 video, stereo AAC audio.
- `output/quizstrike-teacher-onboarding-v3.mp4` - identical copy for handoff.

V3 uses V1 as the visual reference and does not use V2 as the base edit. It retains V1's navy branded chapter cards, generous whitespace, readable typography, and calm full-page UI composition, while shortening the cards and removing dead time. It avoids V2's aggressive crops, oversized zooms, headings covered by captions, and cramped page context.

V3 reuses the canonical raw captures after reviewing both previous cuts and the source footage. No additional recapture was required: the existing recordings show the real account form and dashboard, question-set creation and generated questions, game setup and lobby, the 0-to-1-to-2-to-3 student roster progression, the Start Game click, the Preparation Time state, and the live host screen. The optional student-side shot is limited to a brief transition.

Regenerate V3 from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/onboarding/build-onboarding-v3.ps1
```

V3 has no background music and no narration. Its audio is a silence bed with sparse project-owned click and confirmation cues only. Metadata, scene timings, representative frames, and the full decode check are written to `output/v3-validation.json` and `output/validation-v3/`.
