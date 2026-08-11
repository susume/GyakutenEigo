# QuizStrike Classroom V2 promo

This directory contains the isolated V2 capture and FFmpeg assembly workflow
for the stronger 15-second QuizStrike Classroom trailer. The original V1 files
remain unchanged at `../../quizstrike-promo-15s.mp4` and
`../promo/output/quizstrike-promo-15s.mp4`.

## Deliverables

- `../../quizstrike-promo-15s-v2.mp4` - primary 15-second trailer.
- `output/quizstrike-promo-15s-v2.mp4` - mirrored trailer copy.
- `raw/quizstrike-promo-v2-session.webm` - preserved Playwright source take.
- `raw/capture-timings.json` - capture event and server-state timeline.
- `raw/clips/` - preserved source clips used by the edit.
- `capture-promo-v2.spec.ts` - reproducible two-browser capture.
- `build-promo-v2.ps1` - reproducible FFmpeg assembly and validation script.
- `preview/` - contact sheets and keyframes used for visual QA.

## Capture

The capture creates a temporary in-memory classroom, quiz set, and session,
then joins two real browser students: `V2 Blue Anchor` and `V2 Red Rival`.
Both choose teams and play the same `iron_junction` Classic round. The source
records the real question, correct `+$1500` reward, Warm Vest purchase, live
rail-yard movement, visible Red opponent, server-authorized snowball hit, and
freeze result. No artificial hit, teleport, or generated gameplay frame is
inserted into the source. Bots are intentionally disabled for this take so the
human Red-vs-Blue encounter is not interrupted.

From the repository root:

```powershell
npx playwright test tools/promo-v2/capture-promo-v2.spec.ts --config=tools/promo-v2/playwright.config.ts
```

The capture server uses an empty `DATABASE_URL` and a test-only port, so the
temporary classroom does not touch a production or local database.

## Assembly

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-v2/build-promo-v2.ps1
```

The edit uses hard cuts and sparse event typography:

1. Cold-open on the real Red opponent and impact.
2. Brief official brand sting.
3. Multiplayer lobby, answer, cash reward, and gear purchase.
4. Fast Iron Junction gameplay montage.
5. Red reveal, real freeze impact, and a short scoreboard flash.
6. Existing QuizStrike Classroom hero artwork as the final lockup.

The mix uses the project-owned BGM at
`apps/web/public/assets/audio/game/tank-metal.mp3`, plus project-owned UI,
coin, footstep, launcher, and impact cues. The final audio is loudness
normalized to an approximately `-16 LUFS` target with `-1.2 dBTP` true-peak
ceiling. Attribution for the BGM remains in
`apps/web/public/assets/audio/game/ATTRIBUTION.md`.

## Validation

The build writes `output/quizstrike-promo-15s-v2-probe.json` and
`output/quizstrike-promo-15s-v2-loudnorm.txt`. The current export is H.264,
1920x1080, yuv420p, 30 fps, stereo AAC at 48 kHz, with a 15-second video
timeline. The latest loudness check measured approximately `-14.50 LUFS` and
`-1.20 dBTP`.
