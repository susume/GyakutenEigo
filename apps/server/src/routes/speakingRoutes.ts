import express, { type Application, type NextFunction, type Request, type Response } from "express";
import {
  DEFAULT_SPEAKING_RUBRIC,
  SPEAKING_LIMITS,
  SPEAKING_PRACTICE_LANGUAGE,
  SpeakingCreateActivityInputSchema,
  SpeakingEvaluationSchema,
  SpeakingJoinInputSchema,
  SpeakingTurnInputSchema,
  speakingActiveElapsedMs,
  speakingFeedbackCopy,
  type SpeakingActivity,
  type SpeakingCreateActivityInput,
  type SpeakingEvaluation,
  type SpeakingParticipant,
  type SpeakingParticipantResult,
  type SpeakingSession,
  type SpeakingTurn,
  type TeacherUser
} from "@quizstrike/shared";
import { randomBytes, randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import {
  createInMemorySpeakingState,
  createSpeakingRepository,
  findSpeakingTurnPair,
  hashSpeakingToken,
  type InMemorySpeakingState,
  type SpeakingRepository
} from "../speakingRepository.js";
import {
  createSpeakingProviders,
  speakingProviderFailureDetails,
  type ConversationProvider,
  type EvaluationProvider,
  type HelpProvider,
  type TranscriptionProvider,
  type TranscriptionResult
} from "../speakingProviders.js";
import { buildConversationPrompt } from "../speakingPrompts.js";

type AuthedRequest = Request & { user?: TeacherUser };
type SpeakingTurnRequest = Request & { speakingTurnRequestStartedAt?: number };

export type SpeakingLatencyDiagnostics = {
  audioBytes: number;
  requestParsingMs: number;
  transcriptionMs: number;
  studentPersistenceMs: number;
  promptPreparationMs: number;
  conversationMs: number;
  aiPersistenceMs: number;
  totalMs: number;
};

export type SpeakingRouteState = InMemorySpeakingState & {
  requestWindows: Map<string, { startedAtMs: number; count: number }>;
};

export type SpeakingRouteDependencies = {
  requireTeacher: (req: Request, res: Response, next: NextFunction) => void;
  now: () => string;
  id: () => string;
  environment?: string;
  state?: SpeakingRouteState;
  repository?: SpeakingRepository;
  prisma?: PrismaClient;
  providers?: {
    transcription: TranscriptionProvider;
    conversation: ConversationProvider;
    help: HelpProvider;
    evaluation: EvaluationProvider;
  };
  /** Compatibility injection for route tests. It also enables text test input. */
  transcriber?: TranscriptionProvider;
  conversationProvider?: ConversationProvider;
  evaluationProvider?: EvaluationProvider;
  helpProvider?: HelpProvider;
  allowTextInput?: boolean;
  sessionLifetimeSeconds?: number;
  /** Explicit test override; production diagnostics remain opt-in by environment. */
  latencyDebug?: boolean;
};

const createState = (): SpeakingRouteState => ({ ...createInMemorySpeakingState(), requestWindows: new Map() });

const cloneRubric = () => DEFAULT_SPEAKING_RUBRIC.map((criterion) => ({ ...criterion }));

const templateInputs: Array<SpeakingCreateActivityInput & { id: string }> = [
  {
    id: "template-restaurant",
    title: "At the Restaurant",
    scenario: "The student is ordering lunch at a restaurant.",
    aiRole: "Restaurant worker",
    studentRole: "Customer",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 180,
    identifierMode: "nickname",
    targetExpressions: ["I'd like...", "Can I have...?", "How much is it?", "That's all, thank you."],
    rubric: cloneRubric()
  },
  {
    id: "template-shopping",
    title: "Shopping for Clothes",
    scenario: "The student wants to buy a T-shirt in a clothing store.",
    aiRole: "Shop assistant",
    studentRole: "Customer",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 300,
    identifierMode: "nickname",
    targetExpressions: ["I'd like...", "How much is it?", "Do you have...?", "Can I try it on?"],
    rubric: cloneRubric()
  },
  {
    id: "template-directions",
    title: "Asking for Directions",
    scenario: "The student is looking for the library and asks a helpful person.",
    aiRole: "Helpful local",
    studentRole: "Visitor",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "ja",
    durationSeconds: 120,
    identifierMode: "anonymous",
    targetExpressions: ["Excuse me.", "Where is...?", "How can I get to...?", "Thank you."],
    rubric: cloneRubric()
  },
  {
    id: "template-hobbies",
    title: "Talking About Hobbies",
    scenario: "The student meets a new classmate and talks about hobbies.",
    aiRole: "New classmate",
    studentRole: "Student",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 180,
    identifierMode: "nickname",
    targetExpressions: ["I like...", "I enjoy...", "How about you?", "Me too!"],
    rubric: cloneRubric()
  },
  {
    id: "template-weekend",
    title: "Weekend Plans",
    scenario: "The student and a friend make plans for the weekend.",
    aiRole: "Friend",
    studentRole: "Student",
    level: "lower_intermediate",
    difficulty: "challenge",
    nativeLanguage: "ja",
    durationSeconds: 300,
    identifierMode: "nickname",
    targetExpressions: ["What are you going to do?", "Would you like to...?", "That sounds fun.", "How about Saturday?"],
    rubric: cloneRubric()
  },
  {
    id: "template-introduction",
    title: "Self Introduction",
    scenario: "The student meets someone new and shares a few things about themselves.",
    aiRole: "New friend",
    studentRole: "Student",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "ja",
    durationSeconds: 120,
    identifierMode: "nickname",
    targetExpressions: ["My name is...", "I am from...", "I like...", "Nice to meet you."],
    rubric: cloneRubric()
  }
];

type TemplateInput = (typeof templateInputs)[number];

const makeTemplate = (input: TemplateInput, now: string): SpeakingActivity => ({
  id: input.id,
  teacherId: "speaking-template",
  title: input.title,
  scenario: input.scenario,
  aiRole: input.aiRole,
  studentRole: input.studentRole,
  level: input.level,
  difficulty: input.difficulty,
  nativeLanguage: input.nativeLanguage,
  durationSeconds: input.durationSeconds,
  status: "ready",
  identifierMode: input.identifierMode,
  targetExpressions: [...input.targetExpressions],
  rubric: input.rubric.map((criterion) => ({ ...criterion })),
  createdAt: now,
  updatedAt: now
});

const publicParticipant = (participant: SpeakingParticipant) => {
  const { anonymousToken: _anonymousToken, ...safeParticipant } = participant;
  return safeParticipant;
};

const publicActivity = (activity: SpeakingActivity) => {
  const { teacherId: _teacherId, ...safeActivity } = activity;
  return safeActivity;
};

const activitySummary = (activity: SpeakingActivity) => ({
  id: activity.id,
  title: activity.title,
  scenario: activity.scenario,
  targetExpressions: activity.targetExpressions,
  nativeLanguage: activity.nativeLanguage,
  rubric: activity.rubric
});

const toResult = (activity: SpeakingActivity, session: SpeakingSession, participant: SpeakingParticipant, turns: SpeakingTurn[], evaluation?: SpeakingEvaluation): SpeakingParticipantResult => ({
  participant,
  activity: activitySummary(activity),
  session,
  turns,
  ...(evaluation ? { evaluation } : {})
});

const safeResult = (result: SpeakingParticipantResult) => ({
  ...result,
  participant: publicParticipant(result.participant)
});

const secureToken = () => randomBytes(32).toString("base64url");
const normalizeIdentifier = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 80) : "";
const formatError = (issues: Array<{ path: PropertyKey[]; message: string }>) => issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "activity"}: ${issue.message}`).join("; ");

const initialGreeting = (activity: SpeakingActivity) => {
  const title = activity.title.toLowerCase();
  if (title.includes("restaurant")) return "Hello! What would you like to order?";
  if (title.includes("direction")) return "Hello! Can I help you find a place?";
  if (title.includes("shopping") || title.includes("clothes")) return "Hi! Can I help you today?";
  return "Hi! Nice to meet you. Can we talk?";
};

const sessionPayload = (session: SpeakingSession) => ({ ...session });

export const makeInsufficientEvidenceEvaluation = (activity: SpeakingActivity, participantId: string, createdAt: string): SpeakingEvaluation => {
  const copy = speakingFeedbackCopy(activity.nativeLanguage);
  const scores: Record<string, null> = {};
  const evidence: Record<string, string> = {};
  for (const criterion of activity.rubric.filter((item) => item.enabled)) {
    scores[criterion.id] = null;
    evidence[criterion.id] = copy.insufficientEvidenceReason;
  }
  return {
    participantId,
    language: activity.nativeLanguage,
    assessmentStatus: "insufficient_evidence",
    notScoredReason: copy.insufficientEvidenceReason,
    scores,
    evidence,
    strengths: [copy.insufficientEvidenceStrength],
    improvements: [copy.insufficientEvidenceImprovement],
    usefulEnglish: [],
    overallMessage: copy.insufficientEvidenceMessage,
    createdAt
  };
};

const allowRequest = (state: SpeakingRouteState, key: string, limit: number, nowMs = Date.now()) => {
  const current = state.requestWindows.get(key);
  if (!current || nowMs - current.startedAtMs >= 60_000) {
    state.requestWindows.set(key, { startedAtMs: nowMs, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
};

const makeJoinCode = async (repository: SpeakingRepository) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
    if (!(await repository.isJoinCodeTaken(code))) return code;
  }
  throw new Error("Could not allocate a unique speaking session code.");
};

const parseParticipantToken = (req: Request) => req.header("X-Speaking-Token")?.trim();

const parseAudioOrText = (req: Request) => {
  const contentType = (req.header("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  const audio = Buffer.isBuffer(req.body) ? req.body : undefined;
  const text = req.body && !audio && typeof req.body === "object" ? (req.body as { text?: unknown }).text : undefined;
  const speechHeader = req.header("X-Speaking-Audio-Activity")?.trim().toLowerCase();
  const durationHeader = req.header("X-Speaking-Audio-Duration-Ms");
  const durationHeaderValue = durationHeader === undefined ? undefined : Number(durationHeader);
  return {
    audio,
    text: typeof text === "string" ? text : undefined,
    mimeType: contentType || "application/octet-stream",
    speechDetected: speechHeader === "true" ? true : speechHeader === "false" ? false : undefined,
    audioDurationMs: durationHeaderValue !== undefined && Number.isFinite(durationHeaderValue) ? durationHeaderValue : undefined
  };
};

const supportedAudioMime = (mimeType: string) => mimeType === "audio/webm" || mimeType === "audio/mp4" || mimeType === "audio/ogg" || mimeType === "audio/wav" || mimeType === "audio/mpeg";

const boundedSpeakingDurationMs = (startedAt: number, finishedAt = performance.now()) =>
  Math.min(120_000, Math.max(0, Math.round(finishedAt - startedAt)));

const speakingLatencyDebugEnabled = (environment: NodeJS.ProcessEnv = process.env) =>
  environment.SPEAKING_LATENCY_DEBUG?.trim().toLowerCase() === "true";

const logSpeakingLatency = (diagnostics: SpeakingLatencyDiagnostics) => {
  // Deliberately log only bounded timings and payload size. Never include
  // transcript text, audio bytes, participant identifiers, or provider keys.
  console.info(`[Speaking latency] ${JSON.stringify(diagnostics)}`);
};

const transcriptionFailureResponse = (kind: ReturnType<typeof speakingProviderFailureDetails>["kind"]) => {
  if (kind === "timeout") return { code: "SPEAKING_TRANSCRIPTION_TIMEOUT", error: "Speech recognition took too long. Please try again." };
  if (kind === "rate_limit" || kind === "unavailable" || kind === "network") return { code: "SPEAKING_TRANSCRIPTION_BUSY", error: "Speech recognition is temporarily busy. Please try again." };
  if (kind === "bad_request") return { code: "SPEAKING_TRANSCRIPTION_AUDIO_INVALID", error: "That recording could not be read. Please record it again." };
  return { code: "SPEAKING_TRANSCRIPTION_UNAVAILABLE", error: "Speech recognition is temporarily unavailable. Please try again." };
};

export const participantActiveElapsedMs = (participant: SpeakingParticipant, session: SpeakingSession, referenceTime: string) =>
  speakingActiveElapsedMs(participant, session, referenceTime);

export const participantHasSpeakingTime = (participant: SpeakingParticipant, session: SpeakingSession, activity: SpeakingActivity, referenceTime: string) =>
  !participant.startedAt || participantActiveElapsedMs(participant, session, referenceTime) < activity.durationSeconds * 1_000;

export const validateSpeakingEvaluation = (evaluation: SpeakingEvaluation, activity: SpeakingActivity, participantId: string) => {
  const parsed = SpeakingEvaluationSchema.safeParse(evaluation);
  if (!parsed.success || parsed.data.participantId !== participantId || parsed.data.language !== activity.nativeLanguage) throw new Error("Evaluation provider returned invalid data.");
  const enabledIds = new Set(activity.rubric.filter((criterion) => criterion.enabled).map((criterion) => criterion.id));
  const scoreIds = Object.keys(parsed.data.scores);
  const evidenceIds = Object.keys(parsed.data.evidence);
  if (scoreIds.some((id) => !enabledIds.has(id)) || evidenceIds.some((id) => !enabledIds.has(id)) || scoreIds.some((id) => !evidenceIds.includes(id)) || [...enabledIds].some((id) => !scoreIds.includes(id))) throw new Error("Evaluation provider omitted or added rubric criteria.");
  if (scoreIds.some((id) => /pronunciation|accent|phoneme/i.test(id))) throw new Error("Pronunciation scoring is not supported.");
  const hasNumericScore = Object.values(parsed.data.scores).some((score) => typeof score === "number");
  if ((parsed.data.assessmentStatus === "insufficient_evidence" && hasNumericScore) || (parsed.data.assessmentStatus === "scored" && !hasNumericScore)) {
    throw new Error("Evaluation provider returned an inconsistent assessment status.");
  }
  return parsed.data;
};

const unsupportedPronunciationCriterion = (criterion: { id: string; name: string; description: string }) =>
  /pronunciation|accent|phoneme/i.test(`${criterion.id} ${criterion.name} ${criterion.description}`);

export const registerSpeakingRoutes = (app: Application, deps: SpeakingRouteDependencies) => {
  const state = deps.state ?? createState();
  const repository = deps.repository ?? createSpeakingRepository({ environment: deps.environment, prisma: deps.prisma, state });
  const defaults = deps.providers ?? createSpeakingProviders();
  const transcriber = deps.transcriber ?? defaults.transcription;
  const conversationProvider = deps.conversationProvider ?? defaults.conversation;
  const helpProvider = deps.helpProvider ?? defaults.help;
  const evaluationProvider = deps.evaluationProvider ?? defaults.evaluation;
  const templates = templateInputs.map((input) => makeTemplate(input, deps.now()));
  const allowTextInput = deps.allowTextInput ?? (!deps.providers && !deps.prisma);
  const environmentSessionLifetime = Number.parseInt(process.env.SPEAKING_SESSION_LIFETIME_SECONDS ?? "", 10);
  const configuredSessionLifetime = deps.sessionLifetimeSeconds ?? (Number.isFinite(environmentSessionLifetime) ? environmentSessionLifetime : SPEAKING_LIMITS.sessionLifetimeSeconds);
  const sessionLifetimeSeconds = Math.min(7 * 24 * 60 * 60, Math.max(10 * 60, Math.floor(configuredSessionLifetime)));
  const turnLocks = new Map<string, Promise<void>>();
  const latencyDebug = deps.latencyDebug ?? speakingLatencyDebugEnabled();

  // Express's JSON parser skips audio/*, so parse only this endpoint as a
  // bounded binary request. Raw bytes are never written to the repository.
  const turnRoutePath = "/api/speaking/sessions/:sessionId/turn";
  app.use(turnRoutePath, (req, _res, next) => {
    (req as SpeakingTurnRequest).speakingTurnRequestStartedAt = performance.now();
    next();
  }, express.raw({ type: ["audio/*", "application/octet-stream"], limit: `${SPEAKING_LIMITS.maxAudioBytes}b` }));

  const withTurnLock = async <T>(participantId: string, work: () => Promise<T>) => {
    const previous = turnLocks.get(participantId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    turnLocks.set(participantId, queued);
    await previous;
    try { return await work(); } finally {
      release();
      if (turnLocks.get(participantId) === queued) turnLocks.delete(participantId);
    }
  };

  const requireOwnedActivity = async (req: AuthedRequest, res: Response) => {
    const activity = await repository.getOwnedActivity(String(req.params.activityId ?? req.params.id), req.user?.id ?? "");
    if (!activity) {
      res.status(404).json({ error: "We couldn’t find that speaking activity." });
      return undefined;
    }
    return activity;
  };

  const getParticipantAccess = async (req: Request) => {
    const token = parseParticipantToken(req);
    return token ? repository.getParticipantAccessByTokenHash(hashSpeakingToken(token)) : undefined;
  };

  const expireSessionIfNeeded = async (access: { session: SpeakingSession; activity: SpeakingActivity }) => {
    const now = deps.now();
    const latestAccess = await repository.getSession(access.session.id);
    let current = latestAccess?.session ?? access.session;
    if (!["ended", "expired"].includes(current.status) && Date.parse(current.expiresAt) <= Date.parse(now)) {
      if (current.status === "paused" && current.pausedAt) {
        current = await repository.finalizeSessionPause(current.id, now) ?? current;
      }
      const session = await repository.updateSession(current.id, { status: "expired", endedAt: now, pausedAt: null });
      return session ?? { ...current, status: "expired" as const, endedAt: now, pausedAt: undefined };
    }
    return current;
  };

  const finishParticipant = async (access: { session: SpeakingSession; activity: SpeakingActivity; participant: SpeakingParticipant }) => {
    const existing = await repository.getResult(access.participant.id);
    if (existing?.evaluation) {
      if (existing.participant.status !== "completed") {
        await repository.updateParticipant(access.participant.id, {
          status: "completed",
          finishedAt: existing.participant.finishedAt ?? existing.evaluation.createdAt,
          helpPending: false
        });
      }
      return existing.evaluation;
    }
    const current = await repository.getParticipant(access.participant.id);
    if (!current || current.status === "evaluating") return undefined;
    const finishedAt = current.finishedAt ?? deps.now();
    // Persist the participant's stop time before the provider call. A teacher
    // can resume a paused session while evaluation is running, and pause
    // finalization needs this timestamp to account only for the overlap.
    await repository.updateParticipant(access.participant.id, { status: "evaluating", finishedAt });
    const turns = await repository.listTurns(access.participant.id);
    try {
      const studentTurns = turns.filter((turn) => turn.speaker === "student" && turn.text.trim().length > 0);
      const evaluation = validateSpeakingEvaluation(
        studentTurns.length === 0
          ? makeInsufficientEvidenceEvaluation(access.activity, access.participant.id, finishedAt)
          : await evaluationProvider.evaluate({
            activity: access.activity,
            turns,
            participantId: access.participant.id,
            timingMetadata: { startedAt: current.startedAt, finishedAt, durationSeconds: participantActiveElapsedMs(current, access.session, finishedAt) / 1_000 },
            helpMetadata: { helpCount: current.helpCount, helpedTurnCount: turns.filter((turn) => turn.usedHelp).length }
          }),
        access.activity,
        access.participant.id
      );
      await repository.saveEvaluation(access.participant.id, evaluation);
      await repository.updateParticipant(access.participant.id, { status: "completed", helpPending: false });
      return evaluation;
    } catch {
      await repository.updateParticipant(access.participant.id, { status: "error" });
      return undefined;
    }
  };

  app.get("/api/speaking/templates", (_req, res) => {
    res.json({ items: templates.map(publicActivity) });
  });

  app.get("/api/speaking/activities", deps.requireTeacher, async (req: AuthedRequest, res) => {
    res.json({ items: (await repository.listActivities(req.user!.id)).map(publicActivity) });
  });

  app.post("/api/speaking/activities", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const parsed = SpeakingCreateActivityInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Check the activity details. ${formatError(parsed.error.issues)}` });
      return;
    }
    if (parsed.data.rubric.some(unsupportedPronunciationCriterion)) {
      res.status(400).json({ error: "Pronunciation, accent, and phoneme scoring are not supported by Speaking Practice." });
      return;
    }
    const activity = await repository.createActivity(req.user!.id, parsed.data, deps.id(), deps.now());
    res.status(201).json({ activity: publicActivity(activity) });
  });

  app.patch("/api/speaking/activities/:activityId", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const parsed = SpeakingCreateActivityInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Check the activity details. ${formatError(parsed.error.issues)}` });
      return;
    }
    if (parsed.data.rubric.some(unsupportedPronunciationCriterion)) {
      res.status(400).json({ error: "Pronunciation, accent, and phoneme scoring are not supported by Speaking Practice." });
      return;
    }
    const activity = await repository.updateActivity(req.user!.id, String(req.params.activityId), parsed.data, deps.now());
    if (!activity) {
      res.status(404).json({ error: "We couldn’t find that speaking activity." });
      return;
    }
    res.json({ activity: publicActivity(activity) });
  });

  app.get("/api/speaking/activities/:activityId", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const activity = await requireOwnedActivity(req, res);
    if (activity) res.json({ activity: publicActivity(activity) });
  });

  app.get("/api/speaking/activities/:activityId/sessions", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const activity = await requireOwnedActivity(req, res);
    if (!activity) return;
    const sessions = await repository.listSessions(activity.id, req.user!.id);
    const currentSessions = await Promise.all(sessions.map(async (session) => expireSessionIfNeeded({ activity, session })));
    res.json({ activity: publicActivity(activity), sessions: currentSessions.map(sessionPayload) });
  });

  // Legacy activity controls are retained as authoring status operations. A
  // classroom session is launched explicitly through the endpoint below.
  app.post("/api/speaking/activities/:activityId/activate", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const activity = await requireOwnedActivity(req, res);
    if (activity) res.json({ activity: publicActivity(activity) });
  });
  app.post("/api/speaking/activities/:activityId/end", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const activity = await requireOwnedActivity(req, res);
    if (activity) res.json({ activity: publicActivity(activity) });
  });

  app.post("/api/speaking/activities/:activityId/sessions", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const activity = await requireOwnedActivity(req, res);
    if (!activity) return;
    const createdAt = deps.now();
    const expiresAt = new Date(Date.parse(createdAt) + sessionLifetimeSeconds * 1_000).toISOString();
    let session: SpeakingSession | undefined;
    for (let attempt = 0; attempt < 3 && !session; attempt += 1) {
      try {
        session = await repository.createSession({ id: deps.id(), activity, joinCode: await makeJoinCode(repository), createdAt, expiresAt });
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    res.status(201).json({ activity: publicActivity(activity), session: sessionPayload(session!) });
  });

  app.post("/api/speaking/join", async (req, res) => {
    const parsed = SpeakingJoinInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter the six-character session code." });
      return;
    }
    if (!allowRequest(state, `join:${req.ip}`, 30)) {
      res.status(429).json({ error: "Too many join attempts. Please wait a moment." });
      return;
    }
    const access = await repository.findJoinableSession(parsed.data.code, deps.now());
    if (!access) {
      res.status(404).json({ error: "We couldn’t find an open classroom session. Check the code and try again." });
      return;
    }
    const identifier = normalizeIdentifier(parsed.data.identifier);
    if (access.activity.identifierMode !== "anonymous" && identifier.length < 2) {
      res.status(400).json({ error: access.activity.identifierMode === "student_number" ? "Enter your student number." : "Enter a nickname." });
      return;
    }
    const token = secureToken();
    const participant = await repository.createParticipant({ id: deps.id(), activity: access.activity, session: access.session, ...(access.activity.identifierMode === "anonymous" ? {} : { displayIdentifier: identifier }), tokenHash: hashSpeakingToken(token) });
    const greeting: SpeakingTurn = { id: deps.id(), participantId: participant.id, speaker: "ai", text: initialGreeting(access.activity), createdAt: deps.now() };
    await repository.appendTurn(greeting);
    res.status(201).json({ activity: publicActivity(access.activity), participant: publicParticipant(participant), session: sessionPayload(access.session), token });
  });

  app.post("/api/speaking/sessions/:sessionId/start", async (req, res) => {
    const access = await getParticipantAccess(req);
    if (!access || access.session.id !== String(req.params.sessionId)) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    const session = await expireSessionIfNeeded(access);
    if (["expired", "ended"].includes(session.status)) {
      res.status(410).json({ error: "This activity has ended. Please ask your teacher for a new code." });
      return;
    }
    if (session.status === "ready") {
      res.status(409).json({ error: "Waiting for your teacher to start the activity." });
      return;
    }
    if (session.status === "paused") {
      res.status(409).json({ error: "Your teacher paused the activity." });
      return;
    }
    const participant = await repository.startParticipant(access.participant.id, access.participant.startedAt ?? deps.now());
    res.json({ participant: participant ? publicParticipant(participant) : publicParticipant(access.participant), session: sessionPayload(session) });
  });

  const teacherSessionAction = (action: "start" | "pause" | "resume" | "end") => async (req: AuthedRequest, res: Response) => {
    const sessionAccess = await repository.getSession(String(req.params.sessionId));
    if (!sessionAccess || sessionAccess.activity.teacherId !== req.user?.id) {
      res.status(404).json({ error: "We couldn’t find that speaking session." });
      return;
    }
    let current = await expireSessionIfNeeded(sessionAccess);
    if (current.status === "expired" && action !== "end") {
      res.status(410).json({ error: "This speaking session has expired." });
      return;
    }
    const now = deps.now();
    if ((action === "resume" || action === "end") && current.status === "paused" && current.pausedAt) {
      current = await repository.finalizeSessionPause(current.id, now) ?? current;
    }
    const transitions: Record<typeof action, { from: string[]; status: "ready" | "active" | "paused" | "ended" }> = {
      start: { from: ["ready"], status: "active" },
      pause: { from: ["active"], status: "paused" },
      resume: { from: ["paused"], status: "active" },
      end: { from: ["ready", "active", "paused"], status: "ended" }
    };
    const transition = transitions[action];
    if (!transition.from.includes(current.status)) {
      res.status(409).json({ error: `This session cannot ${action} from its current state.` });
      return;
    }
    const updated = await repository.updateSession(current.id, {
      status: transition.status,
      ...(action === "start" ? { startedAt: now } : {}),
      ...(action === "pause" ? { pausedAt: now } : {}),
      ...(action === "resume" ? { pausedAt: null } : {}),
      ...(action === "end" ? { endedAt: now } : {})
    });
    res.json({ activity: publicActivity(sessionAccess.activity), session: sessionPayload(updated ?? { ...current, status: transition.status }) });
  };

  app.post("/api/speaking/sessions/:sessionId/start-session", deps.requireTeacher, teacherSessionAction("start"));
  app.post("/api/speaking/sessions/:sessionId/pause", deps.requireTeacher, teacherSessionAction("pause"));
  app.post("/api/speaking/sessions/:sessionId/resume", deps.requireTeacher, teacherSessionAction("resume"));
  app.post("/api/speaking/sessions/:sessionId/end", deps.requireTeacher, teacherSessionAction("end"));

  app.get("/api/speaking/sessions/:sessionId", async (req, res) => {
    const access = await getParticipantAccess(req);
    if (!access || access.session.id !== String(req.params.sessionId)) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    const session = await expireSessionIfNeeded(access);
    const turns = await repository.listTurns(access.participant.id);
    const participant = await repository.getParticipant(access.participant.id) ?? access.participant;
    res.json({ activity: publicActivity(access.activity), participant: publicParticipant(participant), session: sessionPayload(session), turns });
  });

  app.post(turnRoutePath, async (req, res) => {
    const requestStartedAt = (req as SpeakingTurnRequest).speakingTurnRequestStartedAt;
    const requestParsedAt = performance.now();
    const turnStartedAt = requestStartedAt ?? performance.now();
    const access = await getParticipantAccess(req);
    if (!access || access.session.id !== String(req.params.sessionId)) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    return withTurnLock(access.participant.id, async () => {
      const latency: SpeakingLatencyDiagnostics = {
        audioBytes: 0,
        requestParsingMs: 0,
        transcriptionMs: 0,
        studentPersistenceMs: 0,
        promptPreparationMs: 0,
        conversationMs: 0,
        aiPersistenceMs: 0,
        totalMs: 0
      };
      const latencyResponse = () => {
        latency.totalMs = boundedSpeakingDurationMs(turnStartedAt);
        return latencyDebug ? { latency: { ...latency } } : {};
      };

      try {
        latency.requestParsingMs = requestStartedAt === undefined ? 0 : boundedSpeakingDurationMs(requestStartedAt, requestParsedAt);
        const rawRequestId = req.header("X-Speaking-Turn-Id")?.trim();
        const requestId = rawRequestId && rawRequestId.length <= 120 ? rawRequestId : undefined;
        const requestTurns = requestId ? await repository.listTurns(access.participant.id) : undefined;
        const previous = requestId && requestTurns ? findSpeakingTurnPair(requestTurns, requestId) : undefined;
        if (previous?.aiTurn) {
          const latestSession = await repository.getSession(access.session.id);
          res.json({ studentTurn: previous.studentTurn, aiTurn: previous.aiTurn, session: sessionPayload(latestSession?.session ?? access.session), ...latencyResponse() });
          return;
        }
        if (!allowRequest(state, `turn:${hashSpeakingToken(parseParticipantToken(req) ?? "")}`, 45)) {
          res.status(429).json({ error: "Please wait a moment before speaking again." });
          return;
        }
        let currentSession = await expireSessionIfNeeded(access);
        if (!previous?.studentTurn && currentSession.status === "paused") {
          res.status(409).json({ error: "Your teacher paused the activity." });
          return;
        }
        if (!previous?.studentTurn && currentSession.status !== "active") {
          res.status(currentSession.status === "expired" || currentSession.status === "ended" ? 410 : 409).json({ error: currentSession.status === "ready" ? "Waiting for your teacher to start the activity." : "This speaking activity is no longer accepting turns." });
          return;
        }
        let currentParticipant = await repository.getParticipant(access.participant.id) ?? access.participant;
        const existingTurns = requestTurns ?? await repository.listTurns(currentParticipant.id);
        let turnsForConversation = existingTurns;
        let studentTurn = previous?.studentTurn;
        if (!studentTurn) {
          if (currentParticipant.status === "completed") {
            res.status(409).json({ error: "This speaking activity is already finished." });
            return;
          }
          const startedAt = currentParticipant.startedAt ?? deps.now();
          if (!currentParticipant.startedAt) {
            const startedParticipant = await repository.startParticipant(currentParticipant.id, startedAt);
            currentParticipant = { ...currentParticipant, ...(startedParticipant ?? { startedAt }) };
          }
          if (!participantHasSpeakingTime(currentParticipant, currentSession, access.activity, deps.now())) {
            res.status(409).json({ error: "Your speaking time is over. You can finish and view your result." });
            return;
          }
          if (currentParticipant.status === "evaluating" || currentParticipant.status === "error") {
            res.status(409).json({ error: "This speaking activity is finishing. Please try the result screen." });
            return;
          }
          if (existingTurns.length >= SPEAKING_LIMITS.maxTurns) {
            res.status(409).json({ error: "This speaking activity has reached its turn limit. You can finish and view your result." });
            return;
          }
          const parsed = parseAudioOrText(req);
          latency.audioBytes = parsed.audio?.byteLength ?? 0;
          if (parsed.audio && parsed.audio.length > SPEAKING_LIMITS.maxAudioBytes) {
            res.status(413).json({ error: "That recording is too large. Please record a shorter answer." });
            return;
          }
          if (parsed.audio && !supportedAudioMime(parsed.mimeType)) {
            res.status(415).json({ error: "This browser recording format is not supported. Try Safari, Chrome, or a shorter recording." });
            return;
          }
          if (parsed.audio && parsed.audioDurationMs !== undefined && (!Number.isInteger(parsed.audioDurationMs) || parsed.audioDurationMs < 0 || parsed.audioDurationMs > SPEAKING_LIMITS.maxTurnSeconds * 1_000 + 2_000)) {
            // This client value is advisory only. The byte limit and provider-side
            // transcription remain the authoritative defenses; this catches only
            // obviously malformed metadata without adding a media parser.
            res.status(400).json({ error: "That recording duration is not valid. Please record a shorter answer." });
            return;
          }
          const textInput = SpeakingTurnInputSchema.safeParse(parsed.text === undefined ? {} : { text: parsed.text });
          if (!parsed.audio && (!allowTextInput || !textInput.success)) {
            res.status(400).json({ error: "I couldn’t hear that clearly. Please try again." });
            return;
          }
          let transcription: TranscriptionResult;
          const transcriptionStartedAt = performance.now();
          try {
            transcription = await transcriber.transcribe({ audio: parsed.audio ?? Buffer.from(parsed.text ?? "", "utf8"), mimeType: parsed.audio ? parsed.mimeType : "text/plain", languageHint: SPEAKING_PRACTICE_LANGUAGE, ...(parsed.speechDetected === undefined ? {} : { speechDetected: parsed.speechDetected }), ...(allowTextInput && textInput.success ? { text: textInput.data.text } : {}) });
          } catch (error) {
            const failure = speakingProviderFailureDetails(error);
            // This log is intentionally safe: no transcript, audio, participant,
            // session, request ID, provider response text, or credential is kept.
            console.warn(`[Speaking provider failure] ${JSON.stringify({
              operation: "transcription",
              provider: transcriber.providerName ?? "custom",
              kind: failure.kind,
              ...(failure.status === undefined ? {} : { status: failure.status }),
              durationMs: boundedSpeakingDurationMs(transcriptionStartedAt),
              audioBytes: parsed.audio?.byteLength ?? 0,
              audioDurationMs: parsed.audioDurationMs,
              mimeType: parsed.mimeType
            })}`);
            res.status(503).json(transcriptionFailureResponse(failure.kind));
            return;
          } finally {
            latency.transcriptionMs = boundedSpeakingDurationMs(transcriptionStartedAt);
          }
          currentSession = await expireSessionIfNeeded({ ...access, session: currentSession });
          if (currentSession.status !== "active") {
            res.status(currentSession.status === "expired" || currentSession.status === "ended" ? 410 : 409).json({ error: currentSession.status === "paused" ? "Your teacher paused the activity." : "This speaking activity is no longer accepting turns." });
            return;
          }
          const studentText = transcription.text.trim().slice(0, SPEAKING_LIMITS.turnText);
          if (!studentText) {
            res.status(422).json({ error: "I couldn’t hear any speech. Please say a short sentence and try again." });
            return;
          }
          const turnCreatedAt = deps.now();
          const studentPersistenceStartedAt = performance.now();
          try {
            studentTurn = await repository.appendTurn({
              id: deps.id(),
              participantId: access.participant.id,
              sessionId: access.session.id,
              speaker: "student",
              text: studentText,
              createdAt: turnCreatedAt,
              ...(parsed.audio && parsed.audioDurationMs !== undefined ? { audioDurationMs: parsed.audioDurationMs } : {}),
              responseTimeMs: Math.max(0, Date.parse(turnCreatedAt) - Math.max(0, Date.parse(existingTurns.filter((turn) => turn.speaker === "ai").at(-1)?.createdAt ?? turnCreatedAt))),
              usedHelp: currentParticipant.helpPending,
              ...(transcription.confidence === undefined ? {} : { transcriptionConfidence: transcription.confidence }),
              ...(requestId ? { requestId } : {})
            });
            await repository.updateParticipant(currentParticipant.id, { status: "in_progress", helpPending: false });
          } finally {
            latency.studentPersistenceMs = boundedSpeakingDurationMs(studentPersistenceStartedAt);
          }
          // The participant turn lock prevents another turn from being appended
          // while this request is running, so the already-loaded ordered list is
          // safe to extend locally and avoids another full listTurns query.
          turnsForConversation = [...existingTurns, studentTurn];
        }
        let aiTurn = previous?.aiTurn;
        if (!aiTurn) {
          const promptStartedAt = performance.now();
          const prompt = buildConversationPrompt({ activity: access.activity, turns: turnsForConversation, latestStudentText: studentTurn.text });
          latency.promptPreparationMs = boundedSpeakingDurationMs(promptStartedAt);
          let responseText: string;
          const conversationStartedAt = performance.now();
          try {
            responseText = (await conversationProvider.respond({ activity: access.activity, turns: turnsForConversation, studentText: studentTurn.text, prompt })).trim().slice(0, 280);
          } catch {
            res.status(503).json({ error: "I couldn’t answer just now. Please tap Retry." });
            return;
          } finally {
            latency.conversationMs = boundedSpeakingDurationMs(conversationStartedAt);
          }
          if (!responseText) {
            res.status(503).json({ error: "I couldn’t answer just now. Please tap Retry." });
            return;
          }
          const aiPersistenceStartedAt = performance.now();
          try {
            aiTurn = await repository.appendTurn({ id: deps.id(), participantId: access.participant.id, sessionId: access.session.id, speaker: "ai", text: responseText, createdAt: deps.now() });
          } finally {
            latency.aiPersistenceMs = boundedSpeakingDurationMs(aiPersistenceStartedAt);
          }
        }
        const latestSession = await repository.getSession(access.session.id);
        res.json({ studentTurn, aiTurn, session: sessionPayload(latestSession?.session ?? currentSession), ...latencyResponse() });
      } finally {
        latency.totalMs = boundedSpeakingDurationMs(turnStartedAt);
        if (latencyDebug) logSpeakingLatency(latency);
      }
    });
  });

  app.post("/api/speaking/sessions/:sessionId/help", async (req, res) => {
    const access = await getParticipantAccess(req);
    if (!access || access.session.id !== String(req.params.sessionId)) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    if (!allowRequest(state, `help:${hashSpeakingToken(parseParticipantToken(req) ?? "")}`, 30)) {
      res.status(429).json({ error: "Please wait a moment before asking for another hint." });
      return;
    }
    const currentSession = await expireSessionIfNeeded(access);
    if (currentSession.status === "paused") {
      res.status(409).json({ error: "Your teacher paused the activity." });
      return;
    }
    if (currentSession.status !== "active") {
      res.status(409).json({ error: currentSession.status === "ready" ? "Waiting for your teacher to start the activity." : "Help is not available after the activity is finished." });
      return;
    }
    const participant = await repository.getParticipant(access.participant.id) ?? access.participant;
    if (participant.helpCount >= SPEAKING_LIMITS.maxHelpCalls) {
      res.status(429).json({ error: "You have reached the Help limit for this activity." });
      return;
    }
    const turns = await repository.listTurns(participant.id);
    try {
      const hint = await helpProvider.hint({ activity: access.activity, turns, latestStudentText: [...turns].reverse().find((turn) => turn.speaker === "student")?.text });
      const updated = await repository.updateParticipant(participant.id, { helpCount: participant.helpCount + 1, helpPending: true });
      res.json({ ...hint, helpCount: updated?.helpCount ?? participant.helpCount + 1 });
    } catch {
      res.status(503).json({ error: "Help is temporarily unavailable. Please try again." });
    }
  });

  app.post("/api/speaking/sessions/:sessionId/finish", async (req, res) => {
    const access = await getParticipantAccess(req);
    if (!access || access.session.id !== String(req.params.sessionId)) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    return withTurnLock(access.participant.id, async () => {
      if (!allowRequest(state, `finish:${hashSpeakingToken(parseParticipantToken(req) ?? "")}`, 5)) {
        res.status(429).json({ error: "Please wait while the result is prepared." });
        return;
      }
      const currentSession = await expireSessionIfNeeded(access);
      if (currentSession.status === "ready") {
        res.status(409).json({ error: "Waiting for your teacher to start the activity." });
        return;
      }
      const evaluation = await finishParticipant({ ...access, session: currentSession });
      if (!evaluation) {
        res.status(503).json({ error: "The result could not be prepared yet. Please try again." });
        return;
      }
      const result = await repository.getResult(access.participant.id);
      if (!result) {
        res.status(404).json({ error: "We couldn’t find that speaking result." });
        return;
      }
      res.json({ result: safeResult(toResult(result.activity, result.session, result.participant, result.turns, result.evaluation)) });
    });
  });

  app.get("/api/speaking/activities/:activityId/results", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const activity = await requireOwnedActivity(req, res);
    if (!activity) return;
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    if (!sessionId) {
      const sessions = await repository.listSessions(activity.id, req.user!.id);
      const currentSessions = await Promise.all(sessions.map(async (session) => expireSessionIfNeeded({ activity, session })));
      res.json({ activity: publicActivity(activity), sessions: currentSessions.map(sessionPayload), items: [] });
      return;
    }
    const sessionAccess = await repository.getSession(sessionId);
    if (!sessionAccess || sessionAccess.activity.id !== activity.id || sessionAccess.activity.teacherId !== req.user!.id) {
      res.status(404).json({ error: "We couldn’t find that speaking session." });
      return;
    }
    const session = await expireSessionIfNeeded(sessionAccess);
    const items = await repository.listResults(activity.id, sessionId, req.user!.id);
    res.json({ activity: publicActivity(activity), session: sessionPayload(session), items: items.map((item) => ({ participant: publicParticipant(item.participant), status: item.participant.status, durationSeconds: item.participant.startedAt ? Math.max(0, Math.round(participantActiveElapsedMs(item.participant, session, item.participant.finishedAt ?? session.endedAt ?? deps.now()) / 1_000)) : 0, overallScore: item.overallScore, helpCount: item.participant.helpCount, evaluation: item.evaluation })) });
  });

  app.get("/api/speaking/sessions/:sessionId/results", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const sessionAccess = await repository.getSession(String(req.params.sessionId));
    if (!sessionAccess || sessionAccess.activity.teacherId !== req.user?.id) {
      res.status(404).json({ error: "We couldn’t find that speaking session." });
      return;
    }
    const session = await expireSessionIfNeeded(sessionAccess);
    const items = await repository.listResults(sessionAccess.activity.id, sessionAccess.session.id, req.user!.id);
    res.json({ activity: publicActivity(sessionAccess.activity), session: sessionPayload(session), items: items.map((item) => ({ participant: publicParticipant(item.participant), status: item.participant.status, durationSeconds: item.participant.startedAt ? Math.max(0, Math.round(participantActiveElapsedMs(item.participant, session, item.participant.finishedAt ?? session.endedAt ?? deps.now()) / 1_000)) : 0, overallScore: item.overallScore, helpCount: item.participant.helpCount, evaluation: item.evaluation })) });
  });

  // A result URL is never sufficient by itself. Student access still requires
  // their opaque Speaking token; otherwise the existing teacher JWT is used.
  app.use("/api/speaking/results/:participantId", (req, res, next: NextFunction) => {
    if (parseParticipantToken(req)) return next();
    return deps.requireTeacher(req, res, next);
  });

  app.get("/api/speaking/results/:participantId", async (req: AuthedRequest, res) => {
    const result = await repository.getResult(String(req.params.participantId));
    if (!result) {
      res.status(404).json({ error: "We couldn’t find that speaking result." });
      return;
    }
    const token = parseParticipantToken(req);
    const ownsParticipant = token ? Boolean((await repository.getParticipantAccessByTokenHash(hashSpeakingToken(token)))?.participant.id === result.participant.id) : false;
    if (!ownsParticipant && result.activity.teacherId !== req.user?.id) {
      res.status(403).json({ error: "You do not have access to this speaking result." });
      return;
    }
    res.json({ result: safeResult(toResult(result.activity, result.session, result.participant, result.turns, result.evaluation)) });
  });

  return state;
};

export { createState as createSpeakingRouteState };
