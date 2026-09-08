# Speaking classroom redesign — 8 September 2026

## Audit and proposal (written before application changes)

Speaking is a teacher-led performance assessment: prepare a textbook task, launch a session, let students speak independently, then review the class against the saved rubric. Keep Speaking Practice as the feature/navigation name and use Performance Test for the classroom task. Keep every canonical route and compatibility alias.

Inspected SpeakingPracticeApp, SpeakingResultPanel, SpeakingTeacherWorkspace, speakingData, both Speaking stylesheets, shared speaking types/schema, API client, roster/start routes, teacher navigation/shell, global tokens, existing browser tests, operations guide, September 5 audit and September 6 review. The current four browser tests pass after regenerating the stale local Prisma client from the existing schema. No migration was needed.

### Current screen findings

1. Entry: two equal cards and a confidence headline prioritize general learning over the teacher's next action. Replace the demo with a compact classroom workflow and a code entry.
2. Join: duplicated introductory content uses vertical space on phones. Direct links already fill the code; retain that behavior and give operational Japanese help. The public API does not reveal a teacher name or task before joining; do not invent one or weaken privacy to retrieve it.
3. Preparation: goal and target expressions are below the microphone action. Move them into a clear task briefing beside device setup. Retain signal detection, denial retry, and the honest unverified-input alternative.
4. Conversation: microphone, Help and Finish are reachable in the tested viewports, but old absolute mic rules still create an uneven mobile control row. Large transcript avatars and bubbles waste reading space. Keep internal scrolling and normal-flow notices.
5. Dashboard: statistics do not lead to work. Promote open sessions and completed-session links; keep reusable tasks searchable with level, duration, criterion count and last session.
6. Builder: a long support form pushes rubric editing far down. Separate task, student support, performance settings and rubric; add a live review summary. Use native disclosures for optional reference fields, not a sequential wizard.
7. Launch/monitor: QR/code and private roster share one view. Provide a native modal projection view with no names, scores or transcripts. Give the private roster full width, compact rows, named status icons, count filters and a visible stale-data warning.
8. Class results: overall score and Help are present; elapsed duration and criterion summaries are available but unused. Add real summary counts, sorting and criterion columns in a semantic table.
9. Individual/student feedback: star ratings resemble rewards; students cannot see criterion evidence. Use numeric four-point meters, descriptions and evidence for both audiences, with optional transcript disclosure.

Before evidence: `docs/audits/speaking-2026-09-08/before/` and `before-classroom/`. Screenshots of the original home, join, preparation, speaking desktop/mobile, builder, launch and individual result were opened and inspected before redesign. These are synthetic local mock runs, not school-device or provider-capacity evidence.

### Comparable products and extracted principles

- [Extempore Live](https://extemporeapp.com/extempore-live): classroom monitoring and intervention are primary teacher tasks. [July/August 2026 updates](https://help.extemporeapp.com/en/articles/5702100-extempore-platform-updates-new-features-and-recent-changes) describe attendance before launch, waiting/recording/recorded states and improved mobile rubric views. Apply distinct readiness/live states and compact triage.
- [Extempore grading](https://help.extemporeapp.com/en/articles/6383810-how-to-grade-student-work-and-give-feedback-in-extempore): submissions open from a gradebook; rubric descriptors stay close to scoring. Apply class-to-criterion-to-evidence hierarchy. Do not imply our AI scores have been teacher approved or add unsupported manual grading.
- [Pear Deck presenting guide](https://help.peardeck.com/migration/en/how-to-present-a-pear-deck): distinct projector, private teacher and student views; join instructions can be recalled during the session. Apply a deliberately separate projection surface with prominent QR/code/link and aggregate counts. Keep our actual six-character code and expiry semantics.
- [ELSA for Schools](https://elsaspeak.com/en/enterprise/schools) and [school FAQ](https://elsaspeak.com/en/enterprise/faq): curriculum-derived materials, independent student work, class completion and individual progress. Apply task-based copy and teacher-first navigation. Its pronunciation scoring is not a capability of our transcript-based rubric.

Research uses public vendor documentation and illustrated product pages, not authenticated hands-on audits of these paid products. The choices above are design inferences, not copied layouts.

### Intended implementation

- Teacher: dashboard → reusable task/editor → review and launch → projection for joining / private roster for monitoring → class results → rubric and evidence.
- Student: link/code → identify → task briefing + device check → conversation → completion and rubric feedback. Operational instructions may be Japanese; target English remains English.
- Visual language: existing GyakutenEigo navy, restrained blue, teacher green actions, pale neutral page surfaces, 14px panels, 10px controls, 44px touch targets. Use shared tokens and Lucide icons. Reduce shadows, decorative panels and large headers.
- Reuse API/polling/recovery hooks, teacher auth/shell, QR renderer, native buttons/forms/disclosures and shared scoring. Refactor presentation only where possible.
- CSS ownership: `speaking.css` owns component appearance; `speaking-layout.css` owns composition, density and viewport behavior. Remove unreachable legacy preview JSX and its exclusive CSS; consolidate repeated selectors safely rather than adding another override file.
- Preserve binary capture, TTS gating, Help cancellation/focus behavior, revisions, secure join recovery, rubric persistence, evaluation jobs/retries and backend contracts.

### Data limits

The roster has joined records, readiness, lifecycle status and latest activity, but no expected class register, named device failures, recording telemetry or reliable online presence. Show joined totals, not “40/40 present” or “connected.” Needs attention is the existing error state, not a microphone diagnosis. Existing activity title/scenario can carry textbook/unit text; there is no separate textbook field. Duration in results is elapsed activity time, not recorded speech. No backend expansion is required for this redesign.

## Verification and handoff

### Delivered behavior

- Entry explains the prepare → run → review workflow, prioritizes teacher creation, and gives students direct code entry.
- Dashboard exposes open classroom sessions, searchable reusable tasks, task metadata and completed-session review. A selected session remains selected when opened from the dashboard; launching another run clears the historical selection.
- Builder groups task, student support, settings, editable rubric and review. Optional references are disclosed progressively. Names, descriptions, enabled criteria and the existing four-point scale remain persisted through the existing API.
- Projection uses a native modal dialog with a large QR/code, public joining instructions and aggregate counts. Escape closes it and returns focus. Teacher identity, student names and results stay outside the projected surface.
- Private monitoring uses a full-width scrollable roster, status counts that also filter, identifier search, error-first ordering, and an explicit warning when polling retains an old snapshot. Start/pause/resume/end state updates immediately. Joining instructions collapse once running.
- Students see the real task, roles, goal, target English and optional evaluation criteria before starting. Device checks retain denial recovery and signal monitoring. The active screen retains first-viewport microphone/Help/Finish controls and an independently scrolling transcript.
- Class results show completion/review counts, criterion columns, elapsed activity duration, Help usage and sortable/filterable student rows. Individual feedback shows criterion descriptions, numerical meters, evidence and an expandable transcript for both audiences.

### Files changed

| File | Responsibility |
| --- | --- |
| `apps/web/src/features/speaking/SpeakingPracticeApp.tsx` | Entry, focused student header, task briefing, session status copy, feedback and removal of unreachable demo presentation |
| `apps/web/src/features/speaking/SpeakingResultPanel.tsx` | Four-point rubric meters, criterion descriptions/evidence, optional transcript |
| `apps/web/src/features/speaking/teacher/SpeakingTeacherWorkspace.tsx` | Dashboard, builder, projection, monitor and class results |
| `apps/web/src/features/speaking/speaking.css` | Component appearance, removed retired preview rules and shadowed declarations |
| `apps/web/src/features/speaking/speaking-layout.css` | Responsive composition and classroom density |
| `apps/web/e2e/speaking.spec.ts` | Updated structural expectations; preserved recovery/control assertions; more responsive evidence |
| `apps/web/e2e/speaking-classroom.spec.ts` | Forty-student workflow, projection privacy/focus, results, stale polling, rubric persistence and session snapshot checks |
| This report | Audit, research, proposal, implementation and handoff |

No schema, backend scoring, provider integration or public API contract changed. Shared auth/navigation, capture, TTS, Help cancellation, evaluation polling/retry and secure join logic remain in use. The Speaking CSS production asset decreased from 99.79 kB to approximately 89.6 kB uncompressed by removing obsolete rules rather than introducing another stylesheet.

### Visual evidence

[Open the before/after gallery](audits/speaking-2026-09-08/index.html). Images are local QA artifacts under the repository's ignored `docs/audits/` directory; retain that directory when sharing this workspace. The report and browser tests are versioned source changes; the gallery is not automatically included in a commit.

The gallery covers home, join, task/device preparation, active conversation, dashboard, builder, launch/code, forty-student roster, class results, individual rubric, student feedback and representative mobile/tablet screens. Additional images cover projection, microphone denial, Help, unscored results, mixed-status fixtures, stale roster updates and 125% scaling. Screenshots were opened and inspected, not only generated.

Visual QA corrected an oversized mobile session selector, crowded mobile/tablet timestamps, retained navigation scroll and an empty-session guard regression. Assertions now cover selector height and timestamp separation as well as document overflow. Native dialogue privacy, Escape and focus restoration are exercised in the browser.

### Tests and outcomes

- Baseline: existing four Speaking E2E scenarios passed before redesign; forty-student before screenshots also captured before application changes.
- `npm run prisma:generate`: regenerated the stale local client from the existing schema to restore baseline buildability; no migration or database write.
- `npm test`: full shared, server, web and proxy suite passed. This includes 254 web tests and seven proxy tests.
- `npm run typecheck`: shared, server, web (including E2E TypeScript) and proxy checks passed.
- `npm run build`: full repository build passed. Subsequent web production builds passed after UI changes. Existing unrelated Three.js chunk-size warning remains.
- Targeted ESLint on all changed TSX and E2E files: passed. `git diff --check`: passed.
- `SPEAKING_MOCK_MODE=true npm run test:e2e -w @quizstrike/web -- speaking.spec.ts speaking-classroom.spec.ts`: **5 passed**. Original recovery and microphone-bound assertions were preserved. The classroom scenario additionally covers forty joins, thirty readiness records, start/pause/resume/end, five submissions including an unscored attempt, results filtering/sorting, stale roster retention/recovery, editing and immutable historical task snapshots, and launching another classroom run.
- Responsive browser checks: 1366×768, 1280×640, 1024×768, 768×1024 and 390×844; learner microphone/Help/Finish remain inside the active viewport. Teacher builder/monitor and learner briefing/results receive additional narrow-screen checks. Class result tables scroll horizontally inside their container.
- Scaling: teacher and student screenshots/assertions at **125% CSS zoom**. This is a useful reflow check, not a claim that native browser zoom was exercised.

The browser suite uses production frontend bundles, a local in-memory API, synthetic identities, mock audio capture and the mock provider. Forty join/ready records and five submissions are actual local API operations. The explicitly named mixed-status image is a route fixture for transient UI states; it does not demonstrate forty simultaneous audio streams. Error tests cover microphone denial, Help/turn/finish recovery and interrupted roster updates. The in-app browser could not attach; visual evidence comes from the repository's Chrome/Playwright workflow.

### Remaining concerns and recommended next validation

1. Run a real classroom pilot on school Wi-Fi, a Chromebook and iPad/Safari with headphones; verify microphone permission, real audio capture, playback interruption and a physical QR scan. Confirm native 125% browser zoom as well.
2. Run the existing provider/load checks with the intended production provider and PostgreSQL configuration before claiming forty concurrent speaking sessions. This UI test is not a concurrency capacity test.
3. Review Japanese operational copy and criterion descriptors with teachers. Mock feedback intentionally remains synthetic; actual pedagogical quality depends on the provider and task rubric.
4. If teachers need an expected class register, reliable device-health diagnostics or attendance reconciliation, add explicit backend data contracts. Current joined/readiness/status labels deliberately do not imply those capabilities.
5. Complete a screen-reader and real-device accessibility pass. Current checks cover keyboard activation, semantic labels/table structure, focus restoration, visible status text and viewport bounds; they are not a WCAG certification.

No deployment or production data mutation was performed.
