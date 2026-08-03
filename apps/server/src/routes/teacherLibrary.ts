import type { Express, Request, RequestHandler } from "express";
import type {
  ClassSummary,
  GameSession,
  QuizFolder,
  QuizSet,
  TeacherUser
} from "@quizstrike/shared";

type AuthenticatedRequest = Request & { user?: TeacherUser };
type LibraryClass = ClassSummary & { teacherId: string };

type NormalizedLibrary = {
  saveFolderForTeacher(folder: QuizFolder): Promise<unknown>;
  deleteFolder(teacherId: string, folderId: string): Promise<unknown>;
  saveClass(klass: LibraryClass): Promise<unknown>;
};

export type TeacherLibraryRouteDependencies = {
  requireTeacher: RequestHandler;
  classes: Map<string, LibraryClass>;
  quizSets: Map<string, QuizSet>;
  folders: Map<string, QuizFolder>;
  sessions: { values(): Iterable<GameSession> };
  normalizedLibrary?: NormalizedLibrary;
  durableReportMetadataForTeacher: (teacherId: string) => Promise<unknown>;
  normalizeFolderName: (value: unknown) => { ok: true; name: string } | { ok: false; error: string };
  hasDuplicateSiblingName: (
    folders: Iterable<QuizFolder>,
    teacherId: string,
    parentId: string | undefined,
    name: string,
    excludeId?: string
  ) => boolean;
  canMoveFolder: (
    folders: Iterable<QuizFolder>,
    folder: QuizFolder,
    parentId: string | undefined
  ) => { ok: true } | { ok: false; error: string };
  routeParam: (value: string | string[] | undefined) => string;
  now: () => string;
  id: () => string;
  schedulePersistence: () => void;
  stampSession: (session: GameSession) => GameSession;
};

export const registerTeacherDashboardRoute = (
  app: Express,
  dependencies: TeacherLibraryRouteDependencies
) => {
  const {
    requireTeacher,
    classes,
    quizSets,
    sessions,
    folders,
    durableReportMetadataForTeacher,
    stampSession
  } = dependencies;

  app.get("/api/teacher/dashboard", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const teacherId = req.user!.id;
    try {
      res.json({
        classes: [...classes.values()].filter((item) => item.teacherId === teacherId),
        quizSets: [...quizSets.values()].filter((item) => item.teacherId === teacherId),
        sessions: [...sessions.values()].filter((item) => item.teacherId === teacherId).map(stampSession),
        folders: [...folders.values()].filter((item) => item.teacherId === teacherId),
        reports: await durableReportMetadataForTeacher(teacherId)
      });
    } catch (error) {
      console.error("Failed to load teacher dashboard reports.", error);
      res.status(500).json({ error: "Teacher library could not be loaded." });
    }
  });
};

export const registerFolderRoutes = (
  app: Express,
  dependencies: TeacherLibraryRouteDependencies
) => {
  const {
    requireTeacher,
    folders,
    quizSets,
    normalizedLibrary,
    normalizeFolderName,
    hasDuplicateSiblingName,
    canMoveFolder,
    routeParam,
    now,
    id,
    schedulePersistence
  } = dependencies;

  app.post("/api/folders", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const teacherId = req.user!.id;
    const normalized = normalizeFolderName(req.body?.name);
    if (!normalized.ok) {
      res.status(400).json({ error: normalized.error });
      return;
    }
    const parentId = typeof req.body?.parentId === "string" && req.body.parentId.trim() ? req.body.parentId.trim() : undefined;
    if (parentId) {
      const parent = folders.get(parentId);
      if (!parent || parent.teacherId !== teacherId) {
        res.status(404).json({ error: "Destination folder not found." });
        return;
      }
    }
    if (hasDuplicateSiblingName(folders.values(), teacherId, parentId, normalized.name)) {
      res.status(409).json({ error: "A folder with that name already exists here." });
      return;
    }
    const createdAt = now();
    const folder: QuizFolder = { id: id(), teacherId, parentId, name: normalized.name, createdAt, updatedAt: createdAt };
    if (normalizedLibrary) await normalizedLibrary.saveFolderForTeacher(folder);
    folders.set(folder.id, folder);
    schedulePersistence();
    res.status(201).json({ folder });
  });

  app.patch("/api/folders/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const folder = folders.get(routeParam(req.params.id));
    if (!folder || folder.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Folder not found." });
      return;
    }
    const normalized = req.body?.name === undefined ? { ok: true as const, name: folder.name } : normalizeFolderName(req.body.name);
    if (!normalized.ok) {
      res.status(400).json({ error: normalized.error });
      return;
    }
    const parentId = req.body?.parentId === undefined
      ? folder.parentId
      : typeof req.body.parentId === "string" && req.body.parentId.trim() ? req.body.parentId.trim() : undefined;
    const move = canMoveFolder(folders.values(), folder, parentId);
    if (!move.ok) {
      res.status(400).json({ error: move.error });
      return;
    }
    if (hasDuplicateSiblingName(folders.values(), folder.teacherId, parentId, normalized.name, folder.id)) {
      res.status(409).json({ error: "A folder with that name already exists here." });
      return;
    }
    folder.name = normalized.name;
    folder.parentId = parentId;
    folder.updatedAt = now();
    if (normalizedLibrary) await normalizedLibrary.saveFolderForTeacher(folder);
    schedulePersistence();
    res.json({ folder });
  });

  app.delete("/api/folders/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const folder = folders.get(routeParam(req.params.id));
    if (!folder || folder.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Folder not found." });
      return;
    }
    const hasChildren = [...folders.values()].some((candidate) => candidate.parentId === folder.id);
    const hasQuizSets = [...quizSets.values()].some((quiz) => quiz.teacherId === folder.teacherId && quiz.folderId === folder.id);
    if (hasChildren || hasQuizSets) {
      res.status(409).json({ error: "Move or delete the items inside this folder before deleting it." });
      return;
    }
    if (normalizedLibrary) await normalizedLibrary.deleteFolder(folder.teacherId, folder.id);
    folders.delete(folder.id);
    schedulePersistence();
    res.json({ deletedFolderId: folder.id });
  });
};

export const registerClassRoute = (
  app: Express,
  dependencies: TeacherLibraryRouteDependencies
) => {
  const { requireTeacher, normalizedLibrary, classes, now, id, schedulePersistence } = dependencies;

  app.post("/api/classes", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const name = String(req.body.name ?? "").trim();
    if (name.length < 2) {
      res.status(400).json({ error: "Class name is required." });
      return;
    }
    const klass: LibraryClass = {
      id: id(),
      teacherId: req.user!.id,
      name,
      description: String(req.body.description ?? "").trim() || undefined,
      createdAt: now()
    };
    if (normalizedLibrary) await normalizedLibrary.saveClass(klass);
    classes.set(klass.id, klass);
    schedulePersistence();
    res.status(201).json({ class: klass });
  });
};
