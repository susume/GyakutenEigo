# SpeakCheck local speaking avatar

## Files

Added under `apps/web/src/features/speaking/avatar/`:
`SpeakingAvatar.tsx`, `SpeakingAvatarRenderer.ts`, `AvatarRig.ts`,
`avatarBehavior.ts`, `speakingAvatars.ts`, `speaking-avatar.css`,
`AvatarRig.test.ts`, `SpeakingAvatarRenderer.test.ts`, `avatarBehavior.test.ts`,
and `avatarAssets.test.ts`.
The bundled model, README and licence are in
`apps/web/public/assets/speaking/avatar/`. See
[speaking-avatar-model.md](speaking-avatar-model.md) for model selection,
licensing, lossless optimization, and real-character validation.

Updated `SpeakingPracticeApp.tsx` (live partner/transcript presentation),
`speakingLifecycle.ts` (extract the existing state mapping for reuse/tests), and
`apps/web/e2e/speaking-student-layout.spec.ts` (fallback/state/layout smoke tests).
The TTS provider, voices, recording, server, and assessment code are unchanged.

The live partner card contains one `SpeakingAvatar`, framed from the chest up
with a transparent canvas and portrait lighting. Preparation/scenario resources
and Context remain unchanged. Transcript messages use the existing static partner
image from the avatar configuration, never additional canvases.

## State and speech

The existing conversation state maps to the existing UI state in
`speakingLifecycle.ts`. The avatar maps ready → idle, student recording → listening,
processing/finishing/evaluating → thinking, and AI playback → speaking. Waiting,
paused, ended, completed, and authorization/error states minimize avatar motion.
Greeting, replies, replay, and stop playback retain their current TTS lifecycle.
No recording, API, evaluation, retry, or reporting behavior was changed.

`AvatarBehavior` crossfades procedural vowel envelopes about every 180–340 ms,
with occasional short silent intervals. Speech ends/cancels cause a smooth fast
release to zero. It works without SpeechSynthesis boundary events; it does not
analyze synthesized audio and is not phoneme-accurate lip sync. TTS remains the
existing browser provider with no new cloud service or voice selection changes.

The portrait blinks irregularly, breathes, shifts its gaze slightly, and makes
small head movements. Listening tightens eye contact with occasional small nods.
Thinking slightly shifts gaze and uses a gentle relaxed expression if available.
Paused motion is reduced. Reduced-motion preference scales head/body/eye movement
to 12%, retaining mouth motion and blinking. Expressions are detected once;
missing vowels route to another available mouth shape, custom mouth-open shape,
or jaw bone. Rest/zero weights provide neutral, avoiding expression overrides.

## Lifecycle and performance

Three/VRM renderer code is dynamically imported only for the live portrait.
The renderer stays mounted across speaking state changes. Rendering is capped
at 30 FPS and device pixel ratio at 1.5, without shadows/postprocessing or React
updates per frame. Hidden tabs cancel their animation frame; visibility resumes
with a bounded delta. ResizeObserver fits the portrait; an ordinary resize
listener is used if it is unavailable.

Model fetch is abortable and times out after 15 seconds. Non-abortable GLTF parse
results arriving after unmount/failure are disposed. Cleanup cancels frames,
disconnects observers, removes media/visibility/context listeners, disposes VRM
geometries/materials/textures and renderer resources, and releases the WebGL
context. This also handles React Strict Mode's mount/cleanup cycle.

WebGL initialization, missing/invalid/unsupported models, load timeout, shader
compilation/link failures, context loss, and thrown update/render errors switch
to the existing static partner image.
If that image also fails, a quiet message icon is displayed. Technical diagnostics
are limited to development builds; students keep their controls, role/message,
status, and existing aria-live announcements. The canvas is presentational.

## Installation and limits

The bundled **Mika 1.0** by **Peter Hoang** is a self-contained VRM
1.0 with standard blink and all five vowel expressions. Its 17,733,740-byte file
is installed at `apps/web/public/assets/speaking/avatar/default.vrm`. The
creator supplied the export and requested its installation. The embedded export
licence settings are preserved unchanged; see the accompanying
[licence](../apps/web/public/assets/speaking/avatar/LICENSE.md).
Assets/resources are restricted to the app's origin.
Model download and rendering are local to the student browser and have no per-use
service cost. Existing Gemini services and browser voice capabilities are unchanged.

The real character has been visually checked at desktop, tablet and phone sizes.
Mika has a stylized appearance with long brown hair. The export
is larger than the preferred 8 MB and is installed byte-for-byte, preserving all
texture pixels, geometry and metadata. Performance
was checked on this Windows/Chrome environment, not physical Chromebooks/iPads.
Portrait framing assumes a conventional upright humanoid; unusual proportions
or accessories may need camera tuning. Replacement models without blink/mouth
presets have limited facial animation. Procedural mouth movements follow speech
state, not precise phonemes
or audio pauses. Different browser/OS voices may use their own network services;
the avatar itself does not introduce any network service.

## Verification

Node tests cover state mapping, speech start/release, smooth vowel movement and
pauses, reduced motion, bounded resume deltas, expression detection, and jaw
fallbacks without a WebGL context. Playwright smoke tests cover model failure,
WebGL failure, greeting/replay/stop state transitions, support controls, one live
avatar, static transcript thumbnails, responsive layout, finishing, and feedback
loading. Renderer tests use real Three/VRM in-memory objects and replace the GPU
and parser boundaries; no test VRM binary is generated. They cover successful
loads, model disposal, partial initialization, shader/runtime/context failure,
unmount/timeout races, mount/cleanup/remount, hidden-tab suspension, bounded
resume deltas, display refresh cadence, and camera clipping at different scales.
Run root
`npm run typecheck`, `npm run test`, `npm run build`, then
`npm run test:e2e -w @quizstrike/web -- e2e/speaking-student-layout.spec.ts --project=desktop-chrome`.

Verified on 2026-10-07:

- Root typecheck and build passed, as did web/e2e typecheck and focused lint.
- Root tests with the bundled model: 719 passed, one existing server test skipped
  (720 total).
- Avatar unit tests: all 27 passed, including the actual asset's licence settings,
  self-contained resources and facial morph bindings. The earlier audit test files passed a separate
  TypeScript check (the normal app config excludes unit tests).
- Avatar/layout Playwright suite: all seven passed. It includes the real-model GPU uniform/lifecycle
  test and a native browser SpeechSynthesis test, alongside the five existing
  cases. Desktop/tablet/mobile screenshots were inspected; recording, processing,
  reply, replay/end/cancel,
  Context, Help, Finish, and feedback loading were checked. Hint/transcript
  reachability was verified at desktop heights of 600, 700, 720, and 768 pixels.
  The real model reaches `ready`, replaces the fallback, renders all five vowels
  and blinking, and closes its mouth in idle/listening/thinking and after stop/end.
  Native Chrome SpeechSynthesis start/end events were observed with the real VRM.
  Native TTS tests skip on operating systems without a local English voice.
  Visibility-handler suspension/resumption was verified against the real VRM
  with simulated browser events. Actual window hiding was not observable in
  this automated Chrome environment; see speaking-avatar-model.md for details.
- The earlier broader 12-test speaking browser run passed eight and failed four existing
  tests in `speaking.spec.ts`, before the live avatar screen. A separate Vite build
  with the modified speaking source files restored from HEAD reproduced all four
  at the same lines: 85/118 expect the old "Create a Performance Test" heading,
  555 expects the old "Join session" button, and 747 expects the old homepage
  "Create a Performance Test" button. The current UI uses Speaking Task labels.
  Teacher/join/homepage behavior and those existing tests were left unchanged.
- The build still reports a >500 kB shared Three chunk warning, also present in
  the baseline build. The avatar renderer itself is a separate lazy chunk.

Detailed local verification logs are in `.codex-local-logs/speaking-avatar-*.log`;
baseline-only build/config/results are also isolated in that ignored directory.

## Audit fixes

The follow-up audit fixed blank portraits after shader errors, incorrect raised
arms on rigs with the opposite coordinate orientation, lost 30 FPS cadence on
60/144 Hz displays, camera far-plane clipping for larger model scales,
and transcript clipping when a hint adds content on short desktop displays.
Cleanup now removes each listener independently even after partial setup or a
cleanup exception. Synchronous context loss during a draw cannot report a dead
renderer as ready or restart its loop. React passes the committed speaking state
through a layout effect. Desktop center content scrolls whenever it needs more
space; microphone, hint and transcript controls remain reachable.
