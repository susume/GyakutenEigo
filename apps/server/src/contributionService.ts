import { createHash } from "node:crypto";
import type { GameSession, QuizSet, RecognitionSummary } from "@quizstrike/shared";
import { buildRecognitionSummary, CONTRIBUTION_POINTS, isMeaningfulStudySet, RECOGNITION_BADGES, badgeIdsForStats, type RecognitionStats } from "./recognition.js";

export type ContributionPersistence = {
  recordStudySetCreated(input: { teacherId: string; studySetId: string; contentFingerprint: string; isFirstSet: boolean; isRemix: boolean }): Promise<void>;
  recordStudySetPublished(input: { teacherId: string; studySetId: string }): Promise<void>;
  recordStudySetDuplicated(input: { teacherId: string; studySetId: string; originalSetId: string }): Promise<boolean>;
  recordStudySetUse(input: { studySetId: string; ownerTeacherId: string; consumerTeacherId: string; sessionId: string }): Promise<StudySetUseResult>;
  recordGameCompleted(input: { teacherId: string; sessionId: string; studentCount: number }): Promise<void>;
  getRecognitionSummary(teacherId: string): Promise<RecognitionSummary>;
};

export type StudySetUseResult = { added: boolean; externalTeacherAdded: boolean; uniqueTeacherCount: number };

type LocalEvent = {
  key: string;
  userId: string;
  points: number;
  type: keyof typeof RECOGNITION_BADGES | "STUDY_SET_CREATED" | "STUDY_SET_PUBLISHED" | "STUDY_SET_USED" | "STUDY_SET_DUPLICATED" | "CREATOR_REUSE_CREDITED" | "GAME_COMPLETED";
  studySetId?: string;
  sessionId?: string;
  studentCount?: number;
};

type LocalUsage = {
  studySetId: string;
  ownerTeacherId: string;
  consumerTeacherId: string;
  sessionId: string;
};

export const studySetContentFingerprint = (quizSet: Pick<QuizSet, "questions">) => {
  const normalizedQuestions = quizSet.questions.map((question) => [
      question.prompt, question.choiceA, question.choiceB, question.choiceC, question.choiceD, question.correctChoice
    ].map((value) => value.trim().toLowerCase()))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash("sha256").update(JSON.stringify(normalizedQuestions)).digest("hex");
};

const localStats = (events: Iterable<LocalEvent>, teacherId: string): RecognitionStats => {
  const userEvents = [...events].filter((event) => event.userId === teacherId);
  const studySetsCreated = userEvents.filter((event) => event.type === "STUDY_SET_CREATED" && event.points === CONTRIBUTION_POINTS.validStudySet).length;
  const publicSetsShared = userEvents.filter((event) => event.type === "STUDY_SET_PUBLISHED").length;
  const reuseConsumers = new Set(userEvents
    .filter((event) => event.key.startsWith("creator-reuse:"))
    .map((event) => event.key.slice(event.key.lastIndexOf(":") + 1)));
  const totalSetUses = userEvents.filter((event) => event.type === "STUDY_SET_USED").length;
  const badges = badgeIdsForStats({
    points: userEvents.reduce((sum, event) => sum + event.points, 0),
    studySetsCreated,
    publicSetsShared,
    gamesHosted: userEvents.filter((event) => event.type === "GAME_COMPLETED").length,
    studentsReached: userEvents.filter((event) => event.type === "GAME_COMPLETED").reduce((sum, event) => sum + (event.studentCount ?? 0), 0),
    teachersUsingSets: reuseConsumers.size,
    totalSetUses
  });
  return {
    points: userEvents.reduce((sum, event) => sum + event.points, 0),
    studySetsCreated,
    publicSetsShared,
    gamesHosted: userEvents.filter((event) => event.type === "GAME_COMPLETED").length,
    studentsReached: userEvents.filter((event) => event.type === "GAME_COMPLETED").reduce((sum, event) => sum + (event.studentCount ?? 0), 0),
    teachersUsingSets: reuseConsumers.size,
    totalSetUses,
    badgeRows: badges.map((badgeId) => ({ id: `${teacherId}:${badgeId}`, badgeId, earnedAt: new Date().toISOString() }))
  };
};

export class ContributionService {
  private readonly events = new Map<string, LocalEvent>();
  private readonly usages = new Map<string, LocalUsage>();

  constructor(
    private readonly studySets: () => Iterable<QuizSet>,
    private readonly persistence?: ContributionPersistence
  ) {}

  async recordStudySetCreated(quizSet: QuizSet) {
    if (!isMeaningfulStudySet(quizSet)) return;
    const isRemix = Boolean(quizSet.originalSetId);
    if (isRemix) return;
    const contentFingerprint = studySetContentFingerprint(quizSet);
    const isFirstSet = ![...this.studySets()].some((set) => set.id !== quizSet.id && set.teacherId === quizSet.teacherId && !set.originalSetId && isMeaningfulStudySet(set));
    if (this.persistence) {
      await this.persistence.recordStudySetCreated({ teacherId: quizSet.teacherId, studySetId: quizSet.id, contentFingerprint, isFirstSet, isRemix });
      return;
    }
    const setKey = `study-set-created:${quizSet.id}:valid`;
    if (!this.events.has(setKey)) {
      const contentKey = `study-set-content:${quizSet.teacherId}:${contentFingerprint}`;
      const isRepeatedContent = this.events.has(contentKey);
      this.addEvent(setKey, quizSet.teacherId, isRepeatedContent ? 0 : CONTRIBUTION_POINTS.validStudySet, "STUDY_SET_CREATED", quizSet.id);
      this.addEvent(contentKey, quizSet.teacherId, 0, "STUDY_SET_CREATED", quizSet.id);
    }
    if (isFirstSet) this.addEvent(`study-set-created:${quizSet.teacherId}:first`, quizSet.teacherId, CONTRIBUTION_POINTS.firstStudySet, "STUDY_SET_CREATED", quizSet.id);
  }

  async recordStudySetPublished(quizSet: QuizSet, wasPublic: boolean) {
    if (wasPublic || quizSet.visibility !== "PUBLIC") return;
    if (this.persistence) {
      await this.persistence.recordStudySetPublished({ teacherId: quizSet.teacherId, studySetId: quizSet.id });
      return;
    }
    this.addEvent(`study-set-published:${quizSet.id}`, quizSet.teacherId, CONTRIBUTION_POINTS.publishStudySet, "STUDY_SET_PUBLISHED", quizSet.id);
  }

  async recordStudySetDuplicated(teacherId: string, studySetId: string, originalSetId: string) {
    let added = false;
    if (this.persistence) {
      added = await this.persistence.recordStudySetDuplicated({ teacherId, studySetId, originalSetId });
    } else {
      const eventKey = `study-set-duplicated:${studySetId}`;
      added = !this.events.has(eventKey);
      this.addEvent(eventKey, teacherId, 0, "STUDY_SET_DUPLICATED", studySetId);
    }
    if (!added) return;
    const original = [...this.studySets()].find((set) => set.id === originalSetId);
    if (original) original.remixCount = (original.remixCount ?? 0) + 1;
  }

  async recordStudySetUse(input: { studySetId: string; ownerTeacherId: string; consumerTeacherId: string; sessionId: string }): Promise<StudySetUseResult> {
    if (this.persistence) {
      return this.persistence.recordStudySetUse(input);
    }
    const usageKey = `${input.studySetId}:${input.sessionId}`;
    if (this.usages.has(usageKey)) return { added: false, externalTeacherAdded: false, uniqueTeacherCount: 0 };
    this.usages.set(usageKey, input);
    this.addEvent(`study-set-used:${input.sessionId}`, input.ownerTeacherId, 0, "STUDY_SET_USED", input.studySetId, input.sessionId);
    if (input.ownerTeacherId === input.consumerTeacherId) return { added: true, externalTeacherAdded: false, uniqueTeacherCount: 0 };
    const hadExternalUse = [...this.usages.values()].some((usage) => usage.studySetId === input.studySetId && usage.consumerTeacherId === input.consumerTeacherId && usage.sessionId !== input.sessionId);
    if (hadExternalUse) {
      return { added: true, externalTeacherAdded: false, uniqueTeacherCount: new Set([...this.usages.values()].filter((usage) => usage.studySetId === input.studySetId && usage.consumerTeacherId !== input.ownerTeacherId).map((usage) => usage.consumerTeacherId)).size };
    }
    {
      this.addEvent(`creator-reuse:${input.studySetId}:${input.consumerTeacherId}`, input.ownerTeacherId, CONTRIBUTION_POINTS.uniqueTeacherUse, "CREATOR_REUSE_CREDITED", input.studySetId, input.sessionId);
      const uniqueUses = new Set([...this.usages.values()].filter((usage) => usage.studySetId === input.studySetId && usage.consumerTeacherId !== input.ownerTeacherId).map((usage) => usage.consumerTeacherId)).size;
      for (const [threshold, points] of Object.entries(CONTRIBUTION_POINTS.usageMilestones)) {
        if (uniqueUses >= Number(threshold)) this.addEvent(`usage-milestone:${input.studySetId}:${threshold}`, input.ownerTeacherId, points, "CREATOR_REUSE_CREDITED", input.studySetId);
      }
      return { added: true, externalTeacherAdded: true, uniqueTeacherCount: uniqueUses };
    }
  }

  async recordGameCompleted(session: GameSession) {
    if (session.status !== "ended" || !session.startedAt) return;
    const studentCount = session.players.filter((player) => !player.isBot).length;
    if (studentCount < 1) return;
    if (this.persistence) {
      await this.persistence.recordGameCompleted({ teacherId: session.teacherId, sessionId: session.id, studentCount });
      return;
    }
    this.addEvent(`game-completed:${session.id}`, session.teacherId, CONTRIBUTION_POINTS.completedGame, "GAME_COMPLETED", session.quizSetId, session.id, studentCount);
  }

  async getSummary(teacherId: string) {
    if (this.persistence) return this.persistence.getRecognitionSummary(teacherId);
    return buildRecognitionSummary(localStats(this.events.values(), teacherId));
  }

  private addEvent(key: string, userId: string, points: number, type: LocalEvent["type"], studySetId?: string, sessionId?: string, studentCount?: number) {
    if (this.events.has(key)) return;
    this.events.set(key, { key, userId, points, type, ...(studySetId ? { studySetId } : {}), ...(sessionId ? { sessionId } : {}), ...(studentCount !== undefined ? { studentCount } : {}) });
  }
}
