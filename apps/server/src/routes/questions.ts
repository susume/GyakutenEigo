import type { Express, Request, RequestHandler } from "express";
import { isValidQuestionAudioUrl, type Question, type QuizSet, type TeacherUser } from "@quizstrike/shared";

type AuthenticatedRequest = Request & { user?: TeacherUser };

type NormalizedLibrary = {
  updateQuestionForTeacher(teacherId: string, question: Question): Promise<unknown>;
  deleteQuestionForTeacher(teacherId: string, questionId: string): Promise<unknown>;
};

export type QuestionRouteDependencies = {
  requireTeacher: RequestHandler;
  getQuizQuestion: (questionId: string) => Question | undefined;
  assertTeacherOwnsQuiz: (userId: string, quizSetId: string) => QuizSet | undefined;
  normalizedLibrary?: NormalizedLibrary;
  routeParam: (value: string | string[] | undefined) => string;
  isChoice: (value: unknown) => value is Question["correctChoice"];
  schedulePersistence: () => void;
};

export const registerQuestionRoutes = (app: Express, dependencies: QuestionRouteDependencies) => {
  const {
    requireTeacher,
    getQuizQuestion,
    assertTeacherOwnsQuiz,
    normalizedLibrary,
    routeParam,
    isChoice,
    schedulePersistence
  } = dependencies;

  app.put("/api/questions/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const question = getQuizQuestion(routeParam(req.params.id));
    if (!question) {
      res.status(404).json({ error: "Question not found." });
      return;
    }
    const quiz = assertTeacherOwnsQuiz(req.user!.id, question.quizSetId);
    if (!quiz) {
      res.status(403).json({ error: "This question belongs to another teacher." });
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
    if (isChoice(req.body.correctChoice)) question.correctChoice = req.body.correctChoice;
    question.prompt = String(req.body.prompt ?? question.prompt).trim();
    question.choiceA = String(req.body.choiceA ?? question.choiceA).trim();
    question.choiceB = String(req.body.choiceB ?? question.choiceB).trim();
    question.choiceC = String(req.body.choiceC ?? question.choiceC).trim();
    question.choiceD = String(req.body.choiceD ?? question.choiceD).trim();
    question.explanation = String(req.body.explanation ?? question.explanation ?? "").trim() || undefined;
    question.difficulty = String(req.body.difficulty ?? question.difficulty ?? "").trim() || undefined;
    if (req.body.audioUrl !== undefined) question.audioUrl = String(req.body.audioUrl).trim() || undefined;
    if (normalizedLibrary) await normalizedLibrary.updateQuestionForTeacher(quiz.teacherId, question);
    schedulePersistence();
    res.json({ question, quizSet: quiz });
  });

  app.delete("/api/questions/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const question = getQuizQuestion(routeParam(req.params.id));
    if (!question) {
      res.status(404).json({ error: "Question not found." });
      return;
    }
    const quiz = assertTeacherOwnsQuiz(req.user!.id, question.quizSetId);
    if (!quiz) {
      res.status(403).json({ error: "This question belongs to another teacher." });
      return;
    }
    if (normalizedLibrary) await normalizedLibrary.deleteQuestionForTeacher(quiz.teacherId, question.id);
    quiz.questions = quiz.questions.filter((item) => item.id !== question.id);
    schedulePersistence();
    res.json({ quizSet: quiz });
  });
};
