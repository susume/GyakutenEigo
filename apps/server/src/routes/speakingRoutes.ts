import express, { type Application, type NextFunction, type Request, type Response } from "express";
import {
  DEFAULT_SPEAKING_RUBRIC,
  SPEAKING_LIMITS,
  SpeakingCreateActivityInputSchema,
  SpeakingEvaluationSchema,
  SpeakingJoinInputSchema,
  SpeakingTurnInputSchema,
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
import {
  mockConversationProvider,
  mockEvaluationProvider,
  mockHelpProvider,
  mockTranscriptionProvider,
  type ConversationProvider,
  type EvaluationProvider,
  type TranscriptionResult
} from "../speakingProviders.js";

type AuthedRequest = Request & { user?: TeacherUser };

type SpeakingSessionRecord = SpeakingSession & {
  turns: SpeakingTurn[];
  evaluation?: SpeakingEvaluation;
  lastAiAtMs: number;
  pendingHelp: boolean;
  turnRequests: Map<string, TurnResponse>;
};

type TurnResponse = {
  studentTurn: SpeakingTurn;
  aiTurn: SpeakingTurn;
  session: SpeakingSession;
};

export type SpeakingRouteState = {
  activities: Map<string, SpeakingActivity>;
  participants: Map<string, SpeakingParticipant>;
  sessions: Map<string, SpeakingSessionRecord>;
  tokenToParticipant: Map<string, string>;
  requestWindows: Map<string, { startedAtMs: number; count: number }>;
};

export type SpeakingRouteDependencies = {
  requireTeacher: (req: Request, res: Response, next: () => void) => void;
  now: () => string;
  id: () => string;
  state?: SpeakingRouteState;
  transcriber?: { transcribe(input: { text?: string; hasAudio?: boolean }): Promise<TranscriptionResult> };
  conversationProvider?: ConversationProvider;
  evaluationProvider?: EvaluationProvider;
};

const makeState = (): SpeakingRouteState => ({
  activities: new Map(),
  participants: new Map(),
  sessions: new Map(),
  tokenToParticipant: new Map(),
  requestWindows: new Map()
});

const cloneRubric = () => DEFAULT_SPEAKING_RUBRIC.map((criterion) => ({ ...criterion }));

const templateInputs: Array<SpeakingCreateActivityInput & { id: string; joinCode: string }> = [
  {
    id: "template-restaurant",
    joinCode: "EAT456",
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
    joinCode: "ABC123",
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
    joinCode: "MAP789",
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
    joinCode: "PLAY12",
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
    joinCode: "PLAN34",
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
    joinCode: "HELLO5",
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

const makeTemplate = (input: ArrayElement<typeof templateInputs>, now: string): SpeakingActivity => ({
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
  joinCode: input.joinCode,
  status: "ready",
  identifierMode: input.identifierMode,
  targetExpressions: [...input.targetExpressions],
  rubric: input.rubric.map((criterion) => ({ ...criterion })),
  createdAt: now,
  updatedAt: now
});

type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

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

const toResult = (activity: SpeakingActivity, session: SpeakingSessionRecord, participant: SpeakingParticipant): SpeakingParticipantResult => ({
  participant: participant,
  activity: activitySummary(activity),
  turns: session.turns,
  ...(session.evaluation ? { evaluation: session.evaluation } : {})
});

const safeResult = (result: SpeakingParticipantResult) => ({
  ...result,
  participant: publicParticipant(result.participant)
});

const makeJoinCode = (state: SpeakingRouteState) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
    if ([...state.activities.values()].every((activity) => activity.joinCode !== code)) return code;
  }
  throw new Error("Could not allocate a unique speaking activity code.");
};

const secureToken = () => randomBytes(32).toString("base64url");

const normalizeIdentifier = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 80) : "";

const formatError = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "activity"}: ${issue.message}`).join("; ");

const parseSessionToken = (state: SpeakingRouteState, req: Request) => {
  const token = req.header("X-Speaking-Token")?.trim();
  const participantId = token ? state.tokenToParticipant.get(token) : undefined;
  if (!token || !participantId) return undefined;
  const participant = state.participants.get(participantId);
  const session = participant?.sessionId ? state.sessions.get(participant.sessionId) : undefined;
  return participant && session ? { token, participant, session } : undefined;
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

const initialGreeting = (activity: SpeakingActivity) =>
  activity.title.toLowerCase().includes("restaurant")
    ? "Hello! What would you like to order?"
    : activity.title.toLowerCase().includes("direction")
      ? "Hello! Can I help you find a place?"
      : activity.title.toLowerCase().includes("shopping") || activity.title.toLowerCase().includes("clothes")
        ? "Hi! Can I help you today?"
        : "Hi! Nice to meet you. Can we talk?";

const sessionPayload = (session: SpeakingSessionRecord) => ({
  id: session.id,
  activityId: session.activityId,
  participantId: session.participantId,
  status: session.status,
  startedAt: session.startedAt,
  ...(session.endedAt ? { endedAt: session.endedAt } : {})
});

const requestTextAndAudio = (req: Request) => {
  const isAudio = Buffer.isBuffer(req.body) || (req.header("content-type") ?? "").toLowerCase().startsWith("audio/");
  const text = req.body && !Buffer.isBuffer(req.body) && typeof req.body === "object"
    ? (req.body as { text?: unknown }).text
    : undefined;
  return { isAudio, text: typeof text === "string" ? text : undefined };
};

export const registerSpeakingRoutes = (app: Application, deps: SpeakingRouteDependencies) => {
  const state = deps.state ?? makeState();
  const transcriber = deps.transcriber ?? mockTranscriptionProvider;
  const conversationProvider = deps.conversationProvider ?? mockConversationProvider;
  const evaluationProvider = deps.evaluationProvider ?? mockEvaluationProvider;
  const templates = templateInputs.map((input) => makeTemplate(input, deps.now()));

  // Express's JSON parser deliberately skips audio/* requests. Parse those
  // only on the turn endpoint and cap the body so raw recordings are never
  // retained or forwarded accidentally.
  app.use("/api/speaking/sessions/:sessionId/turn", express.raw({ type: ["audio/*", "application/octet-stream"], limit: "4mb" }));

  const requireOwnedActivity = (req: AuthedRequest, res: Response) => {
    const activity = state.activities.get(String(req.params.activityId ?? req.params.id));
    if (!activity || activity.teacherId !== req.user?.id) {
      res.status(404).json({ error: "We couldn’t find that speaking activity." });
      return undefined;
    }
    return activity;
  };

  const finishSession = async (activity: SpeakingActivity, participant: SpeakingParticipant, session: SpeakingSessionRecord) => {
    if (session.evaluation) return session.evaluation;
    if (participant.status === "evaluating") return undefined;
    participant.status = "evaluating";
    try {
      const evaluation = await evaluationProvider.evaluate({ activity, turns: session.turns, participantId: participant.id });
      const parsed = SpeakingEvaluationSchema.safeParse(evaluation);
      if (!parsed.success) throw new Error("Evaluation provider returned invalid data.");
      session.evaluation = parsed.data as SpeakingEvaluation;
      participant.status = "completed";
      participant.finishedAt = deps.now();
      session.status = "completed";
      session.endedAt = participant.finishedAt;
      return session.evaluation;
    } catch {
      participant.status = "error";
      session.status = "active";
      return undefined;
    }
  };

  app.get("/api/speaking/templates", (_req, res) => {
    res.json({ items: templates.map(publicActivity) });
  });

  app.get("/api/speaking/activities", deps.requireTeacher, (req: AuthedRequest, res) => {
    res.json({ items: [...state.activities.values()].filter((activity) => activity.teacherId === req.user?.id).map(publicActivity) });
  });

  app.post("/api/speaking/activities", deps.requireTeacher, (req: AuthedRequest, res) => {
    const parsed = SpeakingCreateActivityInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Check the activity details. ${formatError(parsed.error.issues)}` });
      return;
    }
    const input = parsed.data as SpeakingCreateActivityInput;
    const now = deps.now();
    const activity: SpeakingActivity = {
      id: deps.id(),
      teacherId: req.user!.id,
      title: input.title,
      scenario: input.scenario,
      aiRole: input.aiRole,
      studentRole: input.studentRole,
      level: input.level,
      difficulty: input.difficulty,
      nativeLanguage: input.nativeLanguage,
      durationSeconds: input.durationSeconds,
      joinCode: makeJoinCode(state),
      status: "ready",
      identifierMode: input.identifierMode,
      targetExpressions: input.targetExpressions.slice(0, SPEAKING_LIMITS.expressions),
      rubric: input.rubric.filter((criterion) => criterion.enabled).slice(0, SPEAKING_LIMITS.rubricCriteria),
      createdAt: now,
      updatedAt: now
    };
    state.activities.set(activity.id, activity);
    res.status(201).json({ activity: publicActivity(activity) });
  });

  app.get("/api/speaking/activities/:activityId", deps.requireTeacher, (req: AuthedRequest, res) => {
    const activity = requireOwnedActivity(req, res);
    if (!activity) return;
    res.json({ activity: publicActivity(activity) });
  });

  const updateActivityStatus = (status: SpeakingActivity["status"]) => (req: AuthedRequest, res: Response) => {
    const activity = requireOwnedActivity(req, res);
    if (!activity) return;
    if (status === "active" && activity.status === "ended") {
      res.status(400).json({ error: "This activity has ended and cannot be activated again." });
      return;
    }
    activity.status = status;
    activity.updatedAt = deps.now();
    res.json({ activity: publicActivity(activity) });
  };

  app.post("/api/speaking/activities/:activityId/activate", deps.requireTeacher, updateActivityStatus("active"));
  app.post("/api/speaking/activities/:activityId/end", deps.requireTeacher, updateActivityStatus("ended"));

  app.post("/api/speaking/join", (req, res) => {
    const parsed = SpeakingJoinInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter the six-character activity code." });
      return;
    }
    if (!allowRequest(state, `join:${req.ip}`, 30)) {
      res.status(429).json({ error: "Too many join attempts. Please wait a moment." });
      return;
    }
    const activity = [...state.activities.values()].find((item) => item.joinCode === parsed.data.code && item.status !== "ended")
      ?? templates.find((item) => item.joinCode === parsed.data.code);
    if (!activity) {
      res.status(404).json({ error: "We couldn’t find that activity. Check the code and try again." });
      return;
    }
    const identifier = normalizeIdentifier(parsed.data.identifier);
    if (activity.identifierMode !== "anonymous" && identifier.length < 2) {
      res.status(400).json({ error: activity.identifierMode === "student_number" ? "Enter your student number." : "Enter a nickname." });
      return;
    }
    const participantId = deps.id();
    const anonymousToken = secureToken();
    const startedAt = deps.now();
    const participant: SpeakingParticipant = {
      id: participantId,
      activityId: activity.id,
      sessionId: deps.id(),
      ...(activity.identifierMode === "anonymous" ? {} : { displayIdentifier: identifier }),
      anonymousToken,
      startedAt,
      status: "joined",
      helpCount: 0
    };
    const sessionId = participant.sessionId!;
    const greeting: SpeakingTurn = {
      id: deps.id(),
      participantId,
      speaker: "ai",
      text: initialGreeting(activity),
      createdAt: startedAt
    };
    const session: SpeakingSessionRecord = {
      id: sessionId,
      activityId: activity.id,
      participantId,
      status: "ready",
      startedAt,
      turns: [greeting],
      lastAiAtMs: Date.now(),
      pendingHelp: false,
      turnRequests: new Map()
    };
    state.participants.set(participant.id, participant);
    state.sessions.set(session.id, session);
    state.tokenToParticipant.set(anonymousToken, participant.id);
    res.status(201).json({
      activity: publicActivity(activity),
      participant: publicParticipant(participant),
      session: sessionPayload(session),
      token: anonymousToken
    });
  });

  app.get("/api/speaking/sessions/:sessionId", async (req, res) => {
    const access = parseSessionToken(state, req);
    const session = state.sessions.get(String(req.params.sessionId));
    if (!access || !session || access.session.id !== session.id) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    const activity = state.activities.get(session.activityId) ?? templates.find((item) => item.id === session.activityId);
    if (!activity) {
      res.status(404).json({ error: "The speaking activity is no longer available." });
      return;
    }
    if (session.status === "ready") {
      const elapsed = Date.now() - Date.parse(session.startedAt);
      if (elapsed > activity.durationSeconds * 1_000) {
        session.status = "expired";
        access.participant.status = "completed";
        access.participant.finishedAt = deps.now();
      }
    }
    res.json({
      activity: publicActivity(activity),
      participant: publicParticipant(access.participant),
      session: sessionPayload(session),
      turns: session.turns
    });
  });

  app.post("/api/speaking/sessions/:sessionId/turn", async (req, res) => {
    const access = parseSessionToken(state, req);
    const session = state.sessions.get(String(req.params.sessionId));
    if (!access || !session || access.session.id !== session.id) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    if (!allowRequest(state, `turn:${access.token}`, 45)) {
      res.status(429).json({ error: "Please wait a moment before speaking again." });
      return;
    }
    if (session.status === "completed" || access.participant.status === "completed") {
      res.status(409).json({ error: "This speaking activity is already finished." });
      return;
    }
    if (access.participant.status === "evaluating" || access.participant.status === "error") {
      res.status(409).json({ error: "This speaking activity is finishing. Please try the result screen." });
      return;
    }
    const activity = state.activities.get(session.activityId) ?? templates.find((item) => item.id === session.activityId);
    if (!activity) {
      res.status(404).json({ error: "The speaking activity is no longer available." });
      return;
    }
    const requestId = req.header("X-Speaking-Turn-Id")?.trim();
    if (requestId && requestId.length <= 120) {
      const previous = session.turnRequests.get(requestId);
      if (previous) {
        res.json(previous);
        return;
      }
    }
    if (session.turns.filter((turn) => turn.speaker === "student").length >= SPEAKING_LIMITS.maxTurns) {
      res.status(409).json({ error: "This activity has reached its speaking turn limit." });
      return;
    }
    const { isAudio, text } = requestTextAndAudio(req);
    const input = SpeakingTurnInputSchema.safeParse(text === undefined ? {} : { text });
    if (!input.success && !isAudio) {
      res.status(400).json({ error: "I couldn’t hear that clearly. Please try again." });
      return;
    }
    const transcription = await transcriber.transcribe({ text: input.success ? input.data.text : undefined, hasAudio: isAudio });
    const studentText = transcription.text.trim().slice(0, SPEAKING_LIMITS.turnText);
    if (!studentText) {
      res.status(422).json({ error: "I couldn’t hear that clearly. Please try again." });
      return;
    }
    access.participant.status = "in_progress";
    session.status = "active";
    const createdAt = deps.now();
    const studentTurn: SpeakingTurn = {
      id: deps.id(),
      participantId: access.participant.id,
      speaker: "student",
      text: studentText,
      createdAt,
      responseTimeMs: Math.max(0, Date.now() - session.lastAiAtMs),
      usedHelp: session.pendingHelp,
      transcriptionConfidence: transcription.confidence
    };
    session.pendingHelp = false;
    session.turns.push(studentTurn);
    const responseText = await conversationProvider.respond({ activity, turns: session.turns, studentText });
    const aiTurn: SpeakingTurn = {
      id: deps.id(),
      participantId: access.participant.id,
      speaker: "ai",
      text: responseText.trim().slice(0, 280),
      createdAt: deps.now()
    };
    session.turns.push(aiTurn);
    session.lastAiAtMs = Date.now();
    const response: TurnResponse = { studentTurn, aiTurn, session: sessionPayload(session) };
    if (requestId && requestId.length <= 120) session.turnRequests.set(requestId, response);
    res.json(response);
  });

  app.post("/api/speaking/sessions/:sessionId/help", async (req, res) => {
    const access = parseSessionToken(state, req);
    const session = state.sessions.get(String(req.params.sessionId));
    if (!access || !session || access.session.id !== session.id) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    if (!allowRequest(state, `help:${access.token}`, 30)) {
      res.status(429).json({ error: "Please wait a moment before asking for another hint." });
      return;
    }
    const activity = state.activities.get(session.activityId) ?? templates.find((item) => item.id === session.activityId);
    if (!activity || session.status === "completed") {
      res.status(409).json({ error: "Help is not available after the activity is finished." });
      return;
    }
    const latestStudentText = [...session.turns].reverse().find((turn) => turn.speaker === "student")?.text;
    const hint = await mockHelpProvider.hint({ activity, latestStudentText });
    access.participant.helpCount = Math.min(20, access.participant.helpCount + 1);
    session.pendingHelp = true;
    res.json({ ...hint, helpCount: access.participant.helpCount });
  });

  app.post("/api/speaking/sessions/:sessionId/finish", async (req, res) => {
    const access = parseSessionToken(state, req);
    const session = state.sessions.get(String(req.params.sessionId));
    if (!access || !session || access.session.id !== session.id) {
      res.status(401).json({ error: "This speaking session is no longer available." });
      return;
    }
    if (!allowRequest(state, `finish:${access.token}`, 5)) {
      res.status(429).json({ error: "Please wait while the result is prepared." });
      return;
    }
    const activity = state.activities.get(session.activityId) ?? templates.find((item) => item.id === session.activityId);
    if (!activity) {
      res.status(404).json({ error: "The speaking activity is no longer available." });
      return;
    }
    if (!session.evaluation) await finishSession(activity, access.participant, session);
    if (!session.evaluation) {
      res.status(503).json({ error: "The result could not be prepared yet. Please try again." });
      return;
    }
    res.json({ result: safeResult(toResult(activity, session, access.participant)) });
  });

  app.get("/api/speaking/activities/:activityId/results", deps.requireTeacher, (req: AuthedRequest, res) => {
    const activity = requireOwnedActivity(req, res);
    if (!activity) return;
    const items = [...state.sessions.values()]
      .filter((session) => session.activityId === activity.id)
      .map((session) => {
        const participant = state.participants.get(session.participantId);
        if (!participant) return undefined;
        const evaluation = session.evaluation;
        const scoreValues = evaluation ? Object.values(evaluation.scores) : [];
        const overallScore = scoreValues.length > 0 ? Math.round((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) * 25) : undefined;
        return {
          participant: publicParticipant(participant),
          status: participant.status,
          durationSeconds: Math.max(0, Math.round(((Date.parse(participant.finishedAt ?? deps.now()) - Date.parse(participant.startedAt)) / 1_000))),
          overallScore,
          helpCount: participant.helpCount,
          evaluation
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    res.json({ activity: publicActivity(activity), items });
  });

  // Result access may be either a student token or the existing teacher JWT.
  // Keep the JWT middleware on a small optional path so anonymous students are
  // never asked to create an account.
  app.use("/api/speaking/results/:participantId", (req, res, next: NextFunction) => {
    if (req.header("X-Speaking-Token")) return next();
    return deps.requireTeacher(req, res, next);
  });

  app.get("/api/speaking/results/:participantId", (req, res) => {
    const participant = state.participants.get(String(req.params.participantId));
    const session = participant?.sessionId ? state.sessions.get(participant.sessionId) : undefined;
    const activity = participant ? state.activities.get(participant.activityId) ?? templates.find((item) => item.id === participant.activityId) : undefined;
    if (!participant || !session || !activity) {
      res.status(404).json({ error: "We couldn’t find that speaking result." });
      return;
    }
    const playerToken = req.header("X-Speaking-Token")?.trim();
    const ownsParticipant = playerToken && state.tokenToParticipant.get(playerToken) === participant.id;
    const teacher = (req as AuthedRequest).user;
    if (!ownsParticipant && (!teacher || teacher.id !== activity.teacherId)) {
      res.status(403).json({ error: "You do not have access to this speaking result." });
      return;
    }
    if (!session.evaluation) {
      res.status(409).json({ error: "This speaking activity has not been evaluated yet." });
      return;
    }
    res.json({ result: safeResult(toResult(activity, session, participant)) });
  });

  return state;
};

export { makeState as createSpeakingRouteState };
