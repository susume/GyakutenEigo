import type { Server, Socket } from "socket.io";
import { resolveFlagDropForPlayer, type GameSession, type PlayerSession, type Team } from "@quizstrike/shared";

export interface ConnectionLifecycleDependencies {
  io: Server;
  playerSockets: Map<string, Set<string>>;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  playerSocketKey: (sessionCode: string, playerId: string) => string;
  getSessionByCode: (code: string) => GameSession | undefined;
  appendEvent: (session: GameSession, event: { type: "timer"; message: string; playerId: string; team: Team }) => unknown;
  broadcastSession: (session: GameSession) => void;
  evaluateFlagEliminationWin: (session: GameSession) => void;
  finishZombieMatchIfComplete: (session: GameSession) => void;
  resetFreezeStreak: (player: PlayerSession) => void;
  playerQuestionHistory: Map<string, Set<string>>;
  playerQuestionGate: { clear: (playerId: string) => void };
  quizRateLimits: Map<string, number[]>;
  fireRequestIds: Map<string, Map<string, number>>;
  playerMoveTimestamps: Map<string, number>;
  playerNextFireAt: Map<string, number>;
  botRespawnAt: Map<string, number>;
  botNextAttackAt: Map<string, number>;
  botMemoryById: Map<string, unknown>;
  botPreviousPositions: Map<string, unknown>;
  playerPositionHistory: { clear: (playerId: string) => void };
  appearanceUpdateTimestamps: Map<string, number>;
  decalUploadTimestamps: Map<string, number[]>;
  deletePlayerDecals: (sessionId: string, playerId: string) => void;
  botAlertsBySession: Map<string, Map<Team, { sourceId: string }>>;
  gracePeriodMs: number;
}

/** Owns socket replacement, reconnect grace timers, and final player cleanup. */
export class ConnectionLifecycleService {
  constructor(private readonly deps: ConnectionLifecycleDependencies) {}

  clearPlayerDisconnectTimer(session: GameSession, playerId: string) {
    const key = this.deps.playerSocketKey(session.sessionCode, playerId);
    const timer = this.deps.disconnectTimers.get(key);
    if (timer) clearTimeout(timer);
    this.deps.disconnectTimers.delete(key);
  }

  schedulePlayerDisconnectResolution(session: GameSession, playerId: string) {
    const key = this.deps.playerSocketKey(session.sessionCode, playerId);
    this.clearPlayerDisconnectTimer(session, playerId);
    const timer = setTimeout(() => {
      this.deps.disconnectTimers.delete(key);
      const player = session.players.find((candidate) => candidate.id === playerId);
      if (!player || player.connectionState !== "disconnected") return;
      this.deps.resetFreezeStreak(player);
      this.deps.evaluateFlagEliminationWin(session);
      this.deps.finishZombieMatchIfComplete(session);
    }, this.deps.gracePeriodMs);
    this.deps.disconnectTimers.set(key, timer);
  }

  markPlayerDisconnected(session: GameSession, player: PlayerSession) {
    if (player.connectionState === "disconnected") return;
    player.connectionState = "disconnected";
    if (session.flag && player.id === session.flag.carrierId) {
      session.flag = resolveFlagDropForPlayer(session.flag, player, {
        x: player.x ?? 0,
        z: player.z ?? 0
      });
    }
    this.deps.appendEvent(session, {
      type: "timer",
      message: `${player.nickname} is away.`,
      playerId: player.id,
      team: player.team
    });
    this.deps.broadcastSession(session);
    this.schedulePlayerDisconnectResolution(session, player.id);
  }

  removePlayerRuntimeState(session: GameSession, player: PlayerSession) {
    this.clearPlayerDisconnectTimer(session, player.id);
    this.deps.playerQuestionHistory.delete(player.id);
    this.deps.playerQuestionGate.clear(player.id);
    this.deps.quizRateLimits.delete(player.id);
    this.deps.fireRequestIds.delete(player.id);
    this.deps.playerMoveTimestamps.delete(player.id);
    this.deps.playerNextFireAt.delete(player.id);
    this.deps.botRespawnAt.delete(player.id);
    this.deps.botNextAttackAt.delete(player.id);
    this.deps.botMemoryById.delete(player.id);
    this.deps.botPreviousPositions.delete(player.id);
    this.deps.playerPositionHistory.clear(player.id);
    this.deps.appearanceUpdateTimestamps.delete(player.id);
    this.deps.decalUploadTimestamps.delete(player.id);
    this.deps.deletePlayerDecals(session.id, player.id);

    const alerts = this.deps.botAlertsBySession.get(session.sessionCode);
    if (alerts) {
      for (const [team, alert] of alerts) {
        if (alert.sourceId === player.id) alerts.delete(team);
      }
      if (alerts.size === 0) this.deps.botAlertsBySession.delete(session.sessionCode);
    }
  }

  evictPlayerSockets(session: GameSession, player: PlayerSession) {
    const key = this.deps.playerSocketKey(session.sessionCode, player.id);
    const socketIds = this.deps.playerSockets.get(key) ?? new Set<string>();
    for (const socketId of socketIds) {
      const playerSocket = this.deps.io.sockets.sockets.get(socketId);
      if (!playerSocket) continue;
      playerSocket.emit("player_removed", {
      message: "Your teacher removed you from this game. You can return to the join screen and join another room."
      });
      playerSocket.leave(session.sessionCode);
      const binding = playerSocket.data.playerBinding as { sessionCode?: string; playerId?: string } | undefined;
      if (binding?.sessionCode === session.sessionCode && binding.playerId === player.id) {
        delete playerSocket.data.playerBinding;
      }
    }
    this.deps.playerSockets.delete(key);
  }

  detachSocketBinding(socket: Socket) {
    const binding = socket.data.playerBinding as { sessionCode: string; playerId: string } | undefined;
    if (!binding) return;
    const key = this.deps.playerSocketKey(binding.sessionCode, binding.playerId);
    const sockets = this.deps.playerSockets.get(key);
    sockets?.delete(socket.id);
    if (!sockets || sockets.size === 0) {
      this.deps.playerSockets.delete(key);
      const session = this.deps.getSessionByCode(binding.sessionCode);
      const player = session?.players.find((candidate) => candidate.id === binding.playerId);
      if (session && player) this.markPlayerDisconnected(session, player);
    }
    delete socket.data.playerBinding;
  }
}
