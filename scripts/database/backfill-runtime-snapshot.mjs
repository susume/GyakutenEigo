import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const batchSizeArg = process.argv.find((argument) => argument.startsWith("--batch-size="));
const batchSize = Math.max(1, Math.min(1_000, Number(batchSizeArg?.split("=")[1]) || 100));
const asArray = (value) => Array.isArray(value) ? value : [];
const asString = (value, fallback = "") => typeof value === "string" && value.trim() ? value : fallback;
const asDate = (value, fallback = new Date()) => {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? fallback : date;
};
const asInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const status = (value) => ["waiting", "active", "paused", "ended"].includes(value) ? value : "waiting";
const team = (value) => value === "red" ? "red" : "blue";
const inBatches = function* (values) {
  for (let offset = 0; offset < values.length; offset += batchSize) {
    yield values.slice(offset, offset + batchSize);
  }
};

const counts = { snapshotsInspected: 0, users: 0, classes: 0, folders: 0, quizSets: 0, questions: 0, sessions: 0, players: 0, answers: 0, reports: 0, skipped: 0, duplicates: 0, validationFailures: 0 };
const skip = (kind, id) => {
  counts.skipped += 1;
  counts.validationFailures += 1;
  console.warn(`[backfill] skipped ${kind}${id ? ` ${id}` : ""}`);
};

const run = async () => {
  const snapshot = await prisma.runtimeSnapshot.findUnique({ where: { id: "primary" } });
  if (!snapshot) {
    console.log("[backfill] No primary RuntimeSnapshot found; nothing to backfill.");
    return;
  }
  counts.snapshotsInspected = 1;
  const state = snapshot.data && typeof snapshot.data === "object" ? snapshot.data : {};
  const knownSnapshotFields = new Set(["users", "classes", "folders", "quizSets", "sessions", "answers", "reports"]);
  const unknownSnapshotFields = Object.keys(state).filter((key) => !knownSnapshotFields.has(key));
  if (unknownSnapshotFields.length > 0) console.warn(`[backfill] preserved unknown snapshot fields: ${unknownSnapshotFields.join(", ")}`);
  const users = asArray(state.users);
  const classes = asArray(state.classes);
  const folders = asArray(state.folders);
  const quizSets = asArray(state.quizSets);
  const sessions = asArray(state.sessions);
  const answers = asArray(state.answers);
  const reports = asArray(state.reports);
  console.log(`[backfill] ${dryRun ? "dry run for" : "backfilling"} snapshot ${snapshot.updatedAt.toISOString()} in batches of ${batchSize}`);

  if (!dryRun) {
    for (const batch of inBatches(users)) {
      for (const user of batch) {
      if (!user?.id || !user.email || !user.passwordHash) { skip("user", user?.id); continue; }
      await prisma.user.upsert({
        where: { id: user.id },
        create: { id: user.id, name: asString(user.name, "Teacher"), email: user.email, passwordHash: user.passwordHash, role: user.role === "admin" ? "admin" : "teacher", createdAt: asDate(user.createdAt), updatedAt: asDate(user.updatedAt, asDate(user.createdAt)) },
        update: { name: asString(user.name, "Teacher"), email: user.email, passwordHash: user.passwordHash, role: user.role === "admin" ? "admin" : "teacher" }
      });
      counts.users += 1;
      }
    }

    for (const batch of inBatches(classes)) {
      for (const item of batch) {
      if (!item?.id || !item.teacherId || !(await prisma.user.findUnique({ where: { id: item.teacherId }, select: { id: true } }))) { skip("class", item?.id); continue; }
      await prisma.class.upsert({
        where: { id: item.id },
        create: { id: item.id, teacherId: item.teacherId, name: asString(item.name, "Class"), description: item.description || null, createdAt: asDate(item.createdAt), updatedAt: asDate(item.updatedAt, asDate(item.createdAt)) },
        update: { teacherId: item.teacherId, name: asString(item.name, "Class"), description: item.description || null }
      });
      counts.classes += 1;
      }
    }

    const pendingFolders = folders.filter((folder) => folder?.id && folder.teacherId);
    const savedFolders = new Set();
    let madeProgress = true;
    while (pendingFolders.length > 0 && madeProgress) {
      madeProgress = false;
      for (const folder of [...pendingFolders]) {
        if (!(await prisma.user.findUnique({ where: { id: folder.teacherId }, select: { id: true } }))) { skip("folder", folder.id); pendingFolders.splice(pendingFolders.indexOf(folder), 1); continue; }
        if (folder.parentId && !savedFolders.has(folder.parentId) && !(await prisma.folder.findUnique({ where: { id: folder.parentId }, select: { id: true } }))) continue;
        await prisma.folder.upsert({
          where: { id: folder.id },
          create: { id: folder.id, teacherId: folder.teacherId, parentId: folder.parentId || null, name: asString(folder.name, "Folder"), createdAt: asDate(folder.createdAt), updatedAt: asDate(folder.updatedAt, asDate(folder.createdAt)) },
          update: { teacherId: folder.teacherId, parentId: folder.parentId || null, name: asString(folder.name, "Folder") }
        });
        savedFolders.add(folder.id);
        pendingFolders.splice(pendingFolders.indexOf(folder), 1);
        counts.folders += 1;
        madeProgress = true;
      }
    }
    for (const folder of pendingFolders) skip("folder cycle or missing parent", folder.id);

    for (const batch of inBatches(quizSets)) {
      for (const quiz of batch) {
      if (!quiz?.id || !quiz.teacherId || !(await prisma.user.findUnique({ where: { id: quiz.teacherId }, select: { id: true } }))) { skip("quiz set", quiz?.id); continue; }
      const classExists = quiz.classId ? await prisma.class.findFirst({ where: { id: quiz.classId, teacherId: quiz.teacherId }, select: { id: true } }) : null;
      const folderExists = quiz.folderId ? await prisma.folder.findFirst({ where: { id: quiz.folderId, teacherId: quiz.teacherId }, select: { id: true } }) : null;
      await prisma.quizSet.upsert({
        where: { id: quiz.id },
        create: { id: quiz.id, teacherId: quiz.teacherId, classId: classExists?.id ?? null, folderId: folderExists?.id ?? null, title: asString(quiz.title, "Quiz Set"), description: quiz.description || null, settingsJson: quiz, createdAt: asDate(quiz.createdAt), updatedAt: asDate(quiz.updatedAt, asDate(quiz.createdAt)) },
        update: { teacherId: quiz.teacherId, classId: classExists?.id ?? null, folderId: folderExists?.id ?? null, title: asString(quiz.title, "Quiz Set"), description: quiz.description || null, settingsJson: quiz }
      });
      counts.quizSets += 1;
      for (const question of asArray(quiz.questions)) {
        if (!question?.id) { skip("question", question?.id); continue; }
        await prisma.question.upsert({
          where: { id: question.id },
          create: { id: question.id, quizSetId: quiz.id, prompt: asString(question.prompt), choiceA: asString(question.choiceA), choiceB: asString(question.choiceB), choiceC: asString(question.choiceC), choiceD: asString(question.choiceD), correctChoice: asString(question.correctChoice, "A"), explanation: question.explanation || null, difficulty: question.difficulty || null, createdAt: asDate(question.createdAt), updatedAt: asDate(question.updatedAt, asDate(question.createdAt)) },
          update: { quizSetId: quiz.id, prompt: asString(question.prompt), choiceA: asString(question.choiceA), choiceB: asString(question.choiceB), choiceC: asString(question.choiceC), choiceD: asString(question.choiceD), correctChoice: asString(question.correctChoice, "A"), explanation: question.explanation || null, difficulty: question.difficulty || null }
        });
        counts.questions += 1;
      }
      }
    }

    for (const batch of inBatches(sessions)) {
      for (const session of batch) {
      if (!session?.id || !session.teacherId || !session.quizSetId) { skip("session", session?.id); continue; }
      const teacherExists = await prisma.user.findUnique({ where: { id: session.teacherId }, select: { id: true } });
      const quizExists = await prisma.quizSet.findFirst({ where: { id: session.quizSetId, teacherId: session.teacherId }, select: { id: true } });
      if (!teacherExists || !quizExists) { skip("session", session.id); continue; }
      const classExists = session.classId ? await prisma.class.findFirst({ where: { id: session.classId, teacherId: session.teacherId }, select: { id: true } }) : null;
      await prisma.gameSession.upsert({
        where: { id: session.id },
        create: { id: session.id, teacherId: session.teacherId, classId: classExists?.id ?? null, quizSetId: session.quizSetId, quizSetName: asString(quizSets.find((quiz) => quiz.id === session.quizSetId)?.title, "Quiz Set"), sessionCode: asString(session.sessionCode, session.id.slice(0, 6)), status: status(session.status), maxPlayers: asInt(session.maxPlayers, 20), currentRound: asInt(session.currentRound, 1), settingsJson: session.settings ?? {}, createdAt: asDate(session.createdAt), updatedAt: asDate(session.updatedAt, asDate(session.createdAt)), startedAt: session.startedAt ? asDate(session.startedAt) : null, endedAt: session.endedAt ? asDate(session.endedAt) : null }
        , update: { classId: classExists?.id ?? null, quizSetId: session.quizSetId, quizSetName: asString(quizSets.find((quiz) => quiz.id === session.quizSetId)?.title, "Quiz Set"), sessionCode: asString(session.sessionCode, session.id.slice(0, 6)), status: status(session.status), maxPlayers: asInt(session.maxPlayers, 20), currentRound: asInt(session.currentRound, 1), settingsJson: session.settings ?? {}, startedAt: session.startedAt ? asDate(session.startedAt) : null, endedAt: session.endedAt ? asDate(session.endedAt) : null }
      });
      counts.sessions += 1;
      for (const player of asArray(session.players)) {
        if (!player?.id || !player.nickname) { skip("player", player?.id); continue; }
        await prisma.playerSession.upsert({
          where: { id: player.id },
          create: { id: player.id, gameSessionId: session.id, nickname: player.nickname, team: team(player.team), money: asInt(player.money), isAlive: player.isAlive !== false, score: asInt(player.score), correctAnswers: asInt(player.correctAnswers), wrongAnswers: asInt(player.wrongAnswers), socketId: null, gear: asString(player.gear, "starter_blaster"), joinedAt: asDate(player.joinedAt), leftAt: null },
          update: { gameSessionId: session.id, nickname: player.nickname, team: team(player.team), money: asInt(player.money), isAlive: player.isAlive !== false, score: asInt(player.score), correctAnswers: asInt(player.correctAnswers), wrongAnswers: asInt(player.wrongAnswers), gear: asString(player.gear, "starter_blaster") }
        });
        counts.players += 1;
      }
      }
    }

    const [persistedSessions, persistedPlayers, persistedQuestions] = await Promise.all([
      prisma.gameSession.findMany({ select: { id: true } }),
      prisma.playerSession.findMany({ select: { id: true } }),
      prisma.question.findMany({ select: { id: true, prompt: true, correctChoice: true } })
    ]);
    const persistedSessionIds = new Set(persistedSessions.map((session) => session.id));
    const persistedPlayerIds = new Set(persistedPlayers.map((player) => player.id));
    const persistedQuestionById = new Map(persistedQuestions.map((question) => [question.id, question]));

    for (const batch of inBatches(answers)) {
      const rows = [];
      for (const answer of batch) {
        if (!answer?.id || !answer.gameSessionId || !answer.playerSessionId || !answer.questionId) { skip("answer", answer?.id); continue; }
        const question = persistedQuestionById.get(answer.questionId);
        if (!persistedSessionIds.has(answer.gameSessionId) || !persistedPlayerIds.has(answer.playerSessionId) || !question) { skip("answer", answer.id); continue; }
        rows.push(Prisma.sql`(
          ${answer.id},
          ${answer.gameSessionId},
          ${answer.playerSessionId},
          ${answer.questionId},
          ${question.prompt ?? ""},
          ${question.correctChoice ?? "A"},
          ${asString(answer.selectedChoice, "A")},
          ${answer.isCorrect === true},
          ${asInt(answer.moneyAwarded)},
          ${Number.isFinite(answer.responseTimeMs) ? asInt(answer.responseTimeMs) : null},
          ${asDate(answer.answeredAt)}
        )`);
      }
      if (rows.length === 0) continue;
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "AnswerLog" (
          "id", "gameSessionId", "playerSessionId", "questionId",
          "questionPrompt", "correctChoice", "selectedChoice", "isCorrect",
          "moneyAwarded", "responseTimeMs", "answeredAt"
        ) VALUES ${Prisma.join(rows)}
        ON CONFLICT ("id") DO UPDATE SET
          "gameSessionId" = EXCLUDED."gameSessionId",
          "playerSessionId" = EXCLUDED."playerSessionId",
          "questionId" = EXCLUDED."questionId",
          "questionPrompt" = EXCLUDED."questionPrompt",
          "correctChoice" = EXCLUDED."correctChoice",
          "selectedChoice" = EXCLUDED."selectedChoice",
          "isCorrect" = EXCLUDED."isCorrect",
          "moneyAwarded" = EXCLUDED."moneyAwarded",
          "responseTimeMs" = EXCLUDED."responseTimeMs",
          "answeredAt" = EXCLUDED."answeredAt"
      `);
      counts.answers += rows.length;
    }

    for (const batch of inBatches(reports)) {
      for (const stored of batch) {
      const detail = stored?.report;
      if (!stored?.id || !stored.teacherId || !detail?.session) { skip("report", stored?.id); continue; }
      if (!(await prisma.user.findUnique({ where: { id: stored.teacherId }, select: { id: true } }))) { skip("report", stored.id); continue; }
      const quizExists = stored.quizSetId ? await prisma.quizSet.findFirst({ where: { id: stored.quizSetId, teacherId: stored.teacherId }, select: { id: true } }) : null;
      await prisma.report.upsert({
        where: { id: stored.id },
        create: { id: stored.id, teacherId: stored.teacherId, sessionId: stored.sessionId || detail.session.id, sessionCode: asString(stored.sessionCode, detail.session.sessionCode), quizSetId: quizExists?.id ?? null, quizSetName: asString(stored.quizSetName, "Quiz Set"), displayName: asString(stored.displayName, `Report ${asString(stored.sessionCode, detail.session.sessionCode)}`), detailJson: detail, createdAt: asDate(stored.createdAt) },
        update: { sessionId: stored.sessionId || detail.session.id, sessionCode: asString(stored.sessionCode, detail.session.sessionCode), quizSetId: quizExists?.id ?? null, quizSetName: asString(stored.quizSetName, "Quiz Set"), displayName: asString(stored.displayName, `Report ${asString(stored.sessionCode, detail.session.sessionCode)}`), detailJson: detail }
      });
      counts.reports += 1;
      }
    }
  } else {
    const countValidUnique = (kind, values, required) => {
      const seen = new Set();
      for (const value of values) {
        if (!value?.id || !required(value)) { skip(kind, value?.id); continue; }
        if (seen.has(value.id)) { counts.duplicates += 1; continue; }
        seen.add(value.id);
      }
      return seen.size;
    };
    const teacherIds = new Set(users.filter((user) => user?.id && user.email && user.passwordHash).map((user) => user.id));
    counts.users = countValidUnique("user", users, (user) => Boolean(user.email && user.passwordHash));
    counts.classes = countValidUnique("class", classes, (item) => teacherIds.has(item.teacherId));
    counts.folders = countValidUnique("folder", folders, (folder) => teacherIds.has(folder.teacherId) && folder.parentId !== folder.id);
    counts.quizSets = countValidUnique("quiz set", quizSets, (quiz) => teacherIds.has(quiz.teacherId));
    counts.questions = quizSets.reduce((sum, quiz) => sum + countValidUnique("question", asArray(quiz.questions), (question) => Boolean(question.prompt && question.correctChoice)), 0);
    counts.sessions = countValidUnique("session", sessions, (session) => teacherIds.has(session.teacherId) && Boolean(session.quizSetId));
    counts.players = sessions.reduce((sum, session) => sum + countValidUnique("player", asArray(session.players), (player) => Boolean(player.nickname)), 0);
    counts.answers = countValidUnique("answer", answers, (answer) => Boolean(answer.gameSessionId && answer.playerSessionId && answer.questionId));
    counts.reports = countValidUnique("report", reports, (report) => teacherIds.has(report.teacherId) && Boolean(report.report?.session));
  }
  console.log(`[backfill] counts ${JSON.stringify(counts)}`);
  console.log("[backfill] RuntimeSnapshot was preserved; rerunning this script is idempotent.");
};

run().catch((error) => {
  console.error("[backfill] failed", error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
