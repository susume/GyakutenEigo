import { Prisma, PrismaClient } from "@prisma/client";
import type { ClassSummary, Question, QuizFolder, QuizSet, ReportMetadata, SessionReport } from "@quizstrike/shared";
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

  async saveFolder(folder: QuizFolder) {
    await this.prisma.folder.upsert({
      where: { id: folder.id },
      create: { id: folder.id, teacherId: folder.teacherId, parentId: folder.parentId ?? null, name: folder.name, createdAt: new Date(folder.createdAt), updatedAt: new Date(folder.updatedAt) },
      update: { teacherId: folder.teacherId, parentId: folder.parentId ?? null, name: folder.name, updatedAt: new Date(folder.updatedAt) }
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
    await this.prisma.quizSet.upsert({
      where: { id: quiz.id },
      create: { id: quiz.id, teacherId: quiz.teacherId, classId: quiz.classId ?? null, folderId: quiz.folderId ?? null, title: quiz.title, description: quiz.description ?? null, createdAt: new Date(quiz.createdAt), updatedAt: new Date(quiz.updatedAt ?? quiz.createdAt) },
      update: { teacherId: quiz.teacherId, classId: quiz.classId ?? null, folderId: quiz.folderId ?? null, title: quiz.title, description: quiz.description ?? null }
    });
  }

  async saveQuestion(question: Question) {
    await this.prisma.question.upsert({
      where: { id: question.id },
      create: { id: question.id, quizSetId: question.quizSetId, prompt: question.prompt, choiceA: question.choiceA, choiceB: question.choiceB, choiceC: question.choiceC, choiceD: question.choiceD, correctChoice: question.correctChoice, explanation: question.explanation ?? null, difficulty: question.difficulty ?? null, createdAt: new Date(question.createdAt), updatedAt: new Date(question.createdAt) },
      update: { quizSetId: question.quizSetId, prompt: question.prompt, choiceA: question.choiceA, choiceB: question.choiceB, choiceC: question.choiceC, choiceD: question.choiceD, correctChoice: question.correctChoice, explanation: question.explanation ?? null, difficulty: question.difficulty ?? null }
    });
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
    });
  }
}
