import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  SPEAKING_LIMITS,
  speakingOverallScore,
  type SpeakingActivity,
  type SpeakingCreateActivityInput,
  type SpeakingEvaluation,
  type SpeakingParticipant,
  type SpeakingParticipantStatus,
  type SpeakingRubricCriterion,
  type SpeakingSession,
  type SpeakingSessionStatus,
  type SpeakingTurn
} from "@quizstrike/shared";

export type SpeakingActivitySnapshot = Pick<
  SpeakingActivity,
  | "title"
  | "scenario"
  | "aiRole"
  | "studentRole"
  | "level"
  | "difficulty"
  | "nativeLanguage"
  | "durationSeconds"
  | "identifierMode"
  | "targetExpressions"
  | "rubric"
>;

export type StoredSpeakingParticipant = SpeakingParticipant & {
  tokenHash: string;
  helpPending: boolean;
};

export type SpeakingSessionAccess = {
  session: SpeakingSession;
  activity: SpeakingActivity;
};

export type SpeakingResultRecord = {
  session: SpeakingSession;
  participant: SpeakingParticipant;
  activity: SpeakingActivity;
  turns: SpeakingTurn[];
  evaluation?: SpeakingEvaluation;
};

export type SpeakingTurnPair = {
  studentTurn: SpeakingTurn;
  aiTurn?: SpeakingTurn;
};

const turnPairForRequest = (turns: SpeakingTurn[], requestId: string): SpeakingTurnPair | undefined => {
  const studentIndex = turns.findIndex((turn) => turn.speaker === "student" && turn.requestId === requestId);
  if (studentIndex < 0) return undefined;
  const followingTurns = turns.slice(studentIndex + 1);
  const nextStudentIndex = followingTurns.findIndex((turn) => turn.speaker === "student");
  const aiTurn = followingTurns.slice(0, nextStudentIndex < 0 ? followingTurns.length : nextStudentIndex).find((turn) => turn.speaker === "ai");
  return { studentTurn: turns[studentIndex]!, ...(aiTurn ? { aiTurn } : {}) };
};

export const findSpeakingTurnPair = (turns: SpeakingTurn[], requestId: string) => turnPairForRequest(turns, requestId);

export interface SpeakingRepository {
  listActivities(teacherId: string): Promise<SpeakingActivity[]>;
  getActivity(id: string): Promise<SpeakingActivity | undefined>;
  getOwnedActivity(id: string, teacherId: string): Promise<SpeakingActivity | undefined>;
  createActivity(teacherId: string, input: SpeakingCreateActivityInput, id: string, now: string): Promise<SpeakingActivity>;
  updateActivity(teacherId: string, activityId: string, input: SpeakingCreateActivityInput, now: string): Promise<SpeakingActivity | undefined>;
  isJoinCodeTaken(joinCode: string): Promise<boolean>;
  createSession(input: {
    id: string;
    activity: SpeakingActivity;
    joinCode: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<SpeakingSession>;
  getSession(id: string): Promise<SpeakingSessionAccess | undefined>;
  findJoinableSession(joinCode: string, now: string): Promise<SpeakingSessionAccess | undefined>;
  listSessions(activityId: string, teacherId: string): Promise<SpeakingSession[]>;
  createParticipant(input: {
    id: string;
    activity: SpeakingActivity;
    session: SpeakingSession;
    displayIdentifier?: string;
    tokenHash: string;
  }): Promise<SpeakingParticipant>;
  getParticipant(id: string): Promise<StoredSpeakingParticipant | undefined>;
  getParticipantAccessByTokenHash(tokenHash: string): Promise<(SpeakingSessionAccess & { participant: StoredSpeakingParticipant }) | undefined>;
  startParticipant(participantId: string, startedAt: string): Promise<SpeakingParticipant | undefined>;
  updateParticipant(participantId: string, patch: { status?: SpeakingParticipantStatus; finishedAt?: string | null; helpPending?: boolean; helpCount?: number }): Promise<SpeakingParticipant | undefined>;
  updateSession(sessionId: string, patch: { status?: SpeakingSessionStatus; startedAt?: string | null; pausedAt?: string | null; endedAt?: string | null }): Promise<SpeakingSession | undefined>;
  /** Finalize a currently open pause and add its duration to affected participants. */
  finalizeSessionPause(sessionId: string, pausedUntil: string): Promise<SpeakingSession | undefined>;
  listTurns(participantId: string): Promise<SpeakingTurn[]>;
  findTurnPair(participantId: string, requestId: string): Promise<SpeakingTurnPair | undefined>;
  /** sessionId is supplied by the already-authorized route to avoid a redundant participant lookup. */
  appendTurn(input: Omit<SpeakingTurn, "id"> & { id: string; requestId?: string; sessionId?: string }): Promise<SpeakingTurn>;
  saveEvaluation(participantId: string, evaluation: SpeakingEvaluation): Promise<SpeakingEvaluation>;
  getResult(participantId: string): Promise<SpeakingResultRecord | undefined>;
  listResults(activityId: string, sessionId: string, teacherId: string): Promise<Array<SpeakingResultRecord & { overallScore?: number }>>;
}

export type InMemorySpeakingState = {
  activities: Map<string, SpeakingActivity>;
  participants: Map<string, StoredSpeakingParticipant>;
  sessions: Map<string, InMemorySession>;
  tokenToParticipant: Map<string, string>;
};

export type InMemorySession = SpeakingSession & {
  activitySnapshot: SpeakingActivitySnapshot;
  turns: SpeakingTurn[];
  evaluations: Map<string, SpeakingEvaluation>;
};

export const createInMemorySpeakingState = (): InMemorySpeakingState => ({
  activities: new Map(),
  participants: new Map(),
  sessions: new Map(),
  tokenToParticipant: new Map()
});

export const hashSpeakingToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const snapshotActivity = (activity: SpeakingActivity): SpeakingActivitySnapshot => ({
  title: activity.title,
  scenario: activity.scenario,
  aiRole: activity.aiRole,
  studentRole: activity.studentRole,
  level: activity.level,
  difficulty: activity.difficulty,
  nativeLanguage: activity.nativeLanguage,
  durationSeconds: activity.durationSeconds,
  identifierMode: activity.identifierMode,
  targetExpressions: [...activity.targetExpressions],
  rubric: activity.rubric.map((criterion) => ({ ...criterion }))
});

const activityFromSnapshot = (activity: SpeakingActivity, snapshot: SpeakingActivitySnapshot): SpeakingActivity => ({
  ...activity,
  ...snapshot,
  targetExpressions: [...snapshot.targetExpressions],
  rubric: snapshot.rubric.map((criterion) => ({ ...criterion }))
});

const cloneActivity = (activity: SpeakingActivity): SpeakingActivity => ({
  ...activity,
  targetExpressions: [...activity.targetExpressions],
  rubric: activity.rubric.map((criterion) => ({ ...criterion }))
});

const cloneSession = (session: SpeakingSession): SpeakingSession => ({
  id: session.id,
  activityId: session.activityId,
  joinCode: session.joinCode,
  createdAt: session.createdAt,
  status: session.status,
  ...(session.startedAt ? { startedAt: session.startedAt } : {}),
  ...(session.pausedAt ? { pausedAt: session.pausedAt } : {}),
  ...(session.endedAt ? { endedAt: session.endedAt } : {}),
  expiresAt: session.expiresAt
});

const cloneParticipant = (participant: SpeakingParticipant): SpeakingParticipant => ({ ...participant });

const participantPublic = (participant: StoredSpeakingParticipant): SpeakingParticipant => {
  const { tokenHash: _tokenHash, helpPending: _helpPending, ...publicParticipant } = participant;
  return cloneParticipant(publicParticipant);
};

const normalizeActivityInput = (input: SpeakingCreateActivityInput, id: string, teacherId: string, now: string): SpeakingActivity => ({
  id,
  teacherId,
  title: input.title.trim().slice(0, SPEAKING_LIMITS.title),
  scenario: input.scenario.trim().slice(0, SPEAKING_LIMITS.scenario),
  aiRole: input.aiRole.trim().slice(0, SPEAKING_LIMITS.role),
  studentRole: input.studentRole.trim().slice(0, SPEAKING_LIMITS.role),
  level: input.level,
  difficulty: input.difficulty,
  nativeLanguage: input.nativeLanguage,
  durationSeconds: Math.min(SPEAKING_LIMITS.maxDurationSeconds, Math.max(120, Math.round(input.durationSeconds))),
  status: "ready",
  identifierMode: input.identifierMode,
  targetExpressions: input.targetExpressions.map((expression) => expression.trim().slice(0, SPEAKING_LIMITS.expression)).filter(Boolean).slice(0, SPEAKING_LIMITS.expressions),
  // Persist the complete teacher configuration. Evaluation filters enabled
  // criteria later, while historical session snapshots retain this exact list.
  rubric: input.rubric.slice(0, SPEAKING_LIMITS.rubricCriteria).map((criterion) => ({ ...criterion })),
  createdAt: now,
  updatedAt: now
});

const participantFromInput = (input: {
  id: string;
  activity: SpeakingActivity;
  session: SpeakingSession;
  displayIdentifier?: string;
  tokenHash: string;
}): StoredSpeakingParticipant => ({
  id: input.id,
  activityId: input.activity.id,
  sessionId: input.session.id,
  ...(input.displayIdentifier ? { displayIdentifier: input.displayIdentifier } : {}),
  startedAt: undefined,
  pausedDurationMs: 0,
  status: "joined",
  helpCount: 0,
  tokenHash: input.tokenHash,
  helpPending: false
});

export class InMemorySpeakingRepository implements SpeakingRepository {
  constructor(private readonly state: InMemorySpeakingState = createInMemorySpeakingState()) {}

  async listActivities(teacherId: string) {
    return [...this.state.activities.values()]
      .filter((activity) => activity.teacherId === teacherId)
      .map(cloneActivity);
  }

  async getActivity(id: string) {
    const activity = this.state.activities.get(id);
    return activity ? cloneActivity(activity) : undefined;
  }

  async getOwnedActivity(id: string, teacherId: string) {
    const activity = this.state.activities.get(id);
    return activity && activity.teacherId === teacherId ? cloneActivity(activity) : undefined;
  }

  async createActivity(teacherId: string, input: SpeakingCreateActivityInput, id: string, now: string) {
    const activity = normalizeActivityInput(input, id, teacherId, now);
    this.state.activities.set(id, activity);
    return cloneActivity(activity);
  }

  async updateActivity(teacherId: string, activityId: string, input: SpeakingCreateActivityInput, now: string) {
    const current = this.state.activities.get(activityId);
    if (!current || current.teacherId !== teacherId) return undefined;
    const normalized = normalizeActivityInput(input, activityId, teacherId, now);
    const activity = { ...normalized, status: current.status, createdAt: current.createdAt };
    this.state.activities.set(activityId, activity);
    return cloneActivity(activity);
  }

  async isJoinCodeTaken(joinCode: string) {
    return [...this.state.sessions.values()].some((session) => session.joinCode === joinCode);
  }

  async createSession(input: { id: string; activity: SpeakingActivity; joinCode: string; createdAt: string; expiresAt: string }) {
    const session: InMemorySession = {
      id: input.id,
      activityId: input.activity.id,
      joinCode: input.joinCode,
      status: "ready",
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      activitySnapshot: snapshotActivity(input.activity),
      turns: [],
      evaluations: new Map()
    };
    this.state.sessions.set(session.id, session);
    return cloneSession(session);
  }

  async getSession(id: string) {
    const session = this.state.sessions.get(id);
    const activity = session ? this.state.activities.get(session.activityId) : undefined;
    if (!session || !activity) return undefined;
    return { session: cloneSession(session), activity: activityFromSnapshot(cloneActivity(activity), session.activitySnapshot) };
  }

  async findJoinableSession(joinCode: string, now: string) {
    const session = [...this.state.sessions.values()].find((candidate) => candidate.joinCode === joinCode);
    if (!session || Date.parse(session.expiresAt) <= Date.parse(now) || !["ready", "active"].includes(session.status)) return undefined;
    return this.getSession(session.id);
  }

  async listSessions(activityId: string, teacherId: string) {
    const activity = this.state.activities.get(activityId);
    if (!activity || activity.teacherId !== teacherId) return [];
    return [...this.state.sessions.values()]
      .filter((session) => session.activityId === activityId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
      .map(cloneSession);
  }

  async createParticipant(input: { id: string; activity: SpeakingActivity; session: SpeakingSession; displayIdentifier?: string; tokenHash: string }) {
    const participant = participantFromInput(input);
    this.state.participants.set(participant.id, participant);
    this.state.tokenToParticipant.set(participant.tokenHash, participant.id);
    return participantPublic(participant);
  }

  async getParticipant(id: string) {
    const participant = this.state.participants.get(id);
    return participant ? { ...participant } : undefined;
  }

  async getParticipantAccessByTokenHash(tokenHash: string) {
    const participantId = this.state.tokenToParticipant.get(tokenHash);
    const participant = participantId ? this.state.participants.get(participantId) : undefined;
    if (!participant) return undefined;
    const access = await this.getSession(participant.sessionId!);
    return access ? { ...access, participant: { ...participant } } : undefined;
  }

  async startParticipant(participantId: string, startedAt: string) {
    const participant = this.state.participants.get(participantId);
    if (!participant) return undefined;
    if (!participant.startedAt) participant.startedAt = startedAt;
    if (participant.status === "joined") participant.status = "in_progress";
    return participantPublic(participant);
  }

  async updateParticipant(participantId: string, patch: { status?: SpeakingParticipantStatus; finishedAt?: string | null; helpPending?: boolean; helpCount?: number }) {
    const participant = this.state.participants.get(participantId);
    if (!participant) return undefined;
    Object.assign(participant, patch);
    return participantPublic(participant);
  }

  async updateSession(sessionId: string, patch: { status?: SpeakingSessionStatus; startedAt?: string | null; pausedAt?: string | null; endedAt?: string | null }) {
    const session = this.state.sessions.get(sessionId);
    if (!session) return undefined;
    Object.assign(session, patch);
    return cloneSession(session);
  }

  async finalizeSessionPause(sessionId: string, pausedUntil: string) {
    const session = this.state.sessions.get(sessionId);
    if (!session) return undefined;
    if (session.pausedAt) {
      const pauseStartedAtMs = Date.parse(session.pausedAt);
      const pauseEndedAtMs = Date.parse(pausedUntil);
      if (Number.isFinite(pauseStartedAtMs) && Number.isFinite(pauseEndedAtMs)) {
        for (const participant of this.state.participants.values()) {
          if (participant.sessionId !== sessionId || !participant.startedAt) continue;
          const participantStartedAtMs = Date.parse(participant.startedAt);
          const participantFinishedAtMs = participant.finishedAt ? Date.parse(participant.finishedAt) : pauseEndedAtMs;
          const overlapStartedAtMs = Math.max(pauseStartedAtMs, participantStartedAtMs);
          const overlapEndedAtMs = Math.min(pauseEndedAtMs, participantFinishedAtMs);
          const pausedDurationMs = Math.max(0, overlapEndedAtMs - overlapStartedAtMs);
          if (pausedDurationMs > 0) participant.pausedDurationMs = (participant.pausedDurationMs ?? 0) + pausedDurationMs;
        }
      }
      session.pausedAt = undefined;
    }
    return cloneSession(session);
  }

  async listTurns(participantId: string) {
    const participant = this.state.participants.get(participantId);
    const session = participant ? this.state.sessions.get(participant.sessionId!) : undefined;
    return session ? session.turns.filter((turn) => turn.participantId === participantId).map((turn) => ({ ...turn })) : [];
  }

  async findTurnPair(participantId: string, requestId: string) {
    const turns = await this.listTurns(participantId);
    return turnPairForRequest(turns, requestId);
  }

  async appendTurn(input: Omit<SpeakingTurn, "id"> & { id: string; requestId?: string; sessionId?: string }) {
    const participant = this.state.participants.get(input.participantId);
    const session = participant ? this.state.sessions.get(participant.sessionId!) : undefined;
    if (!session) throw new Error("Speaking participant session not found.");
    const turn = { ...input };
    session.turns.push(turn);
    return { ...turn };
  }

  async saveEvaluation(participantId: string, evaluation: SpeakingEvaluation) {
    const participant = this.state.participants.get(participantId);
    const session = participant ? this.state.sessions.get(participant.sessionId!) : undefined;
    if (!participant || !session) throw new Error("Speaking participant session not found.");
    session.evaluations.set(participantId, { ...evaluation });
    return { ...evaluation };
  }

  async getResult(participantId: string) {
    const participant = this.state.participants.get(participantId);
    const session = participant ? this.state.sessions.get(participant.sessionId!) : undefined;
    const activity = session ? this.state.activities.get(session.activityId) : undefined;
    if (!participant || !session || !activity) return undefined;
    const evaluation = session.evaluations.get(participantId);
    return {
      session: cloneSession(session),
      participant: participantPublic(participant),
      activity: activityFromSnapshot(cloneActivity(activity), session.activitySnapshot),
      turns: session.turns.filter((turn) => turn.participantId === participantId).map((turn) => ({ ...turn })),
      ...(evaluation ? { evaluation: { ...evaluation } } : {})
    };
  }

  async listResults(activityId: string, sessionId: string, teacherId: string) {
    const activity = this.state.activities.get(activityId);
    const session = this.state.sessions.get(sessionId);
    if (!activity || activity.teacherId !== teacherId || !session || session.activityId !== activityId) return [];
    const sessionActivity = activityFromSnapshot(cloneActivity(activity), session.activitySnapshot);
    return [...this.state.participants.values()]
      .filter((participant) => participant.sessionId === sessionId)
      .map((participant) => {
        const turns = session.turns.filter((turn) => turn.participantId === participant.id).map((turn) => ({ ...turn }));
        const evaluation = session.evaluations.get(participant.id);
        const overallScore = speakingOverallScore(evaluation);
        return { session: cloneSession(session), participant: participantPublic(participant), activity: sessionActivity, turns, ...(evaluation ? { evaluation } : {}), ...(overallScore === undefined ? {} : { overallScore }) };
      });
  }
}

type PrismaActivity = Prisma.SpeakingActivityGetPayload<{ include: { rubric: { orderBy: { position: "asc" } } } }>;
type PrismaSession = Prisma.SpeakingSessionGetPayload<{ include: { activity: { include: { rubric: { orderBy: { position: "asc" } } } } } }>;
type PrismaParticipantResult = Prisma.SpeakingParticipantGetPayload<{
  include: {
    session: { include: { activity: { include: { rubric: { orderBy: { position: "asc" } } } } } };
    turns: true;
    evaluation: true;
  };
}>;

const rubricFromJson = (value: Prisma.JsonValue): SpeakingRubricCriterion[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || typeof candidate.description !== "string") return [];
    return [{ id: candidate.id, name: candidate.name, description: candidate.description, enabled: candidate.enabled !== false }];
  });
};

const stringArrayFromJson = (value: Prisma.JsonValue): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const objectFromJson = (value: Prisma.JsonValue): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const snapshotFromJson = (value: Prisma.JsonValue, activity: SpeakingActivity): SpeakingActivitySnapshot => {
  const source = objectFromJson(value);
  return {
    title: typeof source.title === "string" ? source.title : activity.title,
    scenario: typeof source.scenario === "string" ? source.scenario : activity.scenario,
    aiRole: typeof source.aiRole === "string" ? source.aiRole : activity.aiRole,
    studentRole: typeof source.studentRole === "string" ? source.studentRole : activity.studentRole,
    level: source.level === "beginner" || source.level === "elementary" || source.level === "lower_intermediate" || source.level === "intermediate" ? source.level : activity.level,
    difficulty: source.difficulty === "easy" || source.difficulty === "normal" || source.difficulty === "challenge" ? source.difficulty : activity.difficulty,
    nativeLanguage: source.nativeLanguage === "en" ? "en" : "ja",
    durationSeconds: typeof source.durationSeconds === "number" ? source.durationSeconds : activity.durationSeconds,
    identifierMode: source.identifierMode === "anonymous" || source.identifierMode === "student_number" ? source.identifierMode : "nickname",
    targetExpressions: stringArrayFromJson((source.targetExpressions ?? activity.targetExpressions) as Prisma.JsonValue),
    rubric: rubricFromJson((source.rubric ?? activity.rubric) as Prisma.JsonValue)
  };
};

const toActivity = (row: PrismaActivity): SpeakingActivity => ({
  id: row.id,
  teacherId: row.teacherId,
  title: row.title,
  scenario: row.scenario,
  aiRole: row.aiRole,
  studentRole: row.studentRole,
  level: row.level as SpeakingActivity["level"],
  difficulty: row.difficulty,
  nativeLanguage: row.nativeLanguage,
  durationSeconds: row.durationSeconds,
  status: row.status === "archived" ? "archived" : row.status === "draft" ? "draft" : "ready",
  identifierMode: row.identifierMode,
  targetExpressions: stringArrayFromJson(row.targetExpressionsJson),
  rubric: row.rubric.map((criterion) => ({ id: criterion.criterionId, name: criterion.name, description: criterion.description, enabled: criterion.enabled })),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const toSession = (row: Pick<PrismaSession, "id" | "activityId" | "joinCode" | "status" | "createdAt" | "startedAt" | "pausedAt" | "endedAt" | "expiresAt">): SpeakingSession => ({
  id: row.id,
  activityId: row.activityId,
  joinCode: row.joinCode,
  status: row.status === "completed" ? "ended" : row.status,
  createdAt: row.createdAt.toISOString(),
  ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
  ...(row.pausedAt ? { pausedAt: row.pausedAt.toISOString() } : {}),
  ...(row.endedAt ? { endedAt: row.endedAt.toISOString() } : {}),
  expiresAt: row.expiresAt.toISOString()
});

const toParticipant = (row: { id: string; activityId: string; sessionId: string; displayIdentifier: string | null; startedAt: Date | null; finishedAt: Date | null; pausedDurationMs: number; status: string; helpCount: number }): SpeakingParticipant => ({
  id: row.id,
  activityId: row.activityId,
  sessionId: row.sessionId,
  ...(row.displayIdentifier ? { displayIdentifier: row.displayIdentifier } : {}),
  ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
  ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
  pausedDurationMs: Math.max(0, row.pausedDurationMs ?? 0),
  status: row.status as SpeakingParticipant["status"],
  helpCount: row.helpCount
});

const toTurn = (row: { id: string; participantId: string; speaker: string; text: string; createdAt: Date; audioDurationMs: number | null; responseTimeMs: number | null; usedHelp: boolean; transcriptionConfidence: number | null; requestId?: string | null }): SpeakingTurn => ({
  id: row.id,
  participantId: row.participantId,
  speaker: row.speaker as SpeakingTurn["speaker"],
  text: row.text,
  createdAt: row.createdAt.toISOString(),
  ...(row.audioDurationMs === null ? {} : { audioDurationMs: row.audioDurationMs }),
  ...(row.responseTimeMs === null ? {} : { responseTimeMs: row.responseTimeMs }),
  ...(row.usedHelp ? { usedHelp: true } : {}),
  ...(row.transcriptionConfidence === null ? {} : { transcriptionConfidence: row.transcriptionConfidence }),
  ...(row.requestId ? { requestId: row.requestId } : {})
});

const toEvaluation = (row: { participantId: string; language: string; scoresJson: Prisma.JsonValue; evidenceJson: Prisma.JsonValue; strengthsJson: Prisma.JsonValue; improvementsJson: Prisma.JsonValue; usefulEnglishJson: Prisma.JsonValue; overallMessage: string; createdAt: Date }): SpeakingEvaluation => ({
  participantId: row.participantId,
  language: row.language as SpeakingEvaluation["language"],
  assessmentStatus: Object.values(objectFromJson(row.scoresJson)).some((value) => typeof value === "number") ? "scored" : "insufficient_evidence",
  scores: Object.fromEntries(Object.entries(objectFromJson(row.scoresJson)).map(([key, value]) => [key, typeof value === "number" ? value : null])) as Record<string, number | null>,
  evidence: objectFromJson(row.evidenceJson) as Record<string, string>,
  strengths: Array.isArray(row.strengthsJson) ? row.strengthsJson.filter((item): item is string => typeof item === "string") : [],
  improvements: Array.isArray(row.improvementsJson) ? row.improvementsJson.filter((item): item is string => typeof item === "string") : [],
  usefulEnglish: Array.isArray(row.usefulEnglishJson) ? row.usefulEnglishJson.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    return typeof candidate.said === "string" && typeof candidate.try === "string" ? [{ said: candidate.said, try: candidate.try }] : [];
  }) : [],
  overallMessage: row.overallMessage,
  createdAt: row.createdAt.toISOString()
});

const activityInclude = { rubric: { orderBy: { position: "asc" as const } } } as const;
const sessionInclude = { activity: { include: activityInclude } } as const;

export class PrismaSpeakingRepository implements SpeakingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private async sessionAccess(row: PrismaSession): Promise<SpeakingSessionAccess> {
    const activity = toActivity(row.activity);
    const snapshot = snapshotFromJson(row.activitySnapshotJson, activity);
    return { session: toSession(row), activity: activityFromSnapshot(activity, snapshot) };
  }

  async listActivities(teacherId: string) {
    const rows = await this.prisma.speakingActivity.findMany({ where: { teacherId }, include: activityInclude, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
    return rows.map(toActivity);
  }

  async getActivity(id: string) {
    const row = await this.prisma.speakingActivity.findUnique({ where: { id }, include: activityInclude });
    return row ? toActivity(row) : undefined;
  }

  async getOwnedActivity(id: string, teacherId: string) {
    const row = await this.prisma.speakingActivity.findFirst({ where: { id, teacherId }, include: activityInclude });
    return row ? toActivity(row) : undefined;
  }

  async createActivity(teacherId: string, input: SpeakingCreateActivityInput, id: string, now: string) {
    const activity = normalizeActivityInput(input, id, teacherId, now);
    const row = await this.prisma.speakingActivity.create({
      data: {
        id: activity.id,
        teacherId,
        title: activity.title,
        scenario: activity.scenario,
        aiRole: activity.aiRole,
        studentRole: activity.studentRole,
        level: activity.level,
        difficulty: activity.difficulty,
        nativeLanguage: activity.nativeLanguage,
        durationSeconds: activity.durationSeconds,
        status: activity.status,
        identifierMode: activity.identifierMode,
        targetExpressionsJson: activity.targetExpressions as Prisma.InputJsonValue,
        rubric: { create: activity.rubric.map((criterion, position) => ({ criterionId: criterion.id, name: criterion.name, description: criterion.description, enabled: criterion.enabled, position })) }
      },
      include: activityInclude
    });
    return toActivity(row);
  }

  async updateActivity(teacherId: string, activityId: string, input: SpeakingCreateActivityInput, now: string) {
    const normalized = normalizeActivityInput(input, activityId, teacherId, now);
    const row = await this.prisma.$transaction(async (transaction) => {
      const owned = await transaction.speakingActivity.findFirst({ where: { id: activityId, teacherId }, select: { id: true, status: true, createdAt: true } });
      if (!owned) return undefined;
      await transaction.speakingRubric.deleteMany({ where: { activityId } });
      return transaction.speakingActivity.update({
        where: { id: activityId },
        data: {
          title: normalized.title,
          scenario: normalized.scenario,
          aiRole: normalized.aiRole,
          studentRole: normalized.studentRole,
          level: normalized.level,
          difficulty: normalized.difficulty,
          nativeLanguage: normalized.nativeLanguage,
          durationSeconds: normalized.durationSeconds,
          identifierMode: normalized.identifierMode,
          targetExpressionsJson: normalized.targetExpressions as Prisma.InputJsonValue,
          rubric: { create: normalized.rubric.map((criterion, position) => ({ criterionId: criterion.id, name: criterion.name, description: criterion.description, enabled: criterion.enabled, position })) }
        },
        include: activityInclude
      });
    });
    return row ? toActivity(row) : undefined;
  }

  async isJoinCodeTaken(joinCode: string) {
    return Boolean(await this.prisma.speakingSession.findUnique({ where: { joinCode }, select: { id: true } }));
  }

  async createSession(input: { id: string; activity: SpeakingActivity; joinCode: string; createdAt: string; expiresAt: string }) {
    const row = await this.prisma.speakingSession.create({
      data: {
        id: input.id,
        activityId: input.activity.id,
        joinCode: input.joinCode,
        status: "ready",
        createdAt: new Date(input.createdAt),
        expiresAt: new Date(input.expiresAt),
        activitySnapshotJson: snapshotActivity(input.activity) as unknown as Prisma.InputJsonValue
      },
      include: sessionInclude
    });
    return (await this.sessionAccess(row)).session;
  }

  async getSession(id: string) {
    const row = await this.prisma.speakingSession.findUnique({ where: { id }, include: sessionInclude });
    return row ? this.sessionAccess(row) : undefined;
  }

  async findJoinableSession(joinCode: string, now: string) {
    const row = await this.prisma.speakingSession.findFirst({
      where: { joinCode, expiresAt: { gt: new Date(now) }, status: { in: ["ready", "active"] } },
      include: sessionInclude
    });
    return row ? this.sessionAccess(row) : undefined;
  }

  async listSessions(activityId: string, teacherId: string) {
    const rows = await this.prisma.speakingSession.findMany({ where: { activityId, activity: { teacherId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return rows.map(toSession);
  }

  async createParticipant(input: { id: string; activity: SpeakingActivity; session: SpeakingSession; displayIdentifier?: string; tokenHash: string }) {
    const row = await this.prisma.speakingParticipant.create({
      data: {
        id: input.id,
        activityId: input.activity.id,
        sessionId: input.session.id,
        ...(input.displayIdentifier ? { displayIdentifier: input.displayIdentifier } : {}),
        anonymousTokenHash: input.tokenHash,
        startedAt: null,
        pausedDurationMs: 0,
        status: "joined",
        helpCount: 0,
        helpPending: false
      }
    });
    return toParticipant(row);
  }

  async getParticipant(id: string) {
    const row = await this.prisma.speakingParticipant.findUnique({ where: { id } });
    return row ? { ...toParticipant(row), tokenHash: row.anonymousTokenHash, helpPending: row.helpPending } : undefined;
  }

  async getParticipantAccessByTokenHash(tokenHash: string) {
    const row = await this.prisma.speakingParticipant.findUnique({ where: { anonymousTokenHash: tokenHash }, include: { session: { include: sessionInclude } } });
    if (!row) return undefined;
    const access = await this.sessionAccess(row.session);
    return { ...access, participant: { ...toParticipant(row), tokenHash: row.anonymousTokenHash, helpPending: row.helpPending } };
  }

  async startParticipant(participantId: string, startedAt: string) {
    const row = await this.prisma.speakingParticipant.updateMany({ where: { id: participantId, startedAt: null }, data: { startedAt: new Date(startedAt), status: "in_progress" } });
    if (!row.count) {
      const current = await this.prisma.speakingParticipant.findUnique({ where: { id: participantId } });
      return current ? toParticipant(current) : undefined;
    }
    const updated = await this.prisma.speakingParticipant.findUnique({ where: { id: participantId } });
    return updated ? toParticipant(updated) : undefined;
  }

  async updateParticipant(participantId: string, patch: { status?: SpeakingParticipantStatus; finishedAt?: string | null; helpPending?: boolean; helpCount?: number }) {
    const row = await this.prisma.speakingParticipant.update({ where: { id: participantId }, data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : null } : {}),
      ...(patch.helpPending !== undefined ? { helpPending: patch.helpPending } : {}),
      ...(patch.helpCount !== undefined ? { helpCount: patch.helpCount } : {})
    } });
    return toParticipant(row);
  }

  async updateSession(sessionId: string, patch: { status?: SpeakingSessionStatus; startedAt?: string | null; pausedAt?: string | null; endedAt?: string | null }) {
    const row = await this.prisma.speakingSession.update({ where: { id: sessionId }, data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt ? new Date(patch.startedAt) : null } : {}),
      ...(patch.pausedAt !== undefined ? { pausedAt: patch.pausedAt ? new Date(patch.pausedAt) : null } : {}),
      ...(patch.endedAt !== undefined ? { endedAt: patch.endedAt ? new Date(patch.endedAt) : null } : {})
    } });
    return toSession(row);
  }

  async finalizeSessionPause(sessionId: string, pausedUntil: string) {
    const row = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.speakingSession.findUnique({ where: { id: sessionId }, select: { pausedAt: true } });
      if (!current) return undefined;
      if (current.pausedAt) {
        const pauseStartedAtMs = current.pausedAt.getTime();
        const pauseEndedAtMs = Date.parse(pausedUntil);
        const claimed = await transaction.speakingSession.updateMany({
          where: { id: sessionId, pausedAt: current.pausedAt },
          data: { pausedAt: null }
        });
        if (claimed.count === 0) return transaction.speakingSession.findUnique({ where: { id: sessionId } });
        if (Number.isFinite(pauseEndedAtMs)) {
          const participants = await transaction.speakingParticipant.findMany({
            where: {
              sessionId,
              startedAt: { not: null },
              OR: [{ finishedAt: null }, { finishedAt: { gt: current.pausedAt } }]
            },
            select: { id: true, startedAt: true, finishedAt: true }
          });
          for (const participant of participants) {
            const overlapStartedAtMs = Math.max(pauseStartedAtMs, participant.startedAt!.getTime());
            const overlapEndedAtMs = Math.min(pauseEndedAtMs, participant.finishedAt?.getTime() ?? pauseEndedAtMs);
            const pausedDurationMs = Math.max(0, overlapEndedAtMs - overlapStartedAtMs);
            if (pausedDurationMs > 0) {
              await transaction.speakingParticipant.update({
                where: { id: participant.id },
                data: { pausedDurationMs: { increment: pausedDurationMs } }
              });
            }
          }
        }
        return transaction.speakingSession.findUnique({ where: { id: sessionId } });
      }
      return transaction.speakingSession.findUnique({ where: { id: sessionId } });
    });
    return row ? toSession(row) : undefined;
  }

  async listTurns(participantId: string) {
    const rows = await this.prisma.speakingTurn.findMany({ where: { participantId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(toTurn);
  }

  async findTurnPair(participantId: string, requestId: string) {
    return turnPairForRequest(await this.listTurns(participantId), requestId);
  }

  async appendTurn(input: Omit<SpeakingTurn, "id"> & { id: string; requestId?: string; sessionId?: string }) {
    const row = await this.prisma.speakingTurn.create({ data: {
      id: input.id,
      participantId: input.participantId,
      sessionId: input.sessionId ?? (await this.prisma.speakingParticipant.findUniqueOrThrow({ where: { id: input.participantId }, select: { sessionId: true } })).sessionId,
      speaker: input.speaker,
      text: input.text,
      createdAt: new Date(input.createdAt),
      ...(input.audioDurationMs === undefined ? {} : { audioDurationMs: input.audioDurationMs }),
      ...(input.responseTimeMs === undefined ? {} : { responseTimeMs: input.responseTimeMs }),
      usedHelp: input.usedHelp === true,
      ...(input.transcriptionConfidence === undefined ? {} : { transcriptionConfidence: input.transcriptionConfidence }),
      ...(input.requestId ? { requestId: input.requestId } : {})
    } });
    return toTurn(row);
  }

  async saveEvaluation(participantId: string, evaluation: SpeakingEvaluation) {
    const row = await this.prisma.speakingEvaluation.upsert({
      where: { participantId },
      create: {
        participantId,
        language: evaluation.language,
        scoresJson: evaluation.scores as Prisma.InputJsonValue,
        evidenceJson: evaluation.evidence as Prisma.InputJsonValue,
        strengthsJson: evaluation.strengths as Prisma.InputJsonValue,
        improvementsJson: evaluation.improvements as Prisma.InputJsonValue,
        usefulEnglishJson: evaluation.usefulEnglish as Prisma.InputJsonValue,
        overallMessage: evaluation.overallMessage,
        createdAt: new Date(evaluation.createdAt)
      },
      update: {
        language: evaluation.language,
        scoresJson: evaluation.scores as Prisma.InputJsonValue,
        evidenceJson: evaluation.evidence as Prisma.InputJsonValue,
        strengthsJson: evaluation.strengths as Prisma.InputJsonValue,
        improvementsJson: evaluation.improvements as Prisma.InputJsonValue,
        usefulEnglishJson: evaluation.usefulEnglish as Prisma.InputJsonValue,
        overallMessage: evaluation.overallMessage
      }
    });
    return toEvaluation(row);
  }

  async getResult(participantId: string) {
    const row = await this.prisma.speakingParticipant.findUnique({ where: { id: participantId }, include: { session: { include: sessionInclude }, turns: true, evaluation: true } }) as PrismaParticipantResult | null;
    if (!row) return undefined;
    const access = await this.sessionAccess(row.session);
    return {
      session: access.session,
      participant: toParticipant(row),
      activity: access.activity,
      turns: row.turns.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(toTurn),
      ...(row.evaluation ? { evaluation: toEvaluation(row.evaluation) } : {})
    };
  }

  async listResults(activityId: string, sessionId: string, teacherId: string) {
    const rows = await this.prisma.speakingParticipant.findMany({
      where: { activityId, sessionId, session: { activity: { teacherId } } },
      include: { session: { include: sessionInclude }, turns: true, evaluation: true },
      orderBy: [{ id: "asc" }]
    }) as PrismaParticipantResult[];
    return rows.map((row) => {
      const accessActivity = toActivity(row.session.activity);
      const activity = activityFromSnapshot(accessActivity, snapshotFromJson(row.session.activitySnapshotJson, accessActivity));
      const turns = row.turns.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(toTurn);
      const evaluation = row.evaluation ? toEvaluation(row.evaluation) : undefined;
      const overallScore = speakingOverallScore(evaluation);
      return { session: toSession(row.session), participant: toParticipant(row), activity, turns, ...(evaluation ? { evaluation } : {}), ...(overallScore === undefined ? {} : { overallScore }) };
    });
  }
}

export const createSpeakingRepository = ({
  environment = process.env.NODE_ENV ?? "development",
  prisma,
  state
}: {
  environment?: string;
  prisma?: PrismaClient;
  state?: InMemorySpeakingState;
} = {}): SpeakingRepository => {
  if (environment.trim().toLowerCase() === "production" && !prisma) {
    throw new Error("Speaking Practice requires a durable Prisma database in production. Set DATABASE_URL before starting the server.");
  }
  return prisma ? new PrismaSpeakingRepository(prisma) : new InMemorySpeakingRepository(state);
};
