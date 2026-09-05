# Speaking Practice audit — 5 September 2026

**Verdict: do not yet declare this ready for 40 students practicing simultaneously.** A local burst of 40 joins from one IP produced **30 successful joins and 10 HTTP 429 responses**. Several student recovery and layout defects can also prevent a student from continuing independently.

This report covers the current checkout at `3b5ef0aa3b96b25a02aaa739edaf4f915e0224a0`. The companion [Luna implementation plan](speaking-practice-luna-plan.md) turns these findings into ordered, testable work. No application fixes or production changes were made during this audit.

## Evidence and limits

- Inspected the actual React screens in the Codex in-app browser, using a local server with explicit mock providers, `NODE_ENV=test`, and no database connection. Teacher and student fixtures contain synthetic identifiers only.
- Inspected student UI, teacher workspace, API client, routes, provider adapters/prompts, repositories, Prisma schema, proxy timeout, recording helpers, and existing tests.
- Executed seven existing speaking test files: **28 tests passed, zero failed**. These include route contracts, provider behavior, evaluation validation, repository behavior, token headers, recording cleanup, and preview isolation. They do not establish browser usability or production throughput.
- Ran reproducible local HTTP probes. After admitting the remaining participants in a later rate-limit window, **40 simultaneous starts, 40 binary turn requests, and 40 finishes all returned 200**. This proves the mock path can handle that burst, not that a real model or database can. The browser audit added one separate learner, so teacher screenshots have 41 rows while the concurrency probe uses exactly 40.
- Simulated microphone denial through a local browser test override; no real microphone audio was captured. Completed-session restoration used credentials from the local fixture. That temporary browser override was discarded with its tab.
- Did not exercise a real speech provider, real PostgreSQL, school Wi-Fi, 40 physical microphones, genuine Safari/iPad recording, screen readers, or a sustained production load. Existing browser E2E tests were inspected, not executed. No claim of full accessibility compliance or production security certification is made.
- Initial browser viewport capture was unreliable when resized; the black/cropped desktop capture was rejected. Accepted narrow-screen captures and later full-page browser/CDP captures were opened and inspected. Desktop screenshots use a measured 1264×720 CSS viewport; narrow-screen captures show the approximately 697-pixel-wide app pane. Exact device/zoom coverage remains a release test.
- Evidence files and probe scripts are in `docs/audits/speaking-2026-09-05/`. That directory is intentionally ignored by the existing repository rules. The report and implementation plan are ordinary versionable documentation; preserve or attach the local evidence separately when sharing the audit.

## Flow review

| Step | Screen/task | Health | Main observation |
| --- | --- | --- | --- |
| 1 | Teacher signs in and opens builder | Usable, needs refinement | Existing teacher authentication and six templates work; large form, unlabeled expression fields, unstable input keys. |
| 2 | Teacher launches/shares/controls session | Incomplete for a class of 40 | Clear QR/code and pause/end controls; no joined/ready/error counts or live roster. |
| 3 | Student enters code and identifier | Blocked at classroom burst | Simple account-free entry, but 30/IP/min throttle and ambiguous identifier requirement. |
| 4 | Student checks device and starts | Fragile | Permission request exists; no signal/playback check, classroom noise guidance, or useful blocked-device recovery. |
| 5 | Student converses and asks for help | Major issues | Hobbies receives restaurant guidance; microphone placement and missing contextual Help impede the main task. |
| 6 | Student encounters error/pause/reconnect | Major issues | Mic error can strand the student; retry is not specific to the failed operation; duplicate polling and stale response risks. |
| 7 | Student finishes/reopens result | Major issues | Deadline mismatch; restored completed session has disabled controls and no result link. |
| 8 | Teacher reviews class and individual feedback | Useful but incomplete | Session-scoped results and evidence are available; no live refresh, readiness triage, or compact 40-person overview. |

### Step 1 — Teacher setup

![Teacher activity builder](audits/speaking-2026-09-05/06-teacher-builder.png)

Keep the integrated teacher shell, reusable activity/session distinction, templates, editable criteria, and explanation that pronunciation scoring is excluded. Improve the form rather than replacing the teacher workspace.

### Step 2 — Classroom control

![Teacher session controls](audits/speaking-2026-09-05/07-teacher-session.png)

The code and QR are easy to find. However, the teacher cannot tell whether 40 learners joined, which devices passed setup, who is processing, or who needs help before pressing Start.

### Steps 3–4 — Entry and device setup

![Student join screen at narrow width](audits/speaking-2026-09-05/01-join.png)

![Student preflight](audits/speaking-2026-09-05/02-preflight.png)

Entry is short and does not require a student account. The preparation page provides phrases and roles. Operational instructions are mostly English even for a Japanese classroom; the microphone explanation is not a device test. The first screenshot is a viewport capture, so the bottom of the form continues below the visible area.

### Steps 5–6 — Conversation and recovery

![Hobbies activity incorrectly presents restaurant conversation steps](audits/speaking-2026-09-05/04-hobbies-session.png)

![Microphone denial with no microphone retry action](audits/speaking-2026-09-05/05-microphone-error.png)

The transcript and phrase bank are useful foundations. In the narrow layout, the long conversation-flow card precedes the transcript and microphone. The error banner covers part of the header. Dismissing the microphone error removes its message but leaves the recording control disabled.

### Step 7 — Completion

![Completed session restored into a disabled speaking screen](audits/speaking-2026-09-05/10-completed-session.png)

![Student result](audits/speaking-2026-09-05/11-student-result.png)

The stored result can be opened directly with the correct token. The session screen does not lead the student there when completion arrives through refresh/restoration. Scores and feedback shown here are **mock-provider output**; their content is not evidence of real scoring quality.

### Step 8 — Teacher results

![Teacher classroom results](audits/speaking-2026-09-05/08-teacher-results.png)

![Teacher individual feedback and transcript](audits/speaking-2026-09-05/09-teacher-feedback.png)

The teacher can review a transcript and criterion-level evidence. The list is visually sparse for 40 learners, and status filtering, automatic refresh, search, and a summary of unfinished/error states are absent.

## Findings

Priorities: **P0** blocks the required class rollout; **P1** materially affects completion, correctness, or classroom control; **P2** improves usability/maintainability. “Confirmed” means reproduced or directly established in code. “Risk” means a plausible failure needing the named runtime test.

### A01 · P0 · Same-school-IP admission rejects part of the class — confirmed

`apps/server/src/routes/speakingRoutes.ts:267` implements a 60-second window; line 545 caps `join:${req.ip}` at 30. The parallel 40-request local probe returned 30×201 and 10×429 in 75 ms. This applies when the deployment resolves classmates to a shared IP, as commonly happens behind school NAT. Proxy interpretation could aggregate requests differently and must also be verified.

**Fix:** distinguish valid classroom admission from abuse attempts, use a classroom-aware burst allowance with retry headroom, retain invalid-code abuse protection, return structured rate-limit errors and `Retry-After`, and test the deployed forwarding chain. Do not simply remove all limits.

### A02 · P0 · Microphone can be outside the reachable viewport — confirmed layout defect

`speaking.css:3522` fixes the screen to `100vh` with hidden overflow. Child panels have large minimum heights; at the audited desktop viewport, the transcript occupies the visible height while the microphone is below it. Below 820 px, `speaking.css:4600` puts the full flow panel first, followed by a center with a 540 px transcript row, then controls. The narrow screenshot shows the teacher's scenario guide, not the student's primary action.

**Fix:** prioritize current reply and recording controls; make optional guidance collapsible, allow constrained transcript scrolling, and keep the microphone/Stop/Help usable at 1366×768, 1024×768, 768×1024, and 390×844, including browser zoom and the on-screen keyboard. Check the actual control bounding boxes, not just page overflow.

### A03 · P0 · Request deadlines conflict across client, proxy, and providers — confirmed

`apps/web/src/api/client.ts:65` defaults to 12 seconds. Only `turn` overrides this to 35 seconds; Help and Finish do not. `apps/server/src/speakingProviders.ts:97` allows transcription 15 s, conversation/Help 12 s, evaluation 30 s. `infrastructure/cloudflare/src/index.ts:6` limits API proxy work to 25 s. Thus a valid 20 s evaluation is abandoned by the browser, and a 15+12 s turn exceeds the proxy budget even before upload/database time.

**Fix:** define one explicit end-to-end budget including upload, queue, provider work, body read, and persistence. Make evaluation an accepted job with a durable status/result lookup, not a 30 s request hidden behind a 12 s client timeout. Align turn/proxy budgets and give recoverable timeout UI. Extending a browser timeout alone is insufficient.

### A04 · P0 release gate · Real-provider capacity is unproven; no aggregate admission control

Per-participant locks and per-token request limits do not constrain 40 different participants. Each accepted recording triggers transcription and then generation. There is no aggregate provider concurrency budget, bounded shared queue, project quota coordination, or durable evaluation worker. `express.raw` buffers up to 4 MiB before participant authentication and turn admission (`speakingRoutes.ts:372`), so 40 maximum-size bodies alone are 160 MiB, excluding copies/base64/provider data.

**Fix:** bounded admission and provider scheduling with measured concurrency and queue limits; reserve interactive capacity from evaluation bursts; protect admission before expensive body processing where possible. Instrument queue wait, total latency, errors, memory, database load, and per-operation usage. Verify configured account/model quotas rather than guessing a plan's capacity. Gemini quotas apply per project and vary by model/account; its documentation does not guarantee stated capacity. [Google rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

### A05 · P1 · Duplicate student polling wastes capacity and risks stale state — confirmed

`SpeakingPracticeApp.tsx:368` and `:441` each schedule session GETs every 2.5 s. Parent polling continues after the child mounts, although the child initializes its own state from `initialData`. For 40 students this is about **32 GET/s or 1,920/min**, before teacher requests. Each endpoint loads access, current session, turns, and participant. Neither interval prevents overlapping requests; the child can apply older snapshots over newer turn/lifecycle data. The parent also continues after a fatal child authorization failure.

**Fix:** one lifecycle owner, one in-flight request, cancellation on unmount, jitter/backoff, monotonic revision handling, and lightweight incremental status responses. A single unchanged 2.5 s poll would still be 16 GET/s, so measure database work rather than declaring the duplicate removal sufficient.

### A06 · P1 · Error recovery is incomplete and Retry can invoke the wrong operation — confirmed

`SpeakingPracticeApp.tsx:538–639`: recording failure sets `voiceState=error`; `onMic` only operates in ready/recording; error maps to the “thinking” presentation. Retry appears only if a previous audio Blob exists. Closing an error clears text only. The browser denial simulation reproduced the dead end. The same generic Retry can resubmit an old turn after evaluation failure instead of retrying evaluation. It also omits the previous audio-duration metadata.

**Fix:** explicit operation-aware errors with actions: retry microphone, retry same upload/request ID, record again when safe, retry/check evaluation, reconnect, or rejoin. Preserve duration and speech metadata; retain audio only for the recoverable in-flight turn and release it afterward. Do not make dismissing an error strand the student.

### A07 · P1 · Completed/evaluating restoration has no reliable path to results — confirmed

`SpeakingPracticeApp.tsx:419–462` sets completed/evaluating state from polling but never navigates to the result. `:605–623` navigates only after the local finish promise succeeds. Reopening a completed fixture showed disabled Finish and microphone, a still-running timer, and no View result action. `SpeakingResultPage:647` reads once; it does not watch an evaluation in progress or offer evaluation retry.

**Fix:** route completed participants to their result, resume pending evaluation monitoring after reload, freeze time at authoritative completion, and offer explicit retry when evaluation failed.

### A08 · P1 · Restaurant-only teaching content leaks into every activity — confirmed

`SpeakingPracticeApp.tsx:180–204`, `:247–280`: fixed restaurant steps, Japanese ordering goal, hamburger/salad/juice menu, and shop-assistant image are shown for hobbies too. Step 1 is always marked current. Only the first five of up to twelve saved expressions are rendered. Some text is Japanese regardless of selected feedback language.

**Fix:** snapshot structured scenario guidance/resources with the launched activity; give existing/custom activities a neutral fallback. Never infer scenario type from editable title text. Use honest static “Suggested steps” unless actual progress is tracked. Make all saved expressions discoverable. Separate operational UI language from English practice content.

### A09 · P1 · Contextual Help is wired in the controller but absent from the real screen — confirmed

The real `SpeakingStudentScreen` accepts `onHelp` but never renders a control calling it. The preview has Help, creating a misleading preview/actual-flow difference. Phrase buttons show a speaker icon but open a hint dialog rather than playing audio. Teacher Help counts cannot represent contextual support that students cannot reach.

**Fix:** add a visible Japanese/English Help control beside the microphone, use clear separate hint/play actions, announce loading, and record provider Help usage only when that operation succeeds.

### A10 · P1 · Teacher cannot monitor readiness or results live — confirmed

`SpeakingTeacherWorkspace.tsx:991` loads setup/sessions but has no readiness roster. Results at `:1383–1408` load only when `sessionId` changes, with no refresh control or polling. The result list maps joined/evaluating and other non-completed/non-error states to “In progress.” Forty students cannot be triaged quickly.

**Fix:** live joined/ready/working/needs-attention/evaluating/completed counts, per-device last-seen and setup status, filtering/search, explicit freshness, and a compact results table. Keep scores/transcripts off projector mode. Do not call a learner “ready” merely because they joined.

### A11 · P1 · Help mutates a completed participant; simultaneous Help can lose counts — confirmed plus concurrency risk

`speakingRoutes.ts:832–865` checks session status but not completed/evaluating participant state or remaining participant time. The local probe successfully requested Help after completion (200), changing the count after evaluation was saved. The read-then-write `helpCount + 1` operation has no participant lock or atomic reservation, allowing concurrent calls to undercount and exceed the intended bound.

**Fix:** guard lifecycle/time before and after provider work, serialize or atomically reserve Help requests, and use a request ID/atomic increment. Snapshot evaluation inputs and prevent later Help from changing completed evidence.

### A12 · P1 · Crash recovery and multiple-instance correctness are missing — code risk

`speakingRoutes.ts:374` locks participants in a process-local Map. `:428` refuses an already-evaluating participant indefinitely; no lease/recovery deadline exists if a process stops after setting that state. Teacher session transitions read state then update without a status comparison in the mutation. Prisma provides a unique student request ID, but AI replies have no explicit turn-operation relation; the repository pairs replies by position (`speakingRepository.ts:55`). These are insufficient guarantees across simultaneous processes/retries.

**Fix:** durable operation records and expiring claims, database compare-and-set transitions, explicit student/reply pairing, recoverable evaluation jobs, and two-instance fault tests before horizontal scaling. Do not hold a database transaction open while waiting on an AI request. Sticky routing is not crash recovery.

### A13 · P1 · Audio playback bypasses recording state; device readiness is weak — confirmed wiring, device risk

Replay controls always receive `onReplay`; the callback at `SpeakingPracticeApp.tsx:626` does not gate recording/processing/paused states or update voice state. AI audio can play while the mic is recording. TTS waits for end/error without a watchdog, and missing synthesis support silently succeeds (`speakingProviders.ts`). Device setup requests `{audio:true}`, immediately stops it, and does not establish usable signal or audible output. This is particularly important with 40 speakers in one room.

**Fix:** one audio controller, no simultaneous TTS/capture, explicit Stop playback, playback fallback/watchdog, microphone level and short playback check, and headset guidance. Request supported echo cancellation/noise suppression as preferences and inspect applied settings; do not promise they eliminate neighboring voices. [MDN constraint guidance](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation).

### A14 · P1 · Join/return flows can duplicate or strand students — confirmed

The join form does not discover identifier mode before submission; a one-character student number is rejected by the server's `identifier.length < 2` check. Rejoining always creates a new participant. Credentials are stored per tab, and a saved current-session pointer is not used for a resume action. A closed tab cannot simply reconstruct its token from the code. A lost successful join response has no idempotent retry contract.

**Fix:** minimal session-preview response for required identifier mode, correct validation, retry-safe join, same-tab Resume, and a teacher-mediated recovery policy. Never restore someone else's private result solely by guessing their student number. Do not solve tab recovery by persisting student credentials indefinitely on shared devices.

### A15 · P1 · Accessibility and authoring defects — confirmed code and AX evidence

Expression inputs lack proper accessible labels (`SpeakingTeacherWorkspace.tsx:725`); their React keys include the editable expression text, so editing changes their identity and can lose focus. HelpDialog declares a modal but has no focus management, focus containment, Escape handler, or trigger focus restoration (`SpeakingPracticeApp.tsx:642`). The global Space handler remains active while help is open and only excludes a subset of editable/focusable targets. Results use buttons/spans rather than table semantics. Recording's visible caption remains “Tap to Speak” while its accessible name changes to Stop.

**Fix:** stable row IDs, unique field labels, contextual checkbox names, correct modal keyboard behavior, explicit state announcements and visible state labels, and semantic results. Confirm focus, contrast, 200% zoom/reflow, and screen-reader behavior on actual devices. Existing focus styles and reduced-motion rules are good foundations.

### A16 · P2 · Feedback presentation and data lifecycle need clarification

The result prioritizes a large numeric score; students get fewer evidence details than teachers and no read-aloud of the suggested phrase. The Japanese headline wraps awkwardly at the captured desktop width. Time sent as “speaking time” includes active elapsed time, including provider waits (`speakingPrompts.ts:118`), not just recorded audio. Provider latency should not become a hidden learner performance measure.

Privacy copy says the recording is not saved “by default” and the teacher sees a result, but it does not clearly describe transcript storage, provider processing, or teacher transcript access. No speaking-specific retention/deletion workflow was found in the inspected feature. These are product/documentation gaps, not a legal compliance conclusion.

**Fix:** lead with one useful achievement and one next phrase, keep the score explained/secondary, distinguish audio duration from elapsed activity time, and provide concise accurate data notices plus a deliberate retention/recovery policy. Never grade pronunciation from text. Existing no-speech/insufficient-evidence handling should be preserved.

## Forty-student capacity model

The following are planning assumptions and proposed acceptance budgets, not measured real-provider performance.

| Workload | Derived demand |
| --- | --- |
| 40 learners, one answer each every 20 seconds | 120 transcriptions/min + 120 replies/min |
| Everyone requests one hint in a five-minute run | 8 Help requests/min on average; up to 40 in a burst |
| Everyone finishes together | 40 evaluations in a burst |
| Current double polling | 32 GET/s before teacher traffic |
| One poll/student every 2.5 s | 16 GET/s; still needs efficient queries and jitter |
| 40 × 4 MiB permitted upload bodies | 160 MiB raw buffers before overhead |
| Illustrative 15 s audio at 32 kb/s | About 60 kB/answer, 2.4 MB/class burst; actual browser codecs must be measured |

Budget each actual model/project separately, including token/audio limits, retry traffic, Help, final evaluation, and any other users. Reserve approximately 50% planning headroom, then tune from measurements. Rotating keys within one project does not create new project quota. Forty devices joining is a different test from forty simultaneous voice turns; both must pass.

Proposed release gates: 40/40 valid same-IP joins in a five-second burst; no duplicate participants from retries; 40 active learners sustain at least a seven-minute run; p95 end-of-recording-to-reply-text ≤8 s and p99 ≤20 s on the agreed school network; every evaluation completes or reaches an actionable retry state within 60 s; no lost/duplicated accepted turns; zero cross-student disclosures; no unrecoverable microphone/result states. These targets must be recorded and measured, not reported as achieved by the mock probe.

Provide 40 headsets with microphones or validate the actual intended device arrangement in the classroom. A quiet one-device recording test cannot validate recognition with 39 neighboring speakers. Keep simultaneous practice as the design requirement; splitting the class into batches does not satisfy it.

## Handoff

Implement the [Luna plan](speaking-practice-luna-plan.md) in order. Fix admission, responsive microphone access, deadlines/completion, and recovery first. Preserve the working authorization, activity snapshots, bounded prompts, binary upload contract, recording cleanup, and insufficient-evidence scoring. Ship the class-readiness claim only after the real deployment/device gate passes.
