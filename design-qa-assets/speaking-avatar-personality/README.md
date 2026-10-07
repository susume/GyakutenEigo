# SpeakCheck avatar personality pass

Completed and visually checked on 2026-10-07 in the current GyakutenEigo checkout. This pass builds on the already completed [student scene work](../speaking-scene/README.md). The same bundled `default.vrm` is used throughout. The supplied plaza illustration guided warmth and composition; it was not substituted for the live character.

**1. Why the previous avatar felt uncanny.** Baseline captures showed a small face above a long, rigid torso, visible straight arms and waist below the dialogue, near-neutral lips, symmetrical posture, and a flat, pale appearance. Continuous direct gaze, simple blink timing and relatively large procedural mouth shapes reinforced the mannequin impression. The reference illustration has much richer authored facial detail than this VRM.

**2. Portrait framing.** The camera now frames hair, head, neck, shoulders and upper chest. It derives the crop from actual humanoid head/shoulder positions and geometry bounds, with chest/spine fallbacks. Shoulder width also constrains narrow canvases; camera clipping distances scale with the model. Unit tests cover model scales 0.1, 1 and 100 and multiple aspect ratios. No bundled-model coordinates or name are hardcoded. The avatar's CSS height follows the existing controls/reply spacing so the dialogue covers the less expressive lower body. Hair and chin remain visible, with comfortable headroom.

**3. Facial expression.** Each authoritative avatar state has one coherent, restrained expression profile. Expressions interpolate exponentially rather than snapping. The rig feature-detects expressions and rejects binary presets or presets that block mouth, blink or look-at. Existing missing-vowel, blink and jaw fallbacks remain available.

| State | Happy target | Relaxed target | Intent |
| --- | ---: | ---: | --- |
| Idle | 0.075 | 0.018 | Friendly availability |
| Listening | 0.095 | 0.022 | Warm attention |
| Thinking | 0.035 | 0.045 | A softened, thoughtful expression |
| Speaking | 0.110 | 0.015 | Slightly more facial energy |
| Paused | 0.060 | 0.030 | Calm waiting |

**4. Baseline smile.** Ordinary conversation no longer settles to a completely neutral face. The low idle smile is retained during pauses and reduced motion. Values were checked on the real bundled face, including shader morph weights; they stay well below a broad grin. The authored happy expression itself can reveal a thin lip/teeth seam even when all procedural vowels are zero.

**5. Listening.** All speech vowels release to zero. Gaze wandering is reduced to one quarter of the idle range, the expression is a little warmer, and breathing remains tiny. The first possible acknowledgement nod occurs after an irregular 9–23 seconds, with subsequent intervals of 13–30 seconds. A nod is less than one degree and lasts about a second; there is no mechanical repeating head bob. Slow resting tilt variation continues.

**6. Thinking.** The smile softens, relaxed weight rises slightly, and a small side/down glance is coordinated with a tiny head offset. It starts returning after 1.5 seconds and finishes its return over the next 2.5 seconds even if processing takes longer. Procedural vowels remain zero. There is no looping cartoon thinking pose.

**7. Speaking.** A slightly warmer smile accompanies all five procedural vowels. Rare, small head emphasis starts independently from syllables and follows irregular timing. The rig keeps blinks and gaze functional. This is a state-based expression; there is no sentence sentiment analysis or semantic brow animation. Replay, natural TTS end and Stop playback still use the existing conversation lifecycle.

**8. Blinks.** Blinks close in 50 ms, briefly hold for 25 ms, then reopen more slowly. Ordinary intervals vary approximately 3.1–7.9 seconds; listening intervals are longer at 4.5–9.3 seconds. A 10% chance adds one smaller second blink after a short pause, and it cannot chain into another double. Blinking is retained unchanged under reduced motion.

**9. Gaze.** Most time is spent looking toward the learner. Small departures occur at irregular 7–15 second intervals, last 1–1.8 seconds and smoothly return. Idle departures are bounded around two degrees sideways and a little over one degree down; listening and speaking further reduce them. Thinking's brief offset is separately bounded. Head yaw follows a small fraction of eye direction rather than turning independently.

**10. Mouth animation.** Procedural opening targets are now 0.20–0.42 instead of 0.32–0.66. Syllable durations vary from 0.14–0.34 seconds, with a 24% chance of a 0.18–0.52 second pause. Vowels crossfade smoothly; all `aa`, `ih`, `ou`, `ee`, `oh` shapes remain exercised in unit and real-WebGL tests. TTS stop uses a faster smooth release. Native browser SpeechSynthesis still drives speaking start/end/cancel. Mouth movement is visibly quieter without being eliminated.

**11. Head, body and arms.** The initial resting tilt is about one degree, changing slowly at irregular intervals within conservative bounds. Continuous sway and syllable-synchronized bobbing are absent. Breathing amplitude is reduced fourfold to 0.001 radians at the chest. Existing relaxed arm lowering is retained; the closer crop removes hands and waist from the visible composition. No gestures or waves were added.

**12. Lighting.** A restrained warm key, cool fill and neutral hemisphere provide gentle modelling. The key is warm ivory rather than orange. MToon GI equalization and toon-band sharpness are capped gently while preserving authored textures and base colors. The final face is a little warmer and hair/neck/shirt have more separation. White clothing is not blown out; it remains slightly gray because of the model's authored shading. No shadow maps or post-processing were introduced.

**13. Background separation.** A very faint radial wash behind the avatar and the existing lower fade help the portrait blend into the plaza haze. The effect is deliberately small. The model's existing outlines are retained; no thick outline or sticker shadow was added. Scenario/background selection and the existing reference panels are unchanged by this pass.

**14. Reduced motion and performance.** Reduced motion scales gaze/head/nod/body movement to 12%, while retaining facial warmth, normal blinks and speaking vowels. Paused motion is quieter still. Animation stays in `AvatarBehavior`/`AvatarRig`, using reused pose arrays/quaternions, without React per-frame updates. The 30 FPS deadline, DPR cap of 1.5, one canvas/context, hidden-tab suspension, local loading, fallback and cleanup paths are preserved. Real-renderer tests check frame bounds, one-context behavior, suspension and disposal.

**15. Before/after observations and visual QA.** Before captures were taken before product changes, using the real bundled VRM in the current scene. Final captures use the same scene, real model and renderer. For reproducible state captures, microphone data, the API reply and TTS completion are held by test doubles while actual UI transitions run; a separate native SpeechSynthesis test exercises the installed browser voice.

The first camera/light iteration still left the desktop face too small and the shirt too dull. A shoulder-based crop improved the portrait, then a final canvas-height adjustment exposed more shoulder/upper chest above the card. Final images were inspected in all four states at 1366×768 and 390×844, and idle at 1920×1080, 1280×720, 1024×768 and 768×1024. Additional long-dialogue output was checked at 360×800. Hair/chin remain clear, the dialogue sits below the face, and microphone/Finish remain reachable. The face is noticeably larger; the straight arms and waist no longer distract. Listening is only a little warmer than idle, thinking visibly softens, and speaking uses small mouth shapes. She feels calmer and friendlier, though the simplified eyes and lips still limit realism. A still image cannot demonstrate irregular blink/gaze timing; behavioral and runtime checks supply that evidence.

| Viewport/state | Before | Final |
| --- | --- | --- |
| 1366×768 idle | [before-idle-1366x768.jpg](before-idle-1366x768.jpg) | [after-idle-1366x768.jpg](after-idle-1366x768.jpg) |
| 1366×768 listening | [before-listening-1366x768.jpg](before-listening-1366x768.jpg) | [after-listening-1366x768.jpg](after-listening-1366x768.jpg) |
| 1366×768 thinking | [before-thinking-1366x768.jpg](before-thinking-1366x768.jpg) | [after-thinking-1366x768.jpg](after-thinking-1366x768.jpg) |
| 1366×768 speaking | [before-speaking-1366x768.jpg](before-speaking-1366x768.jpg) | [after-speaking-1366x768.jpg](after-speaking-1366x768.jpg) |
| 390×844 idle | [before-idle-390x844.jpg](before-idle-390x844.jpg) | [after-idle-390x844.jpg](after-idle-390x844.jpg) |
| 390×844 listening | [before-listening-390x844.jpg](before-listening-390x844.jpg) | [after-listening-390x844.jpg](after-listening-390x844.jpg) |
| 390×844 thinking | [before-thinking-390x844.jpg](before-thinking-390x844.jpg) | [after-thinking-390x844.jpg](after-thinking-390x844.jpg) |
| 390×844 speaking | [before-speaking-390x844.jpg](before-speaking-390x844.jpg) | [after-speaking-390x844.jpg](after-speaking-390x844.jpg) |
| 1920×1080 idle | [before-idle-1920x1080.jpg](before-idle-1920x1080.jpg) | [after-idle-1920x1080.jpg](after-idle-1920x1080.jpg) |
| 1280×720 idle | [before-idle-1280x720.jpg](before-idle-1280x720.jpg) | [after-idle-1280x720.jpg](after-idle-1280x720.jpg) |
| 1024×768 idle | [before-idle-1024x768.jpg](before-idle-1024x768.jpg) | [after-idle-1024x768.jpg](after-idle-1024x768.jpg) |
| 768×1024 idle | [before-idle-768x1024.jpg](before-idle-768x1024.jpg) | [after-idle-768x1024.jpg](after-idle-768x1024.jpg) |

**16. Validation results.**

| Command/check | Result |
| --- | --- |
| `npm run typecheck` | Passed, including E2E TypeScript; rerun after final test changes |
| `npm run test` | 733 passed, 1 existing optional Gemini smoke skipped, 0 failed: shared 164, server 185 + 1 skip, web 377, proxy 7 |
| `npm run build` | Passed; existing Vite warning about a chunk over 500 kB remains |
| Avatar test files via `node node_modules/tsx/dist/cli.mjs --test` | 36 passed, 0 failed/skipped |
| Baseline portrait Playwright test with `SPEAKING_AVATAR_QA_PHASE=before` | 1 passed before implementation |
| `npm run test:e2e -w @quizstrike/web -- e2e/speaking --workers=2` | 17 passed, 7 failed, 0 skipped (24 tests, 4.5 minutes) |
| `git diff --check` | Passed |

All 12 student-layout tests pass, including four-state portrait captures, actual VRM uniforms, native browser TTS, fallback failures, reduced motion and renderer lifecycle. Added unit coverage checks smooth expression transitions, nonspeaking mouth closure, blink asymmetry/double blink, rare nods, safe movement/gaze bounds, thinking's gaze return, seeded reproducibility, reduced-motion warmth, unsafe-expression guards and generic framing. The native speech assertion now requires visible but restrained mouth movement, with an upper bound of 0.43; all-five-vowel coverage remains.

The seven full-suite failures are the same legacy teacher/preparation failures already reproduced on the original starting commit with original test files in the [preceding QA report](../speaking-scene/README.md). They fail before reaching the avatar. They were not skipped or weakened:

| Test | Missing legacy control |
| --- | --- |
| Builder persistence | `Activity name` textbox |
| Classroom overview | `Speaking Practice` heading |
| Set launch/history | `Filter speaking reports by My Set` label |
| Logged-out teacher/auth return | `Create a Performance Test` heading |
| Connected teacher/student API flow | Same legacy authoring heading |
| Retry recovery | Preparation `Join session` button |
| Entry/join laptop layout | `Create a Performance Test` button |

Local ignored logs: `.codex-avatar-before.log`, `.codex-avatar-typecheck.log`, `.codex-avatar-test.log`, `.codex-avatar-unit.log`, `.codex-avatar-build.log`, `.codex-avatar-e2e.log`. `.github/workflows/ci.yml` still uses Ubuntu/Node 22, `npm ci`, root typecheck/test/build; no dependency, lockfile or CI configuration changed. These commands remain compatible and passed locally. No GitHub run was triggered, and the full Playwright suite is not all green.

**17. Exact files modified in this personality pass.** Earlier uncommitted student-scene changes remain in the checkout and are separately listed in their historical report. This pass modifies these eight source/test files:

- `apps/web/src/features/speaking/avatar/avatarBehavior.ts`
- `apps/web/src/features/speaking/avatar/AvatarRig.ts`
- `apps/web/src/features/speaking/avatar/SpeakingAvatarRenderer.ts`
- `apps/web/src/features/speaking/avatar/avatarBehavior.test.ts`
- `apps/web/src/features/speaking/avatar/AvatarRig.test.ts`
- `apps/web/src/features/speaking/avatar/SpeakingAvatarRenderer.test.ts`
- `apps/web/src/features/speaking/speaking-scene.css` (avatar height, faint background wash, removal of conflicting responsive avatar heights)
- `apps/web/e2e/speaking-student-layout.spec.ts` (portrait state test, facial-weight probe and restrained native-TTS mouth bounds)

Documentation: new `design-qa-assets/speaking-avatar-personality/README.md` and a historical cross-reference added to `design-qa-assets/speaking-scene/README.md`. The 24 JPEG filenames in the before/final table above are new files under `design-qa-assets/speaking-avatar-personality/`; they are compressed QA evidence, not runtime assets. No other product file was changed by this pass.

The model/license SHA-256 values match the pre-change capture:

- `apps/web/public/assets/speaking/avatar/default.vrm`: `DFEF02A40993742D9CCA8939DF692DCFAC960DD0ED90CEF87C1CE5E443959BE9`
- `apps/web/public/assets/speaking/avatar/LICENSE.md`: `CCF95A4408C36AA822D1943ACFF3E030FF12287F4B2C6B5A5EB15261D128DB75`

**18. Remaining model limitations.** This VRM has a simple stylized face, large fixed eye shapes, limited lip geometry and authored toon skin/clothing. Subtle happy/relaxed presets improve friendliness but cannot reproduce the reference illustration's detailed cheeks, eyes, hair, fabric or expressive smile. The baseline smile can reveal a small lip seam despite zero vowel animation. Procedural vowels have no audio phoneme timing, so they approximate speech rather than provide precise lip sync. Brow energy and sentence-specific smiles were not fabricated from unsupported expressions. Browser voices vary by device; visual QA used Windows Chrome. The deliberately quiet motion may be easy to miss in screenshots. Seven existing teacher/prep browser tests remain a separate issue. Recording, Gemini, evaluation, support interaction rules, scenarios, authentication and teacher/report logic were not changed in this pass; Useful English and vocabulary remain read-only.
