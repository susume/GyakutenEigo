# QuizStrike Classroom promo

This directory contains the isolated capture and editing workflow for the
15-second QuizStrike Classroom trailer.

## Deliverables

- `../../quizstrike-promo-15s.mp4` — primary 15-second trailer.
- `output/quizstrike-promo-15s.mp4` — mirrored copy for promo assets.
- `raw/quizstrike-promo-session.webm` — Playwright source recording from the
  real QuizStrike application.
- `raw/capture-timings.json` — capture-stage timing notes.
- `capture-promo.spec.ts` — local classroom setup and browser capture.
- `build-promo.ps1` — reproducible FFmpeg assembly and validation script.
- `preview/` — local review frames; these are not needed for regeneration.

## Capture

The capture uses the existing Playwright dependency and the normal built web
and server applications. It creates a temporary teacher, quiz set, and room in
the server's in-memory test runtime, joins one browser student, adds seven of
the server's existing advanced test bots, and records the real lobby, question,
answer feedback, Desert Citadel round, combat input, and scoreboard.

The capture server is intentionally started with `DATABASE_URL` set to a blank
value, so no local or production database is touched. The account, room,
questions, and bot state disappear when the capture server exits.

From the repository root:

```powershell
npm run build
npx playwright test tools/promo/capture-promo.spec.ts --config=tools/promo/playwright.config.ts
```

Playwright video recording needs its small FFmpeg helper. If it is missing,
install only that helper with:

```powershell
npx playwright install ffmpeg
```

The capture viewport is 1920×1080. Browser chrome and the mouse pointer are
not part of the recorded viewport.

## Assembly

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo/build-promo.ps1
```

The script:

1. Probes the available FFmpeg encoders and uses `h264_nvenc` when a short test
   encode succeeds; otherwise it falls back to CPU `libx264`.
2. Cuts the real browser recording into ENTER, ANSWER, EARN, PLAY, COMPETE,
   and HERO beats.
3. Adds restrained action typography using the existing QuizStrike color
   language and the official transparent QuizStrike Classroom logo.
4. Uses one short insert of the repository's existing
   `quizstrike-actual-gameplay.png` capture so the PLAY beat has a clean frame
   with a visible opponent. This is a project-owned current-game capture, not
   generated or fabricated gameplay.
5. Mixes the existing QuizStrike BGM (`apps/web/public/assets/audio/game/tank-metal.mp3`)
   with project-owned UI, coin, impact, and snowball-launcher sounds into a
   stereo AAC track. BGM attribution is preserved in the source asset's
   `ATTRIBUTION.md` file; no additional music is downloaded.
6. Writes H.264 MP4 output at 1920×1080, 30 fps, `yuv420p`, stereo AAC, and
   15.000-second video/audio stream durations.

To use another capture or FFmpeg installation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo/build-promo.ps1 `
  -Source C:\path\to\capture.webm `
  -FfmpegPath C:\path\to\ffmpeg.exe `
  -FfprobePath C:\path\to\ffprobe.exe
```

## Selected scenes

- ENTER: current lobby with Red/Blue team selection and a styled character.
- ANSWER: a real English question and the student's answer interaction.
- EARN: the live `$400` reward state and reward transition.
- PLAY: live Desert Citadel first-person movement and snowball impact, plus
  the existing real-game opponent capture.
- COMPETE: the actual in-game scoreboard with Red and Blue rows.
- HERO: live arena background with the official QuizStrike Classroom logo and
  `Learn. Compete. Play.` lockup.

## Validation

The final file was checked with FFprobe for H.264, 1920×1080, 30 fps,
`yuv420p`, stereo AAC, and 15.000-second stream durations. FFmpeg decode and
black-frame checks were also run. Review frames for approximately 1, 3.5,
6, 9, 12, and 14 seconds are available in `preview/final-keyframes.png`.
