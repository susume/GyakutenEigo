import type { Express, Request, RequestHandler } from "express";
import { isValidQuestionAudioUrl, type GameSession, type Question, type QuizFolder, type QuizSet, type TeacherUser } from "@quizstrike/shared";

type AuthenticatedRequest = Request & { user?: TeacherUser };

type NormalizedLibrary = {
  updateQuizSetLibrary(teacherId: string, quizSetId: string, patch: { title?: string; folderId?: string | null }): Promise<unknown>;
  deleteQuizSet(teacherId: string, quizSetId: string): Promise<unknown>;
  saveQuizSet(quizSet: QuizSet): Promise<unknown>;
  saveQuestionForTeacher(teacherId: string, question: Question): Promise<unknown>;
};

export type QuizSetRouteDependencies = {
  requireTeacher: RequestHandler;
  quizSets: Map<string, QuizSet>;
  folders: Map<string, QuizFolder>;
  sessions: { values(): Iterable<GameSession> };
  normalizedLibrary?: NormalizedLibrary;
  assertTeacherOwnsQuiz: (userId: string, quizSetId: string) => QuizSet | undefined;
  routeParam: (value: string | string[] | undefined) => string;
  isChoice: (value: unknown) => value is Question["correctChoice"];
  now: () => string;
  id: () => string;
  schedulePersistence: () => void;
  deleteQuestionAudio: (questionId: string) => Promise<void>;
};

export const registerQuizSetMutationRoutes = (app: Express, dependencies: QuizSetRouteDependencies) => {
  const {
    requireTeacher,
    assertTeacherOwnsQuiz,
    routeParam,
    normalizedLibrary,
    folders,
    sessions,
    schedulePersistence,
    now,
    deleteQuestionAudio
  } = dependencies;

  app.patch("/api/quiz-sets/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
    if (!quiz) {
      res.status(404).json({ error: "Quiz set not found." });
      return;
    }
    const title = String(req.body?.title ?? quiz.title).trim();
    if (title.length < 2 || title.length > 160) {
      res.status(400).json({ error: "Quiz title must be between 2 and 160 characters." });
      return;
    }
    quiz.title = title;
    quiz.updatedAt = now();
    if (normalizedLibrary) await normalizedLibrary.updateQuizSetLibrary(quiz.teacherId, quiz.id, { title });
    schedulePersistence();
    res.json({ quizSet: quiz });
  });

  app.post("/api/quiz-sets/:id/move", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
    if (!quiz) {
      res.status(404).json({ error: "Quiz set not found." });
      return;
    }
    const folderId = typeof req.body?.folderId === "string" && req.body.folderId.trim() ? req.body.folderId.trim() : undefined;
    if (folderId) {
      const folder = folders.get(folderId);
      if (!folder || folder.teacherId !== quiz.teacherId) {
        res.status(400).json({ error: "Quiz sets can only move into one of your folders." });
        return;
      }
    }
    quiz.folderId = folderId;
    quiz.updatedAt = now();
    if (normalizedLibrary) await normalizedLibrary.updateQuizSetLibrary(quiz.teacherId, quiz.id, { folderId: folderId ?? null });
    schedulePersistence();
    res.json({ quizSet: quiz });
  });

  app.delete("/api/quiz-sets/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
    if (!quiz) {
      res.status(404).json({ error: "Quiz set not found." });
      return;
    }
    const activeSession = [...sessions.values()].find((session) => session.quizSetId === quiz.id && session.status !== "ended");
    if (activeSession) {
      res.status(409).json({ error: "This quiz set is used by an active game and cannot be deleted yet." });
      return;
    }
    if (normalizedLibrary) await normalizedLibrary.deleteQuizSet(quiz.teacherId, quiz.id);
    await Promise.all(quiz.questions.map((question) => deleteQuestionAudio(question.id)));
    dependencies.quizSets.delete(quiz.id);
    schedulePersistence();
    res.json({ deletedQuizSetId: quiz.id });
  });
};

export const registerQuizSetCreationRoutes = (app: Express, dependencies: QuizSetRouteDependencies) => {
  const {
    requireTeacher,
    quizSets,
    normalizedLibrary,
    assertTeacherOwnsQuiz,
    routeParam,
    isChoice,
    now,
    id,
    schedulePersistence
  } = dependencies;

  app.post("/api/quiz-sets", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const title = String(req.body.title ?? "").trim();
    if (title.length < 2) {
      res.status(400).json({ error: "Quiz title is required." });
      return;
    }
    const quizSet: QuizSet = {
      id: id(),
      teacherId: req.user!.id,
      classId: String(req.body.classId ?? "") || undefined,
      folderId: String(req.body.folderId ?? "") || undefined,
      title,
      description: String(req.body.description ?? "").trim() || undefined,
      questions: [],
      createdAt: now()
    };
    if (normalizedLibrary) await normalizedLibrary.saveQuizSet(quizSet);
    quizSets.set(quizSet.id, quizSet);
    schedulePersistence();
    res.status(201).json({ quizSet });
  });

  app.get("/api/quiz-sets/:id", requireTeacher, (req: AuthenticatedRequest, res) => {
    const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
    if (!quiz) {
      res.status(404).json({ error: "Quiz set not found." });
      return;
    }
    res.json({ quizSet: quiz });
  });

  app.post("/api/quiz-sets/:id/questions", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
    if (!quiz) {
      res.status(404).json({ error: "Quiz set not found." });
      return;
    }
    if (!isChoice(req.body.correctChoice)) {
      res.status(400).json({ error: "Correct choice must be A, B, C, or D." });
      return;
    }
    if (
      req.body.audioUrl !== undefined
      && req.body.audioUrl !== ""
      && !isValidQuestionAudioUrl(req.body.audioUrl)
    ) {
      res.status(400).json({ error: "Audio URL must be an http(s) URL or a path on this site." });
      return;
    }

    const question: Question = {
      id: id(),
      quizSetId: quiz.id,
      prompt: String(req.body.prompt ?? "").trim(),
      choiceA: String(req.body.choiceA ?? "").trim(),
      choiceB: String(req.body.choiceB ?? "").trim(),
      choiceC: String(req.body.choiceC ?? "").trim(),
      choiceD: String(req.body.choiceD ?? "").trim(),
      correctChoice: req.body.correctChoice,
      explanation: String(req.body.explanation ?? "").trim() || undefined,
      difficulty: String(req.body.difficulty ?? "").trim() || undefined,
      ...(typeof req.body.audioUrl === "string" && req.body.audioUrl.trim()
        ? { audioUrl: req.body.audioUrl.trim() }
        : {}),
      createdAt: now()
    };

    if (!question.prompt || !question.choiceA || !question.choiceB || !question.choiceC || !question.choiceD) {
      res.status(400).json({ error: "Question prompt and four choices are required." });
      return;
    }

    if (normalizedLibrary) await normalizedLibrary.saveQuestionForTeacher(quiz.teacherId, question);
    quiz.questions.push(question);
    schedulePersistence();
    res.status(201).json({ question, quizSet: quiz });
  });
};
