import type { Application, Request, Response } from "express";
import type { NormalizedLibrary } from "../persistence/normalizedLibrary.js";
import type {
  BotDifficulty,
  GameSession,
  PlayerSession,
  ReportMetadata,
  SessionReport,
  SessionSettings,
  TeacherUser,
  Team,
  PlayerAppearance
} from "@quizstrike/shared";

type AuthedRequest = Request & { user?: TeacherUser };

type JoinCodeDirectory = {
  reserve: (code: string, roomId: string) => boolean;
  release: (code: string, roomId: string) => void;
};

export type SessionRouteDependencies = {
  requireTeacher: (req: AuthedRequest, res: Response, next: () => void) => void;
  isDraining: () => boolean;
  assertTeacherOwnsQuiz: (userId: string, quizSetId: string) => { id: string; title: string; questions: unknown[] } | undefined;
  createDefaultSettings: (input: Partial<SessionSettings>) => SessionSettings;
  id: () => string;
  now: () => string;
  generateSessionCode: () => string;
  appendEvent: (session: GameSession, event: { type: "join" | "start"; message: string; team?: Team }) => unknown;
  sessions: { set: (id: string, session: GameSession) => void; delete: (id: string) => void };
  joinCodeDirectory: JoinCodeDirectory;
  acquireRoomAuthority: (roomId: string) => boolean;
  releaseRoomAuthority: (roomId: string) => void;
  normalizedLibrary?: NormalizedLibrary;
  mirrorNormalized: (operation: Promise<unknown>, label: string) => void;
  schedulePersistence: () => void;
  stampSession: (session: GameSession) => GameSession;
  getSessionByCode: (code: string) => GameSession | undefined;
  routeParam: (value: string | string[] | undefined) => string;
  canStartRound: (session: GameSession) => { ok: boolean; reason?: string };
  openRoundPreparation: (session: GameSession, preserveStats?: boolean) => void;
  openZombieSelectionPhase: (session: GameSession, preserveStats?: boolean) => void;
  startRoundState: (session: GameSession, preserveStats?: boolean) => void;
  makeAnnouncement: (kind: "round_start" | "game_over", title: string, message: string, detail?: string, durationMs?: number) => GameSession["announcement"];
  roundStartAnnouncementMs: number;
  respawnCorrectAnswersRequired: number;
  broadcastSession: (session: GameSession) => void;
  finishZombieSession: (session: GameSession, outcome: string) => void;
  finishSession: (session: GameSession, message?: string) => void;
  finishRound: (session: GameSession, winner: Team | undefined, reason: string) => void;
  makeReport: (session: GameSession) => SessionReport;
  getBotSpawn: (session: GameSession, team: Team, index: number) => { x: number; y?: number; z: number; facing: number };
  selectSessionSpawn: (session: GameSession, team: Team, preferredIndex?: number) => { x: number; y?: number; z: number; facing: number };
  botNames: string[];
  botDifficulty: BotDifficulty;
  defaultPlayerHealth: number;
  defaultPlayerAppearance: PlayerAppearance;
  reportStore: Map<string, ReportMetadata & { report: SessionReport }>;
  getBearerUser: (req: Request) => TeacherUser | undefined;
  getPlayerToken: (req: Request) => string;
  hasPlayerAccess: (session: GameSession, player: PlayerSession, token: unknown) => boolean;
  getStoredSessionReport: (session: GameSession, teacherId: string) => Promise<{ metadata: ReportMetadata; report: SessionReport } | undefined>;
  reportMetadataForTeacher: (teacherId: string) => ReportMetadata[];
  saveSessionReport: (session: GameSession) => ReportMetadata & { report: SessionReport };
  deleteHistoryForTeacher: (teacherId: string) => Promise<number>;
  sanitizeExportFilename: (value: string) => string;
  buildCsvReport: (report: SessionReport) => string;
};

const getSessionPath = (deps: SessionRouteDependencies, req: Request) =>
  deps.getSessionByCode(deps.routeParam(req.params.code));

export const registerSessionRoutes = (app: Application, deps: SessionRouteDependencies) => {
  app.post("/api/sessions", deps.requireTeacher, async (req: AuthedRequest, res) => {
    if (deps.isDraining()) {
      res.status(503).json({ error: "This game service is finishing another task. Try again in a moment." });
      return;
    }
    const quiz = deps.assertTeacherOwnsQuiz(req.user!.id, String(req.body.quizSetId ?? ""));
    if (!quiz || quiz.questions.length === 0) {
      res.status(400).json({ error: "Choose a question set with at least one question." });
      return;
    }
    const settings = deps.createDefaultSettings(req.body.settings);
    const session: GameSession = {
      id: deps.id(),
      teacherId: req.user!.id,
      classId: String(req.body.classId ?? "") || undefined,
      quizSetId: quiz.id,
      sessionCode: deps.generateSessionCode(),
      status: "waiting",
      maxPlayers: settings.maxPlayers,
      currentRound: 1,
      settings,
      players: [],
      events: [],
      createdAt: deps.now()
    };
    deps.appendEvent(session, { type: "join", message: `Session ${session.sessionCode} created.` });
    deps.sessions.set(session.id, session);
    deps.joinCodeDirectory.reserve(session.sessionCode, session.id);
    if (!deps.acquireRoomAuthority(session.id)) {
      deps.sessions.delete(session.id);
      deps.joinCodeDirectory.release(session.sessionCode, session.id);
      res.status(503).json({ error: "The game room could not acquire an authoritative owner. Try again." });
      return;
    }
    try {
      if (deps.normalizedLibrary) await deps.normalizedLibrary.saveSession(session, quiz.title);
    } catch (error) {
      deps.releaseRoomAuthority(session.id);
      deps.sessions.delete(session.id);
      deps.joinCodeDirectory.release(session.sessionCode, session.id);
      throw error;
    }
    deps.schedulePersistence();
    res.status(201).json({ session: deps.stampSession(session) });
  });

  app.post("/api/sessions/:code/start", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = getSessionPath(deps, req);
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const startCheck = deps.canStartRound(session);
    if (!startCheck.ok) {
      res
        .status(400)
        .json({ error: startCheck.reason === "session_ended" ? "This game has ended." : "Add at least one student before starting." });
      return;
    }
    session.currentRound = 1;
    session.roundWins = { blue: 0, red: 0 };
    if (session.settings.gameMode === "flag" || session.settings.gameMode === "classic") {
      deps.openRoundPreparation(session, false);
      deps.appendEvent(session, {
        type: "start",
        message: `${session.settings.gameMode === "flag" ? "Capture the Flag" : "Team Tag"} round 1 is ready to prepare.`
      });
    } else if (session.settings.gameMode === "zombie") {
      deps.openZombieSelectionPhase(session, false);
      deps.appendEvent(session, {
        type: "start",
        message: "Zombie Survival is getting ready. Everyone is Human for 20 seconds."
      });
    } else {
      deps.startRoundState(session, false);
      session.announcement = deps.makeAnnouncement(
        "round_start",
        session.settings.gameMode === "zombie" ? "Zombie Mode has begun!" : `Round ${session.currentRound} has begun!`,
        session.settings.gameMode === "zombie"
          ? "Red Zombies shoot to convert. Blue Humans answer correctly for running energy and survive without weapons."
          : "Most tags wins. Respawns, then quiz earnings break ties.",
        undefined,
        deps.roundStartAnnouncementMs
      );
      deps.appendEvent(session, {
        type: "start",
        message: session.settings.gameMode === "zombie"
          ? "Zombie Mode started. Only Red Zombies can shoot; Blue Humans answer questions for running energy and survive without weapons."
          : `Round started. Answer ${deps.respawnCorrectAnswersRequired} practice questions to respawn if frozen out.`
      });
    }
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session) });
  });

  app.delete("/api/sessions/history", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const deletedSessions = await deps.deleteHistoryForTeacher(req.user!.id);
    res.json({ deletedSessions });
  });

  app.post("/api/sessions/:code/end", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = getSessionPath(deps, req);
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (session.settings.gameMode === "zombie") {
      deps.finishZombieSession(session, "The teacher ended Zombie Mode.");
    } else {
      deps.finishSession(session, "Teacher ended the round. Report is ready.");
    }
    res.json({ report: deps.makeReport(session) });
  });

  app.post("/api/sessions/:code/end-round", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = getSessionPath(deps, req);
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (session.settings.gameMode === "zombie") {
      res.status(400).json({ error: "Zombie Survival is one survival round. Use End game to stop it." });
      return;
    }
    if (session.status !== "active") {
      res.status(409).json({ error: "A round must be active before it can be ended early." });
      return;
    }
    deps.finishRound(session, undefined, "Teacher ended the round early");
    const responseSession = deps.stampSession(session);
    res.json({
      session: responseSession,
      ...(responseSession.status === "ended" ? { report: deps.makeReport(session) } : {})
    });
  });

  app.post("/api/sessions/:code/bots", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = getSessionPath(deps, req);
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (session.status === "ended") {
      res.status(400).json({ error: "This session has ended." });
      return;
    }
    const remainingSlots = session.maxPlayers - session.players.length;
    if (remainingSlots <= 0) {
      res.status(400).json({ error: "This session is full." });
      return;
    }

    const requestedCount = req.body?.count === undefined ? 1 : Number(req.body.count);
    if (!Number.isInteger(requestedCount) || requestedCount < 1) {
      res.status(400).json({ error: "Choose at least one bot." });
      return;
    }
    const difficulty: BotDifficulty = req.body?.difficulty === "beginner" || req.body?.difficulty === "advanced"
      ? req.body.difficulty
      : req.body?.difficulty === "standard"
        ? "standard"
        : session.settings.botDifficulty ?? deps.botDifficulty;
    const count = Math.min(requestedCount, remainingSlots);
    session.settings.botDifficulty = difficulty;
    const bots: PlayerSession[] = [];
    const firstBotIndex = session.players.filter((player) => player.isBot).length;
    for (let offset = 0; offset < count; offset += 1) {
      const blueCount = session.players.filter((player) => player.team === "blue").length;
      const redCount = session.players.filter((player) => player.team === "red").length;
      const team: Team = blueCount <= redCount ? "blue" : "red";
      const botIndex = firstBotIndex + offset;
      const spawn = session.status === "active" ? deps.getBotSpawn(session, team, botIndex) : deps.selectSessionSpawn(session, team, botIndex);
      const bot: PlayerSession = {
        id: deps.id(),
        gameSessionId: session.id,
        nickname: `${deps.botNames[botIndex % deps.botNames.length]} Bot ${botIndex + 1}`,
        team,
        money: session.settings.startingMoney,
        quizMoneyEarned: 0,
        roundQuizMoneyEarned: 0,
        moneySpent: 0,
        isAlive: true,
        isBot: true,
        role: "human",
        tags: 0,
        roundTags: 0,
        respawns: 0,
        roundRespawns: 0,
        connectionState: "connected",
        health: deps.defaultPlayerHealth,
        snowballs: session.settings.startingSnowballs,
        respawnCorrectAnswers: 0,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        facing: spawn.facing,
        score: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        gear: "starter_blaster",
        weapon: "starter_blaster",
        perks: [],
        appearance: { ...deps.defaultPlayerAppearance } as PlayerAppearance,
        joinedAt: deps.now()
      };
      session.players.push(bot);
      bots.push(bot);
    }
    deps.appendEvent(session, {
      type: "join",
      message: `${count} ${difficulty} test bot${count === 1 ? "" : "s"} added to the room.`,
      team: undefined
    });
    deps.broadcastSession(session);
    res.status(201).json({ session: deps.stampSession(session), bots, difficulty });
  });

  app.get("/api/sessions/:code", (req, res) => {
    const session = getSessionPath(deps, req);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const teacher = deps.getBearerUser(req);
    const playerToken = deps.getPlayerToken(req);
    const canRead = teacher?.id === session.teacherId
      || session.players.some((player) => !player.isBot && deps.hasPlayerAccess(session, player, playerToken));
    if (!canRead) {
      res.status(401).json({ error: "A teacher or student session token is required." });
      return;
    }
    res.json({ session: deps.stampSession(session) });
  });

  app.get("/api/sessions/:code/report", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const session = getSessionPath(deps, req);
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const stored = [...deps.reportStore.values()].find((candidate) => candidate.sessionId === session.id && candidate.teacherId === req.user!.id);
    const durable = await deps.getStoredSessionReport(session, req.user!.id);
    res.json({
      report: durable?.report ?? stored?.report ?? deps.makeReport(session),
      metadata: durable?.metadata ?? (stored ? deps.reportMetadataForTeacher(req.user!.id).find((item) => item.id === stored.id) : undefined)
    });
  });

  app.get("/api/sessions/:code/report.csv", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const session = getSessionPath(deps, req);
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const stored = [...deps.reportStore.values()].find((candidate) => candidate.sessionId === session.id && candidate.teacherId === req.user!.id);
    const durable = await deps.getStoredSessionReport(session, req.user!.id);
    const fallbackStored = stored ?? deps.saveSessionReport(session);
    const metadata = durable?.metadata ?? fallbackStored;
    const report = durable?.report ?? fallbackStored.report;
    res
      .status(200)
      .type("text/csv")
      .setHeader("Content-Disposition", `attachment; filename="${deps.sanitizeExportFilename(metadata.displayName)}.csv"`)
      .send(deps.buildCsvReport(report));
  });
};
