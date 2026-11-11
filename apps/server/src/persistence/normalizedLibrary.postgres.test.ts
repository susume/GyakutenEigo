import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SESSION_SETTINGS, type ReportMetadata, type SessionReport } from "@quizstrike/shared";
import { NormalizedLibrary } from "./normalizedLibrary.js";

const databaseUrl = process.env.QUIZSTRIKE_TEST_DATABASE_URL;

test("PostgreSQL advisory locks permit report and contribution writes", { skip: !databaseUrl }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const library = new NormalizedLibrary(prisma);
  const teacherId = randomUUID();
  const studySetId = randomUUID();
  const remixId = randomUUID();
  const sessionId = randomUUID();
  const createdAt = "2026-11-11T00:00:00.000Z";
  try {
    await prisma.user.create({ data: { id: teacherId, email: `${teacherId}@example.test`, name: "Test teacher", passwordHash: "test" } });
    await prisma.quizSet.createMany({ data: [
      { id: studySetId, teacherId, title: "Original Study Set" },
      { id: remixId, teacherId, title: "Remixed Study Set", originalSetId: studySetId }
    ] });
    await library.recordStudySetCreated({ teacherId, studySetId, contentFingerprint: studySetId, isFirstSet: true, isRemix: false });
    assert.equal(await library.recordStudySetDuplicated({ teacherId, studySetId: remixId, originalSetId: studySetId }), true);
    const uses = await Promise.all(Array.from({ length: 2 }, () => library.recordStudySetUse({
      studySetId, ownerTeacherId: teacherId, consumerTeacherId: teacherId, sessionId
    })));
    assert.equal(uses.filter((use) => use.added).length, 1);
    const set = await prisma.quizSet.findUniqueOrThrow({ where: { id: studySetId } });
    assert.equal(set.usageCount, 1);
    assert.equal(set.remixCount, 1);
    assert.ok(await prisma.contributionEvent.findUnique({ where: { eventKey: `study-set-created:${studySetId}:valid` } }));

    const metadata: ReportMetadata = {
      id: randomUUID(), teacherId, sessionId, sessionCode: "TEST01", quizSetId: studySetId,
      quizSetName: set.title, displayName: "Test report", createdAt
    };
    const report: SessionReport = {
      session: {
        id: sessionId, teacherId, sessionCode: metadata.sessionCode, quizSetId: studySetId, status: "ended",
        maxPlayers: DEFAULT_SESSION_SETTINGS.maxPlayers, currentRound: 1, settings: DEFAULT_SESSION_SETTINGS,
        players: [], events: [], createdAt
      },
      rows: [],
      missedQuestions: []
    };
    await library.saveReport(metadata, report);
    assert.deepEqual((await library.getReport(teacherId, metadata.id))?.report, report);
  } finally {
    try {
      await prisma.user.deleteMany({ where: { id: teacherId } });
    } finally {
      await prisma.$disconnect();
    }
  }
});
