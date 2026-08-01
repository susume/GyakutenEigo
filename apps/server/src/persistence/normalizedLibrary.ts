import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AnswerLog,
  ClassSummary,
  GameSession,
  PlayerSession,
  Question,
  QuizFolder,
  QuizSet,
  ReportMetadata,
  SessionReport,
  TeacherUser
} from "@quizstrike/shared";
import { MAX_SAVED_REPORTS } from "../teacherLibrary.js";

type PrismaLike = PrismaClient;
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
        create: { id: quiz.id, teacherId: quiz.teacherId, classId: quiz.classId ?? null, folderId: quiz.folderId ?? null, title: quiz.title, description: quiz.description ?? null, settingsJson, createdAt: new Date(quiz.createdAt), updatedAt: new Date(quiz.updatedAt ?? quiz.createdAt) },
        update: { classId: quiz.classId ?? null, folderId: quiz.folderId ?? null, title: quiz.title, description: quiz.description ?? null, settingsJson }
      });
    });
  }

  async saveQuestionForTeacher(teacherId: string, question: Question) {
    await this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quizSet.findFirst({ where: { id: question.quizSetId, teacherId }, select: { id: true } });
      if (!quiz) throw new Error("Question quiz ownership validation failed.");
      await tx.question.upsert({
        where: { id: question.id },
        create: { id: question.id, quizSetId: question.quizSetId, prompt: question.prompt, choiceA: question.choiceA, choiceB: question.choiceB, choiceC: question.choiceC, choiceD: question.choiceD, correctChoice: question.correctChoice, explanation: question.explanation ?? null, difficulty: question.difficulty ?? null, createdAt: new Date(question.createdAt), updatedAt: new Date(question.createdAt) },
        update: { prompt: question.prompt, choiceA: question.choiceA, choiceB: question.choiceB, choiceC: question.choiceC, choiceD: question.choiceD, correctChoice: question.correctChoice, explanation: question.explanation ?? null, difficulty: question.difficulty ?? null }
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
        difficulty: question.difficulty ?? null
      }
    });
    if (result.count !== 1) throw new Error("Question ownership validation failed.");
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

  async updateQuizSetLibrary(teacherId: string, id: string, update: { title?: string; folderId?: string | null }) {
    await this.prisma.quizSet.updateMany({ where: { id, teacherId }, data: { ...(update.title !== undefined ? { title: update.title } : {}), ...(update.folderId !== undefined ? { folderId: update.folderId } : {}) } });
  }

  async deleteQuizSet(teacherId: string, id: string) {
    await this.prisma.quizSet.deleteMany({ where: { id, teacherId } });
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
