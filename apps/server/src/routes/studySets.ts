import type { Express, Request, RequestHandler } from "express";
import type {
  GameSession,
  Question,
  QuizSet,
  RecognitionSummary,
  StudySetSummary,
  TeacherUser
} from "@quizstrike/shared";
import { isMeaningfulStudySet } from "../recognition.js";
import type { ContributionService } from "../contributionService.js";
import type { QuestionAudioAsset } from "./questions.js";

type AuthenticatedRequest = Request & { user?: TeacherUser };

type NormalizedStudySetLibrary = {
  searchPublicStudySets(input: {
    query?: string;
    subject?: string;
    gradeLevel?: string;
    language?: string;
    sort?: "relevant" | "used" | "newest";
    page: number;
    pageSize: number;
  }): Promise<{ items: StudySetSummary[]; page: number; pageSize: number; total: number }>;
  updateQuizSetLibrary(teacherId: string, id: string, update: {
    title?: string;
    description?: string | null;
    visibility?: "PRIVATE" | "PUBLIC";
    subject?: string | null;
    topic?: string | null;
    gradeLevel?: string | null;
    language?: string | null;
    tags?: string[];
    publishedAt?: Date | null;
  }): Promise<unknown>;
  saveQuizSet(quizSet: QuizSet): Promise<unknown>;
  saveQuestionForTeacher(teacherId: string, question: Question): Promise<unknown>;
  deleteQuizSet(teacherId: string, id: string): Promise<unknown>;
};

export type StudySetRouteDependencies = {
  requireTeacher: RequestHandler;
  quizSets: Map<string, QuizSet>;
  sessions: { values(): Iterable<GameSession> };
  users: ReadonlyMap<string, TeacherUser>;
  normalizedLibrary?: NormalizedStudySetLibrary;
  contribution: ContributionService;
  recordContribution: (operation: Promise<unknown>, label: string) => void;
  getRecognitionSummary: (teacherId: string) => Promise<RecognitionSummary>;
  getQuestionAudio: (questionId: string) => Promise<QuestionAudioAsset | undefined>;
  saveQuestionAudio: (teacherId: string, questionId: string, asset: QuestionAudioAsset) => Promise<void>;
  deleteQuestionAudio: (questionId: string) => Promise<void>;
  routeParam: (value: string | string[] | undefined) => string;
  now: () => string;
  id: () => string;
  schedulePersistence: () => void;
};

// Control characters are removed from teacher-supplied metadata.
// eslint-disable-next-line no-control-regex
const cleanText = (value: unknown, maxLength: number) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
const cleanTags = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map((tag) => cleanText(tag, 40)).filter(Boolean))].slice(0, 12)
  : [];
const isPublic = (quizSet: QuizSet) => quizSet.visibility === "PUBLIC";
export const canTeacherViewStudySet = (quizSet: QuizSet | undefined, teacherId: string): quizSet is QuizSet => Boolean(
  quizSet && (quizSet.teacherId === teacherId || (quizSet.visibility === "PUBLIC" && quizSet.status !== "ARCHIVED"))
);
export const canTeacherUseStudySet = (quizSet: QuizSet | undefined, teacherId: string): quizSet is QuizSet => Boolean(
  quizSet
  && quizSet.status !== "ARCHIVED"
  && (quizSet.teacherId === teacherId || (quizSet.visibility === "PUBLIC" && isMeaningfulStudySet(quizSet)))
);

const studySetViewForTeacher = (quizSet: QuizSet, teacherId: string): QuizSet => {
  if (quizSet.teacherId === teacherId) return quizSet;
  const { classId: _classId, folderId: _folderId, originalSetId: _originalSetId, originalCreatorId: _originalCreatorId, ...publicView } = quizSet;
  return publicView;
};

const toSummary = (quizSet: QuizSet, creatorName: string, recognitionLevel?: string, owner = false): StudySetSummary => ({
  id: quizSet.id,
  title: quizSet.title,
  ...(quizSet.description ? { description: quizSet.description } : {}),
  ...(quizSet.subject ? { subject: quizSet.subject } : {}),
  ...(quizSet.topic ? { topic: quizSet.topic } : {}),
  ...(quizSet.gradeLevel ? { gradeLevel: quizSet.gradeLevel } : {}),
  ...(quizSet.language ? { language: quizSet.language } : {}),
  tags: quizSet.tags ?? [],
  visibility: quizSet.visibility ?? "PRIVATE",
  questionCount: quizSet.questions.length,
  createdAt: quizSet.createdAt,
  ...(quizSet.updatedAt ? { updatedAt: quizSet.updatedAt } : {}),
  ...(quizSet.publishedAt ? { publishedAt: quizSet.publishedAt } : {}),
  usageCount: quizSet.usageCount ?? 0,
  uniqueTeacherUsageCount: quizSet.uniqueTeacherUsageCount ?? 0,
  remixCount: quizSet.remixCount ?? 0,
  ...(owner ? { ownerTeacherId: quizSet.teacherId } : {}),
  creator: { id: quizSet.teacherId, name: creatorName, ...(recognitionLevel ? { recognitionLevel } : {}) },
  ...(owner && quizSet.originalSetId ? { originalSetId: quizSet.originalSetId } : {}),
  ...(owner && quizSet.originalCreatorId ? { originalCreatorId: quizSet.originalCreatorId } : {})
});

export const registerStudySetRoutes = (app: Express, deps: StudySetRouteDependencies) => {
  app.get("/api/teacher/recognition", deps.requireTeacher, async (req: AuthenticatedRequest, res) => {
    res.json({ recognition: await deps.getRecognitionSummary(req.user!.id) });
  });

  app.get("/api/study-sets", deps.requireTeacher, async (req: AuthenticatedRequest, res) => {
    const teacherId = req.user!.id;
    const scope = req.query.scope === "mine" ? "mine" : "public";
    const query = cleanText(req.query.query, 120).replace(/[\\%_]/g, " ").replace(/\s+/g, " ").trim();
    const subject = cleanText(req.query.subject, 80);
    const gradeLevel = cleanText(req.query.gradeLevel, 80);
    const language = cleanText(req.query.language, 80);
    const sort = req.query.sort === "used" || req.query.sort === "newest" ? req.query.sort : "relevant";
    const requestedPage = Number(req.query.page);
    const requestedPageSize = Number(req.query.pageSize);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(50, requestedPageSize) : 20;

    if (scope === "public" && deps.normalizedLibrary) {
      res.json(await deps.normalizedLibrary.searchPublicStudySets({ query, subject, gradeLevel, language, sort, page, pageSize }));
      return;
    }

    const candidates = [...deps.quizSets.values()].filter((quizSet) => scope === "mine"
      ? quizSet.teacherId === teacherId
      : isPublic(quizSet) && quizSet.status !== "ARCHIVED");
    const normalizedQuery = query.toLocaleLowerCase();
    const normalizedSubject = subject.toLocaleLowerCase();
    const normalizedGradeLevel = gradeLevel.toLocaleLowerCase();
    const normalizedLanguage = language.toLocaleLowerCase();
    const relevanceRank = (quizSet: QuizSet) => {
      if (!normalizedQuery) return 0;
      const title = quizSet.title.toLocaleLowerCase();
      const subjectValue = quizSet.subject?.toLocaleLowerCase() ?? "";
      const topicValue = quizSet.topic?.toLocaleLowerCase() ?? "";
      const description = quizSet.description?.toLocaleLowerCase() ?? "";
      const creator = [deps.users.get(quizSet.teacherId)?.name, quizSet.originalCreatorId ? deps.users.get(quizSet.originalCreatorId)?.name : undefined].filter(Boolean).join(" ").toLocaleLowerCase();
      if (title === normalizedQuery) return 0;
      if (title.startsWith(normalizedQuery)) return 1;
      if (title.includes(normalizedQuery)) return 2;
      if (subjectValue.includes(normalizedQuery) || topicValue.includes(normalizedQuery)) return 3;
      if (description.includes(normalizedQuery)) return 4;
      if (creator.includes(normalizedQuery)) return 5;
      return 6;
    };
    const filtered = candidates.filter((quizSet) => {
      const searchable = [quizSet.title, quizSet.description, quizSet.subject, quizSet.topic, deps.users.get(quizSet.teacherId)?.name, quizSet.originalCreatorId ? deps.users.get(quizSet.originalCreatorId)?.name : undefined].filter(Boolean).join(" ").toLocaleLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && (!normalizedSubject || quizSet.subject?.toLocaleLowerCase() === normalizedSubject)
        && (!normalizedGradeLevel || quizSet.gradeLevel?.toLocaleLowerCase() === normalizedGradeLevel)
        && (!normalizedLanguage || quizSet.language?.toLocaleLowerCase() === normalizedLanguage);
    }).sort((left, right) => {
      if (sort === "used") return (right.uniqueTeacherUsageCount ?? 0) - (left.uniqueTeacherUsageCount ?? 0) || (right.usageCount ?? 0) - (left.usageCount ?? 0);
      if (sort === "newest") return (right.createdAt.localeCompare(left.createdAt));
      return relevanceRank(left) - relevanceRank(right)
        || (right.uniqueTeacherUsageCount ?? 0) - (left.uniqueTeacherUsageCount ?? 0)
        || right.createdAt.localeCompare(left.createdAt);
    });
    const items = await Promise.all(filtered.slice((page - 1) * pageSize, page * pageSize).map(async (quizSet) => {
      const creatorId = quizSet.teacherId;
      const recognition = await deps.getRecognitionSummary(creatorId);
      return toSummary(quizSet, deps.users.get(creatorId)?.name ?? "QuizStrike teacher", recognition.level, scope === "mine");
    }));
    res.json({ items, page, pageSize, total: filtered.length });
  });

  app.get("/api/study-sets/:id", deps.requireTeacher, async (req: AuthenticatedRequest, res) => {
    const quizSet = deps.quizSets.get(deps.routeParam(req.params.id));
    if (!canTeacherViewStudySet(quizSet, req.user!.id)) {
      res.status(404).json({ error: "Study Set not found." });
      return;
    }
    const creatorId = quizSet.teacherId;
    const recognition = await deps.getRecognitionSummary(creatorId);
    res.json({
      studySet: studySetViewForTeacher(quizSet, req.user!.id),
      creator: { id: creatorId, name: deps.users.get(creatorId)?.name ?? "QuizStrike teacher", recognitionLevel: recognition.level },
      ...(quizSet.originalCreatorId ? { attribution: `Based on a Study Set by ${deps.users.get(quizSet.originalCreatorId)?.name ?? "a QuizStrike teacher"}` } : {})
    });
  });

  app.patch("/api/study-sets/:id", deps.requireTeacher, async (req: AuthenticatedRequest, res) => {
    const quizSet = deps.quizSets.get(deps.routeParam(req.params.id));
    if (!quizSet || quizSet.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Study Set not found." });
      return;
    }
    if (req.body?.visibility !== undefined && req.body.visibility !== "PUBLIC" && req.body.visibility !== "PRIVATE") {
      res.status(400).json({ error: "Visibility must be PUBLIC or PRIVATE." });
      return;
    }
    const nextVisibility = req.body?.visibility === "PUBLIC" || req.body?.visibility === "PRIVATE"
      ? req.body.visibility as "PUBLIC" | "PRIVATE"
      : quizSet.visibility ?? "PRIVATE";
    const wasPublic = isPublic(quizSet);
    const updatedAt = deps.now();
    const patch = {
      title: req.body?.title === undefined ? quizSet.title : cleanText(req.body.title, 160),
      description: req.body?.description === undefined ? quizSet.description ?? null : cleanText(req.body.description, 500) || null,
      subject: req.body?.subject === undefined ? quizSet.subject ?? null : cleanText(req.body.subject, 80) || null,
      topic: req.body?.topic === undefined ? quizSet.topic ?? null : cleanText(req.body.topic, 120) || null,
      gradeLevel: req.body?.gradeLevel === undefined ? quizSet.gradeLevel ?? null : cleanText(req.body.gradeLevel, 80) || null,
      language: req.body?.language === undefined ? quizSet.language ?? null : cleanText(req.body.language, 80) || null,
      tags: req.body?.tags === undefined ? quizSet.tags ?? [] : cleanTags(req.body.tags)
    };
    if (patch.title.length < 2) {
      res.status(400).json({ error: "Study Set title is required." });
      return;
    }
    if (nextVisibility === "PUBLIC" && !isMeaningfulStudySet({ ...quizSet, title: patch.title })) {
      res.status(400).json({ error: "Add at least two complete questions before publishing this Study Set." });
      return;
    }
    const publishedAt = nextVisibility === "PUBLIC" ? quizSet.publishedAt ? new Date(quizSet.publishedAt) : new Date(updatedAt) : null;
    if (deps.normalizedLibrary) {
      await deps.normalizedLibrary.updateQuizSetLibrary(quizSet.teacherId, quizSet.id, { ...patch, visibility: nextVisibility, publishedAt });
    }
    quizSet.title = patch.title;
    quizSet.description = patch.description ?? undefined;
    quizSet.subject = patch.subject ?? undefined;
    quizSet.topic = patch.topic ?? undefined;
    quizSet.gradeLevel = patch.gradeLevel ?? undefined;
    quizSet.language = patch.language ?? undefined;
    quizSet.tags = patch.tags;
    quizSet.visibility = nextVisibility;
    quizSet.publishedAt = publishedAt?.toISOString();
    quizSet.updatedAt = updatedAt;
    deps.recordContribution(deps.contribution.recordStudySetPublished(quizSet, wasPublic), "Study Set publishing recognition");
    deps.schedulePersistence();
    res.json({ studySet: quizSet });
  });

  app.post("/api/study-sets/:id/duplicate", deps.requireTeacher, async (req: AuthenticatedRequest, res) => {
    const source = deps.quizSets.get(deps.routeParam(req.params.id));
    if (!canTeacherViewStudySet(source, req.user!.id)) {
      res.status(404).json({ error: "Study Set not found." });
      return;
    }
    const createdAt = deps.now();
    const duplicateId = deps.id();
    const duplicate: QuizSet = {
      id: duplicateId,
      teacherId: req.user!.id,
      title: cleanText(req.body?.title, 160) || `Copy of ${source.title}`.slice(0, 160),
      description: source.description,
      subject: source.subject,
      topic: source.topic,
      gradeLevel: source.gradeLevel,
      language: source.language,
      tags: source.tags ?? [],
      visibility: "PRIVATE",
      status: "ACTIVE",
      originalSetId: source.id,
      originalCreatorId: source.originalCreatorId ?? source.teacherId,
      questions: [],
      createdAt,
      updatedAt: createdAt
    };
    const clonedQuestionsWithAudio = await Promise.all(source.questions.map(async (question) => {
      const clonedId = deps.id();
      const audio = await deps.getQuestionAudio(question.id);
      const clonedQuestion = {
        ...question,
        id: clonedId,
        quizSetId: duplicate.id,
        audioUrl: audio ? `/api/question-audio/${encodeURIComponent(clonedId)}` : question.audioUrl,
        createdAt
      } satisfies Question;
      return { question: clonedQuestion, audio };
    }));
    const clonedQuestions = clonedQuestionsWithAudio.map(({ question }) => question);
    duplicate.questions = clonedQuestions;
    try {
      if (deps.normalizedLibrary) {
        await deps.normalizedLibrary.saveQuizSet(duplicate);
        for (const question of clonedQuestions) await deps.normalizedLibrary.saveQuestionForTeacher(duplicate.teacherId, question);
      }
      for (const { question, audio } of clonedQuestionsWithAudio) {
        if (audio) await deps.saveQuestionAudio(duplicate.teacherId, question.id, audio);
      }
    } catch (error) {
      await Promise.allSettled(clonedQuestions.map((question) => deps.deleteQuestionAudio(question.id)));
      if (deps.normalizedLibrary) await deps.normalizedLibrary.deleteQuizSet(duplicate.teacherId, duplicate.id).catch(() => undefined);
      throw error;
    }
    deps.quizSets.set(duplicate.id, duplicate);
    deps.recordContribution(deps.contribution.recordStudySetDuplicated(duplicate.teacherId, duplicate.id, source.id), "Study Set duplication recognition");
    deps.schedulePersistence();
    res.status(201).json({ studySet: duplicate, attribution: `Based on a Study Set by ${deps.users.get(duplicate.originalCreatorId!)?.name ?? "a QuizStrike teacher"}` });
  });
};
