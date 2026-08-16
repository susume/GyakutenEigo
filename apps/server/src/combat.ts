import type { Server } from "socket.io";
import {
  canPlayerFireInMode,
  DEFAULT_PLAYER_HEALTH,
  resolveFlagDropForPlayer,
  resolveTagAction,
  resolveZombieConversion,
  type GameEvent,
  type GameSession,
  type PlayerSession,
  type Team
} from "@quizstrike/shared";

export interface CombatDependencies {
  io: Server;
  gameplayRoom: (sessionCode: string) => string;
  sessionSpawn: (session: GameSession, team: Team) => { x: number; y?: number; z: number; facing: number };
  appendEvent: (session: GameSession, event: Omit<GameEvent, "id" | "createdAt">) => unknown;
  emitToPlayers: (session: GameSession, playerIds: Array<string | undefined>, eventName: string, payload: unknown) => void;
  broadcastPlayerState: (session: GameSession, players: PlayerSession[]) => void;
  finishZombieMatchIfComplete: (session: GameSession) => void;
  evaluateFlagEliminationWin: (session: GameSession) => void;
  resetFreezeStreak: (player: PlayerSession) => void;
  recordValidatedFreeze: (session: GameSession, attacker: PlayerSession, target: PlayerSession) => void;
  botPreviousPositions: Map<string, { x: number; y?: number; z: number }>;
  botRespawnAt: Map<string, number>;
  botRespawnMs: number;
  now: () => string;
}

/** Server-authoritative combat resolution; transport callers only broadcast its result. */
export class CombatService {
  constructor(private readonly deps: CombatDependencies) {}

  applyValidatedDamage(session: GameSession, attacker: PlayerSession, target: PlayerSession) {
    const {
      io,
      gameplayRoom,
      sessionSpawn,
      appendEvent,
      emitToPlayers,
      broadcastPlayerState,
      finishZombieMatchIfComplete,
      evaluateFlagEliminationWin,
      resetFreezeStreak,
      recordValidatedFreeze,
      botPreviousPositions,
      botRespawnAt,
      botRespawnMs,
      now
    } = this.deps;

    if (!canPlayerFireInMode(session.settings.gameMode, attacker.role)) {
      return { ok: false as const, reason: "humans_cannot_fire" as const };
    }
    const zombieAttack = session.settings.gameMode === "zombie" && attacker.role === "zombie";
    const combatAttacker = session.settings.gameMode === "zombie"
      ? { ...attacker, gear: "starter_blaster", weapon: "starter_blaster" }
      : attacker;
    const tagResult = resolveTagAction({ attacker: combatAttacker, target });
    if (!tagResult.ok) return tagResult;

    // Capture the hit location before an elimination moves the target back to
    // spawn. Both the attacker/target result and the observer broadcast need
    // the actual combat location so moving players see the effect where the
    // hit happened, not where the respawn was assigned.
    const targetSpawn = sessionSpawn(session, target.team);
    const impactPosition = {
      x: target.x ?? targetSpawn.x,
      y: target.y,
      z: target.z ?? targetSpawn.z
    };
    const impactFacing = target.facing ?? targetSpawn.facing;
    target.health = tagResult.nextHealth;
    resetFreezeStreak(target);
    if (zombieAttack && tagResult.eliminated) {
      const conversion = resolveZombieConversion({ attacker, target });
      if (!conversion.ok) return conversion;
      Object.assign(target, conversion.player);
      target.zombieConvertedAt = now();
      attacker.tags = (attacker.tags ?? attacker.score) + conversion.tagCredit;
      attacker.roundTags = (attacker.roundTags ?? 0) + conversion.tagCredit;
      attacker.score += conversion.tagCredit;
      recordValidatedFreeze(session, attacker, target);
      appendEvent(session, {
        type: "tag",
        message: `${attacker.nickname} converted ${target.nickname} to Zombie Mode.`,
        playerId: attacker.id,
        targetId: target.id,
        team: attacker.team
      });
      emitToPlayers(session, [attacker.id, target.id], "damage_result", {
        ok: true,
        attackerId: attacker.id,
        targetId: target.id,
        attackerX: attacker.x ?? sessionSpawn(session, attacker.team).x,
        attackerZ: attacker.z ?? sessionSpawn(session, attacker.team).z,
        targetX: impactPosition.x,
        targetZ: impactPosition.z,
        targetFacing: impactFacing,
        damage: tagResult.damage,
        health: target.health,
        snowballs: attacker.snowballs,
        eliminated: true,
        converted: true,
        moneyAwarded: 0
      });
      io.to(gameplayRoom(session.sessionCode)).emit("world_impact", {
        attackerId: attacker.id,
        targetId: target.id,
        x: impactPosition.x,
        z: impactPosition.z,
        shield: false,
        eliminated: true
      });
      broadcastPlayerState(session, [attacker, target]);
      finishZombieMatchIfComplete(session);
      return { ok: true as const, damage: tagResult.damage, nextHealth: DEFAULT_PLAYER_HEALTH, eliminated: true, moneyAwarded: 0, scoreDelta: 1 };
    }
    if (tagResult.eliminated) {
      const knockedOutPosition = impactPosition;
      const baseSpawn = sessionSpawn(session, target.team);
      target.isAlive = false;
      target.respawnCorrectAnswers = 0;
      if (session.flag) {
        session.flag = resolveFlagDropForPlayer(session.flag, target, knockedOutPosition);
      }
      target.x = baseSpawn.x;
      target.y = baseSpawn.y;
      target.z = baseSpawn.z;
      target.facing = baseSpawn.facing;
      target.crouching = false;
      target.jumping = false;
      if (target.isBot) {
        botPreviousPositions.delete(target.id);
        if (session.settings.gameMode !== "flag") botRespawnAt.set(target.id, Date.now() + botRespawnMs);
      }
      attacker.money = Math.min(16000, attacker.money + tagResult.moneyAwarded);
      attacker.score += tagResult.scoreDelta;
      attacker.tags = (attacker.tags ?? 0) + 1;
      attacker.roundTags = (attacker.roundTags ?? 0) + 1;
      recordValidatedFreeze(session, attacker, target);
    }

    appendEvent(session, {
      type: tagResult.eliminated ? "elimination" : "tag",
      message: tagResult.eliminated
        ? `${attacker.nickname} has frozen ${target.nickname}.`
        : `${attacker.nickname} tagged ${target.nickname} for ${tagResult.damage} warmth.`,
      playerId: attacker.id,
      targetId: target.id,
      team: attacker.team
    });

    broadcastPlayerState(session, [attacker, target]);
    emitToPlayers(session, [attacker.id, target.id], "damage_result", {
      ok: true,
      attackerId: attacker.id,
      targetId: target.id,
      attackerX: attacker.x ?? sessionSpawn(session, attacker.team).x,
      attackerZ: attacker.z ?? sessionSpawn(session, attacker.team).z,
      targetX: impactPosition.x,
      targetZ: impactPosition.z,
      targetFacing: impactFacing,
      damage: tagResult.damage,
      health: target.health,
      snowballs: attacker.snowballs,
      eliminated: tagResult.eliminated,
      moneyAwarded: tagResult.moneyAwarded
    });
    io.to(gameplayRoom(session.sessionCode)).emit("world_impact", {
      attackerId: attacker.id,
      targetId: target.id,
      x: impactPosition.x,
      z: impactPosition.z,
      shield: !tagResult.eliminated,
      eliminated: tagResult.eliminated
    });
    if (tagResult.eliminated) {
      emitToPlayers(session, [attacker.id, target.id], "elimination_update", {
        attackerId: attacker.id,
        targetId: target.id,
        moneyAwarded: tagResult.moneyAwarded
      });
    }

    evaluateFlagEliminationWin(session);
    finishZombieMatchIfComplete(session);
    return tagResult;
  }
}
