import * as THREE from "three";
import {
  CHARACTER_VISUAL_SCALE,
  FPS_CROUCH_EYE_HEIGHT,
  FPS_STANDING_EYE_HEIGHT
} from "./ArenaCamera";
import {
  ArenaVfxPool,
  getArenaVfxAnchor,
  subscribeArenaVfx,
  type ArenaVfxEvent,
  type ArenaVfxTextures
} from "./ArenaVfx";
import { subscribeArenaAnimation } from "./ArenaAnimation";
import { CharacterFactory } from "./characters/CharacterFactory";
import { CharacterManager } from "./characters/CharacterManager";
import {
  getArenaGroundHeight,
  getArenaObjectiveGroundY,
  getTeamSpawnForMap,
  type ArenaMapId,
  type GameSession,
  type PlayerSession
} from "@quizstrike/shared";
import type { ArenaQuality } from "./gamePreferences";

type LivePosition = { x: number; y?: number; z: number; facing: number };

export type CharacterSyncDependencies = {
  scene: THREE.Scene;
  isFps: boolean;
  currentPlayerId: string;
  players: PlayerSession[];
  currentPlayer?: PlayerSession;
  session?: GameSession;
  arenaMapId: ArenaMapId;
  activeQuality: Exclude<ArenaQuality, "auto">;
  vfxTextures?: ArenaVfxTextures;
  loadDecalAsset?: (assetId: string) => Promise<Blob>;
  makeLabelTexture: (label: string, color: string, background?: string) => THREE.CanvasTexture;
  serverToLocalX: (x: number) => number;
  serverToLocalZ: (z: number) => number;
  flagMarker?: THREE.Group;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const playerAccuracy = (player: PlayerSession) => {
  const total = player.correctAnswers + player.wrongAnswers;
  return total === 0 ? 0 : Math.round((player.correctAnswers / total) * 100);
};

export const createCharacterSync = (deps: CharacterSyncDependencies) => {
  const {
    scene,
    isFps,
    currentPlayerId,
    players,
    currentPlayer,
    session,
    arenaMapId,
    activeQuality,
    loadDecalAsset,
    makeLabelTexture,
    serverToLocalX,
    serverToLocalZ,
    flagMarker
  } = deps;
  const billboardSprites: THREE.Sprite[] = [];
  const characterFactory = new CharacterFactory({
    loadDecalTexture: loadDecalAsset
      ? async (assetId) => {
          const blob = await loadDecalAsset(assetId);
          const objectUrl = URL.createObjectURL(blob);
          try {
            return await new Promise<THREE.Texture>((resolve, reject) => {
              new THREE.TextureLoader().load(objectUrl, resolve, undefined, reject);
            });
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }
      : undefined
  });
  const characterManager = new CharacterManager(scene, characterFactory, {
    isFps,
    currentPlayerId,
    showBadges: isFps || players.length <= 24,
    makeBadgeMaterial: (player) => new THREE.SpriteMaterial({
      map: makeLabelTexture(player.isBot ? "BOT" : `${playerAccuracy(player)}%`, player.team === "blue" ? "#7dd3fc" : "#fb923c"),
      transparent: true,
      depthWrite: false
    }),
    streakAuraTextures: {
      magic: deps.vfxTextures?.magic,
      circle: deps.vfxTextures?.circle
    },
    streakAuraDetail: deps.activeQuality === "performance" ? 0 : activeQuality === "balanced" ? 1 : 2
  });
  const vfxPool = new ArenaVfxPool(
    scene,
    deps.activeQuality === "performance" ? 0 : activeQuality === "balanced" ? 1 : 2,
    deps.vfxTextures
  );
  const unsubscribeAnimation = subscribeArenaAnimation((event) => characterManager.triggerAnimation(event));
  const knownAlive = new Map(players.map((player) => [player.id, player.isAlive]));
  let knownFlagState = session?.flag?.state;
  let knownFlagInteraction = session?.flag?.interactionPlayerId;
  let knownAnnouncementId = session?.announcement?.id;

  const getVisualPosition = (player: PlayerSession, index: number): LivePosition => {
    const liveX = player.x;
    const liveZ = player.z;
    const hasLivePosition = isFiniteNumber(liveX) && isFiniteNumber(liveZ);
    const fallback = getTeamSpawnForMap(arenaMapId, player.team, index);
    const fallbackGroundY = getArenaGroundHeight(
      arenaMapId,
      hasLivePosition ? serverToLocalX(liveX) : fallback.x,
      hasLivePosition ? serverToLocalZ(liveZ) : fallback.z
    );
    const replicatedEyeHeight = player.crouching
      ? FPS_CROUCH_EYE_HEIGHT
      : FPS_STANDING_EYE_HEIGHT;
    return {
      x: hasLivePosition ? serverToLocalX(liveX) : fallback.x,
      y: isFiniteNumber(player.y) ? player.y - replicatedEyeHeight : fallbackGroundY,
      z: hasLivePosition ? serverToLocalZ(liveZ) : fallback.z,
      facing: isFiniteNumber(player.facing) ? player.facing : fallback.facing
    };
  };

  let latestPlayers = players;
  const resolvePlayerAnchor = (event: ArenaVfxEvent) => {
    const anchor = getArenaVfxAnchor(event);
    if (anchor === "world") return event;
    const modelPosition = event.playerId
      ? anchor === "muzzle"
        ? characterManager.getMuzzleWorldPosition(event.playerId)
        : anchor === "head"
          ? characterManager.getHeadWorldPosition(event.playerId)
          : anchor === "torso"
            ? characterManager.getTorsoWorldPosition(event.playerId)
            : characterManager.getGroundWorldPosition(event.playerId)
      : undefined;
    if (modelPosition) {
      return { ...event, x: modelPosition.x, y: modelPosition.y, z: modelPosition.z };
    }
    if (event.playerId) {
      const playerIndex = latestPlayers.findIndex((candidate) => candidate.id === event.playerId);
      const player = latestPlayers[playerIndex];
      if (player) {
        const visual = getVisualPosition(player, Math.max(0, playerIndex));
        const groundY = visual.y ?? 0;
        const fallbackY = anchor === "head"
          ? groundY + 1.68 * CHARACTER_VISUAL_SCALE
          : anchor === "torso"
            ? groundY + 1.18 * CHARACTER_VISUAL_SCALE
            : anchor === "muzzle"
              ? groundY + 1.24 * CHARACTER_VISUAL_SCALE
              : groundY;
        return { ...event, x: visual.x, y: fallbackY, z: visual.z };
      }
    }
    if (isFiniteNumber(event.y)) return event;
    const groundY = getArenaGroundHeight(arenaMapId, event.x, event.z);
    const fallbackY = anchor === "head"
      ? groundY + 1.68 * CHARACTER_VISUAL_SCALE
      : anchor === "torso" || anchor === "muzzle"
        ? groundY + 1.18 * CHARACTER_VISUAL_SCALE
        : groundY;
    return { ...event, y: fallbackY };
  };
  const emitVfx = (event: ArenaVfxEvent) => vfxPool.emit(resolvePlayerAnchor(event));
  const unsubscribeVfx = subscribeArenaVfx(emitVfx);

  const makeTrainingPlayers = () => [
    { ...(currentPlayer ?? {
      id: "training-blue",
      gameSessionId: "demo",
      nickname: "Blue",
      team: "blue",
      money: 0,
      isAlive: true,
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      gear: "starter_blaster",
      joinedAt: ""
    }), id: "training-blue", team: "blue", x: -40, z: -20, facing: -Math.PI / 2 } satisfies PlayerSession,
    { ...(currentPlayer ?? {
      id: "training-red",
      gameSessionId: "demo",
      nickname: "Red",
      team: "red",
      money: 0,
      isAlive: true,
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      gear: "starter_blaster",
      joinedAt: ""
    }), id: "training-red", team: "red", x: 40, z: 20, facing: Math.PI / 2 } satisfies PlayerSession
  ];

  const getDisplayPlayers = (nextPlayers: PlayerSession[]) =>
    nextPlayers.length === 0 || (isFps && nextPlayers.length === 1) ? makeTrainingPlayers() : nextPlayers;

  const syncPlayers = (nextSession?: GameSession, nextCurrentPlayer?: PlayerSession) => {
    const nextPlayers = nextSession?.players.length ? nextSession.players : nextCurrentPlayer ? [nextCurrentPlayer] : [];
    latestPlayers = nextPlayers;
    nextPlayers.forEach((nextPlayer, index) => {
      const wasAlive = knownAlive.get(nextPlayer.id);
      const visualPosition = getVisualPosition(nextPlayer, index);
      if (wasAlive === false && nextPlayer.isAlive) {
        emitVfx({ kind: "spawn", x: visualPosition.x, y: visualPosition.y, z: visualPosition.z, playerId: nextPlayer.id, team: nextPlayer.team, local: nextPlayer.id === currentPlayerId });
      }
      // Combat broadcasts the authoritative knockout impact separately. Do
      // not infer an elimination effect from the replicated state here: the
      // target has already been moved to its respawn point by the time this
      // snapshot arrives, which would place the effect at the wrong location
      // and duplicate the combat VFX for observers.
      knownAlive.set(nextPlayer.id, nextPlayer.isAlive);
    });
    const nextFlag = nextSession?.flag;
    characterManager.sync(getDisplayPlayers(nextPlayers), getVisualPosition, nextFlag?.carrierId);
    if (nextFlag && (knownFlagState !== nextFlag.state || knownFlagInteraction !== nextFlag.interactionPlayerId)) {
      const objectivePlayerId = nextFlag.interactionPlayerId ?? nextFlag.capturedById ?? nextFlag.placedById ?? nextFlag.carrierId;
      const objectivePlayer = nextPlayers.find((candidate) => candidate.id === objectivePlayerId);
      const objectivePosition = objectivePlayer && nextFlag.state === "carried"
        ? {
            x: objectivePlayer.x ?? nextFlag.position.x,
            y: getArenaObjectiveGroundY(
              arenaMapId,
              { x: objectivePlayer.x ?? nextFlag.position.x, y: objectivePlayer.y, z: objectivePlayer.z ?? nextFlag.position.z },
              objectivePlayer.crouching ? FPS_CROUCH_EYE_HEIGHT : FPS_STANDING_EYE_HEIGHT
            ),
            z: objectivePlayer.z ?? nextFlag.position.z
          }
        : {
            ...nextFlag.position,
            y: getArenaObjectiveGroundY(arenaMapId, nextFlag.position, FPS_STANDING_EYE_HEIGHT)
          };
      if (nextFlag.state === "being_placed" || nextFlag.state === "being_captured") {
        emitVfx({ kind: "objective_progress", ...objectivePosition, team: objectivePlayer?.team, local: objectivePlayer?.id === currentPlayerId });
        if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_plant");
      } else if (nextFlag.state === "placed") {
        emitVfx({ kind: "flag_plant", ...objectivePosition, team: objectivePlayer?.team, local: objectivePlayer?.id === currentPlayerId });
        if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_plant");
      } else if (nextFlag.state === "captured") {
        emitVfx({ kind: "flag_capture", ...objectivePosition, team: objectivePlayer?.team, local: objectivePlayer?.id === currentPlayerId });
        if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_capture");
      } else if (nextFlag.state === "carried") {
        emitVfx({
          kind: knownFlagState === "available" || knownFlagState === "dropped" ? "flag_pickup" : "objective",
          ...objectivePosition,
          team: objectivePlayer?.team,
          local: objectivePlayer?.id === currentPlayerId
        });
      }
      knownFlagState = nextFlag.state;
      knownFlagInteraction = nextFlag.interactionPlayerId;
    }
    const announcement = nextSession?.announcement;
    if (announcement?.id && knownAnnouncementId !== announcement.id) {
      const anchor = nextCurrentPlayer ?? nextPlayers[0];
      if (announcement.kind === "round_start") {
        emitVfx({ kind: "round_start", x: anchor?.x ?? 0, z: anchor?.z ?? 0, playerId: anchor?.id, team: anchor?.team, local: anchor?.id === currentPlayerId });
        characterManager.triggerAnimation({ kind: "respawn" });
      } else if (announcement.kind === "round_result" || announcement.kind === "game_over") {
        const winningTeam = /blue/i.test(announcement.title) ? "blue" : /red/i.test(announcement.title) ? "red" : undefined;
        const localResultKind = winningTeam && anchor?.id === currentPlayerId
          ? anchor.team === winningTeam ? "victory" : "defeat"
          : "round_end";
        emitVfx({ kind: localResultKind, x: anchor?.x ?? 0, z: anchor?.z ?? 0, playerId: anchor?.id, team: anchor?.team, local: anchor?.id === currentPlayerId });
        if (winningTeam) {
          characterManager.triggerAnimation({ kind: "victory", team: winningTeam });
          characterManager.triggerAnimation({ kind: "defeat", team: winningTeam === "blue" ? "red" : "blue" });
        }
      }
      knownAnnouncementId = announcement.id;
    }
    if (flagMarker && nextFlag) {
      const nextCarrier = nextFlag.carrierId
        ? nextPlayers.find((player) => player.id === nextFlag.carrierId)
        : undefined;
      const nextX = nextCarrier?.x ?? nextFlag.position.x;
      const nextZ = nextCarrier?.z ?? nextFlag.position.z;
      const nextY = nextCarrier
        ? getArenaObjectiveGroundY(
            arenaMapId,
            { x: nextX, y: nextCarrier.y, z: nextZ },
            nextCarrier.crouching ? FPS_CROUCH_EYE_HEIGHT : FPS_STANDING_EYE_HEIGHT
          )
        : getArenaObjectiveGroundY(arenaMapId, nextFlag.position, FPS_STANDING_EYE_HEIGHT);
      flagMarker.position.set(nextX, nextY, nextZ);
    }
  };

  characterManager.sync(getDisplayPlayers(players), getVisualPosition, session?.flag?.carrierId);

  return { billboardSprites, characterFactory, characterManager, vfxPool, unsubscribeVfx, unsubscribeAnimation, syncPlayers };
};
