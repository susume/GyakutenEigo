import type {
  GameAnnouncement,
  GameEvent,
  GameSession,
  GroundArenaPosition,
  PlayerSession,
  Team
} from "@quizstrike/shared";
import {
  createInitialFlagState,
  getPlayerHealthMax,
  getRoundResetLoadout,
  getRoundRemainingSeconds,
  getZombieBestPlayers,
  isRoundPreparationPhase,
  isZombieSelectionPhase,
  randomizeBalancedTeams,
  resolveFlagCountdown,
  resolveTeamRoundWinner,
  selectInitialZombies
} from "@quizstrike/shared";
import { isTeacherPaused } from "@quizstrike/shared";
import { planRoundConclusion, resolvePendingRoundAction } from "./roundFlow.js";

type BotMap = Map<string, unknown>;

type RoundAnnouncementFactory = (
  kind: GameAnnouncement["kind"],
  title: string,
  message: string,
  detail?: string,
  durationMs?: number
) => GameAnnouncement;

export type RoundRuntimeDependencies = {
  now: () => string;
  nowMs: () => number;
  sessions: { values: () => Iterable<GameSession> };
  ownsRoom: (roomId: string) => boolean;
  makeAnnouncement: RoundAnnouncementFactory;
  appendEvent: (session: GameSession, event: Omit<GameEvent, "id" | "createdAt">) => GameEvent;
  broadcastSession: (session: GameSession) => void;
  sessionSpawn: (session: GameSession, team: Team) => GroundArenaPosition;
  selectSessionSpawn: (session: GameSession, team: Team, preferredIndex?: number) => GroundArenaPosition;
  getBotSpawn: (session: GameSession, team: Team, index: number) => GroundArenaPosition;
  botMemoryById: BotMap;
  botNextAttackAt: BotMap;
  botRespawnAt: BotMap;
  botPreviousPositions: BotMap;
  botAlertsBySession: Map<string, unknown>;
  purgeSessionDecals: (session: GameSession) => void;
  saveSession: ((session: GameSession, quizSetName: string) => Promise<unknown>) | undefined;
  getQuizSetName: (quizSetId: string) => string;
  mirrorNormalized: (operation: Promise<unknown>, label: string) => void;
  saveSessionReport: (session: GameSession) => unknown;
  recordGameCompleted?: (session: GameSession) => Promise<unknown>;
  roundResultAnnouncementMs: number;
  gameOverAnnouncementMs: number;
  roundPreparationMs: number;
  zombieSelectionMs: number;
  zombieHumanMaxEnergy: number;
  roundStartAnnouncementMs: number;
};

export const createRoundRuntime = (deps: RoundRuntimeDependencies) => {
  const {
    now,
    nowMs,
    sessions,
    ownsRoom,
    makeAnnouncement,
    appendEvent,
    broadcastSession,
    sessionSpawn,
    selectSessionSpawn,
    getBotSpawn,
    botMemoryById,
    botNextAttackAt,
    botRespawnAt,
    botPreviousPositions,
    botAlertsBySession,
    purgeSessionDecals,
    saveSession,
    getQuizSetName,
    mirrorNormalized,
    saveSessionReport,
    recordGameCompleted,
    roundResultAnnouncementMs,
    gameOverAnnouncementMs,
    roundPreparationMs,
    zombieSelectionMs,
    zombieHumanMaxEnergy,
    roundStartAnnouncementMs
  } = deps;

  const teamName = (team: Team) => team === "red" ? "Red Team" : "Blue Team";

const finishSession = (
  session: GameSession,
  message = "Round ended. Report is ready.",
  announcement = makeAnnouncement("game_over", "Game Over", message, undefined, gameOverAnnouncementMs)
) => {
  if (session.status === "ended") return;
  session.status = "ended";
  session.controlState = "running";
  session.teacherPausedAt = undefined;
  session.endedAt = now();
  session.roundTransition = undefined;
  session.announcement = announcement;
  if (session.settings.gameMode === "athletics" && session.athletics) {
    session.athletics.status = session.athletics.status === "expired" ? "expired" : "finished";
    for (const player of session.players) {
      if (player.athletics?.status === "racing") player.athletics.status = "dnf";
    }
  }
  for (const player of session.players) {
    if (!player.isBot) continue;
    botMemoryById.delete(player.id);
    botNextAttackAt.delete(player.id);
    botRespawnAt.delete(player.id);
    botPreviousPositions.delete(player.id);
  }
  botAlertsBySession.delete(session.sessionCode);
  purgeSessionDecals(session);
  appendEvent(session, { type: "end", message });
  const quizSetName = getQuizSetName(session.quizSetId);
  if (saveSession) mirrorNormalized(saveSession(session, quizSetName), "completed session");
  if (recordGameCompleted) mirrorNormalized(recordGameCompleted(session), "teacher recognition");
  saveSessionReport(session);
  broadcastSession(session);
};


const finishZombieSession = (session: GameSession, outcome: string) => {
  const bestPlayers = getZombieBestPlayers(session.players, 6);
  const detail = bestPlayers.length > 0
    ? `Best players: ${bestPlayers.map((player) => player.nickname).join(", ")}`
    : "No survivor ranking was available.";
  finishSession(
    session,
    `${outcome} ${detail}`,
    makeAnnouncement("game_over", "Game Over", outcome, detail, gameOverAnnouncementMs)
  );
};

const inactiveRoundMessage = (session: GameSession) =>
  session.status === "ended"
    ? "The round has ended. This action was not counted."
    : isTeacherPaused(session)
      ? "The game is paused by the teacher. Wait for the game to resume."
    : isRoundPreparationPhase(session)
      ? "Preparation is open. Buy gear or answer questions before the round begins."
    : isZombieSelectionPhase(session)
      ? "Zombie selection is underway. Answer questions to build movement energy."
    : session.status === "paused"
      ? "The round has ended. The next round is starting shortly."
      : "The teacher has not started the round yet.";

const resetRoundPlayer = (session: GameSession, player: PlayerSession, index: number): PlayerSession => {
  if (player.isBot) {
    botMemoryById.delete(player.id);
    botNextAttackAt.delete(player.id);
    botRespawnAt.delete(player.id);
    botPreviousPositions.delete(player.id);
  }
  const spawn = player.isBot ? getBotSpawn(session, player.team, index) : selectSessionSpawn(session, player.team, index);
  const loadout = getRoundResetLoadout({ player, startingSnowballs: session.settings.startingSnowballs });
  const isZombieHuman = session.settings.gameMode === "zombie" && player.role !== "zombie";
  return {
    ...player,
    ...spawn,
    role: session.settings.gameMode === "zombie" ? player.role ?? "human" : player.role,
    health: getPlayerHealthMax({ ...player, ...loadout }),
    ...loadout,
    energy: session.settings.gameMode === "zombie"
      ? player.role === "zombie" ? zombieHumanMaxEnergy : 0
      : player.energy,
    snowballs: isZombieHuman ? 0 : loadout.snowballs,
    isAlive: true,
    crouching: false,
    jumping: false,
    freezeStreak: 0,
    respawnCorrectAnswers: 0
  };
};

const prepareModeStateForRound = (session: GameSession) => {
  if (session.settings.gameMode === "flag") {
    if (session.settings.teamAssignment === "random") {
      session.players = randomizeBalancedTeams(session.players, Date.now());
    }
    session.flag = createInitialFlagState(sessionSpawn(session, "red"), `${session.id}:round:${session.currentRound}`);
  } else if (session.settings.gameMode === "zombie") {
    session.players = session.players.map((player) => ({
      ...player,
      role: "human",
      team: "blue",
      zombieConvertedAt: undefined,
      energy: 0,
      isAlive: true
    }));
    session.flag = undefined;
  } else {
    session.flag = undefined;
  }
};

const prepareRoundState = (session: GameSession, preserveStats = true) => {
  prepareModeStateForRound(session);
  session.roundWins = session.roundWins ?? { blue: 0, red: 0 };
  session.players = session.players.map((player, index) => {
    const wasOutForRound = !player.isAlive;
    const reset = resetRoundPlayer(session, player, index);
    return preserveStats
      ? {
          ...reset,
          respawns: wasOutForRound ? (player.respawns ?? 0) + 1 : (player.respawns ?? 0),
          roundTags: 0,
          roundRespawns: 0,
          roundQuizMoneyEarned: 0
        }
      : {
          ...reset,
          score: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          tags: 0,
          respawns: 0,
          roundTags: 0,
          roundRespawns: 0,
          roundQuizMoneyEarned: 0
        };
  });
};

const activatePreparedRound = (session: GameSession) => {
  session.status = "active";
  session.roundTransition = undefined;
  session.startedAt = now();
  session.endsAt = new Date(Date.now() + session.settings.roundDurationSeconds * 1000).toISOString();
};

const startRoundState = (session: GameSession, preserveStats = true) => {
  prepareRoundState(session, preserveStats);
  activatePreparedRound(session);
};

const openRoundPreparation = (session: GameSession, preserveStats = true) => {
  prepareRoundState(session, preserveStats);
  const startsAt = new Date(Date.now() + roundPreparationMs).toISOString();
  session.status = "paused";
  session.startedAt = undefined;
  session.endsAt = undefined;
  session.roundTransition = { nextRound: session.currentRound, startsAt, phase: "preparation" };
  session.announcement = {
    ...makeAnnouncement(
      "preparation",
      "Preparation Time",
      "Buy gear with B, or answer questions with Q to earn more money.",
      `Round ${session.currentRound} begins in 35 seconds.`,
      roundPreparationMs
    ),
    expiresAt: startsAt
  };
};


const openZombieSelectionPhase = (session: GameSession, preserveStats = true) => {
  prepareRoundState(session, preserveStats);
  const startsAt = new Date(Date.now() + zombieSelectionMs).toISOString();
  session.status = "paused";
  session.startedAt = undefined;
  session.endsAt = undefined;
  session.roundTransition = { nextRound: session.currentRound, startsAt, phase: "zombie_selection" };
  session.announcement = {
    ...makeAnnouncement(
      "preparation",
      "Everyone Starts Human",
      "Answer questions now to charge your movement energy. Zombies will be chosen at random.",
      "Zombie selection in 20 seconds.",
      zombieSelectionMs
    ),
    expiresAt: startsAt
  };
};

const finishRound = (session: GameSession, winner: Team | undefined, reason: string) => {
  if (session.status !== "active" || isTeacherPaused(session)) return;
  const conclusion = planRoundConclusion({
    currentRound: session.currentRound,
    roundCount: session.settings.roundCount,
    roundWins: session.roundWins ?? { blue: 0, red: 0 },
    winner,
    reason
  });
  session.roundWins = conclusion.roundWins;
  appendEvent(session, {
    type: "end",
    message: conclusion.eventMessage,
    team: winner
  });

  if (conclusion.matchResult) {
    const title = conclusion.matchWinner ? `${teamName(conclusion.matchWinner)} wins!` : "The match is a draw";
    finishSession(
      session,
      conclusion.matchResult,
      makeAnnouncement("game_over", title, "Game Over", conclusion.matchResult, gameOverAnnouncementMs)
    );
    return;
  }

  const nextRound = conclusion.nextRound!;
  const resultTitle = winner ? `${teamName(winner)} wins Round ${session.currentRound}!` : `Round ${session.currentRound} is a draw`;
  const resultMessage = session.settings.gameMode === "flag" || session.settings.gameMode === "classic"
    ? `${reason}. Round ${nextRound} preparation begins shortly.`
    : `${reason}. Round ${nextRound} begins shortly.`;
  const startsAt = new Date(Date.now() + roundResultAnnouncementMs).toISOString();
  session.status = "paused";
  session.endsAt = now();
  session.announcement = {
    ...makeAnnouncement("round_result", resultTitle, resultMessage, undefined, roundResultAnnouncementMs),
    expiresAt: startsAt
  };
  session.roundTransition = { nextRound, startsAt, phase: "result" };
  broadcastSession(session);
};

const startPendingRound = (session: GameSession) => {
  if (session.status !== "paused" || !session.roundTransition) return;
  const transition = session.roundTransition;
  session.currentRound = transition.nextRound;
  const pendingRoundAction = resolvePendingRoundAction({ gameMode: session.settings.gameMode, phase: transition.phase });
  if (pendingRoundAction === "open_preparation") {
    openRoundPreparation(session);
    appendEvent(session, { type: "start", message: `Round ${session.currentRound} preparation opened.` });
    broadcastSession(session);
    return;
  }

  if (transition.phase === "zombie_selection") {
    session.players = selectInitialZombies(session.players, session.settings.initialZombieCount).map((player) => (
      player.role === "zombie"
        ? { ...player, snowballs: session.settings.startingSnowballs }
        : player
    ));
    activatePreparedRound(session);
  } else if (transition.phase === "preparation" || transition.phase === "buy") {
    activatePreparedRound(session);
  } else {
    startRoundState(session);
  }
  session.announcement = makeAnnouncement(
    "round_start",
    session.settings.gameMode === "zombie" ? "Zombies Revealed!" : `Round ${session.currentRound} has begun!`,
    session.settings.gameMode === "flag"
      ? "Red carries and protects the flag. Blue defends and captures."
      : session.settings.gameMode === "zombie"
        ? "Red Zombies hunt. Blue Humans use their stored energy to move and survive."
        : "Most tags wins. Respawns, then quiz earnings break ties.",
    undefined,
    roundStartAnnouncementMs
  );
  appendEvent(session, {
    type: "start",
    message: session.settings.gameMode === "zombie"
      ? "Zombies were chosen at random. The survival round started."
      : `Round ${session.currentRound} started.`
  });
  broadcastSession(session);
};

const finishZombieMatchIfComplete = (session: GameSession) => {
  if (session.settings.gameMode !== "zombie" || session.status !== "active" || isTeacherPaused(session)) return;
  const humansRemaining = session.players.some(
    (player) => player.connectionState !== "disconnected" && player.isAlive && player.role !== "zombie"
  );
  if (!humansRemaining) finishZombieSession(session, "Zombies converted everyone.");
};

const evaluateFlagEliminationWin = (session: GameSession) => {
  if (session.settings.gameMode !== "flag" || session.status !== "active" || isTeacherPaused(session)) return;
  const redActive = session.players.some((player) => player.team === "red" && player.connectionState !== "disconnected" && player.isAlive);
  const blueActive = session.players.some((player) => player.team === "blue" && player.connectionState !== "disconnected" && player.isAlive);
  if (!blueActive) {
    finishRound(session, "red", "Red Team knocked out Blue Team");
    return;
  }
  if (!redActive && session.flag?.state !== "placed") {
    finishRound(session, "blue", "Blue Team knocked out Red Team before the flag was placed");
  }
};

const advanceRounds = () => {
  const currentMs = nowMs();
  for (const session of sessions.values()) {
    if (!ownsRoom(session.id)) continue;
    if (isTeacherPaused(session)) continue;
    if (session.status === "paused") {
      const startsAtMs = session.roundTransition ? Date.parse(session.roundTransition.startsAt) : Number.NaN;
      if (Number.isFinite(startsAtMs) && currentMs >= startsAtMs) startPendingRound(session);
      continue;
    }
    if (session.status !== "active") continue;

    // Athletics Race owns its own continuous timer and finish order. Keep it
    // out of team-round conclusion logic so a race cannot be scored as a tag
    // draw when its clock expires.
    if (session.settings.gameMode === "athletics") continue;

    const announcementExpiresAtMs = session.announcement?.expiresAt
      ? Date.parse(session.announcement.expiresAt)
      : Number.NaN;
    if (Number.isFinite(announcementExpiresAtMs) && currentMs >= announcementExpiresAtMs) {
      session.announcement = undefined;
      broadcastSession(session);
    }

    if (session.settings.gameMode === "flag" && session.flag) {
      const flagCountdown = resolveFlagCountdown(session.flag, currentMs);
      if (flagCountdown.winner) {
        finishRound(
          session,
          flagCountdown.winner,
          flagCountdown.reason === "flag_captured" ? "Blue Team captured the flag" : "Red Team protected the flag"
        );
        continue;
      }
    }

    if (getRoundRemainingSeconds(session) <= 0) {
      if (session.settings.gameMode === "flag") {
        finishRound(session, "blue", "Time expired before Red placed the flag");
      } else if (session.settings.gameMode === "zombie") {
        finishZombieSession(session, "Humans survived until time expired.");
      } else {
        const winner = resolveTeamRoundWinner(session.players);
        finishRound(
          session,
          winner,
          winner
            ? "More tags, respawns, or quiz earnings when time expired"
            : "Teams tied on tags, respawns, and quiz earnings when time expired"
        );
      }
    }
  }
};

  return {
    finishSession,
    finishZombieSession,
    inactiveRoundMessage,
    prepareRoundState,
    activatePreparedRound,
    startRoundState,
    openRoundPreparation,
    openZombieSelectionPhase,
    finishRound,
    startPendingRound,
    advanceRounds,
    finishZombieMatchIfComplete,
    evaluateFlagEliminationWin
  };
};
