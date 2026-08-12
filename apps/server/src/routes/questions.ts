import express, { type Express, type Request, type RequestHandler } from "express";
import { isValidQuestionAudioUrl, type Question, type QuizSet, type TeacherUser } from "@quizstrike/shared";
import type { ContributionService } from "../contributionService.js";
import { isMeaningfulStudySet } from "../recognition.js";

type AuthenticatedRequest = Request & { user?: TeacherUser };

export type QuestionAudioAsset = {
  mimeType: string;
  data: Buffer;
};

const QUESTION_AUDIO_MAX_BYTES = 5 * 1024 * 1024;
const QUESTION_AUDIO_URL_PREFIX = "/api/question-audio/";
const supportedQuestionAudioMimeTypes = new Set([
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav"
]);

export const questionAudioUrl = (questionId: string) =>
  `${QUESTION_AUDIO_URL_PREFIX}${encodeURIComponent(questionId)}`;

type NormalizedLibrary = {
  updateQuestionForTeacher(teacherId: string, question: Question): Promise<unknown>;
  deleteQuestionForTeacher(teacherId: string, questionId: string): Promise<unknown>;
};

export type QuestionRouteDependencies = {
  requireTeacher: RequestHandler;
  getQuizQuestion: (questionId: string) => Question | undefined;
  canReadQuestionAudio: (req: Request, questionId: string) => boolean;
  isQuestionAudioUsedByActiveSession: (questionId: string) => boolean;
  assertTeacherOwnsQuiz: (userId: string, quizSetId: string) => QuizSet | undefined;
  normalizedLibrary?: NormalizedLibrary;
  contribution?: ContributionService;
  recordContribution?: (operation: Promise<unknown>, label: string) => void;
  getQuestionAudio: (questionId: string) => Promise<QuestionAudioAsset | undefined>;
  saveQuestionAudio: (teacherId: string, questionId: string, asset: QuestionAudioAsset) => Promise<void>;
  deleteQuestionAudio: (questionId: string) => Promise<void>;
  routeParam: (value: string | string[] | undefined) => string;
  isChoice: (value: unknown) => value is Question["correctChoice"];
  schedulePersistence: () => void;
};

export const registerQuestionRoutes = (app: Express, dependencies: QuestionRouteDependencies) => {
  const {
    requireTeacher,
    getQuizQuestion,
    canReadQuestionAudio,
    isQuestionAudioUsedByActiveSession,
    assertTeacherOwnsQuiz,
    normalizedLibrary,
    contribution,
    recordContribution,
    getQuestionAudio,
    saveQuestionAudio,
    deleteQuestionAudio,
    routeParam,
    isChoice,
    schedulePersistence
  } = dependencies;

  app.get("/api/question-audio/:id", async (req, res) => {
    const questionId = routeParam(req.params.id);
    if (!canReadQuestionAudio(req, questionId)) {
      res.status(404).json({ error: "Question audio not found." });
      return;
    }
    const audio = await getQuestionAudio(questionId);
    if (!audio) {
      res.status(404).json({ error: "Question audio not found." });
      return;
    }
    res.setHeader("Content-Type", audio.mimeType);
    res.setHeader("Content-Length", audio.data.byteLength);
    // A replacement recording keeps the same question URL, so stale browser
    // caching would otherwise make students hear the previous clip.
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.send(audio.data);
  });

  app.post(
    "/api/questions/:id/audio",
    requireTeacher,
    express.raw({
      type: (req) => String(req.headers["content-type"] ?? "").toLowerCase().startsWith("audio/"),
      limit: QUESTION_AUDIO_MAX_BYTES
    }),
    async (req: AuthenticatedRequest, res) => {
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
      if (question.audioUrl?.startsWith(QUESTION_AUDIO_URL_PREFIX) && isQuestionAudioUsedByActiveSession(question.id)) {
        res.status(409).json({ error: "This recording is in use by an active game and cannot be replaced yet." });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "Record some audio before uploading it." });
        return;
      }
      const mimeType = String(req.header("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
      if (!supportedQuestionAudioMimeTypes.has(mimeType)) {
        res.status(415).json({ error: "This recording format is not supported. Try WebM, Ogg, or MP4 audio." });
        return;
      }

      const previousAudioUrl = question.audioUrl;
      const asset = { mimeType, data: req.body } satisfies QuestionAudioAsset;
      await saveQuestionAudio(quiz.teacherId, question.id, asset);
      question.audioUrl = questionAudioUrl(question.id);
      try {
        if (normalizedLibrary) await normalizedLibrary.updateQuestionForTeacher(quiz.teacherId, question);
        if (contribution) recordContribution?.(contribution.recordStudySetCreated(quiz), "Study Set creation recognition");
        schedulePersistence();
      } catch (error) {
        question.audioUrl = previousAudioUrl;
        await deleteQuestionAudio(question.id).catch(() => undefined);
        throw error;
      }
      res.json({ question, quizSet: quiz });
    }
  );

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
    const updatedQuestion: Question = {
      ...question,
      correctChoice: isChoice(req.body.correctChoice) ? req.body.correctChoice : question.correctChoice,
      prompt: String(req.body.prompt ?? question.prompt).trim(),
      choiceA: String(req.body.choiceA ?? question.choiceA).trim(),
      choiceB: String(req.body.choiceB ?? question.choiceB).trim(),
      choiceC: String(req.body.choiceC ?? question.choiceC).trim(),
      choiceD: String(req.body.choiceD ?? question.choiceD).trim(),
      explanation: String(req.body.explanation ?? question.explanation ?? "").trim() || undefined,
      difficulty: String(req.body.difficulty ?? question.difficulty ?? "").trim() || undefined,
      ...(req.body.audioUrl !== undefined ? { audioUrl: String(req.body.audioUrl).trim() || undefined } : {})
    };
    if (!updatedQuestion.prompt || !updatedQuestion.choiceA || !updatedQuestion.choiceB || !updatedQuestion.choiceC || !updatedQuestion.choiceD) {
      res.status(400).json({ error: "Question prompt and four choices are required." });
      return;
    }
    const updatedQuestions = quiz.questions.map((item) => item.id === question.id ? updatedQuestion : item);
    if (quiz.visibility === "PUBLIC" && !isMeaningfulStudySet({ ...quiz, questions: updatedQuestions })) {
      res.status(400).json({ error: "Public Study Sets must keep at least two complete questions." });
      return;
    }
    const previousAudioUrl = question.audioUrl;
    if (
      previousAudioUrl?.startsWith(QUESTION_AUDIO_URL_PREFIX)
      && previousAudioUrl !== updatedQuestion.audioUrl
      && isQuestionAudioUsedByActiveSession(question.id)
    ) {
      res.status(409).json({ error: "This recording is in use by an active game and cannot be changed yet." });
      return;
    }
    if (normalizedLibrary) await normalizedLibrary.updateQuestionForTeacher(quiz.teacherId, updatedQuestion);
    Object.assign(question, updatedQuestion);
    if (contribution) recordContribution?.(contribution.recordStudySetCreated(quiz), "Study Set creation recognition");
    if (
      previousAudioUrl
      && previousAudioUrl !== question.audioUrl
      && previousAudioUrl.startsWith(QUESTION_AUDIO_URL_PREFIX)
    ) {
      await deleteQuestionAudio(question.id);
    }
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
    const remainingQuestions = quiz.questions.filter((item) => item.id !== question.id);
    if (quiz.visibility === "PUBLIC" && !isMeaningfulStudySet({ ...quiz, questions: remainingQuestions })) {
      res.status(409).json({ error: "Make this Study Set private before deleting a question required for publication." });
      return;
    }
    if (question.audioUrl?.startsWith(QUESTION_AUDIO_URL_PREFIX) && isQuestionAudioUsedByActiveSession(question.id)) {
      res.status(409).json({ error: "This question's recording is in use by an active game and cannot be deleted yet." });
      return;
    }
    if (normalizedLibrary) await normalizedLibrary.deleteQuestionForTeacher(quiz.teacherId, question.id);
    await deleteQuestionAudio(question.id);
    quiz.questions = quiz.questions.filter((item) => item.id !== question.id);
    schedulePersistence();
    res.json({ quizSet: quiz });
  });
};
