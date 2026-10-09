# SpeakCheck student scene completion and QA

Audited on 2026-10-07 in the current GyakutenEigo checkout. Starting commit: `feaad5679cc2bacadeec3cbb8e6fa3c49a94ab24` (`incomplete speakcheck`). The existing immersive design was completed in place.

This is the historical scene-completion report. A subsequent [avatar personality pass](../speaking-avatar-personality/README.md) updates the portrait renderer/behavior. The [2026-10-09 responsive layout and environment pass](../speaking-responsive/README.md) replaces the oversized controls and adds appropriate backgrounds for all built-in templates. Preservation statements and counts below describe the earlier scene work.

**1. What was incomplete.** Useful English could invoke Replay through `onPhraseClick`; every activity inherited the tourist plaza; overlapping drawer/controls positioning and shrink-wrapped mobile drawers could obstruct the microphone; hints lacked dismissal; focus restoration did not consistently return to the actual invoker; state descriptions were clipped; long replies could cover the partner's face. Unused phrase-button CSS and duplicate intermediate assets remained.

**2. What changed.** The active student scene retains the large local VRM, floating HTML dialogue, central microphone, secondary utilities and collapsible reference/conversation panels. Changes cover static references, scenario selection, responsive bounds, state presentation and keyboard access. Teacher authoring has one preservation-only change for the optional scene field; teacher and preparation layouts were not redesigned. Recording, STT, Gemini, assessment, evaluation, authentication, retry, reporting, timers and session lifecycle were not changed.

**3. Permanently read-only Useful English.** Removed the `onPhraseClick` API, callback wiring, conditional button rendering, action chevrons and all obsolete phrase-button hover/focus styles. Phrases always render as static list-item `div`/`span` content. Vocabulary remains plain `li` text. There is no callback path from either reference collection to Replay, insertion, navigation or selection.

**4. No phrase/vocabulary TTS.** A browser speech spy verifies clicks on `I recommend...`, `You should visit...`, `It is near...`, `park` and `station` do not add speech calls, change the avatar's idle state, change dialogue or navigate. Enter/Space on the support tab likewise cannot speak a reference. Dedicated Replay still adds one speech call for the partner's actual message and changes the avatar to speaking.

**5. Static semantics and tab order.** Reference content has no buttons, links, button roles, tabindex, click/key handlers or pointer cursor. Twelve successive Tab presses never enter a phrase or vocabulary item. The containing tabpanel is focusable for native keyboard scrolling; its individual references are not focusable.

**6. Scenario background selection.** `resolveSpeakingSceneBackground` reads the existing `scenarioResources`. An optional `sceneBackground` root-relative, same-origin image path takes precedence. Otherwise the stable source scenario `core-helping-a-tourist` reuses `practice-plaza.webp`. Restaurant, school, automotive, unknown and teacher-created tasks without suitable artwork use neutral. Editable titles are not used for matching. Catalog illustrations were inspected: their people and functional task details would compete with the VRM, so they are not stretched into scene environments. Maps, menus, timetables, charts, photos and reference sheets remain Context resources. Shared validation/normalization, Prisma JSON reading and existing-task edit/copy preserve the optional field independently from Context.

**7. Neutral fallback.** A softly lit cream/blue CSS radial gradient requires no image request. Missing, unknown, unsafe or failed environment assets reveal that setting. Photographic environments retain a 3px blur, restrained saturation and reduced opacity. The restaurant screenshot shows the real Ordering Food task, its Café worker role and restaurant vocabulary in the neutral environment.

**8. Assets and font audit.** Removed unused `practice-plaza.png` (1,986,607 bytes), intermediate `desktop-comparison.png` (4,261,394 bytes) and `desktop-iteration-2.jpg` (112,404 bytes). The reused WebP is 150,990 bytes. Nunito Sans is retained at 31,076 bytes: its rounded English typography fits the existing scene and its cost is modest. Its accompanying copyright/OFL file is preserved; the [official Nunito Sans OFL](https://github.com/google/fonts/blob/main/ofl/nunitosans/OFL.txt) permits bundling/embedding with its license conditions. `font-display: swap` and the `Noto Sans JP`/`Segoe UI`/sans-serif fallback remain usable when the local font request fails. The Japanese 360×800 failure test checks text, font stack, overflow and primary controls. Existing VRM, its license, and actively used fallback/transcript images are retained. No new runtime raster/font asset was introduced; saved QA images are compressed final screenshots.

**9. Responsive/layout completion.** Avatar, message and controls share the stage center, which recalculates when the desktop sidebar is open. Shared CSS control-space and reply-height variables replace disconnected offsets. The desktop Conversation launcher is at the upper left; mobile launchers/drawers reserve space above speaking controls. Explicit bounded drawer heights prevent absolute grid children from expanding into controls. Context reference sheets use one outer scroller rather than a nested, clipped scroller. Long responses wrap and scroll within the dialogue card below the face. Ready/listening/thinking/playback/waiting now have visible captions, distinct icons/colors and disabled presentation; the speaking state machine remains intact.

**10. Accessibility completion.** Support tabs retain selected-state and arrow/Home/End semantics. Opening a drawer moves focus to a useful control. Escape closes the relevant drawer and restores its actual invoker, including the Context utility. Nonmodal drawers dismiss when keyboard focus moves outside; mobile drawers close one another. Hints live in the bounded dialogue region, have a Close hint button and return focus to Help. Dialogue, reference and transcript scrolling do not trigger the global microphone Space shortcut. Keyboard focus rings, darker small text, and 44px minimum Close/Finish touch targets were verified. State/dialogue live regions, accessible HTML dialogue and decorative screen-reader-hidden canvas remain.

**11. Tests added/updated.** Static-render and browser tests cover the exact read-only phrases/vocabulary, absence of interactions and independent Replay. Resolver tests cover tourist versus restaurant/school/car, explicit precedence, Context separation and unsafe/missing values; browser tests cover visible selection and failed image loading. Shared/server tests cover validation and stored scene preservation; a real create/edit/save API/browser test checks scene and Context preservation. Responsive QA covers drawers, focus/Escape, hints, long replies, font failure and primary-control hit testing. Existing VRM tests cover fallback failure modes, animation, 30 FPS, visibility suspension, one canvas and native browser TTS. The final student rerun also verifies transcript pending/new turns, keyboard scroll, Jump to latest, permitted Replay and static thumbnails. Legacy student assertions were updated to open collapsible drawers and reflect static phrases; the seven earlier teacher/preparation failures were not skipped or weakened.

**12. Root validation.**

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed, including web E2E TypeScript and proxy checks |
| `npm run test` | 724 passed, 1 skipped, 0 failed: shared 164, server 185 + 1 skip, web 368, proxy 7 |
| `npm run build` | Passed; existing Vite warning about a chunk over 500kB remains |
| Avatar files via `node node_modules/tsx/dist/cli.mjs --test` | 27 passed, 0 skipped/failed |

The unit skip is the existing opt-in real Gemini evaluation smoke test, `optional real Gemini evaluation smoke validates the production contract`; no paid/live Gemini call was made. Root unit tests include the new static-reference and background-resolver tests. Avatar test files: `AvatarRig.test.ts`, `SpeakingAvatarRenderer.test.ts`, `avatarAssets.test.ts`, `avatarBehavior.test.ts` in the speaking avatar directory.

**13. Playwright results and baseline proof.** The complete command `npm run test:e2e -w @quizstrike/web -- e2e/speaking --workers=2` ran 23 tests: **16 passed, 7 failed, 0 skipped**. All 11 student-layout tests and the scene-preserving edit test passed. The real VRM/native SpeechSynthesis tests ran successfully on installed Windows Chrome.

After strengthening transcript assertions, the final focused command ran all student-layout tests plus the new edit test: `npm run test:e2e -w @quizstrike/web -- e2e/speaking-student-layout.spec.ts e2e/speaking-builder-persistence.spec.ts --grep 'Useful English|visible scene|scene drawers|Japanese text|workplace reference|local avatar|bundled VRM|student Speaking layout|editing an existing' --workers=2`. Result: **12 passed, 0 failed, 0 skipped** (1.5 minutes).

The seven complete-suite failures were separately reproduced using the original starting-commit frontend **and original test files**, exported with `git archive feaad5679cc2bacadeec3cbb8e6fa3c49a94ab24`, built with the installed dependencies and served on port 4174. An isolated test API ran on port 4001 using the same existing mock configuration; the only server product change in this task preserves an optional JSON field. All seven original tests failed on the same missing legacy controls before entering the changed student experience. The comparison did not substitute final test files into the baseline frontend.

| Original test | Failure reproduced on starting commit and final code |
| --- | --- |
| `speaking-builder-persistence.spec.ts` — builder spaces persist through create, reopen, edit and save | Missing textbox `Activity name`; current authoring uses `Task name` |
| `speaking-classroom.spec.ts` — classroom overview supports forty students and session controls | Missing heading `Speaking Practice`; current dashboard uses `Speaking Tasks` |
| `speaking-set-history.spec.ts` — Set launch persists history and deleted Sets remain filterable in Reports | Missing label `Filter speaking reports by My Set` |
| `speaking.spec.ts` — logged-out teacher returns to the Speaking builder after existing auth | Missing heading `Create a Performance Test`; current authoring uses `Create a Speaking Task` |
| `speaking.spec.ts` — teacher and student Speaking Practice screens use the connected mock API | Same missing legacy authoring heading, before the student flow |
| `speaking.spec.ts` — Speaking Practice recovers each failed operation without cross-retrying | Missing preparation button `Join session` |
| `speaking.spec.ts` — speaking entry and join fit laptop viewports without page scaling | Missing entry button `Create a Performance Test` |

Local ignored evidence logs remain at repository root: `.codex-local-logs-typecheck-final.log`, `.codex-local-logs-test.log`, `.codex-local-logs-build.log`, `.codex-local-logs-avatar.log`, `.codex-local-logs-e2e-final.log`, `.codex-local-logs-e2e-student-final.log`, `.codex-local-logs-e2e-baseline.log`. Baseline failure screenshots/error contexts/traces remain under `tmp/baseline-results`. These outcomes are reported as failures, not an all-green Playwright suite.

The ignored baseline checkout, archive, dependency junctions and temporary diagnostic/config files remain under `tmp`: automatic approval review rejected cleanup with `blocked by policy`, including the safer non-recursive, literal-path attempt. No recursive removal was attempted with unresolved junctions. They are excluded from the source diff and retained alongside reproducible baseline evidence. The baseline command was `node node_modules/@playwright/test/cli.js test --config=tmp/baseline-playwright.config.ts --grep 'builder spaces|classroom overview|Set launch|logged-out teacher|teacher and student|recovers each|speaking entry'`.

**14. Remaining limitations.** Scenarios without suitable existing environment artwork deliberately use the neutral setting; this task does not invent restaurant/car/school artwork or add a teacher environment-picker interface. The optional scene field supports existing API/resource authoring and survives the teacher editor. Seven legacy teacher/preparation tests still need a separate audit against their current flows. Visual/browser QA used Windows Chrome and the eight dimensions below, rather than every browser/device. Japanese fallback ultimately depends on fonts installed/available in the user's browser. Long response/hint content remains scrollable on small screens. The real Gemini smoke remains opt-in. The bundled model and renderer were preserved byte-for-byte/in source; no avatar cloud service or external TTS was added.

Final screenshots were inspected with the real bundled VRM ready:

| Viewport/state | Final screenshot |
| --- | --- |
| 1920×1080 | [closed-1920x1080.jpg](closed-1920x1080.jpg) |
| 1366×768 | [desktop-closed.jpg](desktop-closed.jpg) |
| 1280×720 | [closed-1280x720.jpg](closed-1280x720.jpg) |
| 1024×768 | [closed-1024x768.jpg](closed-1024x768.jpg) |
| 768×1024 | [closed-768x1024.jpg](closed-768x1024.jpg) |
| 390×844 | [mobile-closed.jpg](mobile-closed.jpg) |
| 360×800 | [closed-360x800.jpg](closed-360x800.jpg) |
| 1366×600 | [closed-1366x600.jpg](closed-1366x600.jpg) |
| Desktop support open | [desktop-support.jpg](desktop-support.jpg) |
| Mobile support open | [mobile-support.jpg](mobile-support.jpg) |
| Restaurant / neutral environment | [neutral-restaurant.jpg](neutral-restaurant.jpg) |

Checks include no horizontal overflow, reachable/uncovered microphone and Finish, visible whole head/hair in the closed scene, readable ordinary replies, bounded long replies, appropriate sidebar recentering, reference scrolling, support/Context/Conversation/Help access and closing/focus behavior. Additional final font-failure, long-dialogue and runtime-animation screenshots stay in ignored Playwright output rather than being committed as redundant assets.

**15. Exact changed-file manifest.** Paths are relative to this repository. No avatar implementation/model/license file changed.

Modified source and tests:

- `apps/server/src/speakingRepository.ts`
- `apps/server/src/speakingRepository.test.ts`
- `apps/web/src/features/speaking/SpeakingPracticeApp.tsx`
- `apps/web/src/features/speaking/SpeakingSupportPanel.tsx`
- `apps/web/src/features/speaking/SpeakingSupportPanel.test.ts`
- `apps/web/src/features/speaking/speaking-scene.css`
- `apps/web/src/features/speaking/speaking.css`
- `apps/web/src/features/speaking/speaking-layout.css`
- `apps/web/src/features/speaking/teacher/SpeakingTeacherWorkspace.tsx`
- `apps/web/src/ui/locales/ja.json`
- `apps/web/e2e/speaking-student-layout.spec.ts`
- `apps/web/e2e/speaking-builder-persistence.spec.ts`
- `apps/web/e2e/speaking.spec.ts`
- `packages/shared/src/speaking.ts`
- `packages/shared/src/speaking.test.ts`

New source/tests/report:

- `apps/web/src/features/speaking/speakingSceneBackground.ts`
- `apps/web/src/features/speaking/speakingSceneBackground.test.ts`
- `design-qa-assets/speaking-scene/README.md`

Refreshed final screenshots:

- `design-qa-assets/speaking-scene/desktop-closed.jpg`
- `design-qa-assets/speaking-scene/mobile-closed.jpg`
- `design-qa-assets/speaking-scene/mobile-support.jpg`

New final screenshots:

- `design-qa-assets/speaking-scene/closed-1920x1080.jpg`
- `design-qa-assets/speaking-scene/closed-1280x720.jpg`
- `design-qa-assets/speaking-scene/closed-1024x768.jpg`
- `design-qa-assets/speaking-scene/closed-768x1024.jpg`
- `design-qa-assets/speaking-scene/closed-360x800.jpg`
- `design-qa-assets/speaking-scene/closed-1366x600.jpg`
- `design-qa-assets/speaking-scene/desktop-support.jpg`
- `design-qa-assets/speaking-scene/neutral-restaurant.jpg`

Deleted redundant assets:

- `apps/web/public/assets/speaking/practice-plaza.png`
- `design-qa-assets/speaking-scene/desktop-comparison.png`
- `design-qa-assets/speaking-scene/desktop-iteration-2.jpg`
