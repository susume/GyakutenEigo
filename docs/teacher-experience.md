# GyakutenEigo teacher experience

The teacher application is one authenticated workspace with two classroom
tools: QuizStrike and Speaking Practice. QuizStrike remains the visual and
interaction baseline; Speaking pages are mounted inside the same shell and use
the same page width, navigation, surface, border, and action hierarchy.

## Composition

```text
BrowserApp
  └─ QuizStrikeApp (teacher mode)
      └─ TeacherWorkspace
          ├─ TeacherShell
          │   ├─ GyakutenEigo header + account action
          │   ├─ QuizStrike / Speaking Practice navigation
          │   └─ active QuizStrike session rail
          ├─ TeacherHome
          │   └─ QuizStrike and Speaking quick actions
          ├─ QuizStrike library, hosting, reports, competitions, settings
          └─ lazy speaking/teacher/SpeakingTeacherWorkspace
              ├─ activities, editor, launch/join, results, evaluations
              └─ shared SpeakingResultPanel
```

`TeacherShell.tsx` owns shared layout and navigation only. QuizStrike pages
continue to own QuizStrike data and runtime behavior. Speaking pages continue
to use Speaking-specific activity/session/evaluation APIs and types; the
integration is a UI and routing boundary, not a forced database-model merge.

## Canonical teacher routes

| Route | Dashboard section |
| --- | --- |
| `/quiz-strike/teacher`, `/quiz-strike/teacher/home` | Home |
| `/quiz-strike/teacher/discover` | Discover public Study Sets |
| `/quiz-strike/teacher/library` | QuizStrike Study Sets |
| `/quiz-strike/teacher/create` | Create Study Set |
| `/quiz-strike/teacher/sets/:id` | Study Set detail |
| `/quiz-strike/teacher/sets/:id/edit` | Edit Study Set |
| `/quiz-strike/teacher/host/:quizSetId` | Configure and host a game |
| `/quiz-strike/teacher/reports` | QuizStrike reports |
| `/quiz-strike/teacher/competitions` | Competitions |
| `/quiz-strike/teacher/speaking` | Speaking activities |
| `/quiz-strike/teacher/speaking/create` | Create Speaking activity |
| `/quiz-strike/teacher/speaking/activity/:id` | Launch, join information, and controls |
| `/quiz-strike/teacher/speaking/activity/:id/edit` | Edit Speaking activity |
| `/quiz-strike/teacher/speaking/activity/:id/results?sessionId=...` | Session results |
| `/quiz-strike/teacher/speaking/result/:participantId` | Participant evaluation |
| `/quiz-strike/teacher/settings` | Teacher game preferences |

Legacy `/speak/teacher/*` paths are accepted and immediately replaced with the
equivalent canonical Speaking path. The current deep route remains in place
through authentication, so signing in returns the teacher to the requested
activity, editor, or report without a second login.

## Shared conventions

- Use `TeacherShell` for teacher navigation, account actions, loading/error
  placement, and responsive sidebar behavior.
- Keep feature pages responsible for their domain API calls and domain states.
- Prefer the existing QuizStrike light workspace tokens: white cards, pale blue
  page background, blue navigation, green success/launch actions, and coral
  creation emphasis.
- Keep actions as semantic buttons with visible focus states and touch targets
  of at least 40px.
- Use feature-specific empty and error copy when it provides actionable domain
  guidance; keep the surrounding shell and status placement consistent.

## Performance and security boundary

Speaking teacher code is lazy-loaded from
`features/speaking/teacher/SpeakingTeacherWorkspace.tsx`; the student
Speaking route remains separate in `SpeakingPracticeApp.tsx`. Neither the
ordinary Speaking student flow nor the teacher shell should eagerly load the Three.js arena. Provider
credentials, transcription, evaluation, and raw-audio handling remain
server-side as described in `docs/speaking-practice.md`.

The teacher token is the existing signed JWT. Switching between sections uses
the same browser session; logout clears it and returns to the public home. No
student account or new cross-product server model was introduced.

## Known boundaries

The QuizStrike `TeacherWorkspace.tsx` still contains its behavior-sensitive
game setup, live session controls, and report implementations. Dead duplicate
folder/dashboard/editor implementations were removed; the remaining work
should move one coherent page boundary at a time with focused tests and
Playwright coverage. The game runtime remains untouched.
