import {
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  IRON_JUNCTION_LOADING_LEVEL_Y,
  IRON_JUNCTION_OVERPASS_LEVEL_Y,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  clampArenaPosition,
  getArenaObstacles,
  hasLineOfSight,
  type ArenaPosition,
  type GameSession,
  type PlayerSession,
  type Team
} from "@quizstrike/shared";
import {
  BOT_DIFFICULTIES,
  createBotMemory,
  isTargetInsideBotAwareness,
  resolveBotSpacingGoal,
  type BotMemory,
  type BotState
} from "./botAI.js";
import { PlayerPositionHistory, type HistoricalPosition } from "./playerPositionHistory.js";

type BotProfile = (typeof BOT_DIFFICULTIES)[keyof typeof BOT_DIFFICULTIES];
type BotPreviousPositions = Map<string, HistoricalPosition>;

export class BotNavigationService {
  constructor(
    private readonly botMemoryById: Map<string, BotMemory>,
    private readonly botPreviousPositions: BotPreviousPositions,
    private readonly playerPositionHistory: PlayerPositionHistory
  ) {}

  getBotBrain(bot: PlayerSession, index: number, nowMs: number) {
    let brain = this.botMemoryById.get(bot.id);
    if (!brain) {
      brain = createBotMemory(bot.id, index, nowMs);
      this.botMemoryById.set(bot.id, brain);
    }
    return brain;
  }

  botPosition(player: PlayerSession): ArenaPosition {
    return {
      x: player.x ?? 0,
      y: player.y ?? 0,
      z: player.z ?? 0,
      facing: player.facing ?? 0
    };
  }

  playersWithRewind(players: PlayerSession[], nowMs = Date.now()) {
    return players.map((player) => {
      const previous = player.isBot
        ? this.botPreviousPositions.get(player.id)
        : this.playerPositionHistory.rewind(player.id, nowMs);
      return previous
        ? { ...player, previousX: previous.x, previousY: previous.y, previousZ: previous.z }
        : player;
    });
  }

  horizontalDistance(a: ArenaPosition, b: ArenaPosition) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  isBotEnemy(session: GameSession, bot: PlayerSession, candidate: PlayerSession) {
    if (candidate.id === bot.id || candidate.connectionState === "disconnected" || !candidate.isAlive) return false;
    if (session.settings.gameMode === "zombie") return candidate.role !== bot.role;
    return candidate.team !== bot.team;
  }

  private isInsideBotFov(from: PlayerSession, to: PlayerSession, halfAngle: number) {
    const fromPosition = this.botPosition(from);
    const targetPosition = this.botPosition(to);
    const distance = this.horizontalDistance(fromPosition, targetPosition);
    if (distance <= 0.001) return true;
    const forward = { x: -Math.sin(fromPosition.facing ?? 0), z: -Math.cos(fromPosition.facing ?? 0) };
    const direction = { x: (targetPosition.x - fromPosition.x) / distance, z: (targetPosition.z - fromPosition.z) / distance };
    return forward.x * direction.x + forward.z * direction.z >= Math.cos(halfAngle);
  }

  canBotSee(
    session: GameSession,
    bot: PlayerSession,
    target: PlayerSession,
    profile: BotProfile,
    obstacles: ReturnType<typeof getArenaObstacles>
  ) {
    const distance = this.horizontalDistance(this.botPosition(bot), this.botPosition(target));
    return distance <= profile.viewDistance
      && Math.abs((target.y ?? 0) - (bot.y ?? 0)) <= 5.5
      && isTargetInsideBotAwareness({
        distance,
        inFieldOfView: this.isInsideBotFov(bot, target, profile.viewHalfAngle)
      })
      && hasLineOfSight({ from: this.botPosition(bot), to: this.botPosition(target), obstacles });
  }

  private scaledPoint(x: number, z: number) {
    return { x: x * ARENA_SCALE, z: z * ARENA_SCALE };
  }

  private scaledLevelPoint(x: number, z: number, groundY = 0) {
    return { x: x * ARENA_SCALE, y: groundY + ARENA_PLAYER_EYE_HEIGHT, z: z * ARENA_SCALE };
  }

  private botBasePoint(team: Team, mapId?: string) {
    return mapId === "desert_citadel"
      ? this.scaledPoint((team === "blue" ? -1 : 1) * 235, 0)
      : this.scaledPoint(
        (team === "blue" ? -1 : 1)
          * (mapId === "temple_runoff" ? 205 : mapId === "iron_junction" ? 248 : 142),
        0
      );
  }

  private botEnemyBasePoint(team: Team, mapId?: string) {
    return mapId === "desert_citadel"
      ? this.scaledPoint((team === "blue" ? 1 : -1) * 235, 0)
      : this.scaledPoint(
        (team === "blue" ? 1 : -1)
          * (mapId === "temple_runoff" ? 205 : mapId === "iron_junction" ? 248 : 142),
        0
      );
  }

  private getIronJunctionPatrolPoints(team: Team) {
    const direction = team === "blue" ? 1 : -1;
    const longitudinal = [-185, -85, 65, 175].map((value) => value * direction);
    const upper = team === "blue"
      ? [
          this.scaledLevelPoint(-205, -57),
          this.scaledLevelPoint(-150, -57, IRON_JUNCTION_LOADING_LEVEL_Y),
          this.scaledLevelPoint(-105, -94, IRON_JUNCTION_OVERPASS_LEVEL_Y),
          this.scaledLevelPoint(20, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y)
        ]
      : [
          this.scaledLevelPoint(165, 25),
          this.scaledLevelPoint(125, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y),
          this.scaledLevelPoint(80, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y),
          this.scaledLevelPoint(-20, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y)
        ];
    const stages = longitudinal.map((x, stage) => [
      this.scaledLevelPoint(x, stage % 2 === 0 ? 0 : 42),
      this.scaledLevelPoint(x, -112 + stage * 8),
      this.scaledLevelPoint(x, 112 + stage * 12),
      this.scaledLevelPoint(x, 202 + stage * 5),
      upper[stage]
    ]);
    return stages.flat();
  }

  private getDesertCitadelPatrolPoints(team: Team) {
    const direction = team === "blue" ? 1 : -1;
    const xStages = [-180, -108, 0, 108, 180].map((x) => x * direction);
    const upper = [
      this.scaledLevelPoint(-120, 78, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
      this.scaledLevelPoint(0, 78, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
      this.scaledLevelPoint(120, 78, DESERT_CITADEL_ROOFTOP_LEVEL_Y)
    ];
    return xStages.flatMap((x, stage) => [
      this.scaledLevelPoint(x, -118),
      this.scaledLevelPoint(x, 0),
      this.scaledLevelPoint(x, 133),
      this.scaledLevelPoint(x, stage % 2 === 0 ? 18 : 78, stage % 2 === 0 ? DESERT_CITADEL_MAIN_LEVEL_Y : 0),
      upper[stage % upper.length]
    ]);
  }

  private getTempleRunoffPatrolPoints(team: Team) {
    const direction = team === "blue" ? 1 : -1;
    const xStages = [-190, -108, -12, 92, 190].map((x) => x * direction);
    return xStages.flatMap((x) => [
      this.scaledLevelPoint(x, -154, TEMPLE_RUNOFF_MAIN_LEVEL_Y),
      this.scaledLevelPoint(x, -86, TEMPLE_RUNOFF_MAIN_LEVEL_Y),
      this.scaledLevelPoint(x, 0),
      this.scaledLevelPoint(x, 86, TEMPLE_RUNOFF_MAIN_LEVEL_Y),
      this.scaledLevelPoint(x, 154, TEMPLE_RUNOFF_MAIN_LEVEL_Y)
    ]);
  }

  private getBotPatrolPoints(team: Team, mapId?: string) {
    return mapId === "temple_runoff"
      ? this.getTempleRunoffPatrolPoints(team)
      : mapId === "iron_junction"
        ? this.getIronJunctionPatrolPoints(team)
        : mapId === "desert_citadel"
          ? this.getDesertCitadelPatrolPoints(team)
          : [
              this.scaledPoint(0, -84),
              this.scaledPoint(team === "blue" ? -42 : 42, -28),
              this.scaledPoint(0, 28),
              this.scaledPoint(team === "blue" ? 42 : -42, 84),
              this.botBasePoint(team, mapId)
            ];
  }

  findBotCover(
    session: GameSession,
    bot: PlayerSession,
    threat: PlayerSession | undefined,
    obstacles: ReturnType<typeof getArenaObstacles>
  ) {
    if (!threat) return undefined;
    const origin = this.botPosition(bot);
    const threatPosition = this.botPosition(threat);
    const candidates: Array<{ x: number; z: number; score: number }> = [];
    for (const obstacle of obstacles) {
      const awayX = obstacle.x - threatPosition.x;
      const awayZ = obstacle.z - threatPosition.z;
      const awayDistance = Math.hypot(awayX, awayZ) || 1;
      const padding = obstacle.kind === "circle" ? obstacle.radius + 4 : Math.max(obstacle.width, obstacle.depth) / 2 + 4;
      const points = [
        { x: obstacle.x + (awayX / awayDistance) * padding, z: obstacle.z + (awayZ / awayDistance) * padding },
        { x: obstacle.x - (awayZ / awayDistance) * padding, z: obstacle.z + (awayX / awayDistance) * padding },
        { x: obstacle.x + (awayZ / awayDistance) * padding, z: obstacle.z - (awayX / awayDistance) * padding }
      ];
      for (const point of points) {
        const candidate = clampArenaPosition({ ...point, facing: origin.facing ?? 0 }, session.settings.mapId);
        if (hasLineOfSight({ from: threatPosition, to: candidate, obstacles })) continue;
        const score = this.horizontalDistance(origin, candidate) - this.horizontalDistance(threatPosition, candidate) * 0.25;
        candidates.push({ ...candidate, score });
      }
    }
    return candidates.sort((a, b) => a.score - b.score)[0];
  }

  applyBotSpacing(session: GameSession, bot: PlayerSession, desired: { x: number; y?: number; z: number }) {
    const spaced = resolveBotSpacingGoal({
      botId: bot.id,
      botPosition: this.botPosition(bot),
      desired,
      teammates: session.players.filter((player) => player.isAlive && player.team === bot.team)
    });
    return clampArenaPosition({ ...spaced, ...(Number.isFinite(desired.y) ? { y: desired.y } : {}), facing: bot.facing ?? 0 }, session.settings.mapId);
  }

  getBotObjectiveGoal(session: GameSession, bot: PlayerSession, brain: BotMemory, state: BotState) {
    const flag = session.flag;
    const carrier = flag?.carrierId ? session.players.find((player) => player.id === flag.carrierId) : undefined;
    if (flag?.state === "carried" && carrier?.id === bot.id) return this.botEnemyBasePoint(bot.team, session.settings.mapId);
    if (state === "escort_flag_carrier" && carrier && carrier.team === bot.team) return { x: carrier.x ?? 0, z: (carrier.z ?? 0) + brain.strafeDirection * 8 };
    if (state === "attack_flag_carrier" && carrier && carrier.team !== bot.team) return this.botPosition(carrier);
    if (state === "defend_objective" && flag && ["placed", "being_captured"].includes(flag.state)) return flag.position;
    if (state === "move_to_objective" || state === "defend_objective") {
      if (flag && bot.team === "red" && ["available", "dropped"].includes(flag.state)) return flag.position;
      if (flag && flag.state === "carried" && carrier) return this.botPosition(carrier);
      return bot.team === "blue" ? this.botBasePoint(bot.team, session.settings.mapId) : this.botEnemyBasePoint(bot.team, session.settings.mapId);
    }
    if (state === "flank") {
      if (session.settings.mapId === "desert_citadel") {
        const lowerRoute = brain.routeIndex % 2 === 0;
        return lowerRoute
          ? this.scaledLevelPoint(brain.strafeDirection * 96, 133)
          : this.scaledLevelPoint(brain.strafeDirection * 120, 78, DESERT_CITADEL_ROOFTOP_LEVEL_Y);
      }
      const side = brain.routeIndex % 2 === 0 ? -1 : 1;
      return this.scaledPoint(side * 82, brain.strafeDirection * 72);
    }
    if (state === "search" && brain.lastSeenPosition) return brain.lastSeenPosition;
    if (state === "retreat" || state === "regroup" || state === "take_cover") return this.botBasePoint(bot.team, session.settings.mapId);
    const patrol = this.getBotPatrolPoints(bot.team, session.settings.mapId);
    return patrol[brain.routeIndex % patrol.length];
  }
}
