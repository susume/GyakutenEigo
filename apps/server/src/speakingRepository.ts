import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  SPEAKING_LIMITS,
  speakingOverallScore,
  type SpeakingActivity,
  type SpeakingCreateActivityInput,
  type SpeakingEvaluation,
  type SpeakingEvaluationJob,
  type SpeakingEvaluationJobStatus,
  type SpeakingParticipant,
  type SpeakingParticipantStatus,
  type SpeakingRubricCriterion,
  type SpeakingScenarioResources,
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
  | "scenarioResources"
>;

export type StoredSpeakingParticipant = SpeakingParticipant & {
  tokenHash: string;
  helpPending: boolean;
  joinRequestId?: string;
};

export type SpeakingRosterItem = {
  participant: SpeakingParticipant;
  latestActivityAt?: string;
  latestTurnSpeaker?: "ai" | "student";
};

export class SpeakingParticipantAdmissionError extends Error {
  constructor(public readonly code: "full" | "duplicate") { super(code); }
}

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
  const explicitlyLinkedAiTurn = turns.find((turn) => turn.speaker === "ai" && turn.requestId === `${requestId}:ai`);
  if (explicitlyLinkedAiTurn) return { studentTurn: turns[studentIndex]!, aiTurn: explicitlyLinkedAiTurn };
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
    joinRequestId?: string;
    maxParticipants?: number;
  }): Promise<SpeakingParticipant>;
  findParticipantByJoinRequest(sessionId: string, joinRequestId: string): Promise<SpeakingParticipant | undefined>;
  countParticipants(sessionId: string): Promise<number>;
  listRoster(sessionId: string): Promise<SpeakingRosterItem[]>;
  getParticipant(id: string): Promise<StoredSpeakingParticipant | undefined>;
  getParticipantAccessByTokenHash(tokenHash: string): Promise<(SpeakingSessionAccess & { participant: StoredSpeakingParticipant }) | undefined>;
  startParticipant(participantId: string, startedAt: string): Promise<SpeakingParticipant | undefined>;
  markParticipantReady(participantId: string, readyAt: string): Promise<SpeakingParticipant | undefined>;
  touchParticipant(participantId: string, lastSeenAt: string): Promise<SpeakingParticipant | undefined>;
  updateParticipant(participantId: string, patch: { status?: SpeakingParticipantStatus; finishedAt?: string | null; helpPending?: boolean; helpCount?: number; readyAt?: string | null; lastSeenAt?: string | null }): Promise<SpeakingParticipant | undefined>;
  updateSession(sessionId: string, patch: { status?: SpeakingSessionStatus; startedAt?: string | null; pausedAt?: string | null; endedAt?: string | null }): Promise<SpeakingSession | undefined>;
  /** Finalize a currently open pause and add its duration to affected participants. */
  finalizeSessionPause(sessionId: string, pausedUntil: string): Promise<SpeakingSession | undefined>;
  listTurns(participantId: string): Promise<SpeakingTurn[]>;
  findTurnPair(participantId: string, requestId: string): Promise<SpeakingTurnPair | undefined>;
  /** sessionId is supplied by the already-authorized route to avoid a redundant participant lookup. */
  appendTurn(input: Omit<SpeakingTurn, "id"> & { id: string; requestId?: string; sessionId?: string }): Promise<SpeakingTurn>;
  saveEvaluation(participantId: string, evaluation: SpeakingEvaluation): Promise<SpeakingEvaluation>;
  getEvaluationJob(participantId: string): Promise<SpeakingEvaluationJob | undefined>;
  upsertEvaluationJob(participantId: string, input: { id: string; queuedAt: string; updatedAt: string; status?: SpeakingEvaluationJobStatus; attempt?: number }): Promise<SpeakingEvaluationJob>;
  claimEvaluationJob(participantId: string, startedAt: string, leaseUntil: string): Promise<SpeakingEvaluationJob | undefined>;
  settleEvaluationJob(participantId: string, attempt: number, now: string, outcome: { evaluation?: SpeakingEvaluation; errorCode?: string }): Promise<boolean>;
  recoverableEvaluationParticipants(now: string): Promise<string[]>;
  updateEvaluationJob(participantId: string, patch: { status?: SpeakingEvaluationJobStatus; startedAt?: string | null; finishedAt?: string | null; leaseUntil?: string | null; lastErrorCode?: string | null; updatedAt: string }): Promise<SpeakingEvaluationJob | undefined>;
  getResult(participantId: string): Promise<SpeakingResultRecord | undefined>;
  listResults(activityId: string, sessionId: string, teacherId: string): Promise<Array<SpeakingResultRecord & { overallScore?: number }>>;
}

export type InMemorySpeakingState = {
  activities: Map<string, SpeakingActivity>;
  participants: Map<string, StoredSpeakingParticipant>;
  sessions: Map<string, InMemorySession>;
  tokenToParticipant: Map<string, string>;
  evaluationJobs: Map<string, SpeakingEvaluationJob>;
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
  tokenToParticipant: new Map(),
  evaluationJobs: new Map()
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
  rubric: activity.rubric.map((criterion) => ({ ...criterion })),
  ...(activity.scenarioResources ? { scenarioResources: cloneScenarioResources(activity.scenarioResources) } : {})
});

const cloneScenarioResources = (resources?: SpeakingScenarioResources) => resources ? ({
  ...resources,
  ...(resources.suggestedSteps ? { suggestedSteps: [...resources.suggestedSteps] } : {}),
  ...(resources.usefulVocabulary ? { usefulVocabulary: [...resources.usefulVocabulary] } : {}),
  ...(resources.referenceItems ? { referenceItems: resources.referenceItems.map((item) => ({ ...item })) } : {})
}) : undefined;

const activityFromSnapshot = (activity: SpeakingActivity, snapshot: SpeakingActivitySnapshot): SpeakingActivity => ({
  ...activity,
  ...snapshot,
  targetExpressions: [...snapshot.targetExpressions],
  rubric: snapshot.rubric.map((criterion) => ({ ...criterion })),
  ...(snapshot.scenarioResources ? { scenarioResources: cloneScenarioResources(snapshot.scenarioResources) } : {})
});

const cloneActivity = (activity: SpeakingActivity): SpeakingActivity => ({
  ...activity,
  targetExpressions: [...activity.targetExpressions],
  rubric: activity.rubric.map((criterion) => ({ ...criterion })),
  ...(activity.scenarioResources ? { scenarioResources: cloneScenarioResources(activity.scenarioResources) } : {})
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
  expiresAt: session.expiresAt,
  ...(session.revision === undefined ? {} : { revision: session.revision })
});

const cloneParticipant = (participant: SpeakingParticipant): SpeakingParticipant => ({ ...participant });

const cloneEvaluationJob = (job: SpeakingEvaluationJob): SpeakingEvaluationJob => ({ ...job });

const participantPublic = (participant: StoredSpeakingParticipant): SpeakingParticipant => {
  const { tokenHash: _tokenHash, helpPending: _helpPending, joinRequestId: _joinRequestId, ...publicParticipant } = participant;
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
  ...(input.scenarioResources ? { scenarioResources: cloneScenarioResources(input.scenarioResources) } : {}),
  createdAt: now,
  updatedAt: now
});

const participantFromInput = (input: {
  id: string;
  activity: SpeakingActivity;
  session: SpeakingSession;
  displayIdentifier?: string;
  tokenHash: string;
  joinRequestId?: string;
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
  helpPending: false,
  ...(input.joinRequestId ? { joinRequestId: input.joinRequestId } : {})
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
      revision: 0,
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

  async createParticipant(input: { id: string; activity: SpeakingActivity; session: SpeakingSession; displayIdentifier?: string; tokenHash: string; joinRequestId?: string; maxParticipants?: number }) {
    const existing = [...this.state.participants.values()].filter((participant) => participant.sessionId === input.session.id);
    if (input.joinRequestId && existing.some((participant) => participant.joinRequestId === input.joinRequestId)) throw new SpeakingParticipantAdmissionError("duplicate");
    if (input.maxParticipants !== undefined && existing.length >= input.maxParticipants) throw new SpeakingParticipantAdmissionError("full");
    const participant = participantFromInput(input);
    this.state.participants.set(participant.id, participant);
    this.state.tokenToParticipant.set(participant.tokenHash, participant.id);
    const session = this.state.sessions.get(input.session.id);
    if (session) session.revision = (session.revision ?? 0) + 1;
    return participantPublic(participant);
  }

  async findParticipantByJoinRequest(sessionId: string, joinRequestId: string) {
    const participant = [...this.state.participants.values()].find((candidate) => candidate.sessionId === sessionId && candidate.joinRequestId === joinRequestId);
    return participant ? participantPublic(participant) : undefined;
  }

  async countParticipants(sessionId: string) {
    return [...this.state.participants.values()].filter((participant) => participant.sessionId === sessionId).length;
  }

  async listRoster(sessionId: string) {
    return [...this.state.participants.values()]
      .filter((participant) => participant.sessionId === sessionId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((participant) => {
        const session = this.state.sessions.get(sessionId);
        const latestTurn = session?.turns
          .filter((turn) => turn.participantId === participant.id)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
        return {
          participant: participantPublic(participant),
          ...(latestTurn ? { latestActivityAt: latestTurn.createdAt, latestTurnSpeaker: latestTurn.speaker } : participant.lastSeenAt ? { latestActivityAt: participant.lastSeenAt } : {})
        };
      });
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
    const hadStartedAt = Boolean(participant.startedAt);
    const previousStatus = participant.status;
    if (!participant.startedAt) participant.startedAt = startedAt;
    if (participant.status === "joined") participant.status = "in_progress";
    const session = participant.sessionId ? this.state.sessions.get(participant.sessionId) : undefined;
    if (session && (!hadStartedAt || previousStatus !== participant.status)) session.revision = (session.revision ?? 0) + 1;
    return participantPublic(participant);
  }

  async markParticipantReady(participantId: string, readyAt: string) {
    return this.updateParticipant(participantId, { readyAt });
  }

  async touchParticipant(participantId: string, lastSeenAt: string) {
    const participant = this.state.participants.get(participantId);
    if (!participant) return undefined;
    participant.lastSeenAt = lastSeenAt;
    return participantPublic(participant);
  }

  async updateParticipant(participantId: string, patch: { status?: SpeakingParticipantStatus; finishedAt?: string | null; helpPending?: boolean; helpCount?: number; readyAt?: string | null; lastSeenAt?: string | null }) {
    const participant = this.state.participants.get(participantId);
    if (!participant) return undefined;
    Object.assign(participant, patch);
    const session = participant.sessionId ? this.state.sessions.get(participant.sessionId) : undefined;
    if (session && Object.keys(patch).some((key) => key !== "lastSeenAt")) session.revision = (session.revision ?? 0) + 1;
    return participantPublic(participant);
  }

  async updateSession(sessionId: string, patch: { status?: SpeakingSessionStatus; startedAt?: string | null; pausedAt?: string | null; endedAt?: string | null }) {
    const session = this.state.sessions.get(sessionId);
    if (!session) return undefined;
    Object.assign(session, patch);
    session.revision = (session.revision ?? 0) + 1;
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
      session.revision = (session.revision ?? 0) + 1;
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
    const existing = session.turns.find((candidate) =>
      candidate.id === turn.id || (turn.requestId && candidate.requestId === turn.requestId && candidate.speaker === turn.speaker)
    );
    if (existing) return { ...existing };
    session.turns.push(turn);
    session.revision = (session.revision ?? 0) + 1;
    return { ...turn };
  }

  async saveEvaluation(participantId: string, evaluation: SpeakingEvaluation) {
    const participant = this.state.participants.get(participantId);
    const session = participant ? this.state.sessions.get(participant.sessionId!) : undefined;
    if (!participant || !session) throw new Error("Speaking participant session not found.");
    session.evaluations.set(participantId, { ...evaluation });
    session.revision = (session.revision ?? 0) + 1;
    return { ...evaluation };
  }

  async getEvaluationJob(participantId: string) {
    const job = this.state.evaluationJobs.get(participantId);
    return job ? cloneEvaluationJob(job) : undefined;
  }

  async upsertEvaluationJob(participantId: string, input: { id: string; queuedAt: string; updatedAt: string; status?: SpeakingEvaluationJobStatus; attempt?: number }) {
    const existing = this.state.evaluationJobs.get(participantId);
    if (existing && existing.status !== "failed") return cloneEvaluationJob(existing);
    const job: SpeakingEvaluationJob = existing
      ? { ...existing, ...(input.status ? { status: input.status } : {}), ...(input.attempt === undefined ? {} : { attempt: input.attempt }), updatedAt: input.updatedAt, ...(input.status === "queued" ? { queuedAt: input.queuedAt, startedAt: undefined, finishedAt: undefined, leaseUntil: undefined, lastErrorCode: undefined } : {}) }
      : { id: input.id, participantId, status: input.status ?? "queued", attempt: input.attempt ?? 0, queuedAt: input.queuedAt, updatedAt: input.updatedAt };
    this.state.evaluationJobs.set(participantId, job);
    return cloneEvaluationJob(job);
  }

  async claimEvaluationJob(participantId: string, startedAt: string, leaseUntil: string) {
    const job = this.state.evaluationJobs.get(participantId);
    if (!job) return undefined;
    const nowMs = Date.parse(startedAt);
    const leaseMs = job.leaseUntil ? Date.parse(job.leaseUntil) : Number.NaN;
    if (job.status !== "queued" && !(job.status === "running" && (!Number.isFinite(leaseMs) || leaseMs <= nowMs))) return undefined;
    job.status = "running";
    job.attempt += 1;
    job.startedAt = startedAt;
    job.leaseUntil = leaseUntil;
    job.updatedAt = startedAt;
    return cloneEvaluationJob(job);
  }

  async settleEvaluationJob(participantId: string, attempt: number, now: string, outcome: { evaluation?: SpeakingEvaluation; errorCode?: string }) {
    const job = this.state.evaluationJobs.get(participantId);
    if (!job || job.status !== "running" || job.attempt !== attempt) return false;
    job.status = outcome.evaluation ? "completed" : "failed";
    job.finishedAt = now;
    job.leaseUntil = undefined;
    job.updatedAt = now;
    job.lastErrorCode = outcome.errorCode;
    if (outcome.evaluation) await this.saveEvaluation(participantId, outcome.evaluation);
    await this.updateParticipant(participantId, { status: outcome.evaluation ? "completed" : "error", helpPending: false });
    return true;
  }

  async recoverableEvaluationParticipants(now: string) {
    return [...this.state.evaluationJobs.values()].filter((job) => job.status === "queued" || job.status === "running" && (!job.leaseUntil || Date.parse(job.leaseUntil) <= Date.parse(now))).slice(0, 100).map((job) => job.participantId);
  }

  async updateEvaluationJob(participantId: string, patch: { status?: SpeakingEvaluationJobStatus; startedAt?: string | null; finishedAt?: string | null; leaseUntil?: string | null; lastErrorCode?: string | null; updatedAt: string }) {
    const job = this.state.evaluationJobs.get(participantId);
    if (!job) return undefined;
    Object.assign(job, patch);
    return cloneEvaluationJob(job);
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

const scenarioResourcesFromJson = (value: Prisma.JsonValue): SpeakingScenarioResources | undefined => {
  const source = objectFromJson(value);
  const suggestedSteps = Array.isArray(source.suggestedSteps) ? source.suggestedSteps.filter((item): item is string => typeof item === "string") : undefined;
  const usefulVocabulary = Array.isArray(source.usefulVocabulary) ? source.usefulVocabulary.filter((item): item is string => typeof item === "string") : undefined;
  const referenceItems = Array.isArray(source.referenceItems)
    ? source.referenceItems.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const candidate = item as Record<string, unknown>;
      return typeof candidate.label === "string" ? [{ label: candidate.label, ...(typeof candidate.detail === "string" ? { detail: candidate.detail } : {}) }] : [];
    })
    : undefined;
  const resources: SpeakingScenarioResources = {
    ...(typeof source.openingLine === "string" ? { openingLine: source.openingLine } : {}),
    ...(typeof source.studentGoal === "string" ? { studentGoal: source.studentGoal } : {}),
    ...(suggestedSteps ? { suggestedSteps } : {}),
    ...(usefulVocabulary ? { usefulVocabulary } : {}),
    ...(referenceItems ? { referenceItems } : {}),
    ...(typeof source.imageSrc === "string" ? { imageSrc: source.imageSrc } : {}),
    ...(typeof source.imageAlt === "string" ? { imageAlt: source.imageAlt } : {})
  };
  return Object.keys(resources).length ? resources : undefined;
};

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
    rubric: rubricFromJson((source.rubric ?? activity.rubric) as Prisma.JsonValue),
    ...(scenarioResourcesFromJson((source.scenarioResources ?? {}) as Prisma.JsonValue) ? { scenarioResources: scenarioResourcesFromJson((source.scenarioResources ?? {}) as Prisma.JsonValue) } : {})
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
  ...(scenarioResourcesFromJson(row.scenarioResourcesJson) ? { scenarioResources: scenarioResourcesFromJson(row.scenarioResourcesJson) } : {}),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const toSession = (row: Pick<PrismaSession, "id" | "activityId" | "joinCode" | "status" | "createdAt" | "startedAt" | "pausedAt" | "endedAt" | "expiresAt" | "revision">): SpeakingSession => ({
  id: row.id,
  activityId: row.activityId,
  joinCode: row.joinCode,
  status: row.status === "completed" ? "ended" : row.status,
  createdAt: row.createdAt.toISOString(),
  ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
  ...(row.pausedAt ? { pausedAt: row.pausedAt.toISOString() } : {}),
  ...(row.endedAt ? { endedAt: row.endedAt.toISOString() } : {}),
  expiresAt: row.expiresAt.toISOString(),
  revision: row.revision
});

const toParticipant = (row: { id: string; activityId: string; sessionId: string; displayIdentifier: string | null; startedAt: Date | null; finishedAt: Date | null; readyAt?: Date | null; lastSeenAt?: Date | null; pausedDurationMs: number; status: string; helpCount: number }): SpeakingParticipant => ({
  id: row.id,
  activityId: row.activityId,
  sessionId: row.sessionId,
  ...(row.displayIdentifier ? { displayIdentifier: row.displayIdentifier } : {}),
  ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
  ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
  ...(row.readyAt ? { readyAt: row.readyAt.toISOString() } : {}),
  ...(row.lastSeenAt ? { lastSeenAt: row.lastSeenAt.toISOString() } : {}),
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
        scenarioResourcesJson: (activity.scenarioResources ?? {}) as Prisma.InputJsonValue,
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
          scenarioResourcesJson: (normalized.scenarioResources ?? {}) as Prisma.InputJsonValue,
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
        revision: 0,
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

  async createParticipant(input: { id: string; activity: SpeakingActivity; session: SpeakingSession; displayIdentifier?: string; tokenHash: string; joinRequestId?: string }) {
    const row = await this.prisma.speakingParticipant.create({
      data: {
        id: input.id,
        activityId: input.activity.id,
        sessionId: input.session.id,
        ...(input.displayIdentifier ? { displayIdentifier: input.displayIdentifier } : {}),
        anonymousTokenHash: input.tokenHash,
        ...(input.joinRequestId ? { joinRequestId: input.joinRequestId } : {}),
        startedAt: null,
        pausedDurationMs: 0,
        status: "joined",
        helpCount: 0,
        helpPending: false
      }
    });
    await this.prisma.speakingSession.update({ where: { id: input.session.id }, data: { revision: { increment: 1 } } });
    return toParticipant(row);
  }

  async findParticipantByJoinRequest(sessionId: string, joinRequestId: string) {
    const row = await this.prisma.speakingParticipant.findFirst({ where: { sessionId, joinRequestId } });
    return row ? toParticipant(row) : undefined;
  }

  async countParticipants(sessionId: string) {
    return this.prisma.speakingParticipant.count({ where: { sessionId } });
  }

  async listRoster(sessionId: string) {
    const rows = await this.prisma.speakingParticipant.findMany({
      where: { sessionId },
      include: { turns: { orderBy: [{ createdAt: "desc" }], take: 1 } },
      orderBy: [{ id: "asc" }]
    });
    return rows.map((row) => ({
      participant: toParticipant(row),
      ...(row.turns[0]?.createdAt ? { latestActivityAt: row.turns[0].createdAt.toISOString(), latestTurnSpeaker: row.turns[0].speaker as "ai" | "student" } : row.lastSeenAt ? { latestActivityAt: row.lastSeenAt.toISOString() } : {})
    }));
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
    if (updated) await this.prisma.speakingSession.update({ where: { id: updated.sessionId }, data: { revision: { increment: 1 } } });
    return updated ? toParticipant(updated) : undefined;
  }

  async markParticipantReady(participantId: string, readyAt: string) {
    const row = await this.prisma.speakingParticipant.update({ where: { id: participantId }, data: { readyAt: new Date(readyAt) } });
    await this.prisma.speakingSession.update({ where: { id: row.sessionId }, data: { revision: { increment: 1 } } });
    return toParticipant(row);
  }

  async touchParticipant(participantId: string, lastSeenAt: string) {
    const row = await this.prisma.speakingParticipant.update({ where: { id: participantId }, data: { lastSeenAt: new Date(lastSeenAt) } });
    return toParticipant(row);
  }

  async updateParticipant(participantId: string, patch: { status?: SpeakingParticipantStatus; finishedAt?: string | null; helpPending?: boolean; helpCount?: number; readyAt?: string | null; lastSeenAt?: string | null }) {
    const row = await this.prisma.speakingParticipant.update({ where: { id: participantId }, data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : null } : {}),
      ...(patch.helpPending !== undefined ? { helpPending: patch.helpPending } : {}),
      ...(patch.helpCount !== undefined ? { helpCount: patch.helpCount } : {}),
      ...(patch.readyAt !== undefined ? { readyAt: patch.readyAt ? new Date(patch.readyAt) : null } : {}),
      ...(patch.lastSeenAt !== undefined ? { lastSeenAt: patch.lastSeenAt ? new Date(patch.lastSeenAt) : null } : {})
    } });
    await this.prisma.speakingSession.update({ where: { id: row.sessionId }, data: { revision: { increment: 1 } } });
    return toParticipant(row);
  }

  async updateSession(sessionId: string, patch: { status?: SpeakingSessionStatus; startedAt?: string | null; pausedAt?: string | null; endedAt?: string | null }) {
    const row = await this.prisma.speakingSession.update({ where: { id: sessionId }, data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt ? new Date(patch.startedAt) : null } : {}),
      ...(patch.pausedAt !== undefined ? { pausedAt: patch.pausedAt ? new Date(patch.pausedAt) : null } : {}),
      ...(patch.endedAt !== undefined ? { endedAt: patch.endedAt ? new Date(patch.endedAt) : null } : {}),
      revision: { increment: 1 }
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
          data: { pausedAt: null, revision: { increment: 1 } }
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
    let row;
    try {
      row = await this.prisma.speakingTurn.create({ data: {
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
    } catch (error) {
      if (input.requestId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.speakingTurn.findFirst({ where: { participantId: input.participantId, requestId: input.requestId, speaker: input.speaker } });
        if (existing) return toTurn(existing);
      }
      throw error;
    }
    await this.prisma.speakingSession.update({
      where: { id: input.sessionId ?? row.sessionId },
      data: { revision: { increment: 1 } }
    });
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

  async getEvaluationJob(participantId: string) {
    const row = await this.prisma.speakingEvaluationJob.findUnique({ where: { participantId } });
    return row ? {
      id: row.id,
      participantId: row.participantId,
      status: row.status as SpeakingEvaluationJobStatus,
      attempt: row.attempt,
      queuedAt: row.queuedAt.toISOString(),
      ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
      ...(row.leaseUntil ? { leaseUntil: row.leaseUntil.toISOString() } : {}),
      ...(row.lastErrorCode ? { lastErrorCode: row.lastErrorCode } : {}),
      updatedAt: row.updatedAt.toISOString()
    } : undefined;
  }

  async upsertEvaluationJob(participantId: string, input: { id: string; queuedAt: string; updatedAt: string; status?: SpeakingEvaluationJobStatus; attempt?: number }) {
    if (input.status === "queued") await this.prisma.speakingEvaluationJob.updateMany({
      where: { participantId, status: "failed" },
      data: { status: "queued", queuedAt: new Date(input.queuedAt), startedAt: null, finishedAt: null, leaseUntil: null, lastErrorCode: null }
    });
    const row = await this.prisma.speakingEvaluationJob.upsert({
      where: { participantId },
      create: {
        id: input.id,
        participantId,
        status: input.status ?? "queued",
        attempt: input.attempt ?? 0,
        queuedAt: new Date(input.queuedAt),
        updatedAt: new Date(input.updatedAt)
      },
      update: {}
    });
    return {
      id: row.id,
      participantId: row.participantId,
      status: row.status as SpeakingEvaluationJobStatus,
      attempt: row.attempt,
      queuedAt: row.queuedAt.toISOString(),
      ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
      ...(row.leaseUntil ? { leaseUntil: row.leaseUntil.toISOString() } : {}),
      ...(row.lastErrorCode ? { lastErrorCode: row.lastErrorCode } : {}),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async claimEvaluationJob(participantId: string, startedAt: string, leaseUntil: string) {
    const now = new Date(startedAt);
    const claimed = await this.prisma.speakingEvaluationJob.updateMany({
      where: {
        participantId,
        OR: [
          { status: "queued" },
          { status: "running", leaseUntil: { lte: now } },
          { status: "running", leaseUntil: null }
        ]
      },
      data: { status: "running", attempt: { increment: 1 }, startedAt: now, leaseUntil: new Date(leaseUntil), lastErrorCode: null }
    });
    if (!claimed.count) return undefined;
    return this.getEvaluationJob(participantId);
  }

  async settleEvaluationJob(participantId: string, attempt: number, now: string, outcome: { evaluation?: SpeakingEvaluation; errorCode?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.speakingEvaluationJob.updateMany({
        where: { participantId, attempt, status: "running" },
        data: { status: outcome.evaluation ? "completed" : "failed", finishedAt: new Date(now), leaseUntil: null, lastErrorCode: outcome.errorCode ?? null }
      });
      if (!claimed.count) return false;
      const repository = new PrismaSpeakingRepository(tx as PrismaClient);
      if (outcome.evaluation) await repository.saveEvaluation(participantId, outcome.evaluation);
      await repository.updateParticipant(participantId, { status: outcome.evaluation ? "completed" : "error", helpPending: false });
      return true;
    });
  }

  async recoverableEvaluationParticipants(now: string) {
    const rows = await this.prisma.speakingEvaluationJob.findMany({ where: { OR: [{ status: "queued" }, { status: "running", leaseUntil: { lte: new Date(now) } }, { status: "running", leaseUntil: null }] }, select: { participantId: true }, orderBy: { queuedAt: "asc" }, take: 100 });
    return rows.map((row) => row.participantId);
  }

  async updateEvaluationJob(participantId: string, patch: { status?: SpeakingEvaluationJobStatus; startedAt?: string | null; finishedAt?: string | null; leaseUntil?: string | null; lastErrorCode?: string | null; updatedAt: string }) {
    const row = await this.prisma.speakingEvaluationJob.update({ where: { participantId }, data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt ? new Date(patch.startedAt) : null } : {}),
      ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : null } : {}),
      ...(patch.leaseUntil !== undefined ? { leaseUntil: patch.leaseUntil ? new Date(patch.leaseUntil) : null } : {}),
      ...(patch.lastErrorCode !== undefined ? { lastErrorCode: patch.lastErrorCode } : {})
    } });
    return {
      id: row.id,
      participantId: row.participantId,
      status: row.status as SpeakingEvaluationJobStatus,
      attempt: row.attempt,
      queuedAt: row.queuedAt.toISOString(),
      ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
      ...(row.leaseUntil ? { leaseUntil: row.leaseUntil.toISOString() } : {}),
      ...(row.lastErrorCode ? { lastErrorCode: row.lastErrorCode } : {}),
      updatedAt: row.updatedAt.toISOString()
    };
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
