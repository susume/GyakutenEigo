import type { Application, Request, Response } from "express";
import type { NormalizedLibrary } from "../persistence/normalizedLibrary.js";
import type {
  GameEvent,
  GameSession,
  PlayerAppearance,
  PlayerSession,
  PublicQuestion,
  Team,
  TeacherUser,
  FlagState
} from "@quizstrike/shared";

type AuthedRequest = Request & { user?: TeacherUser };

type StudentCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export type PlayerRouteDependencies = {
  requireTeacher: (req: AuthedRequest, res: Response, next: () => void) => void;
  getSessionByCode: (code: string) => GameSession | undefined;
  routeParam: (value: string | string[] | undefined) => string;
  getNicknameError: (value: string) => string;
  id: () => string;
  now: () => string;
  selectLateJoinTeam: (players: PlayerSession[]) => Team;
  selectSessionSpawn: (session: GameSession, team: Team) => { x: number; y?: number; z: number; facing: number };
  defaultPlayerHealth: number;
  zombieHumanMaxEnergy: number;
  defaultPlayerAppearance: PlayerAppearance;
  readCosmeticProgressToken: (token: unknown) => number;
  makePlayerToken: (session: GameSession, player: PlayerSession) => string;
  makeCosmeticProgressToken: (player: PlayerSession) => string;
  clearPlayerDisconnectTimer: (session: GameSession, playerId: string) => void;
  issueNextQuestion: (session: GameSession, playerId: string) => PublicQuestion | undefined;
  appendEvent: (session: GameSession, event: Omit<GameEvent, "id" | "createdAt">) => GameEvent;
  broadcastSession: (session: GameSession) => void;
  normalizedLibrary?: NormalizedLibrary;
  mirrorNormalized: (operation: Promise<unknown>, label: string) => void;
  requirePlayerAccess: (req: Request, res: Response, session: GameSession, player: PlayerSession) => boolean;
  stampSession: (session: GameSession) => GameSession;
  evictPlayerSockets: (session: GameSession, player: PlayerSession) => void;
  removePlayerRuntimeState: (session: GameSession, player: PlayerSession) => void;
  resolveFlagDropForPlayer: (flag: FlagState, player: PlayerSession, position: { x: number; z: number }) => FlagState;
  evaluateFlagEliminationWin: (session: GameSession) => void;
  finishZombieMatchIfComplete: (session: GameSession) => void;
  resetFreezeStreak: (player: PlayerSession) => void;
  sendStudentCommand: <T>(res: Response, result: StudentCommandResult<T>) => void;
  answerQuestion: (session: GameSession, player: PlayerSession, body: { questionId?: unknown; selectedChoice?: unknown }) => StudentCommandResult<unknown>;
  buyGear: (session: GameSession, player: PlayerSession, gearId: unknown) => StudentCommandResult<unknown>;
  buySnowballs: (session: GameSession, player: PlayerSession) => StudentCommandResult<unknown>;
};

const findPlayer = (deps: PlayerRouteDependencies, req: Request) => {
  const session = deps.getSessionByCode(deps.routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === deps.routeParam(req.params.playerId));
  return { session, player };
};

export const registerPlayerRoutes = (app: Application, deps: PlayerRouteDependencies) => {
  app.delete("/api/sessions/:code/players/:playerId", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = deps.getSessionByCode(deps.routeParam(req.params.code));
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "We couldn’t find that game room." });
      return;
    }
    if (session.status === "ended") {
      res.status(400).json({ error: "Players can’t be removed after the game ends." });
      return;
    }

    const playerId = deps.routeParam(req.params.playerId);
    const playerIndex = session.players.findIndex((candidate) => candidate.id === playerId);
    if (playerIndex < 0) {
      res.status(404).json({ error: "We couldn’t find that player." });
      return;
    }

    const player = session.players[playerIndex]!;
    if (session.flag?.carrierId === player.id) {
      session.flag = deps.resolveFlagDropForPlayer(session.flag, player, {
        x: player.x ?? 0,
        z: player.z ?? 0
      });
    }
    deps.evictPlayerSockets(session, player);
    deps.removePlayerRuntimeState(session, player);
    session.players.splice(playerIndex, 1);
    deps.appendEvent(session, {
      type: "timer",
      message: `${player.nickname} was removed by the teacher.`,
      team: player.team
    });

    const statusBeforeEvaluation = session.status;
    deps.evaluateFlagEliminationWin(session);
    deps.finishZombieMatchIfComplete(session);
    if (session.status === statusBeforeEvaluation) deps.broadcastSession(session);

    res.json({ session: deps.stampSession(session), removedPlayerId: player.id });
  });

  app.post("/api/sessions/:code/join", (req, res) => {
    const session = deps.getSessionByCode(deps.routeParam(req.params.code));
    const nickname = String(req.body.nickname ?? "").trim();
    if (!session) {
      res.status(404).json({ error: "We couldn’t find that game room." });
      return;
    }
    if (session.status === "ended") {
      res.status(400).json({ error: "This game has ended." });
      return;
    }
    if (nickname.length < 2 || nickname.length > 20) {
      res.status(400).json({ error: "Your name must be 2 to 20 characters." });
      return;
    }
    const nicknameError = deps.getNicknameError(nickname);
    if (nicknameError) {
      res.status(400).json({ error: nicknameError });
      return;
    }
    const returningPlayer = session.players.find(
      (player) => !player.isBot && player.nickname.toLowerCase() === nickname.toLowerCase()
    );
    if (returningPlayer?.connectionState === "disconnected") {
      deps.clearPlayerDisconnectTimer(session, returningPlayer.id);
      returningPlayer.connectionState = "connected";
      const playerToken = deps.makePlayerToken(session, returningPlayer);
      const question = returningPlayer.isAlive || session.settings.deadPlayersCanPractice
        ? deps.issueNextQuestion(session, returningPlayer.id)
        : undefined;
      deps.appendEvent(session, {
        type: "timer",
        message: `${returningPlayer.nickname} rejoined the game.`,
        playerId: returningPlayer.id,
        team: returningPlayer.team
      });
      deps.broadcastSession(session);
      res.status(200).json({
        session: deps.stampSession(session),
        player: returningPlayer,
        playerToken,
        cosmeticProgressToken: deps.makeCosmeticProgressToken(returningPlayer),
        question
      });
      return;
    }
    if (returningPlayer) {
      res.status(409).json({ error: "That name is already in use in this game. Choose another." });
      return;
    }
    if (session.players.length >= session.maxPlayers) {
      res.status(400).json({ error: "This game is full. Ask your teacher to make space." });
      return;
    }
    const isLateJoin = session.status !== "waiting";
    const blueCount = session.players.filter((player) => player.team === "blue").length;
    const redCount = session.players.filter((player) => player.team === "red").length;
    const team: Team = isLateJoin
      ? deps.selectLateJoinTeam(session.players)
      : blueCount <= redCount ? "blue" : "red";
    const zombieRole = isLateJoin && session.settings.gameMode === "zombie"
      ? team === "red" ? "zombie" : "human"
      : "human";
    const spawn = deps.selectSessionSpawn(session, team);
    const player: PlayerSession = {
      id: deps.id(),
      gameSessionId: session.id,
      nickname,
      team,
      money: session.settings.startingMoney,
      quizMoneyEarned: 0,
      roundQuizMoneyEarned: 0,
      moneySpent: 0,
      isAlive: true,
      role: zombieRole,
      tags: 0,
      roundTags: 0,
      respawns: 0,
      roundRespawns: 0,
      cosmeticXp: deps.readCosmeticProgressToken(req.body.cosmeticProgressToken),
      connectionState: "connected",
      health: deps.defaultPlayerHealth,
      energy: isLateJoin && session.settings.gameMode === "zombie"
        ? zombieRole === "zombie" ? deps.zombieHumanMaxEnergy : 0
        : undefined,
      snowballs: isLateJoin && session.settings.gameMode === "zombie" && zombieRole === "human"
        ? 0
        : session.settings.startingSnowballs,
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
      appearance: { ...deps.defaultPlayerAppearance },
      joinedAt: deps.now()
    };
    session.players.push(player);
    if (deps.normalizedLibrary) deps.mirrorNormalized(deps.normalizedLibrary.savePlayer(player), "player join");
    const playerToken = deps.makePlayerToken(session, player);
    deps.appendEvent(session, {
      type: "join",
      message: isLateJoin
        ? `${player.nickname} joined the live game on ${team === "blue" ? "Blue" : "Red"} Team.`
        : session.settings.gameMode === "zombie"
        ? `${player.nickname} joined the Zombie Mode lobby.`
        : `${player.nickname} joined ${team === "blue" ? "Blue" : "Red"} Team.`,
      playerId: player.id,
      team
    });
    deps.broadcastSession(session);
    res.status(201).json({
      session: deps.stampSession(session),
      player,
      playerToken,
      cosmeticProgressToken: deps.makeCosmeticProgressToken(player),
      question: deps.issueNextQuestion(session, player.id)
    });
  });

  app.get("/api/sessions/:code/players/:playerId/rejoin", (req, res) => {
    const { session, player } = findPlayer(deps, req);
    if (!session || !player || player.isBot) {
      res.status(404).json({ error: "This player session is no longer available. Join again with the classroom code." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;

    deps.clearPlayerDisconnectTimer(session, player.id);
    player.connectionState = "connected";
    const question =
      session.status !== "ended" && (player.isAlive || session.settings.deadPlayersCanPractice)
        ? deps.issueNextQuestion(session, player.id)
        : undefined;
    deps.broadcastSession(session);
    res.json({
      session: deps.stampSession(session),
      player,
      cosmeticProgressToken: deps.makeCosmeticProgressToken(player),
      question
    });
  });

  app.post("/api/sessions/:code/players/:playerId/team", (req, res) => {
    const { session, player } = findPlayer(deps, req);
    const requestedTeam = req.body.team === "red" || req.body.team === "blue" ? req.body.team : undefined;
    if (!session || !player) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;
    if (session.status !== "waiting" || session.settings.teamAssignment !== "players_choose") {
      res.status(400).json({ error: "Team changes are closed for this round." });
      return;
    }
    if (!requestedTeam) {
      res.status(400).json({ error: "Choose Red Team or Blue Team." });
      return;
    }
    if (player.team !== requestedTeam) deps.resetFreezeStreak(player);
    player.team = requestedTeam;
    const spawn = deps.selectSessionSpawn(session, player.team);
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.facing = spawn.facing;
    deps.appendEvent(session, {
      type: "join",
      message: `${player.nickname} chose ${requestedTeam === "red" ? "Red Team" : "Blue Team"}.`,
      playerId: player.id,
      team: player.team
    });
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session), player });
  });

  app.get("/api/sessions/:code/players/:playerId/question", (req, res) => {
    const { session, player } = findPlayer(deps, req);
    if (!session || !player) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;
    if (!player.isAlive && !session.settings.deadPlayersCanPractice) {
      res.status(400).json({ error: "Practice questions are off while you’re out this round." });
      return;
    }
    const question = deps.issueNextQuestion(session, player.id);
    if (!question) {
      res.status(404).json({ error: "No questions are available in this game yet." });
      return;
    }
    res.json({ question });
  });

  app.post("/api/sessions/:code/players/:playerId/answer", (req, res) => {
    const { session, player } = findPlayer(deps, req);
    if (!session || !player) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;
    deps.sendStudentCommand(res, deps.answerQuestion(session, player, req.body));
  });

  app.post("/api/sessions/:code/players/:playerId/buy", (req, res) => {
    const { session, player } = findPlayer(deps, req);
    if (!session || !player) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;
    deps.sendStudentCommand(res, deps.buyGear(session, player, req.body.gearId));
  });

  app.post("/api/sessions/:code/players/:playerId/buy-snowballs", (req, res) => {
    const { session, player } = findPlayer(deps, req);
    if (!session || !player) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;
    deps.sendStudentCommand(res, deps.buySnowballs(session, player));
  });
};
