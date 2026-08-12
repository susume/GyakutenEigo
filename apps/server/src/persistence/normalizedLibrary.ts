import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AnswerLog,
  ClassSummary,
  GameSession,
  PlayerSession,
  Question,
  QuizFolder,
  QuizSet,
  RecognitionSummary,
  ReportMetadata,
  SessionReport,
  StudySetSummary,
  TeacherUser
} from "@quizstrike/shared";
import { MAX_SAVED_REPORTS } from "../teacherLibrary.js";
import { buildRecognitionSummary, badgeIdsForStats, CONTRIBUTION_POINTS, getRecognitionLevel, type RecognitionStats } from "../recognition.js";
import type { StudySetUseResult } from "../contributionService.js";

type PrismaLike = PrismaClient;
const publicStudySetInclude = {
  teacher: { select: { id: true, name: true } },
  _count: { select: { questions: true } }
} satisfies Prisma.QuizSetInclude;
type PublicStudySetRow = Prisma.QuizSetGetPayload<{ include: typeof publicStudySetInclude }>;
type ReportRecord = {
  id: string;
  teacherId: string;
  sessionId: string;
  sessionCode: string;
  quizSetId: string | null;
  quizSetName: string;
  displayName: string;
  detailJson: Prisma.JsonValue;
  createdAt: Date;
};

const metadataFromRecord = (record: Pick<ReportRecord, "id" | "teacherId" | "sessionId" | "sessionCode" | "quizSetId" | "quizSetName" | "displayName" | "createdAt">): ReportMetadata => ({
  id: record.id,
  teacherId: record.teacherId,
  sessionId: record.sessionId,
  sessionCode: record.sessionCode,
  ...(record.quizSetId ? { quizSetId: record.quizSetId } : {}),
  quizSetName: record.quizSetName,
  displayName: record.displayName,
  createdAt: record.createdAt.toISOString()
});

const reportDetail = (value: Prisma.JsonValue) => value as unknown as SessionReport;

/**
 * Repository boundary for teacher folders/reports that are normalized in Prisma.
 * Runtime simulation can continue using its in-memory maps, but durable report
 * writes and retention are transactionally owned here.
 */
export class NormalizedLibrary {
  constructor(private readonly prisma: PrismaLike) {}

  async loadTeacherData() {
    const [userRows, classRows, quizRows, folderRows] = await Promise.all([
      this.prisma.user.findMany(),
      this.prisma.class.findMany(),
      this.prisma.quizSet.findMany({ include: { questions: { orderBy: { createdAt: "asc" } } } }),
      this.prisma.folder.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    ]);
    return {
      users: userRows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role
      })),
      classes: classRows.map((klass) => ({
        id: klass.id,
        teacherId: klass.teacherId,
        name: klass.name,
        ...(klass.description ? { description: klass.description } : {}),
        createdAt: klass.createdAt.toISOString()
      })),
      quizSets: quizRows.map((quiz) => ({
        id: quiz.id,
        teacherId: quiz.teacherId,
        ...(quiz.classId ? { classId: quiz.classId } : {}),
        ...(quiz.folderId ? { folderId: quiz.folderId } : {}),
        title: quiz.title,
        ...(quiz.description ? { description: quiz.description } : {}),
        visibility: quiz.visibility,
        ...(quiz.subject ? { subject: quiz.subject } : {}),
        ...(quiz.topic ? { topic: quiz.topic } : {}),
        ...(quiz.gradeLevel ? { gradeLevel: quiz.gradeLevel } : {}),
        ...(quiz.language ? { language: quiz.language } : {}),
        tags: Array.isArray(quiz.tagsJson) ? quiz.tagsJson.filter((tag): tag is string => typeof tag === "string") : [],
        ...(quiz.publishedAt ? { publishedAt: quiz.publishedAt.toISOString() } : {}),
        status: quiz.status,
        ...(quiz.originalSetId ? { originalSetId: quiz.originalSetId } : {}),
        ...(quiz.originalCreatorId ? { originalCreatorId: quiz.originalCreatorId } : {}),
        usageCount: quiz.usageCount,
        uniqueTeacherUsageCount: quiz.uniqueTeacherUsageCount,
        remixCount: quiz.remixCount,
        questions: quiz.questions.map((question) => ({
          id: question.id,
          quizSetId: question.quizSetId,
          prompt: question.prompt,
          choiceA: question.choiceA,
          choiceB: question.choiceB,
          choiceC: question.choiceC,
          choiceD: question.choiceD,
          correctChoice: question.correctChoice as Question["correctChoice"],
          ...(question.explanation ? { explanation: question.explanation } : {}),
          ...(question.difficulty ? { difficulty: question.difficulty } : {}),
          ...(question.audioUrl ? { audioUrl: question.audioUrl } : {}),
          createdAt: question.createdAt.toISOString()
        })),
        createdAt: quiz.createdAt.toISOString(),
        updatedAt: quiz.updatedAt.toISOString()
      } satisfies QuizSet)),
      folders: folderRows.map((folder) => ({
        id: folder.id,
        teacherId: folder.teacherId,
        ...(folder.parentId ? { parentId: folder.parentId } : {}),
        name: folder.name,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString()
      } satisfies QuizFolder))
    };
  }

  async saveUser(user: TeacherUser & { passwordHash: string }) {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role
      },
      update: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role
      }
    });
  }

  async listReportMetadata(teacherId: string): Promise<ReportMetadata[]> {
    const rows = await this.prisma.report.findMany({
      where: { teacherId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    return rows.map(metadataFromRecord);
  }

  async getReport(teacherId: string, id: string) {
    const row = await this.prisma.report.findFirst({ where: { id, teacherId } });
    return row ? { metadata: metadataFromRecord(row), report: reportDetail(row.detailJson) } : undefined;
  }

  async getReportForSession(teacherId: string, sessionId: string) {
    const row = await this.prisma.report.findFirst({ where: { teacherId, sessionId } });
    return row ? { metadata: metadataFromRecord(row), report: reportDetail(row.detailJson) } : undefined;
  }

  async deleteReport(teacherId: string, id: string) {
    const result = await this.prisma.report.deleteMany({ where: { id, teacherId } });
    return result.count > 0;
  }

  async deleteTeacherHistory(teacherId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.report.deleteMany({ where: { teacherId } });
      const result = await tx.gameSession.deleteMany({ where: { teacherId, status: "ended" } });
      return result.count;
    });
  }

  async saveFolderForTeacher(folder: QuizFolder) {
    await this.prisma.$transaction(async (tx) => {
      if (folder.parentId) {
        const parent = await tx.folder.findFirst({
          where: { id: folder.parentId, teacherId: folder.teacherId },
          select: { id: true }
        });
        if (!parent) throw new Error("Folder parent ownership validation failed.");
      }
      await tx.folder.upsert({
        where: { id: folder.id },
        create: { id: folder.id, teacherId: folder.teacherId, parentId: folder.parentId ?? null, name: folder.name, createdAt: new Date(folder.createdAt), updatedAt: new Date(folder.updatedAt) },
        update: { parentId: folder.parentId ?? null, name: folder.name, updatedAt: new Date(folder.updatedAt) }
      });
    });
  }

  async saveClass(klass: ClassSummary & { teacherId: string }) {
    await this.prisma.class.upsert({
      where: { id: klass.id },
      create: { id: klass.id, teacherId: klass.teacherId, name: klass.name, description: klass.description ?? null, createdAt: new Date(klass.createdAt), updatedAt: new Date(klass.createdAt) },
      update: { teacherId: klass.teacherId, name: klass.name, description: klass.description ?? null }
    });
  }

  async saveQuizSet(quiz: QuizSet) {
    const settingsJson = {} as Prisma.InputJsonValue;
    const tagsJson = (quiz.tags ?? []) as Prisma.InputJsonValue;
    await this.prisma.$transaction(async (tx) => {
      if (quiz.classId) {
        const ownedClass = await tx.class.findFirst({ where: { id: quiz.classId, teacherId: quiz.teacherId }, select: { id: true } });
        if (!ownedClass) throw new Error("Quiz class ownership validation failed.");
      }
      if (quiz.folderId) {
        const ownedFolder = await tx.folder.findFirst({ where: { id: quiz.folderId, teacherId: quiz.teacherId }, select: { id: true } });
        if (!ownedFolder) throw new Error("Quiz folder ownership validation failed.");
      }
      await tx.quizSet.upsert({
        where: { id: quiz.id },
        create: {
          id: quiz.id,
          teacherId: quiz.teacherId,
          classId: quiz.classId ?? null,
          folderId: quiz.folderId ?? null,
          title: quiz.title,
          description: quiz.description ?? null,
          visibility: quiz.visibility ?? "PRIVATE",
          subject: quiz.subject ?? null,
          topic: quiz.topic ?? null,
          gradeLevel: quiz.gradeLevel ?? null,
          language: quiz.language ?? null,
          tagsJson,
          publishedAt: quiz.publishedAt ? new Date(quiz.publishedAt) : null,
          status: quiz.status ?? "ACTIVE",
          originalSetId: quiz.originalSetId ?? null,
          originalCreatorId: quiz.originalCreatorId ?? null,
          usageCount: quiz.usageCount ?? 0,
          uniqueTeacherUsageCount: quiz.uniqueTeacherUsageCount ?? 0,
          remixCount: quiz.remixCount ?? 0,
          settingsJson,
          createdAt: new Date(quiz.createdAt),
          updatedAt: new Date(quiz.updatedAt ?? quiz.createdAt)
        },
        update: {
          classId: quiz.classId ?? null,
          folderId: quiz.folderId ?? null,
          title: quiz.title,
          description: quiz.description ?? null,
          visibility: quiz.visibility ?? "PRIVATE",
          subject: quiz.subject ?? null,
          topic: quiz.topic ?? null,
          gradeLevel: quiz.gradeLevel ?? null,
          language: quiz.language ?? null,
          tagsJson,
          publishedAt: quiz.publishedAt ? new Date(quiz.publishedAt) : null,
          status: quiz.status ?? "ACTIVE",
          originalSetId: quiz.originalSetId ?? null,
          originalCreatorId: quiz.originalCreatorId ?? null,
          settingsJson
        }
      });
    });
  }

  async saveQuestionForTeacher(teacherId: string, question: Question) {
    await this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quizSet.findFirst({ where: { id: question.quizSetId, teacherId }, select: { id: true } });
      if (!quiz) throw new Error("Question quiz ownership validation failed.");
      await tx.question.upsert({
        where: { id: question.id },
        create: { id: question.id, quizSetId: question.quizSetId, prompt: question.prompt, choiceA: question.choiceA, choiceB: question.choiceB, choiceC: question.choiceC, choiceD: question.choiceD, correctChoice: question.correctChoice, explanation: question.explanation ?? null, difficulty: question.difficulty ?? null, audioUrl: question.audioUrl ?? null, createdAt: new Date(question.createdAt), updatedAt: new Date(question.createdAt) },
        update: { prompt: question.prompt, choiceA: question.choiceA, choiceB: question.choiceB, choiceC: question.choiceC, choiceD: question.choiceD, correctChoice: question.correctChoice, explanation: question.explanation ?? null, difficulty: question.difficulty ?? null, audioUrl: question.audioUrl ?? null }
      });
    });
  }

  async updateQuestionForTeacher(teacherId: string, question: Question) {
    const result = await this.prisma.question.updateMany({
      where: { id: question.id, quizSet: { teacherId } },
      data: {
        prompt: question.prompt,
        choiceA: question.choiceA,
        choiceB: question.choiceB,
        choiceC: question.choiceC,
        choiceD: question.choiceD,
        correctChoice: question.correctChoice,
        explanation: question.explanation ?? null,
        difficulty: question.difficulty ?? null,
        audioUrl: question.audioUrl ?? null
      }
    });
    if (result.count !== 1) throw new Error("Question ownership validation failed.");
  }

  async saveQuestionAudioForTeacher(teacherId: string, questionId: string, mimeType: string, data: Buffer) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, quizSet: { teacherId } },
      select: { id: true }
    });
    const persistedData = Uint8Array.from(data);
    if (!question) throw new Error("Question audio ownership validation failed.");
    await this.prisma.questionAudio.upsert({
      where: { questionId },
      create: { questionId, mimeType, data: persistedData },
      update: { mimeType, data: persistedData }
    });
  }

  async getQuestionAudio(questionId: string): Promise<{ mimeType: string; data: Buffer } | undefined> {
    const audio = await this.prisma.questionAudio.findUnique({
      where: { questionId },
      select: { mimeType: true, data: true }
    });
    return audio ? { mimeType: audio.mimeType, data: Buffer.from(audio.data) } : undefined;
  }

  async deleteQuestionAudio(questionId: string) {
    await this.prisma.questionAudio.deleteMany({ where: { questionId } });
  }

  async deleteQuestionForTeacher(teacherId: string, questionId: string) {
    const result = await this.prisma.question.deleteMany({
      where: { id: questionId, quizSet: { teacherId } }
    });
    return result.count === 1;
  }

  async deleteFolder(teacherId: string, id: string) {
    await this.prisma.folder.deleteMany({ where: { id, teacherId } });
  }

  async updateQuizSetLibrary(teacherId: string, id: string, update: {
    title?: string;
    description?: string | null;
    folderId?: string | null;
    visibility?: "PRIVATE" | "PUBLIC";
    subject?: string | null;
    topic?: string | null;
    gradeLevel?: string | null;
    language?: string | null;
    tags?: string[];
    publishedAt?: Date | null;
  }) {
    await this.prisma.quizSet.updateMany({
      where: { id, teacherId },
      data: {
        ...(update.title !== undefined ? { title: update.title } : {}),
        ...(update.description !== undefined ? { description: update.description } : {}),
        ...(update.folderId !== undefined ? { folderId: update.folderId } : {}),
        ...(update.visibility !== undefined ? { visibility: update.visibility, publishedAt: update.publishedAt ?? null } : {}),
        ...(update.subject !== undefined ? { subject: update.subject } : {}),
        ...(update.topic !== undefined ? { topic: update.topic } : {}),
        ...(update.gradeLevel !== undefined ? { gradeLevel: update.gradeLevel } : {}),
        ...(update.language !== undefined ? { language: update.language } : {}),
        ...(update.tags !== undefined ? { tagsJson: update.tags as Prisma.InputJsonValue } : {})
      }
    });
  }

  async deleteQuizSet(teacherId: string, id: string) {
    await this.prisma.quizSet.deleteMany({ where: { id, teacherId } });
  }

  async searchPublicStudySets(input: {
    query?: string;
    subject?: string;
    gradeLevel?: string;
    language?: string;
    sort?: "relevant" | "used" | "newest";
    page: number;
    pageSize: number;
  }): Promise<{ items: StudySetSummary[]; page: number; pageSize: number; total: number }> {
    const query = input.query?.trim();
    const where: Prisma.QuizSetWhereInput = {
      visibility: "PUBLIC",
      status: "ACTIVE",
      ...(input.subject ? { subject: { equals: input.subject, mode: "insensitive" } } : {}),
      ...(input.gradeLevel ? { gradeLevel: { equals: input.gradeLevel, mode: "insensitive" } } : {}),
      ...(input.language ? { language: { equals: input.language, mode: "insensitive" } } : {}),
      ...(query ? {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { subject: { contains: query, mode: "insensitive" } },
          { topic: { contains: query, mode: "insensitive" } },
          { teacher: { name: { contains: query, mode: "insensitive" } } },
          { originalCreator: { name: { contains: query, mode: "insensitive" } } }
        ]
      } : {})
    };
    const orderBy: Prisma.QuizSetOrderByWithRelationInput[] = input.sort === "used"
      ? [{ uniqueTeacherUsageCount: "desc" }, { usageCount: "desc" }, { updatedAt: "desc" }, { id: "desc" }]
      : input.sort === "newest"
        ? [{ createdAt: "desc" }, { id: "desc" }]
        : [{ updatedAt: "desc" }, { uniqueTeacherUsageCount: "desc" }, { createdAt: "desc" }, { id: "desc" }];
    const page = Math.max(1, Math.floor(input.page));
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize)));
    const totalPromise = this.prisma.quizSet.count({ where });
    let rows: PublicStudySetRow[];
    if (query && input.sort === "relevant") {
      const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
      const containsPattern = `%${escapedQuery}%`;
      const prefixPattern = `${escapedQuery}%`;
      const rankedIds = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT q."id"
        FROM "QuizSet" q
        JOIN "User" owner ON owner."id" = q."teacherId"
        LEFT JOIN "User" original_creator ON original_creator."id" = q."originalCreatorId"
        WHERE q."visibility" = 'PUBLIC' AND q."status" = 'ACTIVE'
          ${input.subject ? Prisma.sql`AND lower(q."subject") = lower(${input.subject})` : Prisma.empty}
          ${input.gradeLevel ? Prisma.sql`AND lower(q."gradeLevel") = lower(${input.gradeLevel})` : Prisma.empty}
          ${input.language ? Prisma.sql`AND lower(q."language") = lower(${input.language})` : Prisma.empty}
          AND (
            q."title" ILIKE ${containsPattern} ESCAPE '\\'
            OR q."description" ILIKE ${containsPattern} ESCAPE '\\'
            OR q."subject" ILIKE ${containsPattern} ESCAPE '\\'
            OR q."topic" ILIKE ${containsPattern} ESCAPE '\\'
            OR owner."name" ILIKE ${containsPattern} ESCAPE '\\'
            OR original_creator."name" ILIKE ${containsPattern} ESCAPE '\\'
          )
        ORDER BY
          CASE
            WHEN lower(q."title") = lower(${query}) THEN 0
            WHEN q."title" ILIKE ${prefixPattern} ESCAPE '\\' THEN 1
            WHEN q."title" ILIKE ${containsPattern} ESCAPE '\\' THEN 2
            WHEN q."subject" ILIKE ${containsPattern} ESCAPE '\\' OR q."topic" ILIKE ${containsPattern} ESCAPE '\\' THEN 3
            WHEN q."description" ILIKE ${containsPattern} ESCAPE '\\' THEN 4
            ELSE 5
          END,
          q."uniqueTeacherUsageCount" DESC,
          q."updatedAt" DESC,
          q."id" DESC
        OFFSET ${(page - 1) * pageSize}
        LIMIT ${pageSize}
      `);
      const unordered = await this.prisma.quizSet.findMany({ where: { id: { in: rankedIds.map((row) => row.id) } }, include: publicStudySetInclude });
      const rowsById = new Map(unordered.map((row) => [row.id, row]));
      rows = rankedIds.flatMap((row) => {
        const match = rowsById.get(row.id);
        return match ? [match] : [];
      });
    } else {
      rows = await this.prisma.quizSet.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: publicStudySetInclude
      });
    }
    const total = await totalPromise;
    const creatorIds = [...new Set(rows.map((row) => row.teacher.id))];
    const pointsByCreator = await this.prisma.contributionEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: creatorIds } },
      _sum: { points: true }
    });
    const recognitionByCreator = new Map(pointsByCreator.map((row) => [row.userId, getRecognitionLevel(row._sum.points ?? 0).name]));
    const items = rows.map((row) => {
      const creator = row.teacher;
      return {
        id: row.id,
        title: row.title,
        ...(row.description ? { description: row.description } : {}),
        ...(row.subject ? { subject: row.subject } : {}),
        ...(row.topic ? { topic: row.topic } : {}),
        ...(row.gradeLevel ? { gradeLevel: row.gradeLevel } : {}),
        ...(row.language ? { language: row.language } : {}),
        tags: Array.isArray(row.tagsJson) ? row.tagsJson.filter((tag): tag is string => typeof tag === "string") : [],
        visibility: row.visibility,
        questionCount: row._count.questions,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ...(row.publishedAt ? { publishedAt: row.publishedAt.toISOString() } : {}),
        usageCount: row.usageCount,
        uniqueTeacherUsageCount: row.uniqueTeacherUsageCount,
        remixCount: row.remixCount,
        creator: { id: creator.id, name: creator.name, recognitionLevel: recognitionByCreator.get(creator.id) ?? "Teacher" }
      } satisfies StudySetSummary;
    });
    return { items, page, pageSize, total };
  }

  async recordStudySetCreated(input: { teacherId: string; studySetId: string; contentFingerprint: string; isFirstSet: boolean; isRemix: boolean }) {
    await this.prisma.$transaction(async (tx) => {
      if (input.isRemix) return;
      const setKey = `study-set-created:${input.studySetId}:valid`;
      const contentKey = `study-set-content:${input.teacherId}:${input.contentFingerprint}`;
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.teacherId}))`);
      const [setEvent, contentEvent] = await Promise.all([
        tx.contributionEvent.findUnique({ where: { eventKey: setKey }, select: { id: true } }),
        tx.contributionEvent.findUnique({ where: { eventKey: contentKey }, select: { id: true } })
      ]);
      if (!setEvent) {
        await tx.contributionEvent.create({
          data: { eventKey: setKey, userId: input.teacherId, type: "STUDY_SET_CREATED", points: contentEvent ? 0 : CONTRIBUTION_POINTS.validStudySet, studySetId: input.studySetId }
        });
      }
      if (!contentEvent) {
        await tx.contributionEvent.create({
          data: { eventKey: contentKey, userId: input.teacherId, type: "STUDY_SET_CREATED", points: 0, studySetId: input.studySetId, metadataJson: { contentFingerprint: input.contentFingerprint } }
        });
      }
      if (input.isFirstSet) {
        const previousFirstReward = await tx.contributionEvent.findFirst({
          where: { userId: input.teacherId, type: "STUDY_SET_CREATED", points: CONTRIBUTION_POINTS.firstStudySet },
          select: { id: true }
        });
        if (!previousFirstReward) await tx.contributionEvent.create({
          data: { eventKey: `study-set-created:${input.teacherId}:first`, userId: input.teacherId, type: "STUDY_SET_CREATED", points: CONTRIBUTION_POINTS.firstStudySet, studySetId: input.studySetId }
        });
      }
    });
    await this.ensureRecognitionBadges(input.teacherId);
  }

  async recordStudySetPublished(input: { teacherId: string; studySetId: string }) {
    await this.prisma.contributionEvent.upsert({
      where: { eventKey: `study-set-published:${input.studySetId}` },
      create: { eventKey: `study-set-published:${input.studySetId}`, userId: input.teacherId, type: "STUDY_SET_PUBLISHED", points: CONTRIBUTION_POINTS.publishStudySet, studySetId: input.studySetId },
      update: {}
    });
    await this.ensureRecognitionBadges(input.teacherId);
  }

  async recordStudySetDuplicated(input: { teacherId: string; studySetId: string; originalSetId: string }) {
    const eventKey = `study-set-duplicated:${input.studySetId}`;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${eventKey}))`);
      const existing = await tx.contributionEvent.findUnique({ where: { eventKey }, select: { id: true } });
      if (existing) return false;
      await tx.contributionEvent.create({
        data: { eventKey, userId: input.teacherId, type: "STUDY_SET_DUPLICATED", points: 0, studySetId: input.studySetId, metadataJson: { originalSetId: input.originalSetId } }
      });
      await tx.quizSet.update({ where: { id: input.originalSetId }, data: { remixCount: { increment: 1 } } });
      return true;
    });
  }

  async recordStudySetUse(input: { studySetId: string; ownerTeacherId: string; consumerTeacherId: string; sessionId: string }): Promise<StudySetUseResult> {
    let added = false;
    let externalTeacherAdded = false;
    let uniqueTeacherCount = 0;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${input.studySetId}:${input.consumerTeacherId}`}))`);
      const existing = await tx.studySetUsage.findUnique({ where: { sessionId: input.sessionId } });
      if (existing) return;
      await tx.studySetUsage.create({ data: { quizSetId: input.studySetId, consumerTeacherId: input.consumerTeacherId, sessionId: input.sessionId } });
      added = true;
      await tx.quizSet.update({ where: { id: input.studySetId }, data: { usageCount: { increment: 1 } } });
      await tx.contributionEvent.upsert({
        where: { eventKey: `study-set-used:${input.sessionId}` },
        create: { eventKey: `study-set-used:${input.sessionId}`, userId: input.ownerTeacherId, type: "STUDY_SET_USED", points: 0, studySetId: input.studySetId, sessionId: input.sessionId },
        update: {}
      });
      if (input.ownerTeacherId === input.consumerTeacherId) return;
      const previousUse = await tx.studySetUsage.findFirst({ where: { quizSetId: input.studySetId, consumerTeacherId: input.consumerTeacherId, sessionId: { not: input.sessionId } }, select: { id: true } });
      if (previousUse) return;
      externalTeacherAdded = true;
      await tx.contributionEvent.upsert({
        where: { eventKey: `creator-reuse:${input.studySetId}:${input.consumerTeacherId}` },
        create: { eventKey: `creator-reuse:${input.studySetId}:${input.consumerTeacherId}`, userId: input.ownerTeacherId, type: "CREATOR_REUSE_CREDITED", points: CONTRIBUTION_POINTS.uniqueTeacherUse, studySetId: input.studySetId, sessionId: input.sessionId },
        update: {}
      });
      const uniqueUsage = await tx.studySetUsage.findMany({ where: { quizSetId: input.studySetId, consumerTeacherId: { not: input.ownerTeacherId } }, distinct: ["consumerTeacherId"], select: { consumerTeacherId: true } });
      uniqueTeacherCount = uniqueUsage.length;
      await tx.quizSet.update({ where: { id: input.studySetId }, data: { uniqueTeacherUsageCount: uniqueUsage.length } });
      for (const [threshold, points] of Object.entries(CONTRIBUTION_POINTS.usageMilestones)) {
        if (uniqueUsage.length >= Number(threshold)) {
          await tx.contributionEvent.upsert({
            where: { eventKey: `usage-milestone:${input.studySetId}:${threshold}` },
            create: { eventKey: `usage-milestone:${input.studySetId}:${threshold}`, userId: input.ownerTeacherId, type: "CREATOR_REUSE_CREDITED", points, studySetId: input.studySetId },
            update: {}
          });
        }
      }
    });
    if (added) await this.ensureRecognitionBadges(input.ownerTeacherId);
    return { added, externalTeacherAdded, uniqueTeacherCount };
  }

  async recordGameCompleted(input: { teacherId: string; sessionId: string; studentCount: number }) {
    await this.prisma.contributionEvent.upsert({
      where: { eventKey: `game-completed:${input.sessionId}` },
      create: { eventKey: `game-completed:${input.sessionId}`, userId: input.teacherId, type: "GAME_COMPLETED", points: CONTRIBUTION_POINTS.completedGame, sessionId: input.sessionId, metadataJson: { studentCount: input.studentCount } },
      update: {}
    });
    await this.ensureRecognitionBadges(input.teacherId);
  }

  async getRecognitionSummary(teacherId: string): Promise<RecognitionSummary> {
    await this.ensureRecognitionBadges(teacherId);
    return buildRecognitionSummary(await this.getRecognitionStats(teacherId));
  }

  private async getRecognitionStats(teacherId: string): Promise<RecognitionStats> {
    const [points, validCreationEvents, publishEvents, completedGameEvents, reuseEvents, totalSetUses, badgeRows] = await Promise.all([
      this.prisma.contributionEvent.aggregate({ where: { userId: teacherId }, _sum: { points: true } }),
      this.prisma.contributionEvent.count({ where: { userId: teacherId, type: "STUDY_SET_CREATED", points: CONTRIBUTION_POINTS.validStudySet } }),
      this.prisma.contributionEvent.count({ where: { userId: teacherId, type: "STUDY_SET_PUBLISHED" } }),
      this.prisma.contributionEvent.findMany({ where: { userId: teacherId, type: "GAME_COMPLETED" }, select: { metadataJson: true } }),
      this.prisma.contributionEvent.findMany({ where: { userId: teacherId, eventKey: { startsWith: "creator-reuse:" } }, select: { eventKey: true } }),
      this.prisma.contributionEvent.count({ where: { userId: teacherId, type: "STUDY_SET_USED" } }),
      this.prisma.contributionBadge.findMany({ where: { userId: teacherId }, select: { id: true, badgeId: true, earnedAt: true }, orderBy: [{ earnedAt: "asc" }, { id: "asc" }] })
    ]);
    const studentCountFromEvent = (metadata: Prisma.JsonValue) => {
      if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return 0;
      const value = (metadata as Prisma.JsonObject).studentCount;
      return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    };
    return {
      points: points._sum.points ?? 0,
      studySetsCreated: validCreationEvents,
      publicSetsShared: publishEvents,
      gamesHosted: completedGameEvents.length,
      studentsReached: completedGameEvents.reduce((sum, event) => sum + studentCountFromEvent(event.metadataJson), 0),
      teachersUsingSets: new Set(reuseEvents.map((event) => event.eventKey.slice(event.eventKey.lastIndexOf(":") + 1))).size,
      totalSetUses,
      badgeRows: badgeRows.map((badge) => ({ id: badge.id, badgeId: badge.badgeId, earnedAt: badge.earnedAt.toISOString() }))
    };
  }

  private async ensureRecognitionBadges(teacherId: string) {
    const stats = await this.getRecognitionStats(teacherId);
    for (const badgeId of badgeIdsForStats(stats)) {
      await this.prisma.$transaction([
        this.prisma.contributionBadge.upsert({
          where: { userId_badgeId: { userId: teacherId, badgeId } },
          create: { userId: teacherId, badgeId },
          update: {}
        }),
        this.prisma.contributionEvent.upsert({
          where: { eventKey: `badge-earned:${teacherId}:${badgeId}` },
          create: { eventKey: `badge-earned:${teacherId}:${badgeId}`, userId: teacherId, type: "BADGE_EARNED", points: 0, metadataJson: { badgeId } },
          update: {}
        })
      ]);
    }
  }

  async saveReport(metadata: ReportMetadata, report: SessionReport) {
    const createdAt = new Date(metadata.createdAt);
    await this.prisma.$transaction(async (tx) => {
      // PostgreSQL transaction-scoped advisory locks serialize retention for a
      // teacher even when several server instances finish matches together.
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${metadata.teacherId}))`);
      await tx.report.upsert({
        where: { teacherId_sessionId: { teacherId: metadata.teacherId, sessionId: metadata.sessionId } },
        create: {
          id: metadata.id,
          teacherId: metadata.teacherId,
          sessionId: metadata.sessionId,
          sessionCode: metadata.sessionCode,
          quizSetId: metadata.quizSetId || null,
          quizSetName: metadata.quizSetName,
          displayName: metadata.displayName,
          detailJson: report as unknown as Prisma.InputJsonValue,
          createdAt
        },
        update: {
          sessionCode: metadata.sessionCode,
          quizSetId: metadata.quizSetId || null,
          quizSetName: metadata.quizSetName,
          displayName: metadata.displayName,
          detailJson: report as unknown as Prisma.InputJsonValue
        }
      });

      const retained = await tx.report.findMany({
        where: { teacherId: metadata.teacherId },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      });
      const expiredIds = retained.slice(MAX_SAVED_REPORTS).map((row) => row.id);
      if (expiredIds.length > 0) await tx.report.deleteMany({ where: { id: { in: expiredIds }, teacherId: metadata.teacherId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async saveSession(session: GameSession, quizSetName: string) {
    await this.prisma.gameSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        teacherId: session.teacherId,
        classId: session.classId ?? null,
        quizSetId: session.quizSetId,
        quizSetName,
        ...(session.questionSnapshot ? { questionSnapshotJson: session.questionSnapshot as unknown as Prisma.InputJsonValue } : {}),
        sessionCode: session.sessionCode,
        status: session.status,
        maxPlayers: session.maxPlayers,
        currentRound: session.currentRound,
        settingsJson: session.settings as unknown as Prisma.InputJsonValue,
        createdAt: new Date(session.createdAt),
        startedAt: session.startedAt ? new Date(session.startedAt) : null,
        endedAt: session.endedAt ? new Date(session.endedAt) : null
      },
      update: {
        classId: session.classId ?? null,
        quizSetId: session.quizSetId,
        quizSetName,
        ...(session.questionSnapshot ? { questionSnapshotJson: session.questionSnapshot as unknown as Prisma.InputJsonValue } : {}),
        status: session.status,
        currentRound: session.currentRound,
        settingsJson: session.settings as unknown as Prisma.InputJsonValue,
        startedAt: session.startedAt ? new Date(session.startedAt) : null,
        endedAt: session.endedAt ? new Date(session.endedAt) : null
      }
    });
  }

  async savePlayer(player: PlayerSession) {
    await this.prisma.playerSession.upsert({
      where: { id: player.id },
      create: {
        id: player.id,
        gameSessionId: player.gameSessionId,
        nickname: player.nickname,
        team: player.team,
        money: player.money,
        isAlive: player.isAlive,
        score: player.score,
        correctAnswers: player.correctAnswers,
        wrongAnswers: player.wrongAnswers,
        gear: player.gear,
        joinedAt: new Date(player.joinedAt)
      },
      update: {
        money: player.money,
        isAlive: player.isAlive,
        score: player.score,
        correctAnswers: player.correctAnswers,
        wrongAnswers: player.wrongAnswers,
        gear: player.gear
      }
    });
  }

  async saveAnswer(answer: AnswerLog, question: Question) {
    await this.prisma.answerLog.upsert({
      where: { id: answer.id },
      create: {
        id: answer.id,
        gameSessionId: answer.gameSessionId,
        playerSessionId: answer.playerSessionId,
        questionId: answer.questionId,
        questionPrompt: question.prompt,
        correctChoice: question.correctChoice,
        selectedChoice: answer.selectedChoice,
        isCorrect: answer.isCorrect,
        moneyAwarded: answer.moneyAwarded,
        responseTimeMs: answer.responseTimeMs ?? null,
        answeredAt: new Date(answer.answeredAt)
      },
      update: {
        selectedChoice: answer.selectedChoice,
        isCorrect: answer.isCorrect,
        moneyAwarded: answer.moneyAwarded,
        responseTimeMs: answer.responseTimeMs ?? null
      }
    });
  }
}
