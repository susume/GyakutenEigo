import express, { type Express, type Request, type RequestHandler } from "express";
import { isValidQuestionAudioUrl, type Question, type QuizSet, type TeacherUser } from "@quizstrike/shared";

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
  assertTeacherOwnsQuiz: (userId: string, quizSetId: string) => QuizSet | undefined;
  normalizedLibrary?: NormalizedLibrary;
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
    assertTeacherOwnsQuiz,
    normalizedLibrary,
    getQuestionAudio,
    saveQuestionAudio,
    deleteQuestionAudio,
    routeParam,
    isChoice,
    schedulePersistence
  } = dependencies;

  app.get("/api/question-audio/:id", async (req, res) => {
    const audio = await getQuestionAudio(routeParam(req.params.id));
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
    const previousAudioUrl = question.audioUrl;
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
    if (normalizedLibrary) await normalizedLibrary.deleteQuestionForTeacher(quiz.teacherId, question.id);
    await deleteQuestionAudio(question.id);
    quiz.questions = quiz.questions.filter((item) => item.id !== question.id);
    schedulePersistence();
    res.json({ quizSet: quiz });
  });
};
