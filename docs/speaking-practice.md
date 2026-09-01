# Speaking Practice operations

Speaking Practice has separate student routes at `/speak/*` and an integrated
teacher workflow inside the GyakutenEigo dashboard.

## Teacher routes

The canonical teacher routes are:

- `/quiz-strike/teacher/speaking` — activity overview and active-session summary;
- `/quiz-strike/teacher/speaking/create` — create an activity;
- `/quiz-strike/teacher/speaking/activity/:id` — activity setup, launch, join code, and session controls;
- `/quiz-strike/teacher/speaking/activity/:id/edit` — edit an activity;
- `/quiz-strike/teacher/speaking/activity/:id/results?sessionId=...` — session results;
- `/quiz-strike/teacher/speaking/result/:participantId` — participant evaluation and transcript detail.

Existing `/speak/teacher/*` bookmarks remain compatibility aliases. They are
resolved by the browser into the shared teacher shell and authenticated once by
the existing QuizStrike teacher token. Student routes (`/speak/join/*`,
`/speak/session/*`, and `/speak/result/*`) are intentionally unchanged.

## Local mock mode

1. Start PostgreSQL and set `DATABASE_URL` if you want to exercise Prisma persistence.
2. Set `SPEAKING_MOCK_MODE=true` in the server environment.
3. Run `npm run prisma:deploy` and then `npm run dev`.

Mock providers still use the real Activity → Session → Participant API path. A
test-only text body can be submitted by route tests; the browser flow records a
MediaRecorder `Blob` and uploads the binary body.

Without `DATABASE_URL`, the server uses the injected in-memory repository as a
development fallback. It is not durable and is never the production source of
truth when Prisma is configured.

## Production providers

Production requires both provider selections unless an explicit mock override is
being used:

Google AI Studio / Gemini:

```text
SPEAKING_AI_PROVIDER=gemini
SPEAKING_TRANSCRIPTION_PROVIDER=gemini
SPEAKING_GEMINI_API_KEY=server-only-secret
SPEAKING_GEMINI_MODEL=gemini-2.5-flash-lite
SPEAKING_GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash-lite
SPEAKING_SESSION_LIFETIME_SECONDS=28800
```

The OpenAI adapters remain available as an alternative by selecting `openai` for
both providers and supplying the corresponding OpenAI variables. Both adapters
use server-side HTTP requests. Do not prefix these secrets with `VITE_`. If
`NODE_ENV=production` is missing a provider selection or key, the server fails
clearly at provider setup; it does not return a canned answer, transcript, or
evaluation.

## Stored data and privacy

Prisma stores reusable activity configuration and rubric criteria, launched
session lifecycle fields plus an activity snapshot, participant classroom
metadata, transcript turns, and structured evaluations. Student access uses a
temporary opaque token; only its SHA-256 hash is stored. Teacher ownership is
checked on every teacher route.

Raw microphone bytes are held only for request validation and transcription.
They are not written to Prisma, browser storage, application logs, or the
transcript. Providers receive the selected activity context and transcript
needed for their operation; participant identifiers are not included in AI
prompts. Browser `speechSynthesis` speaks the returned AI text and is not a
data provider.

## Browser and lifecycle limits

The client selects the first supported `MediaRecorder` MIME type from WebM/Opus,
WebM, MP4, Ogg/Opus, and WAV. A recording is automatically stopped after 30
seconds. Browsers without `getUserMedia` or `MediaRecorder` show an honest
unsupported state. Safari/iPad MIME support can vary by OS version.

Sessions are ready after launch, active after teacher start, and can be paused,
resumed, ended, or expired. A session code is generated only at launch and is
not reusable after expiry/end. Server-side limits cover activity duration,
participant duration, turns, transcript/reply size, audio bytes, Help calls,
and request rate.
