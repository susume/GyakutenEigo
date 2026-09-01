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
SPEAKING_GEMINI_TRANSCRIPTION_MODEL=gemini-3.5-transcribe
SPEAKING_SESSION_LIFETIME_SECONDS=28800
```

The OpenAI adapters remain available as an alternative by selecting `openai` for
both providers and supplying the corresponding OpenAI variables. A hybrid setup
is also supported when an OpenAI key is available:

```text
SPEAKING_AI_PROVIDER=gemini
SPEAKING_TRANSCRIPTION_PROVIDER=openai
SPEAKING_GEMINI_API_KEY=server-only-gemini-secret
SPEAKING_GEMINI_MODEL=gemini-2.5-flash-lite
SPEAKING_OPENAI_API_KEY=server-only-openai-secret
SPEAKING_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

Gemini-only and mock mode remain supported; OpenAI is never required for
Speaking Practice. Both adapters use server-side HTTP requests. Do not prefix
these secrets with `VITE_`. If
`NODE_ENV=production` is missing a provider selection or key, the server fails
clearly at provider setup; it does not return a canned answer, transcript, or
evaluation.

## Turn latency and diagnostics

The normal turn remains a single request so existing clients keep their
idempotency, participant-token, lock, pause/end, and retry behavior:

```text
browser uploads Blob
  → bounded request parsing
  → selected transcription provider
  → persist student turn
  → prepare bounded conversation prompt
  → selected conversation provider
  → persist AI turn
  → browser speechSynthesis
```

The conversation prompt contains at most seven preceding turns plus the latest
student turn (eight turns total). The latest turn is sent in its own explicit
block and is not duplicated in the recent transcript. This preserves the short
classroom context while avoiding an ever-growing prompt.

Provider requests have bounded AbortController timeouts. Defaults are 15
seconds for transcription, 12 seconds for conversation and Help, and 30 seconds
for final evaluation. They can be overridden with the corresponding
`SPEAKING_*_TIMEOUT_MS` variables or the shared
`SPEAKING_PROVIDER_TIMEOUT_MS` value. The browser allows 35 seconds for the
complete turn so it does not abandon a valid request while the two bounded
provider calls are completing.

For a short diagnostic window, set `SPEAKING_LATENCY_DEBUG=true` on the server.
Successful turn responses include a bounded `latency` object, and the server
prints one aggregate `[Speaking latency]` record containing only byte count and
durations—not transcript text, audio, identifiers, or secrets. Turn diagnostics
are opt-in; return the variable to `false` after measurement.

To measure multiple real provider turns, keep the server diagnostic flag on and
run the helper with an existing active participant session and real recordings:

```text
SPEAKING_LATENCY_SESSION_ID=...
SPEAKING_LATENCY_TOKEN=...
SPEAKING_LATENCY_AUDIO_DIR=./path/to/recordings
npm run speaking:latency
```

The first recording is marked as the cold-provider candidate; later recordings
are labeled turn 2, turn 3, and so on. The helper never uses test text input and
prints timings only. Use a fresh classroom session because each recording is a
real student turn.

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
data provider. While a single request is in progress, the browser shows
“Processing your answer” because it cannot honestly distinguish transcription
from reply generation until the server responds.

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
