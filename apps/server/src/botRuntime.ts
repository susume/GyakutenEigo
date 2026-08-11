import type { Server } from "socket.io";
import type {
  ArenaPosition,
  BotDifficulty,
  GameEvent,
  GameSession,
  GroundArenaPosition,
  PlayerSession,
  Team
} from "@quizstrike/shared";
import {
  ARENA_PLAYER_EYE_HEIGHT,
  DEFAULT_PLAYER_HEALTH,
  awardZombieHumanEnergy,
  canPlayerFireInMode,
  clampArenaAimPitch,
  clampArenaPosition,
  findBotNavigationPath,
  getArenaEyeHeight,
  getArenaGroundHeightForPlayer,
  getArenaObstacles,
  getGearFireCooldownMs,
  getGearHitRadius,
  getGearRange,
  getPlayerHealthMax,
  getPlayerMoveSpeedMultiplier,
  getPlayerWeaponIdForMode,
  getRoundRemainingSeconds,
  hasLineOfSight,
  resolveBotRespawn,
  resolveBotRoamStep,
  resolveFlagCapture,
  resolveFlagCountdown,
  resolveFlagPickup,
  resolveFlagPlacement,
  resolveProjectileTarget,
  resolveSnowballUse,
  resolveZombieSprintEnergy
} from "@quizstrike/shared";
import { isTeacherPaused } from "@quizstrike/shared";
import {
  BOT_DIFFICULTIES,
  chooseBotRole,
  chooseBotTarget,
  getBotWeaponPreference,
  nextBotRandom,
  randomBetween,
  resolveBotAim,
  resolveBotPerceptionFocus,
  resolveBotState,
  shouldAdvanceBotPatrolRoute,
  shouldBotAttemptFlagInteraction,
  type BotMemory,
  type BotState
} from "./botAI.js";

type BotProfile = (typeof BOT_DIFFICULTIES)[keyof typeof BOT_DIFFICULTIES];
type BotGoal = { x: number; y?: number; z: number; facing?: number };
type BotAlert = { position: { x: number; z: number }; createdAtMs: number; sourceId: string };

export type BotRuntimeDependencies = {
  io: Server;
  gameplayRoom: (sessionCode: string) => string;
  sessions: { values: () => Iterable<GameSession> };
  ownsRoom: (roomId: string) => boolean;
  finishRound: (session: GameSession, winner: Team | undefined, reason: string) => void;
  broadcastSession: (session: GameSession) => void;
  appendEvent: (session: GameSession, event: Omit<GameEvent, "id" | "createdAt">) => GameEvent;
  broadcastPlayerPosition: (session: GameSession, position: { playerId: string; x: number; y?: number; z: number; facing: number }) => void;
  sessionSpawn: (session: GameSession, team: Team) => GroundArenaPosition;
  getBotSpawn: (session: GameSession, team: Team, index: number) => GroundArenaPosition;
  getBotBrain: (bot: PlayerSession, index: number, nowMs: number) => BotMemory;
  botPosition: (player: PlayerSession) => ArenaPosition;
  playersWithRewind: (players: PlayerSession[], nowMs?: number) => PlayerSession[];
  horizontalDistance: (a: ArenaPosition, b: ArenaPosition) => number;
  isBotEnemy: (session: GameSession, bot: PlayerSession, candidate: PlayerSession) => boolean;
  canBotSee: (session: GameSession, bot: PlayerSession, target: PlayerSession, profile: BotProfile, obstacles: ReturnType<typeof getArenaObstacles>) => boolean;
  findBotCover: (session: GameSession, bot: PlayerSession, threat: PlayerSession | undefined, obstacles: ReturnType<typeof getArenaObstacles>) => BotGoal | undefined;
  applyBotSpacing: (session: GameSession, bot: PlayerSession, desired: BotGoal) => GroundArenaPosition;
  getBotObjectiveGoal: (session: GameSession, bot: PlayerSession, brain: BotMemory, state: BotState) => BotGoal;
  emitFlagPlanted: (session: GameSession, player: PlayerSession) => void;
  applyValidatedDamage: (session: GameSession, attacker: PlayerSession, target: PlayerSession) => unknown;
  botNextAttackAt: Map<string, number>;
  botRespawnAt: Map<string, number>;
  botPreviousPositions: Map<string, { x: number; y?: number; z: number }>;
  botAlertsBySession: Map<string, Map<Team, BotAlert>>;
  botDifficulty: BotDifficulty;
  botTickMs: number;
};

export const createBotRuntime = (deps: BotRuntimeDependencies) => {
  const {
    io,
    gameplayRoom,
    sessions,
    ownsRoom,
    finishRound,
    broadcastSession,
    appendEvent,
    broadcastPlayerPosition,
    sessionSpawn,
    getBotSpawn,
    getBotBrain,
    botPosition,
    playersWithRewind,
    horizontalDistance,
    isBotEnemy,
    canBotSee,
    findBotCover,
    applyBotSpacing,
    getBotObjectiveGoal,
    emitFlagPlanted,
    applyValidatedDamage,
    botNextAttackAt,
    botRespawnAt,
    botPreviousPositions,
    botAlertsBySession,
    botDifficulty,
    botTickMs
  } = deps;

const shouldBotObjectiveAction = (session: GameSession, bot: PlayerSession) => {
  if (session.settings.gameMode !== "flag" || !session.flag) return false;
  const previous = session.flag.state;
  session.flag = resolveFlagPickup(session.flag, bot);
  session.flag = resolveFlagPlacement({
    flag: session.flag,
    player: bot,
    nowMs: Date.now(),
    holdSeconds: session.settings.flagHoldSeconds
  });
  session.flag = resolveFlagCapture(session.flag, bot);
  if (previous === session.flag.state) return false;
  if (session.flag.state === "placed") emitFlagPlanted(session, bot);
  appendEvent(session, {
    type: "timer",
    message: session.flag.state === "carried"
      ? `${bot.nickname} picked up the flag.`
      : session.flag.state === "placed"
        ? "The flag has been placed. Red must protect it."
        : session.flag.state === "captured"
          ? "Blue captured the flag."
          : "Flag updated.",
    playerId: bot.id,
    team: bot.team
  });
  const countdown = resolveFlagCountdown(session.flag, Date.now());
  if (countdown.winner) {
    finishRound(
      session,
      countdown.winner,
      countdown.reason === "flag_captured" ? "Blue Team captured the flag" : "Red Team protected the flag"
    );
  }
  return true;
};

const botFire = (
  session: GameSession,
  bot: PlayerSession,
  target: PlayerSession,
  brain: BotMemory,
  profile: (typeof BOT_DIFFICULTIES)[keyof typeof BOT_DIFFICULTIES],
  currentMs: number,
  obstacles: ReturnType<typeof getArenaObstacles>
) => {
  if (!canPlayerFireInMode(session.settings.gameMode, bot.role)) return false;
  if ((botNextAttackAt.get(bot.id) ?? 0) > currentMs) return false;
  const weaponId = getPlayerWeaponIdForMode(session.settings.gameMode, bot);
  const preference = getBotWeaponPreference(weaponId);
  const distance = horizontalDistance(botPosition(bot), botPosition(target));
  if (distance > getGearRange(weaponId)) return false;
  const aim = resolveBotAim({
    memory: brain,
    from: botPosition(bot),
    target: botPosition(target),
    currentFacing: bot.facing ?? 0,
    profile,
    movementPenalty: brain.state === "engage_enemy" ? 0.025 : 0.07,
    distance,
    nowMs: currentMs
  });
  bot.facing = aim.facing;
  if (!aim.aligned) return false;
  const botEyeY = bot.y
    ?? getArenaEyeHeight(session.settings.mapId, bot.x ?? 0, bot.z ?? 0);
  const targetEyeY = target.y
    ?? getArenaEyeHeight(session.settings.mapId, target.x ?? 0, target.z ?? 0);
  const aimPitch = clampArenaAimPitch(
    Math.atan2(targetEyeY - botEyeY, Math.max(0.001, distance))
  );
  const snowballUse = resolveSnowballUse(bot);
  if (!snowballUse.ok) return false;
  bot.snowballs = snowballUse.nextSnowballs;
  io.to(gameplayRoom(session.sessionCode)).emit("remote_weapon_fire", {
    playerId: bot.id,
    x: bot.x ?? sessionSpawn(session, bot.team).x,
    y: botEyeY,
    z: bot.z ?? sessionSpawn(session, bot.team).z,
    facing: bot.facing ?? sessionSpawn(session, bot.team).facing,
    pitch: aimPitch,
    gearId: weaponId,
    scoped: weaponId === "power_blaster" && brain.role === "overwatch",
    zoomLevel: weaponId === "power_blaster" && brain.role === "overwatch" ? 1 : 0
  });
  const targetSelection = resolveProjectileTarget({
    attacker: bot,
    candidates: playersWithRewind(session.players),
    requestedTargetId: target.id,
    range: getGearRange(weaponId),
    hitRadius: getGearHitRadius(weaponId, weaponId === "power_blaster" && brain.role === "overwatch" ? 1 : 0),
    obstacles,
    aimPitch
  });
  const shotDelay = Math.max(
    getGearFireCooldownMs(weaponId),
    weaponId === "quick_blaster" ? 360 : weaponId === "power_blaster" ? 1750 : 620
  );
  brain.burstShotsRemaining = brain.burstShotsRemaining > 1 ? brain.burstShotsRemaining - 1 : preference.burstSize;
  botNextAttackAt.set(
    bot.id,
    currentMs + (brain.burstShotsRemaining > 1 ? shotDelay : shotDelay + profile.firePauseMs + randomBetween(brain, 0, 260))
  );
  if (!targetSelection.ok) return true;
  const selectedTarget = session.players.find((player) => player.id === targetSelection.targetId);
  if (selectedTarget) applyValidatedDamage(session, bot, selectedTarget);
  return true;
};

const advanceBots = () => {
  const currentMs = Date.now();
  for (const session of sessions.values()) {
    if (!ownsRoom(session.id)) continue;
    if (isTeacherPaused(session)) continue;
    if (session.status !== "active") continue;
    let moved = false;
    session.players.forEach((bot, index) => {
      if (!bot.isBot) return;
      if (!bot.isAlive) {
        if (session.settings.gameMode === "flag") return;
        const respawn = resolveBotRespawn({
          bot,
          spawn: getBotSpawn(session, bot.team, index),
          nowMs: currentMs,
          respawnAtMs: botRespawnAt.get(bot.id),
          startingSnowballs: session.settings.startingSnowballs
        });
        if (respawn.respawned) {
          Object.assign(bot, respawn.player);
          bot.respawns = (bot.respawns ?? 0) + 1;
          bot.roundRespawns = (bot.roundRespawns ?? 0) + 1;
          botRespawnAt.delete(bot.id);
          botPreviousPositions.delete(bot.id);
          appendEvent(session, { type: "respawn", message: `${bot.nickname} returned to the arena.`, playerId: bot.id, team: bot.team });
          moved = true;
        }
        return;
      }
      const brain = getBotBrain(bot, index, currentMs);
      const profile = BOT_DIFFICULTIES[session.settings.botDifficulty ?? botDifficulty];
      const obstacles = getArenaObstacles(session.settings.mapId);
      const isZombieHumanBot = session.settings.gameMode === "zombie" && bot.role !== "zombie";
      if (isZombieHumanBot && (bot.energy ?? 0) <= 0) {
        bot.energy = awardZombieHumanEnergy({
          gameMode: "zombie",
          role: "human",
          isCorrect: true,
          currentEnergy: bot.energy
        });
      }
      const remainingSeconds = getRoundRemainingSeconds(session);
      const aliveTeammates = session.players.filter((player) => player.isAlive && player.team === bot.team);
      const nearbyAllies = aliveTeammates.filter((player) => player.id !== bot.id && horizontalDistance(botPosition(bot), botPosition(player)) < 30).length;
      const enemyPlayers = session.players.filter((player) => isBotEnemy(session, bot, player));
      const flagCarrier = session.flag?.carrierId ? session.players.find((player) => player.id === session.flag?.carrierId) : undefined;
      const objectiveUrgent = session.settings.gameMode === "flag" && Boolean(
        (bot.team === "red" && (session.flag?.state === "available" || session.flag?.state === "dropped"))
        ||
        (flagCarrier && flagCarrier.team !== bot.team)
        || (session.flag?.state === "placed" && (session.flag.expiresAtMs ?? currentMs + 99_999) - currentMs < 12_000)
        || remainingSeconds < 20
      );

      let visibleTargets: PlayerSession[] = [];
      if (currentMs >= brain.nextThinkAtMs) {
        brain.nextThinkAtMs = currentMs + profile.thinkIntervalMs + Math.floor(nextBotRandom(brain) * 120);
        brain.role = chooseBotRole({
          gameMode: session.settings.gameMode,
          team: bot.team,
          flagState: session.flag?.state,
          flagCarrierTeam: flagCarrier?.team,
          index,
          teammateCount: aliveTeammates.length,
          remainingSeconds,
          personality: brain.personality
        });
        const perceivedTargets = enemyPlayers
          .map((player) => ({ player, distance: horizontalDistance(botPosition(bot), botPosition(player)) }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 8)
          .filter((candidate) => canBotSee(session, bot, candidate.player, profile, obstacles));
        const perception = resolveBotPerceptionFocus({
          visibleTargetIds: perceivedTargets.map((candidate) => candidate.player.id),
          currentTargetId: brain.visibleTargetId,
          visibleSinceAtMs: brain.visibleSinceAtMs,
          nowMs: currentMs,
          reactionMs: profile.reactionMs
        });
        brain.visibleTargetId = perception.focusId;
        brain.visibleSinceAtMs = perception.visibleSinceAtMs;
        const focus = perceivedTargets.find((candidate) => candidate.player.id === perception.focusId)?.player;
        if (focus) {
          brain.lastSeenTargetId = focus.id;
          brain.lastSeenPosition = { x: focus.x ?? 0, z: focus.z ?? 0 };
          brain.lastSeenAtMs = currentMs;
        }
        if (perception.reacted) {
          visibleTargets = perceivedTargets.map((candidate) => candidate.player);
          const alerts = botAlertsBySession.get(session.sessionCode) ?? new Map<Team, BotAlert>();
          alerts.set(bot.team, {
            position: {
              x: (focus?.x ?? 0) + randomBetween(brain, -6, 6),
              z: (focus?.z ?? 0) + randomBetween(brain, -6, 6)
            },
            createdAtMs: currentMs,
            sourceId: bot.id
          });
          botAlertsBySession.set(session.sessionCode, alerts);
        }
        if (perceivedTargets.length === 0) {
          const alert = botAlertsBySession.get(session.sessionCode)?.get(bot.team);
          if (alert && currentMs - alert.createdAtMs < profile.memoryMs * 0.65 && alert.sourceId !== bot.id) {
            brain.lastSeenPosition = alert.position;
            brain.lastSeenAtMs = alert.createdAtMs;
          }
        }
        const targetChoice = chooseBotTarget({
          candidates: visibleTargets.map((candidate) => ({
            id: candidate.id,
            distance: horizontalDistance(botPosition(bot), botPosition(candidate)),
            health: candidate.health ?? DEFAULT_PLAYER_HEALTH,
            visible: true,
            isFlagCarrier: session.flag?.carrierId === candidate.id,
            attackingObjective: session.settings.gameMode === "flag" && session.flag?.state === "carried" && candidate.team === "red",
            alliesNearTarget: enemyPlayers.filter((ally) => horizontalDistance(botPosition(ally), botPosition(candidate)) < 14).length
          })),
          currentTargetId: brain.targetId,
          nowMs: currentMs,
          commitUntilMs: brain.targetCommitUntilMs,
          role: brain.role,
          personality: brain.personality,
          weaponRange: getGearRange(getPlayerWeaponIdForMode(session.settings.gameMode, bot))
        });
        if (targetChoice) {
          brain.targetId = targetChoice.id;
          brain.targetCommitUntilMs = currentMs + profile.targetCommitMs;
        } else if (!brain.lastSeenAtMs || currentMs - brain.lastSeenAtMs > profile.memoryMs) {
          brain.targetId = undefined;
          brain.lastSeenPosition = undefined;
          brain.lastSeenTargetId = undefined;
        }
        const target = brain.targetId ? session.players.find((player) => player.id === brain.targetId && isBotEnemy(session, bot, player)) : undefined;
        const targetVisible = Boolean(target && visibleTargets.some((player) => player.id === target.id));
        brain.state = resolveBotState({
          current: brain.state,
          health: bot.health ?? DEFAULT_PLAYER_HEALTH,
          maxHealth: getPlayerHealthMax(bot),
          targetVisible,
          hasLastKnownTarget: Boolean(brain.lastSeenPosition && brain.lastSeenAtMs && currentMs - brain.lastSeenAtMs <= profile.memoryMs),
          objectiveUrgent,
          role: brain.role,
          personality: brain.personality,
          alliesNearby: nearbyAllies,
          enemiesVisible: visibleTargets.length,
          flankAvailable: enemyPlayers.length > 0,
          randomValue: nextBotRandom(brain)
        });
        if (session.flag?.state === "carried" && flagCarrier && flagCarrier.team !== bot.team && brain.role === "interceptor" && !targetVisible) {
          brain.state = "attack_flag_carrier";
          brain.targetId = flagCarrier.id;
        }
      }

      const target = brain.targetId ? session.players.find((player) => player.id === brain.targetId && isBotEnemy(session, bot, player)) : undefined;
      const oldX = bot.x ?? sessionSpawn(session, bot.team).x;
      const oldY = bot.y;
      const oldZ = bot.z ?? sessionSpawn(session, bot.team).z;
      const oldFacing = bot.facing ?? 0;
      const preference = getBotWeaponPreference(getPlayerWeaponIdForMode(session.settings.gameMode, bot));
      let goal = getBotObjectiveGoal(session, bot, brain, brain.state);
      if (target && ["engage_enemy", "flank", "take_cover"].includes(brain.state)) {
        if (brain.state === "take_cover") {
          goal = findBotCover(session, bot, target, obstacles) ?? goal;
        } else if (brain.state === "engage_enemy" || brain.state === "flank") {
          const targetPosition = botPosition(target);
          const distance = horizontalDistance(botPosition(bot), targetPosition);
          if (distance > preference.preferredDistance) {
            const directionX = (targetPosition.x - oldX) / Math.max(distance, 1);
            const directionZ = (targetPosition.z - oldZ) / Math.max(distance, 1);
            goal = { x: targetPosition.x - directionX * preference.preferredDistance, z: targetPosition.z - directionZ * preference.preferredDistance };
          } else if (distance < preference.minimumDistance) {
            const directionX = (targetPosition.x - oldX) / Math.max(distance, 1);
            const directionZ = (targetPosition.z - oldZ) / Math.max(distance, 1);
            goal = { x: oldX - directionX * 8, z: oldZ - directionZ * 8 };
          } else {
            goal = {
              x: targetPosition.x + (-(targetPosition.z - oldZ) / Math.max(distance, 1)) * brain.strafeDirection * 12,
              z: targetPosition.z + ((targetPosition.x - oldX) / Math.max(distance, 1)) * brain.strafeDirection * 12
            };
          }
        }
      }
      let rawGoal = clampArenaPosition({ ...goal, facing: bot.facing ?? 0 }, session.settings.mapId);
      if (shouldAdvanceBotPatrolRoute({
        state: brain.state,
        hasTarget: Boolean(target),
        distanceToGoal: horizontalDistance(botPosition(bot), rawGoal)
      })) {
        brain.routeIndex += session.settings.mapId === "iron_junction"
          || session.settings.mapId === "desert_citadel"
          || session.settings.mapId === "temple_runoff"
          ? 5
          : 1;
        brain.navigationPath = undefined;
        goal = getBotObjectiveGoal(session, bot, brain, brain.state);
        rawGoal = clampArenaPosition({ ...goal, facing: bot.facing ?? 0 }, session.settings.mapId);
      }
      const navigationGoalChanged = !brain.navigationGoal
        || horizontalDistance({ ...brain.navigationGoal, facing: 0 }, rawGoal) > 10;
      if (navigationGoalChanged) brain.navigationPath = undefined;
      brain.navigationGoal = { x: rawGoal.x, z: rawGoal.z };
      while (brain.navigationPath?.length && horizontalDistance(botPosition(bot), { ...brain.navigationPath[0], facing: 0 }) < 3) {
        brain.navigationPath.shift();
      }
      if (!hasLineOfSight({ from: botPosition(bot), to: rawGoal, obstacles, padding: 0.7 })) {
        if (!brain.navigationPath?.length) {
          brain.navigationPath = findBotNavigationPath({
            from: botPosition(bot),
            to: rawGoal,
            obstacles,
            mapId: session.settings.mapId
          });
        }
        goal = brain.navigationPath?.[0] ?? rawGoal;
      } else {
        brain.navigationPath = undefined;
        goal = rawGoal;
      }
      const desired = applyBotSpacing(session, bot, clampArenaPosition({ ...goal, facing: bot.facing ?? 0 }, session.settings.mapId));
      desired.facing = Math.atan2(oldX - desired.x, oldZ - desired.z);
      const next = resolveBotRoamStep({
        current: { x: oldX, y: oldY, z: oldZ, facing: bot.facing ?? desired.facing },
        desired,
        elapsedMs: botTickMs,
        speed: (
          isZombieHumanBot && (bot.energy ?? 0) <= 0
            ? 0
            : session.settings.gameMode === "zombie"
              ? bot.role === "zombie" ? 14.8 : 10.8
              : 19.5
        ) * getPlayerMoveSpeedMultiplier(bot),
        obstacles,
        detourDirection: brain.strafeDirection,
        mapId: session.settings.mapId
      });
      botPreviousPositions.set(bot.id, { x: oldX, y: oldY, z: oldZ });
      bot.x = next.x;
      const botGroundY = getArenaGroundHeightForPlayer(
        session.settings.mapId,
        next.x,
        next.z,
        oldY,
        ARENA_PLAYER_EYE_HEIGHT,
        1.4
      );
      bot.y = botGroundY + ARENA_PLAYER_EYE_HEIGHT;
      bot.z = next.z;
      const movedDistance = Math.hypot(next.x - oldX, next.z - oldZ);
      if (isZombieHumanBot) {
        bot.energy = resolveZombieSprintEnergy({
          gameMode: "zombie",
          role: "human",
          sprinting: true,
          currentEnergy: bot.energy,
          elapsedMs: botTickMs,
          movedDistance
        }).nextEnergy;
      }
      if (movedDistance > 0.1) bot.facing = Math.atan2(next.x - oldX, next.z - oldZ);
      else bot.facing = next.facing;
      if (movedDistance > 0.01 || Math.abs((bot.facing ?? 0) - oldFacing) > 0.01) {
        broadcastPlayerPosition(session, {
          playerId: bot.id,
          x: bot.x,
          y: bot.y,
          z: bot.z,
          facing: bot.facing
        });
      }
      bot.snowballs = bot.snowballs ?? session.settings.startingSnowballs;
      moved = moved || movedDistance > 0.1;
      if (next.blocked || (horizontalDistance(botPosition(bot), { ...goal, y: bot.y }) > 5 && movedDistance < 0.1)) {
        brain.blockedTicks += 1;
        brain.noProgressTicks += 1;
      } else {
        brain.blockedTicks = 0;
        brain.noProgressTicks = 0;
      }
      if (brain.blockedTicks >= 3 || brain.noProgressTicks >= 8) {
        brain.state = "unstuck";
        brain.routeIndex += 1;
        brain.blockedTicks = 0;
        brain.noProgressTicks = 0;
        brain.nextThinkAtMs = currentMs;
      } else if (brain.state === "unstuck" && movedDistance > 0.1) {
        brain.state = "regroup";
      }

      const currentTargetVisible = Boolean(target && canBotSee(session, bot, target, profile, obstacles));
      if (target && currentTargetVisible && ["engage_enemy", "take_cover"].includes(brain.state)) {
        botFire(session, bot, target, brain, profile, currentMs, obstacles);
      }
      if (session.settings.gameMode === "flag" && session.flag && shouldBotAttemptFlagInteraction({
        flagState: session.flag.state,
        carrierId: session.flag.carrierId,
        botId: bot.id,
        botPosition: botPosition(bot),
        flagPosition: session.flag.position,
        interactionRadius: 7,
        placedAtMs: session.flag.placedAtMs,
        nowMs: currentMs,
        captureDelayMs: profile.objectiveCaptureDelayMs
      })) {
        moved = shouldBotObjectiveAction(session, bot) || moved;
      }
    });
    if (moved) broadcastSession(session);
  }
};

  return { advanceBots };
};
