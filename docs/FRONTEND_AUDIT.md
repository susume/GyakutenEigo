# Comprehensive Frontend Audit — GyakutenEigo / Quiz-Strike

**Audit date:** 2026-07-11  
**Audit mode:** Combined UX, visual, accessibility, performance, and frontend-code audit  
**Source revision:** `4a835ed` (`Update architecture and handoff docs`)  
**Overall frontend score:** **5.6 / 10**  
**Public-release readiness:** **Not ready for public classroom use**  
**Finding count:** **1 Critical, 5 High, 12 Medium, 5 Low, 3 Enhancements**

This was an audit-only pass. No application source code, game rules, API contracts, database structures, or business logic were changed. The only repository additions are this report and accepted screenshots under `docs/frontend-audit/screenshots/`.

---

## 1. Executive Summary

GyakutenEigo has a coherent and promising vertical slice. The public landing pages are clean, the teacher can create a quiz and session without developer help, the Three.js arena is visibly original and school-safe, touch controls work, and the report screen communicates academic outcomes well. The application is beyond a throwaway demo, but it is still a prototype rather than a production classroom product.

The largest release blockers are reliability and state integrity. The server stores all user and classroom data in memory, so a restart erases accounts, quizzes, sessions, and reports. Browser Back can change the URL without changing the visible screen. Refreshing a student game discards the learner's session and returns to a blank Join form. Flag Mode scoreboards are mislabeled as Humans and Zombies. These are confirmed defects, not style preferences.

Accessibility is mixed. Native buttons, labels, headings, a semantic results table, and live regions provide a useful base. However, the end-session dialog does not receive or trap focus, does not close with Escape, and leaves the page scrollable. Custom scoreboards expose rows without header/cell semantics. There is no reduced-motion support, skip link, or explicit focus-visible system.

Visual quality is strongest on the Quiz-Strike landing page, the 3D map preview, and the reports dashboard. It is weakest on small-screen navigation, dense teacher configuration screens, and post-session status. The visual language is consistent but shallow: 175 raw color literals and 445 pixel values are spread through a 2,075-line stylesheet rather than a small token layer.

The most valuable first implementation stage is to preserve user/session state, fix URL navigation, correct game-mode labels, repair dialog accessibility, and make ended/offline states truthful before polishing the visual system.

### Strongest areas

1. The original Desert Citadel map, minimap, school-safe terminology, and readable touch controls create a credible game identity.
2. Quiz creation, pasted study-item generation, session setup, student joining, quiz rewards, and reporting complete a real end-to-end loop.
3. The reports screen has clear summary metrics, a semantic data table, CSV export, and a useful reteach empty state.

### Largest risks

- Total data loss on server restart.
- Student and route state not recoverable after normal browser actions.
- Incorrect mode labels undermine teacher trust during live play.
- Modal and custom-table accessibility barriers.
- No automated browser coverage for the classroom-critical flow.

---

## 2. Repository and Application Map

### Repository structure

| Area | Purpose | Main technology |
| --- | --- | --- |
| `apps/web` | Public site, teacher workspace, student flow, game HUD and renderer | React 19, TypeScript, Vite 7, plain CSS, Three.js, Socket.IO client, Lucide |
| `apps/server` | Auth, quiz/session APIs, authoritative game state, reports | Express 5, Socket.IO, JWT, bcrypt, in-memory Maps |
| `packages/shared` | Contracts, validation, economy, movement, mode and reporting rules | TypeScript |
| `prisma` | Future persistence schema; not used at runtime | Prisma/PostgreSQL schema |
| `.github/workflows/deploy-web.yml` | Static GitHub Pages build/deploy | GitHub Actions |

### Rendering, state, styling, and assets

- Rendering: client-rendered React single-page application; routes are manual `window.location.pathname` checks rather than a routing library.
- Game rendering: Three.js/WebGL with generated textures, simple geometry, sprites, a minimap SVG, pointer lock, mouse/keyboard, and touch controls.
- State: component-local React state; 37 `useState` and 15 `useEffect` calls in `App.tsx`. `zustand` is installed but unused.
- Styling: one 2,075-line plain CSS file with four responsive breakpoints (`980`, `780`, `680`, `520` px).
- Assets: public PNG/SVG assets plus procedural Canvas/Three.js textures. Only `player-blue.png` and `snowball-puff.svg` are referenced from current client source.
- Tests: Node/tsx unit tests in shared and web code. No lint command, component tests, browser E2E tests, accessibility tests, or visual regression tests.
- Build: npm workspaces; shared, server, then web TypeScript/Vite build.
- Deployment: GitHub Pages for the web app and a separate Render API. Production data remains process-memory-only.

### Routes and major states

| Route | Surface | Major states/components |
| --- | --- | --- |
| `/` | GyakutenEigo home | Product hero, Quiz-Strike card, teacher/student entry |
| `/quiz-strike` | Game landing or teacher workspace | Landing, signup/login, dashboard home, quiz editor, session setup, live monitor, end confirmation, reports |
| `/join` | Student entry | Instructions, session code, nickname, validation/error |
| `/game` | Student entry/game alias | Same `StudentExperience`; no separate persisted game route state |
| `/character-lab` | Development character stress surface | 10/20/40/60-player presets, generated map preview, debug metrics |

### Intended users and use cases

- Teachers create accounts, prepare quiz sets, host private sessions, monitor play, end sessions, and review/export results.
- Students join with a code and nickname, select a team, answer quiz questions, earn money, buy gear, and play a team arena game.
- Developers use Character Lab to assess character density and LOD.
- Product uncertainty: the repository does not define whether Character Lab is intentionally public, whether controller support is a launch requirement, or which WCAG conformance level is targeted. This audit uses WCAG 2.2 AA as the practical accessibility target.

---

## 3. Baseline Validation

| Check | Command or Method | Result | Notes |
| --- | --- | --- | --- |
| Dependency installation | `npm install` | Pass | Up to date; 264 packages; 0 reported vulnerabilities. |
| Build | `npm run build` | Pass with warning | Vite warns that `ArenaPreview` is 537.07 kB minified. |
| Lint | `npm run lint` | **Unavailable** | Root package has no `lint` script. |
| Type checking | `npm run typecheck` | Pass | Shared, server, and web all pass. |
| Automated tests | `npm test` | Pass, incomplete | 45 shared tests pass. Root script does not run the web tests. |
| Web tests | `npx tsx --test "apps/web/src/**/*.test.ts"` | Pass | 18 additional web/game tests pass when run manually. |
| Runtime startup | `npm run dev` | Pass | Vite on `5173`; server on `4000`; shared package watch passes. |
| Console inspection | In-app Chromium browser, teacher/student/error flows | Pass | 0 captured console errors or warnings. |
| Network inspection | Live REST + Socket.IO teacher/student flow | Pass with limits | Signup, login, dashboard, quiz, session, join, answer, sockets, end, and report worked. Dedicated request waterfall was not exposed by the browser environment. |
| Route failures | Direct navigation and browser history | **Fail** | Direct routes load, but browser Back changes URL without changing the rendered screen. |
| Missing assets | Running UI + source reference audit | Pass in tested screens | No visible 404 assets. Several unused public assets remain in the repository. |

### Build output

| Asset | Minified | Gzip |
| --- | ---: | ---: |
| Main JS | 318.54 kB | 98.12 kB |
| Arena chunk | 537.07 kB | 139.37 kB |
| CSS | 26.25 kB | 6.42 kB |
| HTML | 0.46 kB | 0.30 kB |

---

## 4. Frontend Scorecard

| Category | Score | Explanation |
| --- | ---: | --- |
| First impression | 7.0 | Clear purpose, calm visual language, original game imagery. |
| Visual hierarchy | 6.5 | Strong landing/report hierarchy; setup and mobile game states become dense. |
| Design consistency | 6.0 | Consistent radii/colors/components, but no token layer and some state-label inconsistencies. |
| Responsive design | 5.0 | Major screens reflow, but small-screen nav is a clipped scroller and teacher/game density remains high. |
| Navigation | 4.0 | Primary destinations are visible, but browser Back leaves URL and screen out of sync. |
| User-flow clarity | 5.5 | Core loop completes; login/signup, ended-session, refresh, and recovery states are confusing. |
| Game UI and HUD | 6.0 | Good minimap/touch controls and readable quiz overlay; mode labels and mobile information order need work. |
| Forms and inputs | 5.5 | Labels and basic validation exist; autocomplete, recovery, password affordances, units, and grouping are weak. |
| Feedback and states | 5.0 | Rewards and live feed are good; errors disappear, ended controls remain misleading, and offline recovery is thin. |
| Accessibility | 4.0 | Native semantics help, but modal focus, custom tables, motion, skip navigation, and canvas alternatives remain incomplete. |
| Performance | 6.0 | Lazy arena loading and resource cleanup are positive; the game chunk is large and no quality selector or field metrics exist. |
| Mobile usability | 5.0 | Touch play works; nav, viewport economy, and information prioritization need a focused pass. |
| Frontend maintainability | 4.0 | `App.tsx` and `styles.css` are oversized; test scripts and tokens are incomplete. |
| Error handling | 4.0 | Basic messages exist, but recovery instructions, persistence, retries, and truthful terminal states do not. |
| **Overall frontend quality** | **5.6** | A convincing prototype with several production-blocking reliability defects. |

---

## 5. Top Ten Frontend Problems

1. **All classroom data is erased on a server restart.** This outranks every visual issue because it causes irreversible user-visible data loss.
2. **Browser Back changes the URL but not the screen.** Users cannot trust navigation or browser history.
3. **Refreshing a student game loses the entire session context.** A routine browser action removes the learner from the playable flow.
4. **Flag Mode scoreboards show Humans/Zombies.** The live monitor communicates the wrong game mode and team identity.
5. **The end-session dialog does not manage keyboard focus.** Keyboard and screen-reader users can remain on obscured background controls.
6. **Phone navigation hides actions in a horizontal scroller.** A primary teacher action is partially or fully off-screen at 360–430 px.
7. **Ended-session controls and metrics are not truthful.** “Waiting for Students,” an enabled Add Bot button, reset timer, and active count remain after ending.
8. **Errors disappear and do not explain recovery.** A learner can miss the message and has no suggested next action.
9. **The critical teacher/student loop has no browser E2E coverage.** Existing unit tests cannot catch the confirmed URL, refresh, and focus defects.
10. **The arena payload and runtime have no user-selectable fallback.** A 537 kB game chunk and WebGL workload reach classroom devices without a quality mode.

---

## 6. Detailed Findings

The following entries include the requested severity, confidence, location, reproduction, impact, cause, files, correction, acceptance criteria, effort, risk, independence, and backend/game-logic implications.

### Critical

#### C-01 — Server restart erases accounts, quizzes, sessions, and reports

| Field | Detail |
| --- | --- |
| Severity / confidence | Critical / Confirmed |
| Affected application | Entire product |
| Screen / viewport | Authentication, teacher dashboard, live session, reports / all |
| Scope / effort / risk | Repository-wide / Large / High |
| Independent fix | No; requires persistence design and migration |
| Game/backend impact | Yes; backend storage and deployment behavior |

- **Reproduce:** Create an account, quiz, session, and report; restart the API process; attempt to log in or reload the dashboard.
- **Observed:** Repository documentation and `apps/server/src/index.ts` confirm production state is stored in process-memory Maps; Prisma is inactive. A restart clears user and classroom data.
- **Expected:** Durable records survive restarts, deploys, sleeps, and process replacement.
- **User impact:** Teachers lose prepared content and reports; students lose sessions; trust and classroom continuity fail.
- **Technical cause:** In-memory repositories with no active database adapter.
- **Files/components:** `apps/server/src/index.ts`; `prisma/schema.prisma`; `architecture.md`; `README.md`.
- **Screenshot:** Not visually reproducible without intentionally destroying the local test state; repository evidence is authoritative.
- **Recommended correction:** Implement durable repositories and migrations, make session recovery explicit, and retain a deliberately bounded ephemeral mode only for local development.
- **Acceptance criteria:** Restart and redeploy tests preserve account, quiz, session, answer, purchase, and report data; migration rollback and backup/restore are documented.

### High

#### H-01 — Browser Back changes the URL but leaves the previous screen visible

| Field | Detail |
| --- | --- |
| Severity / confidence | High / Confirmed |
| Affected application | Web shell |
| Screen / viewport | `/` → `/quiz-strike` → Back / desktop Chromium |
| Scope / effort / risk | Application-wide / Medium / Medium |
| Independent fix | Yes |
| Game/backend impact | No backend change; route state must preserve active flows safely |

- **Reproduce:** Open `/`, select **Open Quiz-Strike**, then use browser Back.
- **Observed:** URL returns to `/`, but the Quiz-Strike landing screen remains rendered.
- **Expected:** URL, navigation state, and visible screen stay synchronized.
- **User impact:** Navigation is misleading; bookmarking, reload, back/forward, and assistive-technology orientation become unreliable.
- **Technical cause:** Manual `pushState` calls and initial pathname-derived state without a `popstate` listener or router.
- **Files/components:** `apps/web/src/App.tsx`, `App`.
- **Screenshot:** DOM/history observation; public landing references are [home](frontend-audit/screenshots/21-home-desktop-1920x1080.png) and [Quiz-Strike](frontend-audit/screenshots/22-quiz-strike-laptop-1280x720.png).
- **Recommended correction:** Centralize route state and handle `popstate`, or introduce the smallest compatible client router without changing deployment fallbacks.
- **Acceptance criteria:** Direct load, internal navigation, Back, Forward, trailing slashes, refresh, and Pages fallback all show the screen matching the URL.

#### H-02 — Refreshing the student game discards session and player context

| Field | Detail |
| --- | --- |
| Severity / confidence | High / Confirmed |
| Affected application | Student game |
| Screen / viewport | `/join`/`/game`, active or ended session / phone and desktop |
| Scope / effort / risk | Application-wide / Medium / High |
| Independent fix | Partly; needs server-supported secure rejoin semantics |
| Game/backend impact | Yes; player token/session recovery |

- **Reproduce:** Join a session, enter the arena, then refresh the tab.
- **Observed:** The app returns to an empty Join Game form; code, nickname, player token, money, and session context are unavailable in the UI.
- **Expected:** The app securely resumes the current learner or provides a clear rejoin path that preserves valid progress.
- **User impact:** Accidental refresh, mobile tab eviction, and browser recovery interrupt classroom play.
- **Technical cause:** `StudentExperience` stores `session`, `player`, and `playerToken` only in component memory.
- **Files/components:** `apps/web/src/App.tsx`, `StudentExperience`; `apps/web/src/api/client.ts`.
- **Screenshot:** Pre-refresh gameplay is shown in [student gameplay](frontend-audit/screenshots/16-student-gameplay-mobile-390x844.png); post-refresh was confirmed by DOM inspection.
- **Recommended correction:** Add a scoped, expiring rejoin credential and recovery state; avoid exposing durable student identity beyond the session.
- **Acceptance criteria:** Refresh, crash/reopen, and short disconnect recover the same learner exactly once; expired or ended sessions explain the outcome and next action.

#### H-03 — Flag Mode scoreboards are labeled Humans and Zombies

| Field | Detail |
| --- | --- |
| Severity / confidence | High / Confirmed |
| Affected application | Teacher live monitor and student scoreboard |
| Screen / viewport | Flag Mode waiting, active, and ended states / all |
| Scope / effort / risk | Shared component / Small / Medium |
| Independent fix | Yes |
| Game/backend impact | Read-only display fix if mode is passed explicitly; avoid changing mode logic |

- **Reproduce:** Create a Flag Mode session, join a student, start the round, inspect the scoreboard.
- **Observed:** Scoreboard groups are **Humans** and **Zombies**, while the status and live feed say Flag Mode and Blue/Red.
- **Expected:** Flag Mode groups Blue Team and Red Team; only Zombie Mode uses Humans/Zombies.
- **User impact:** Teachers receive contradictory live information and may believe the wrong game mode is running.
- **Technical cause:** `Scoreboard` infers grouping from any player `role`; joined players default to `human` even outside Zombie Mode.
- **Files/components:** `apps/web/src/App.tsx`, `Scoreboard`; `packages/shared/src/index.ts`, `buildScoreboardRows`; `apps/server/src/index.ts` player creation.
- **Screenshot:** [Live round](frontend-audit/screenshots/15-teacher-live-round-desktop-1440x900.png) and [ended session](frontend-audit/screenshots/28-session-ended-desktop-1440x900.png).
- **Recommended correction:** Pass `gameMode` into `Scoreboard` and group explicitly; reserve role labels for Zombie Mode.
- **Acceptance criteria:** Unit and browser tests verify Flag=Blue/Red, Zombie=Human/Zombie, Classic=appropriate team/FFA labels in waiting, active, and ended states.

#### H-04 — End-session dialog does not receive, trap, or restore focus

| Field | Detail |
| --- | --- |
| Severity / confidence | High / Confirmed |
| Affected application | Teacher dashboard |
| Screen / viewport | End Session confirmation / desktop Chromium |
| Scope / effort / risk | Shared interaction pattern / Medium / Low |
| Independent fix | Yes |
| Game/backend impact | No, provided submission behavior is preserved |

- **Reproduce:** Open Live Session and select **End Session**; inspect keyboard focus and press Escape.
- **Observed:** Focus remains on the obscured background End Session button; background remains scrollable; no Escape handler or focus trap exists.
- **Expected:** Focus moves into the dialog, stays within it, Escape cancels, background is inert, and closing restores focus to the trigger.
- **User impact:** Keyboard and screen-reader users can interact with content behind a visually modal decision.
- **Technical cause:** Static `role="dialog"` markup without a dialog/focus-management utility.
- **Files/components:** `apps/web/src/App.tsx`, `SessionManager`; `apps/web/src/styles.css`, `.modal-backdrop`, `.confirm-modal`.
- **Screenshot:** [End-session confirmation](frontend-audit/screenshots/27-end-session-confirmation-desktop.png).
- **Recommended correction:** Implement a reusable accessible dialog primitive using `inert`/focus trapping, Escape handling, initial focus, scroll lock, and focus restoration.
- **Acceptance criteria:** Keyboard-only and screen-reader tests cannot reach background controls; Escape and both actions behave correctly; trigger focus is restored.

#### H-05 — Phone navigation hides primary actions in a horizontal scroller

| Field | Detail |
| --- | --- |
| Severity / confidence | High / Confirmed |
| Affected application | Public shell and student game |
| Screen / viewport | All routes / 360×800, 390×844, 430×932 |
| Scope / effort / risk | Application-wide / Medium / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Open `/quiz-strike` or `/join` at 360–430 px.
- **Observed:** The action row is 452 px wide inside a 317 px viewport at 360 px; Teacher Login is clipped and a native horizontal scrollbar is permanently visible.
- **Expected:** All primary destinations are discoverable without horizontal scrolling or clipped labels.
- **User impact:** Users can miss teacher entry, misread the shell as broken, and lose vertical space above gameplay.
- **Technical cause:** `.top-actions { flex-wrap: nowrap; overflow-x: auto; }` below 680 px.
- **Files/components:** `apps/web/src/App.tsx`, top bar; `apps/web/src/styles.css` mobile rules.
- **Screenshot:** [360 px Quiz-Strike](frontend-audit/screenshots/26-quiz-strike-small-phone-360x800.png) and [430 px Join](frontend-audit/screenshots/25-join-large-phone-430x932.png).
- **Recommended correction:** Use a compact menu or priority-based two-row navigation; keep the current brand and labels.
- **Acceptance criteria:** No horizontal page or nav scrolling at 320–520 px; every primary destination is visible or exposed by a clearly labeled menu with keyboard/touch support.

### Medium

#### M-01 — “Teacher Login” opens sign-up by default

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Teacher authentication |
| Screen / viewport | Quiz-Strike landing → teacher entry / all |
| Scope / effort / risk | Local / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Select any **Teacher Login** entry while signed out.
- **Observed:** Heading and fields show **Teacher Sign Up** with Create Account.
- **Expected:** Login entry opens login, while an explicit Create Account action opens signup.
- **User impact:** Returning teachers pause and must locate a low-emphasis mode switch.
- **Technical cause:** `TeacherAuth` initializes `isSignup` to `true` for every entry path.
- **Files/components:** `apps/web/src/App.tsx`, `TeacherAuth`.
- **Screenshot:** [Teacher signup](frontend-audit/screenshots/08-teacher-signup-desktop-1440x900.png).
- **Recommended correction:** Pass intended auth mode from the CTA and keep both modes directly discoverable.
- **Acceptance criteria:** Login CTAs open login; sign-up CTAs open signup; switching mode preserves email where safe.

#### M-02 — Ended sessions retain misleading live controls and metrics

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Teacher live monitor |
| Screen / viewport | Session Ended / desktop |
| Scope / effort / risk | Local / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No, except disabling invalid actions |

- **Reproduce:** End an active session and remain on Live Session.
- **Observed:** Primary control says Waiting for Students, timer resets to 3:00, 1/1 remains “active,” Add Bot stays enabled, and the join-code invitation remains prominent.
- **Expected:** Terminal summary, Report CTA, disabled join/bot actions, and truthful ended metrics.
- **User impact:** Teachers cannot tell which actions remain valid and may try to modify a closed session.
- **Technical cause:** Waiting-state labels and action disablement are reused for `ended`; remaining time returns configured duration outside active state.
- **Files/components:** `apps/web/src/App.tsx`, `SessionManager`, `useRoundRemaining`.
- **Screenshot:** [Ended session](frontend-audit/screenshots/28-session-ended-desktop-1440x900.png).
- **Recommended correction:** Create an explicit ended-state branch with final score, ended timestamp, report CTA, and terminal action rules.
- **Acceptance criteria:** No join/bot/start affordance appears actionable after ending; displayed time and active count are explicitly final or omitted.

#### M-03 — Mobile gameplay prioritizes the site shell over game context

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Student game |
| Screen / viewport | Active arena / 390×844 |
| Scope / effort / risk | Application-wide / Medium / Medium |
| Independent fix | Yes |
| Game/backend impact | No mechanics change; layout only |

- **Reproduce:** Join and start a round at 390×844.
- **Observed:** Brand/nav consume the top of the page; only status, timer, minimap, arena and touch controls fit initially. Money, team, gear, ammo, objectives, and menu controls sit below the fold; most objective-strip text is hidden.
- **Expected:** Gameplay mode gives the arena, objective, timer, key resources, and controls a single-screen hierarchy.
- **User impact:** New players must scroll during a real-time game and can miss objective/resource information.
- **Technical cause:** Normal site shell remains above `.game-layout`; compact CSS hides objective details and stacks HUD after the canvas.
- **Files/components:** `apps/web/src/App.tsx`, `StudentExperience`; `apps/web/src/styles.css` compact game rules.
- **Screenshot:** [Mobile gameplay](frontend-audit/screenshots/16-student-gameplay-mobile-390x844.png).
- **Recommended correction:** Add a dedicated gameplay shell with compact exit/menu access, safe-area support, and a prioritized HUD.
- **Acceptance criteria:** At 360×800 and 390×844, timer, objective, warmth, money/ammo, move/fire, and menu access are visible without page scrolling.

#### M-04 — Error messages disappear and do not provide recovery

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Forms and async actions |
| Screen / viewport | Invalid join, API errors / all |
| Scope / effort / risk | Shared component / Medium / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Submit an invalid session code and wait 4.5 seconds.
- **Observed:** “Session not found.” appears, gives no corrective instruction, then automatically clears while inputs remain unchanged.
- **Expected:** Error persists until corrected/dismissed, is associated with the relevant field, and explains the next action.
- **User impact:** Learners can miss the message and repeatedly submit without knowing whether code format, session state, or connectivity is wrong.
- **Technical cause:** `useAsyncMessage` applies a common timeout to error and success feedback; fields lack `aria-describedby`/`aria-errormessage`.
- **Files/components:** `apps/web/src/App.tsx`, `useAsyncMessage`, `StudentExperience`; `apps/web/src/api/client.ts`.
- **Screenshot:** Screenshot capture for this transient state was rejected due browser corruption; DOM observation confirmed the message and timeout.
- **Recommended correction:** Separate persistent form errors from temporary success toasts; add recovery-specific copy and focus the summary on submission failure.
- **Acceptance criteria:** Error remains until input changes or dismissal; screen readers announce it once; copy states what happened and what to do next.

#### M-05 — Authentication and join forms omit browser-assistance metadata

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Teacher auth and student join |
| Screen / viewport | Signup/login/join / all, especially mobile |
| Scope / effort / risk | Shared component / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Inspect fields and use a mobile keyboard/password manager.
- **Observed:** No `autocomplete`, `inputMode`, `enterKeyHint`, password visibility control, or field-level error association. Session code does not advertise uppercase/alphanumeric input.
- **Expected:** Appropriate browser autofill, keyboard, submission, and accessible error behavior.
- **User impact:** More typing mistakes, weaker password-manager support, and slower classroom joining.
- **Technical cause:** Minimal native input markup.
- **Files/components:** `apps/web/src/App.tsx`, `TeacherAuth`, `StudentExperience`.
- **Screenshot:** [Teacher auth](frontend-audit/screenshots/08-teacher-signup-desktop-1440x900.png) and [mobile join](frontend-audit/screenshots/07-join-mobile-390x844.png).
- **Recommended correction:** Add standards-based metadata, reveal-password control, described errors, and sensible Enter progression.
- **Acceptance criteria:** Chrome/Safari/Firefox autofill correctly; mobile keyboards match fields; errors are programmatically associated.

#### M-06 — Custom game scoreboards lack complete table semantics

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Teacher/student game scoreboards |
| Screen / viewport | Waiting, live, overlay / all |
| Scope / effort / risk | Shared component / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Inspect the accessibility tree for the game scoreboard.
- **Observed:** Container and rows use `role=table`/`role=row`, but header and data spans have no `columnheader`/`cell` roles; empty-state paragraphs sit directly in the table.
- **Expected:** A native table or complete ARIA table model with headers associated to cells.
- **User impact:** Screen-reader users cannot reliably understand which values are tags, respawns, or accuracy.
- **Technical cause:** Visual div grid only partially annotated.
- **Files/components:** `apps/web/src/App.tsx`, `Scoreboard`.
- **Screenshot:** [Ended session scoreboard area](frontend-audit/screenshots/28-session-ended-desktop-1440x900.png).
- **Recommended correction:** Prefer native `<table>` markup, using responsive wrappers rather than replacing semantics.
- **Acceptance criteria:** Screen readers announce table name, row/column counts, headers, and each value with its header.

#### M-07 — Motion and impact effects ignore reduced-motion preferences

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Student game |
| Screen / viewport | Crosshair, reward, hit flash, respawn meter / all |
| Scope / effort / risk | Application-wide / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Enable `prefers-reduced-motion: reduce` and play/answer/fire.
- **Observed:** CSS always runs reticle, reward, and incoming-hit animations; no reduced-motion media query exists. Vibration is also triggered when available.
- **Expected:** Essential state remains, while nonessential motion and vibration are reduced or disabled by preference.
- **User impact:** Motion-sensitive users can experience discomfort during repeated gameplay feedback.
- **Technical cause:** Animation rules have no preference override.
- **Files/components:** `apps/web/src/styles.css`; `apps/web/src/App.tsx`, `feedbackCue`.
- **Screenshot:** [Quiz overlay](frontend-audit/screenshots/17-student-quiz-overlay-mobile-390x844.png) provides the affected context.
- **Recommended correction:** Add reduced-motion and vibration preference handling while preserving static hit/reward indicators.
- **Acceptance criteria:** With reduced motion, no pulsing/translating effect runs; feedback remains perceivable through static text/color/icon cues.

#### M-08 — Session setup is long, weakly grouped, and lacks units/help

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Teacher dashboard |
| Screen / viewport | Create Session / desktop, tablet, mobile |
| Scope / effort / risk | Local / Medium / Medium |
| Independent fix | Yes |
| Game/backend impact | Display-only if existing validation/ranges stay unchanged |

- **Reproduce:** Open Live Session with a quiz set and review the form.
- **Observed:** Up to 10 numeric inputs form one uninterrupted list; labels such as Flag Hold Time and Round Time Limit omit “seconds”; presets do not summarize changed values.
- **Expected:** Logical groups, units, concise help, preset summaries, and progressive disclosure by game mode.
- **User impact:** Teachers can configure unintended values and must scan a long form before class.
- **Technical cause:** `sessionNumberFields` is rendered as a flat map.
- **Files/components:** `apps/web/src/App.tsx`, `SessionManager`, `sessionNumberFields`; `apps/web/src/styles.css`.
- **Screenshot:** [Session setup after end](frontend-audit/screenshots/12-session-ended-setup-desktop-1440x900.png).
- **Recommended correction:** Group timing, capacity, economy, supplies, and respawn settings; show units and preset diffs without changing values.
- **Acceptance criteria:** A teacher can state what each field controls and its unit; mode-irrelevant fields are hidden; keyboard order follows groups.

#### M-09 — Locked shop items hide the benefit the learner is saving for

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Student game |
| Screen / viewport | Buy menu / phone and desktop |
| Scope / effort / risk | Local / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No economy changes |

- **Reproduce:** Open Buy with insufficient money.
- **Observed:** Each locked item replaces its description with “Need $X,” so the learner sees cost but not speed, damage, warmth, or accuracy benefit.
- **Expected:** Name, benefit, price, owned/equipped state, and remaining amount are all visible.
- **User impact:** Quiz rewards and purchase goals feel arbitrary; new players cannot make informed choices.
- **Technical cause:** `BuyPanel` conditionally renders either `gear.description` or the lock reason.
- **Files/components:** `apps/web/src/App.tsx`, `BuyPanel`.
- **Screenshot:** [Mobile buy menu](frontend-audit/screenshots/19-student-buy-menu-mobile-390x844.png).
- **Recommended correction:** Keep the description and add a secondary affordability line; preserve server validation.
- **Acceptance criteria:** Every item communicates mechanic, cost, affordability, equipped state, and disabled reason at 360 px.

#### M-10 — Arena payload exceeds the build threshold and has no quality fallback

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Quiz-Strike landing, Character Lab, live monitor, student game |
| Screen / viewport | Any arena load / low-end and slow-network devices |
| Scope / effort / risk | Application-wide / Medium / Medium |
| Independent fix | Partly |
| Game/backend impact | No rule change; renderer loading/quality behavior |

- **Reproduce:** Run `npm run build` and load an arena route.
- **Observed:** `ArenaPreview` is 537.07 kB minified/139.37 kB gzip and triggers Vite's 500 kB warning. Renderer caps pixel ratio at 1.75 and disposes resources correctly, but has no low/medium/high/auto setting or non-WebGL fallback.
- **Expected:** Budgeted loading and an automatic/user-selectable safe mode for classroom hardware.
- **User impact:** Slower first game entry and unstable frame rate on older laptops/tablets can interrupt play.
- **Technical cause:** Three.js, map, character, and renderer logic share one lazy chunk.
- **Files/components:** `apps/web/src/game/ArenaPreview.tsx`; `apps/web/src/App.tsx` lazy import; `apps/web/vite.config.ts`.
- **Screenshot:** [Character Lab](frontend-audit/screenshots/04-character-lab-desktop-1440x900.png).
- **Recommended correction:** Measure real devices, split debug/character-lab-only code, add quality presets and a failure state, then set an evidence-based budget.
- **Acceptance criteria:** No unexplained build warning; cold-load and sustained-frame targets are documented for representative school devices; WebGL failure offers recovery.

#### M-11 — Frontend architecture and styling are concentrated in two oversized files

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Entire frontend |
| Screen / viewport | All |
| Scope / effort / risk | Application-wide / Large / Medium |
| Independent fix | Incremental only |
| Game/backend impact | No intended behavior change; high regression surface |

- **Reproduce:** Inspect source size and state ownership.
- **Observed:** `App.tsx` is 2,445 lines with 37 state hooks and 15 effects; `styles.css` is 2,075 lines with 175 hex colors and 445 px values. Routing, auth, teacher, student, overlays, and reports share one module.
- **Expected:** Route/feature boundaries and a repairable token/component layer without unnecessary abstraction.
- **User impact:** UI fixes carry broad regression risk and visual inconsistencies multiply as features grow.
- **Technical cause:** Vertical-slice growth without subsequent feature extraction.
- **Files/components:** `apps/web/src/App.tsx`; `apps/web/src/styles.css`.
- **Screenshot:** Cross-screen consistency can be compared in [dashboard](frontend-audit/screenshots/09-teacher-dashboard-desktop-1440x900.png), [quiz editor](frontend-audit/screenshots/10-quiz-editor-desktop-1440x900.png), and [reports](frontend-audit/screenshots/29-reports-desktop-1440x900.png).
- **Recommended correction:** Extract by stable product boundary, then introduce color/space/type/state tokens from current values. Do not migrate framework or create abstractions without reuse.
- **Acceptance criteria:** Route/state ownership is local; repeated components/tokens have one source; visual regression coverage protects extraction.

#### M-12 — Quality gates do not cover the real classroom flow

| Field | Detail |
| --- | --- |
| Severity / confidence | Medium / Confirmed |
| Affected application | Repository-wide |
| Screen / viewport | All critical flows |
| Scope / effort / risk | Repository-wide / Medium / Low |
| Independent fix | Yes |
| Game/backend impact | Tests only |

- **Reproduce:** Run root scripts.
- **Observed:** No lint script. `npm test` runs only 45 shared tests and omits 18 existing web tests. No browser E2E, accessibility, responsive, or visual tests exist.
- **Expected:** One command covers shared/web unit tests plus critical browser smoke tests and linting.
- **User impact:** Confirmed Back, refresh, dialog, and mode-label defects can ship despite green CI.
- **Technical cause:** Root scripts and GitHub workflow build shared/web but do not run the full test matrix.
- **Files/components:** root `package.json`; `apps/web/package.json`; `.github/workflows/deploy-web.yml`.
- **Screenshot:** Not applicable.
- **Recommended correction:** Add linting and browser smoke tests for signup/login, quiz/session, join/start, answer/buy, end/report, Back, refresh, keyboard dialog, and responsive nav.
- **Acceptance criteria:** CI fails on any confirmed High defect; root test runs all 63 current unit tests; screenshots/traces attach on E2E failure.

### Low

#### L-01 — No skip link or authored focus-visible system

| Field | Detail |
| --- | --- |
| Severity / confidence | Low / Confirmed |
| Affected application | Entire web shell |
| Screen / viewport | Keyboard navigation / all |
| Scope / effort / risk | Application-wide / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Inspect CSS and tab through public/teacher screens.
- **Observed:** Browser default focus outline appears on tested inputs, but no `:focus-visible` rules or skip link exist; repeated top and sidebar navigation must be traversed.
- **Expected:** Consistent high-contrast focus and a skip-to-main control.
- **User impact:** Keyboard navigation is slower and focus styling varies by browser.
- **Technical cause/files:** `apps/web/src/styles.css`; `apps/web/src/App.tsx` shell.
- **Screenshot:** [Teacher dashboard](frontend-audit/screenshots/09-teacher-dashboard-desktop-1440x900.png).
- **Correction / acceptance:** Add skip link and tokenized focus ring; verify every interactive control at 200% zoom and in Chromium/Firefox/Safari. Effort Small; risk Low; independent; no backend effect.

#### L-02 — Inter is declared but never loaded

| Field | Detail |
| --- | --- |
| Severity / confidence | Low / Confirmed |
| Affected application | Entire frontend |
| Screen / viewport | Typography / all |
| Scope / effort / risk | Application-wide / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Inspect `index.html` and CSS font declarations.
- **Observed:** `Inter` is first in the stack but there is no `@font-face` or font request, so system UI fonts render instead.
- **Expected:** Deliberately load a licensed optimized font or declare the actual system stack.
- **User impact:** Line breaks and perceived identity vary by OS; Japanese fallback is uncontrolled.
- **Cause/files:** `apps/web/src/styles.css`; `apps/web/index.html`.
- **Screenshot:** Text examples in [home](frontend-audit/screenshots/21-home-desktop-1920x1080.png).
- **Correction / acceptance:** Choose and document font strategy; no layout shift; Japanese and English samples pass visual review. Effort Small; risk Low; independent.

#### L-03 — Character Lab is a public production route with developer language

| Field | Detail |
| --- | --- |
| Severity / confidence | Low / Confirmed |
| Affected application | Character Lab |
| Screen / viewport | `/character-lab` / desktop |
| Scope / effort / risk | Local / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Navigate directly to `/character-lab` in the production build.
- **Observed:** Public shell exposes LOD/stress/debug metrics and 60-player controls; workflow deploys a fallback route for it.
- **Expected:** Explicit decision: authenticated/internal diagnostic, or intentionally documented public demo.
- **User impact:** Ordinary users can encounter unfinished developer terminology and may mistake it for a supported game mode.
- **Cause/files:** `apps/web/src/App.tsx`, `CharacterLab`; `.github/workflows/deploy-web.yml`.
- **Screenshot:** [Character Lab](frontend-audit/screenshots/04-character-lab-desktop-1440x900.png).
- **Correction / acceptance:** Gate or label it according to product intent; no accidental indexing/navigation. Effort Small; risk Low; independent.

#### L-04 — Base button targets are 40 px high

| Field | Detail |
| --- | --- |
| Severity / confidence | Low / Confirmed |
| Affected application | Public and teacher controls |
| Screen / viewport | Touch use / all |
| Scope / effort / risk | Shared component / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No |

- **Reproduce:** Inspect base button CSS and tap dense nav/actions.
- **Observed:** Base `min-height` is 40 px. This exceeds WCAG 2.2's 24 px minimum but is below common 44–48 px mobile guidance.
- **Expected:** Primary touch actions reach 44–48 px without making dense desktop tables oversized.
- **User impact:** Slightly higher mis-tap risk, especially in the phone nav scroller.
- **Cause/files:** `apps/web/src/styles.css`, `button`, `.top-actions`.
- **Screenshot:** [430 px Join](frontend-audit/screenshots/25-join-large-phone-430x932.png).
- **Correction / acceptance:** Increase mobile target size and spacing; verify 320 px layout. Effort Small; risk Low; independent.

#### L-05 — Unused dependency and public assets increase maintenance surface

| Field | Detail |
| --- | --- |
| Severity / confidence | Low / Confirmed |
| Affected application | Repository/build maintenance |
| Screen / viewport | Not directly visible |
| Scope / effort / risk | Repository-wide / Small / Low |
| Independent fix | Yes |
| Game/backend impact | No if references are rechecked |

- **Reproduce:** Search client imports and asset filenames.
- **Observed:** `zustand` is installed but unused. PNG/SVG pairs such as the 575 kB floor decal, energy blaster, muzzle flash, red player, and launcher are not referenced by current client source.
- **Expected:** Every dependency/asset has an active owner or is removed from shipped/public output.
- **User impact:** Little immediate network impact because unused assets are not requested, but repository size and audit ambiguity grow.
- **Cause/files:** `apps/web/package.json`; `apps/web/public/assets/`.
- **Screenshot:** Not applicable.
- **Correction / acceptance:** Confirm dynamic references, then remove only truly unused files/dependency; build and visual smoke tests pass. Effort Small; risk Low; independent.

### Enhancements

#### E-01 — Add a student-facing post-game summary and next action

- **Severity/confidence:** Enhancement / Confirmed gap. **Application/screen:** Student game, Session Ended, all devices. **Scope/effort/risk:** Local / Medium / Low. **Independent:** Yes. **Backend/game impact:** May reuse existing report/session data; no rule change.
- **Observed/impact:** The student receives “Session Ended” but no personal accuracy, quiz earnings, team result, return-to-join, or play-again action. The teacher report is much stronger than the learner ending.
- **Files/components:** `apps/web/src/App.tsx`, `StudentExperience`; screenshot context [reports](frontend-audit/screenshots/29-reports-desktop-1440x900.png).
- **Correction/acceptance:** Present team result, personal learning summary, progress safety statement, and one clear exit/rejoin action; verify privacy and do not expose other students' private data.

#### E-02 — Add controller support and graphics/accessibility preferences

- **Severity/confidence:** Enhancement / Confirmed missing capability. **Application/screen:** Student arena/settings. **Scope/effort/risk:** Application-wide / Large / Medium. **Independent:** Partly. **Backend/game impact:** Input mapping only if movement/fire messages remain unchanged.
- **Observed/impact:** Mouse, keyboard, and touch are implemented; no Gamepad API or settings surface exists. Graphics quality, vibration, audio, sensitivity, and motion cannot be adjusted.
- **Files/components:** `apps/web/src/game/ArenaPreview.tsx`; `apps/web/src/game/GameAudio.ts`; `apps/web/src/App.tsx`.
- **Correction/acceptance:** Add a remappable/preset controller layer and preference panel only after keyboard/touch reliability; show active input hints and persist non-sensitive preferences.

#### E-03 — Validate localization and long-content resilience

- **Severity/confidence:** Enhancement / Needs verification. **Application/screen:** All text-heavy screens, especially quiz/report. **Scope/effort/risk:** Application-wide / Medium / Low. **Independent:** Yes. **Backend/game impact:** No unless content limits change.
- **Observed/impact:** English text renders well, but no Japanese UI sample, long translation suite, or 200% zoom matrix exists. Usernames are capped, but long quiz prompts/answers can still stress overlays and tables.
- **Files/components:** `apps/web/src/App.tsx`; `apps/web/src/styles.css`; shared validation.
- **Correction/acceptance:** Add Japanese/English fixtures, long-content browser tests, correct `lang` switching, and line-break/font fallback rules; pass 200% zoom without loss of content/function.

---

## 7. Route-by-Route Review

| Route/screen | Purpose | What works | Main problems | Missing/next states |
| --- | --- | --- | --- | --- |
| `/` | Explain product and route users | Strong headline, clear student/open-game CTAs, original card art, responsive single-column phone layout | Very large desktop hero uses substantial empty space; teacher path depends on nav/next screen | Product proof, privacy/classroom trust details, footer/support |
| `/quiz-strike` landing | Explain game and split teacher/student entry | Excellent desktop composition and useful live arena preview | Phone shell scrolls horizontally; Teacher Login opens signup | Browser capability/WebGL support state |
| Teacher auth | Account entry | Native labels, email/password types, clear primary action | Login/signup mismatch, no autocomplete/password reveal, errors transient | Forgot/reset password, durable-account expectations |
| Dashboard home | Orient teacher | Clear counts and launch sequence | Counts do not explain ended vs active history; duplicate sign-out/header nav | First-run guidance and service persistence warning |
| Quiz editor | Create/import questions | Paste-to-quiz flow worked and generated four questions; clear selector | Large combined create/editor surface; no visible per-question edit/delete in initial viewport; long-form density | Import errors, duplicate detection, unsaved changes, destructive confirmation |
| Session setup | Configure a game | Mode-specific fields, presets, bounds, and server validation | Long flat form, missing units/help, presets hide values | Saved presets, validation summary, classroom-device readiness |
| Live session | Monitor/start/end | Join code, scoreboard, feed, map, start gate, real-time socket updates | Wrong Flag scoreboard labels; dialog focus; ended state controls; dense layout | Pause/reconnect/kick/reset; explicit server health |
| Reports | Review outcomes | Strongest admin screen: summaries, semantic table, CSV, reteach queue | No visible date/context filters; selector labeling could be stronger | Durable history after restart, print/share, comparison filters |
| `/join` | Enter private session | Plain-language intro, no student email, labels and max lengths | Keyboard-centric instruction on phone; error recovery weak; mobile nav scroller | Camera/audio/WebGL checks, rejoin, expired/full/ended distinctions |
| Student arena | Play and answer | Touch controls, minimap, HUD, quiz rewards, buy menu, live feedback | Refresh loss, mobile information order, no settings, no controller, hidden objectives | Rejoin, pause/settings, unsupported-WebGL, robust offline, postgame summary |
| `/character-lab` | Developer stress testing | Useful 10–60 player visualization and metrics | Public production exposure and developer jargon | Internal access decision and performance thresholds |

---

## 8. Game Experience Review

### Onboarding and lobby

- Join instructions explain earning, buying, movement, quiz, buy, scoreboard, and respawn, but read as a keyboard command paragraph even on touch devices.
- The waiting state clearly shows team and joined count; team choice worked.
- Teacher start is correctly blocked until a real learner joins.
- Missing: secure rejoin, device capability check, connection-quality expectation, and a short visual objective tutorial.

### Match setup

- Flag, Zombie, and Classic choices plus presets are a strong foundation.
- Settings are validated and irrelevant fields are filtered by mode.
- Teachers need grouped units, preset summaries, and clearer consequences before starting.

### Gameplay HUD and controls

- Strengths: readable crosshair, timer, minimap, touch D-pad/fire, warmth, money, team, gear, ammo, keyboard shortcuts, server-backed reward/buy flow.
- Risks: key objective text disappears on small screens; HUD is below the arena; site navigation competes with play; no settings/controller/remapping; browser scroll remains part of gameplay.
- Quiz overlay fits at 390 px and provides numbered shortcuts; Buy overlay fits but hides locked-item benefits.

### Feedback, pause, and connection

- Correct answers update money immediately and show a reward cue. Live feed and hit/reconnect text exist.
- There is no real pause/settings state. The quiz/buy/scoreboard overlay pauses local input but is marked `aria-modal=false`.
- Reconnecting shows a brief banner, but session refresh/rejoin is not recoverable and the API offline copy exposes deployment terms such as `VITE_API_URL` and `CLIENT_ORIGIN` to end users.

### Results and replay

- Teacher results are clear and exportable.
- Student ending is minimal and has no personal summary or explicit return/replay flow.
- Ended teacher controls remain partially live and the wrong scoreboard role labels persist.

### New-player comprehension

A new learner can join, move, fire, open quiz/buy, and see rewards without a developer. A new learner cannot reliably infer the Flag objective on a phone, understand locked gear benefits, recover after refresh, or know what to do after the session ends.

---

## 9. Design-System Audit

### Existing foundations

- Consistent dark navy text, green primary action, blue selected state, white panels, 8 px radii, light borders, modest shadows, and system-style typography.
- Repeated visual patterns: panel, form panel, button, active button, status pill, metric, scoreboard, live summary, error/success text.
- Good restraint: no `!important`, no excessive decoration, original game palette.

### Missing or inconsistent foundations

- No CSS custom-property token layer for colors, space, radius, type, shadow, focus, z-index, or motion.
- 175 raw hex values and 445 px values make global tuning risky.
- Focus, destructive, warning, offline, and disabled states are not defined as a coherent component contract.
- Base controls are consistent visually, but semantics and state handling differ by context.

### Recommended token structure

Repair the current system rather than replacing it:

- `--color-text-*`, `--color-surface-*`, `--color-border-*`, `--color-action-*`, `--color-status-*`, plus Blue/Red team tokens.
- A compact 4/8-based spacing scale derived from current values.
- `--radius-control`, `--radius-panel`; `--shadow-panel`, `--shadow-overlay`.
- Type roles for display, page title, section title, body, label, metric, HUD, and monospace codes.
- Motion durations/easing plus reduced-motion fallbacks.
- Focus ring, target size, disabled opacity, and destructive-action standards.

### Components to consolidate

- Accessible dialog, field/error, toast/status message, responsive top navigation, status pill, metric card, and semantic scoreboard table.

### Components to keep independent

- Arena HUD, minimap, touch controls, quiz overlay, buy overlay, teacher report table, and Character Lab debug overlay have distinct behavior and should not be forced into one generic card abstraction.

---

## 10. Responsive Audit Matrix

| Screen | 1920×1080 | 1440×900 | 1280×720 | 1024×768 | 768×1024 | 430×932 | 390×844 | 360×800 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Pass; large empty hero area | Pass | Code/visual review | Code/visual review | Code/visual review | Reflows | Pass | Reflows |
| Quiz-Strike landing | Visual review | Pass | Pass | Code review | Code review | Nav scroll | Nav scroll | **Fail: clipped nav/scroller** |
| Teacher auth | — | Pass | — | Code review | Code review | Reflows | Reflows | Reflows |
| Teacher dashboard | — | Pass | — | CSS breakpoint review | CSS breakpoint review | Code review | Code review | Code review |
| Quiz editor | — | Pass | — | Code review | Density risk | Not fully exercised | Not fully exercised | Not fully exercised |
| Session/live monitor | — | Pass | — | CSS breakpoint review | Density risk | Not fully exercised | Not fully exercised | Not fully exercised |
| Join | — | Pass | Pass | Pass | Pass | **Nav scroll** | Pass, long scroll | Code review |
| Student arena | — | Desktop live monitor | — | — | — | Not retained after tab resize | **Pass with hierarchy issues** | CSS review |
| Quiz/buy overlays | — | Code review | — | — | — | — | Pass | CSS review |
| Character Lab | — | Pass | — | CSS review | CSS review | Not exercised | Not exercised | Not exercised |

Evidence: [1920 home](frontend-audit/screenshots/21-home-desktop-1920x1080.png), [1280 landing](frontend-audit/screenshots/22-quiz-strike-laptop-1280x720.png), [1024 join](frontend-audit/screenshots/23-join-tablet-landscape-1024x768.png), [768 join](frontend-audit/screenshots/24-join-tablet-portrait-768x1024.png), [430 join](frontend-audit/screenshots/25-join-large-phone-430x932.png), [390 game](frontend-audit/screenshots/16-student-gameplay-mobile-390x844.png), and [360 landing](frontend-audit/screenshots/26-quiz-strike-small-phone-360x800.png).

Not verified: real iOS/Android browser chrome and safe areas, active-game mobile landscape after session refresh, fullscreen, 200% zoom, system font scaling, Firefox, Safari/WebKit, high-DPI comparison, and physical controller behavior.

---

## 11. Accessibility Findings

### Automated/structural findings

- Positive: page headings, native buttons/inputs/selects, explicit labels, `aria-live` feedback, timer role, named minimap image, dialog name, and semantic teacher report table.
- Confirmed issues: incomplete ARIA game tables, no skip link, no reduced-motion query, no form error associations, overlay dialog semantics inconsistent with visually blocking behavior.
- Automated axe/Lighthouse was not available in the in-app browser, so no numerical compliance score is claimed.

### Manually confirmed keyboard findings

- End-session dialog leaves focus on the background trigger and background scroll enabled.
- Native inputs retain a browser focus outline, but no consistent authored focus system exists.
- Game keyboard shortcuts are implemented and ignore typing targets.
- Full tab-order, Escape, and focus-trap verification across every overlay remains required in physical browsers.

### Screen-reader concerns

- Custom scoreboard cells/headers are not identified semantically.
- Canvas has a label and the minimap has an image name, but there is no nonvisual equivalent for spatial gameplay. A full accessible FPS equivalent is not realistic; the product should clearly document limitations and maximize access to the learning layer.
- Transient errors and status changes need stable, contextual announcements.

### Game-specific limitations

- Core movement/aim requires spatial vision and rapid input.
- Color is supplemented by labels in many HUD areas, which is positive.
- No reduced-motion, controller/remap, text-size, contrast, aim sensitivity, vibration, or audio preference exists.

### Priority order

1. Dialog focus/inert/Escape behavior.
2. Persistent associated form errors and recovery.
3. Semantic scoreboard.
4. Reduced motion/vibration.
5. Skip/focus-visible system and 200% zoom reflow.
6. Document game limitations and expose learning content outside the canvas where possible.

---

## 12. Performance Findings

### Loading performance

- Main app is 318.54 kB minified/98.12 kB gzip.
- Lazy arena chunk is 537.07 kB/139.37 kB gzip and triggers the build warning.
- CSS is modest at 26.25 kB/6.42 kB gzip.
- Arena is correctly lazy-loaded, so the plain home route does not need to parse Three.js immediately.

### Runtime interface and rendering

- Positive: renderer pixel ratio is capped at 1.75; animation frames, listeners, renderer, geometries, materials, and textures are cleaned up.
- Character Lab reports 40/40 visible and supplies a useful stress harness, but it does not record frame time, dropped frames, CPU/GPU split, or memory.
- No quality selector, automatic performance downgrade, or WebGL fallback is exposed.

### Network performance

- Local REST and Socket.IO flow succeeded without captured console errors.
- Production cold-start latency, Render sleep behavior, slow-network loading, retry/backoff, and connection-loss recovery were not measurable in this local run.

### Asset performance

- `player-blue.png` is used on the home card; `snowball-puff.svg` is used in the arena.
- Several large PNG/SVG assets appear unused. They do not affect transfer unless requested but should not remain ambiguous in public output.
- Inter is not loaded, so there is no font transfer or font-display policy; actual system font varies.

### Memory concerns

- Resource disposal is substantially better than a typical prototype and no obvious listener/renderer leak was found in reviewed paths.
- Long-session multi-round heap behavior and repeated mount/unmount should still be profiled on real devices.

No reliable LCP, CLS, INP, GPU, or heap numbers are claimed because the available in-app browser did not expose a Lighthouse/trace workflow.

---

## 13. Quick Wins

| Improvement | Value | Effort | Risk | Independent |
| --- | --- | --- | --- | --- |
| Make Teacher Login open login | Removes immediate auth confusion | Small | Low | Yes |
| Pass game mode into Scoreboard | Fixes incorrect live labels | Small | Medium | Yes |
| Replace phone nav scroller with compact menu/wrap | Restores primary action discovery | Medium | Low | Yes |
| Create explicit ended-state controls and Report CTA | Makes terminal state truthful | Small | Low | Yes |
| Keep form errors persistent with recovery copy | Improves joining and accessibility | Small | Low | Yes |
| Add autocomplete/input metadata | Faster, more reliable forms | Small | Low | Yes |
| Add reduced-motion CSS and vibration preference check | Removes avoidable discomfort | Small | Low | Yes |
| Convert custom scoreboard to native table | Improves screen-reader comprehension | Small | Low | Yes |
| Add root web test and lint scripts | Makes existing coverage run in CI | Small | Low | Yes |
| Remove verified unused dependency/assets | Reduces maintenance surface | Small | Low | Yes |

---

## 14. Recommended Implementation Roadmap

### Stage 1: Broken or Blocking

**Goals:** prevent data/state loss, restore truthful navigation, fix severe accessibility and live-game comprehension.

- Findings: C-01, H-01, H-02, H-03, H-04, H-05.
- Likely files: server repositories and Prisma layer; `App.tsx`; `api/client.ts`; shared player/session types; `styles.css`; deployment docs/workflows.
- Dependencies: persistence architecture, secure student rejoin design, routing decision, test harness.
- Risks: auth/session migration, token leakage, stale sockets, Pages fallback, accidental mode-logic change.
- Validation: restart/redeploy recovery; Back/Forward/refresh; multi-tab/rejoin; keyboard dialog; 320–430 px navigation; Flag/Zombie/Classic scoreboard matrix.

### Stage 2: Core User Experience

**Goals:** make joining, setup, live operation, ending, errors, and student game hierarchy understandable and recoverable.

- Findings: M-01 through M-09 and E-01.
- Likely files: `App.tsx` feature sections, shared dialog/field/status components, `styles.css`.
- Dependencies: Stage 1 route/session state contracts.
- Risks: preserving server validation, pointer-lock behavior, classroom timing, focus order.
- Validation: teacher/student end-to-end browser tests; offline/slow/full/expired session states; mobile portrait/landscape; keyboard/touch; screen reader spot checks.

### Stage 3: Visual System

**Goals:** repair the existing design system, improve density and hierarchy, and standardize states.

- Findings: M-03, M-08, M-09, M-11, L-01, L-02, L-04.
- Likely files: token stylesheet, extracted feature styles/components, current pages.
- Dependencies: stable feature boundaries from Stage 2.
- Risks: broad visual regression and game overlay layering.
- Validation: approved reference screenshots at all target viewports, 200% zoom, long/Japanese content, focus/state matrix.

### Stage 4: Polish and Performance

**Goals:** improve loading/frame stability, preferences, controller support, student ending, and secondary polish.

- Findings: M-07, M-10, L-03, L-05, E-01 through E-03.
- Likely files: `ArenaPreview.tsx`, game audio/input modules, Vite chunking, settings UI, assets, Character Lab.
- Dependencies: real-device performance baseline and product decision on controller/internal tools.
- Risks: input latency, WebGL differences, asset loading, bundle fragmentation.
- Validation: low/mid/high device matrix, sustained 40-player sessions, memory profile, controller/touch parity, reduced-motion, Chrome/Firefox/Safari/WebKit.

---

## 15. Regression Risks

| Recommendation | Main regression risk | Required guard |
| --- | --- | --- |
| Persistence migration | Lost/misowned teacher data, incompatible sessions | Migration tests, backups, ownership/security review |
| Student rejoin | Token replay or duplicate players | Expiring scoped token, server idempotency, multi-tab tests |
| Routing repair | GitHub Pages fallback or active state loss | Direct-route, trailing-slash, Back/Forward, refresh E2E |
| Scoreboard grouping | Changing actual team/role rules | Display-only mode matrix tests |
| Dialog primitive | Accidental submission/keyboard conflicts | Focus/Escape/submit tests |
| Gameplay shell | Pointer-lock/touch coordinate changes | Desktop/touch movement/fire regression suite |
| Session form regrouping | Changed defaults or serialized values | Snapshot payload and server validation tests |
| Code splitting | Asset/chunk 404 on Pages base paths | Production build served under `/` and repo subpath |
| Graphics settings | Different collision/game state | Renderer-only settings; server authority unchanged |
| Asset cleanup | Hidden dynamic reference broken | Build/runtime asset inventory before deletion |

---

## 16. Acceptance Test Checklist

### Desktop

- [ ] `/`, `/quiz-strike`, `/join`, `/game`, `/character-lab` load directly and through in-app navigation.
- [ ] Back/Forward, refresh, and trailing slashes show the screen matching the URL.
- [ ] Teacher signup/login/logout, quiz create/import/edit/delete, session create/start/end, report load/export succeed.
- [ ] 1920×1080, 1440×900, and 1280×720 have no clipped controls or unintended scroll.

### Tablet

- [ ] 1024×768 and 768×1024 preserve readable teacher setup, tables, dialog, and join forms.
- [ ] Touch scrolling does not conflict with canvas or overlays.

### Mobile

- [ ] 430×932, 390×844, and 360×800 have no horizontal nav/page scroll.
- [ ] Active game shows objective, timer, key resources, move/fire, and menu without page scroll.
- [ ] Portrait and landscape respect safe areas and browser bars.

### Keyboard

- [ ] Skip link works; focus ring is always visible.
- [ ] Dialog focus enters, traps, cancels with Escape, and returns to trigger.
- [ ] Quiz, buy, scoreboard, team choice, forms, and reports work without a mouse.
- [ ] Game shortcuts do not fire while typing.

### Touch and controller

- [ ] Touch targets meet the chosen 44–48 px standard and do not overlap.
- [ ] Pointer cancel/leave does not leave movement stuck.
- [ ] If controller support ships, reconnect/remap/input-hint behavior is tested.

### Game flow

- [ ] Flag, Zombie, and Classic display correct role/team labels.
- [ ] Waiting/start/timer/round transition/end states are truthful on teacher and student screens.
- [ ] Answer, reward, buy, fire, hit, elimination, respawn, objective, scoreboard, and report remain server-authoritative.
- [ ] Refresh/rejoin/disconnect do not duplicate or lose the learner.

### Authentication and data

- [ ] Password-manager/autocomplete flows work.
- [ ] Expired auth explains re-login and preserves safe unsaved context where possible.
- [ ] Restart/redeploy preserves accounts, quizzes, sessions, answers, purchases, and reports.
- [ ] Multiple tabs and logout invalidate/refresh state consistently.

### Loading and errors

- [ ] Slow API, offline, server unavailable, invalid/full/ended session, missing asset, and WebGL failure states explain what happened, data safety, and next action.
- [ ] Errors persist until corrected/dismissed and are announced accessibly.
- [ ] Duplicate submissions are impossible while requests run.

### Accessibility

- [ ] Automated WCAG scan has no serious violations on every route/state.
- [ ] Heading/landmark order, labels, names, tables, dialogs, live regions, and canvas alternatives are manually checked.
- [ ] 200% zoom and system font scaling preserve content and function.
- [ ] Reduced motion/vibration preferences are honored.
- [ ] Color contrast and non-color state cues pass in HUD and moving scenes.

### Performance and browsers

- [ ] LCP, CLS, INP, arena load, sustained FPS, memory, and network budgets are measured on representative school devices.
- [ ] Repeated arena mount/unmount and multi-round sessions do not leak resources.
- [ ] Chromium, Firefox, Safari/WebKit, desktop and mobile are verified.
- [ ] Fullscreen, pointer lock, audio autoplay, high-DPI, and mobile keyboard behavior are verified.

---

## Evidence Index

Accepted screenshots are stored in `docs/frontend-audit/screenshots/`. Key evidence:

- [Home — 1920×1080](frontend-audit/screenshots/21-home-desktop-1920x1080.png)
- [Quiz-Strike landing — 1280×720](frontend-audit/screenshots/22-quiz-strike-laptop-1280x720.png)
- [Teacher signup — 1440×900](frontend-audit/screenshots/08-teacher-signup-desktop-1440x900.png)
- [Teacher dashboard — 1440×900](frontend-audit/screenshots/09-teacher-dashboard-desktop-1440x900.png)
- [Quiz editor — 1440×900](frontend-audit/screenshots/10-quiz-editor-desktop-1440x900.png)
- [Live round — 1440×900](frontend-audit/screenshots/15-teacher-live-round-desktop-1440x900.png)
- [End confirmation — desktop](frontend-audit/screenshots/27-end-session-confirmation-desktop.png)
- [Ended session — 1440×900](frontend-audit/screenshots/28-session-ended-desktop-1440x900.png)
- [Reports — 1440×900](frontend-audit/screenshots/29-reports-desktop-1440x900.png)
- [Student gameplay — 390×844](frontend-audit/screenshots/16-student-gameplay-mobile-390x844.png)
- [Quiz overlay — 390×844](frontend-audit/screenshots/17-student-quiz-overlay-mobile-390x844.png)
- [Buy menu — 390×844](frontend-audit/screenshots/19-student-buy-menu-mobile-390x844.png)
- [Join — 1024×768](frontend-audit/screenshots/23-join-tablet-landscape-1024x768.png)
- [Join — 768×1024](frontend-audit/screenshots/24-join-tablet-portrait-768x1024.png)
- [Join — 430×932](frontend-audit/screenshots/25-join-large-phone-430x932.png)
- [Quiz-Strike — 360×800](frontend-audit/screenshots/26-quiz-strike-small-phone-360x800.png)
- [Character Lab — 1440×900](frontend-audit/screenshots/04-character-lab-desktop-1440x900.png)

### Evidence limits

- Browser screenshots and DOM inspection were captured in the Codex in-app Chromium browser during this audit run.
- A few full-page captures were rejected and deleted because sticky/WebGL composition produced incorrect images.
- Firefox, Safari/WebKit, real phones/tablets, physical controllers, fullscreen, 200% zoom, mobile landscape gameplay, screen-reader speech output, production cold starts, and Core Web Vitals were not available for direct verification.
- Accessibility statements are findings and risks, not a claim of full WCAG conformance.
