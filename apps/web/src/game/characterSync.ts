import * as THREE from "three";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_STANDING_EYE_HEIGHT
} from "./ArenaCamera";
import { ArenaVfxPool, subscribeArenaVfx, type ArenaVfxTextures } from "./ArenaVfx";
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
    })
  });
  const vfxPool = new ArenaVfxPool(
    scene,
    deps.activeQuality === "performance" ? 0 : activeQuality === "balanced" ? 1 : 2,
    deps.vfxTextures
  );
  const unsubscribeVfx = subscribeArenaVfx((event) => {
    const muzzlePosition = event.playerId
      ? characterManager.getMuzzleWorldPosition(event.playerId)
      : undefined;
    vfxPool.emit(muzzlePosition ? {
      ...event,
      x: muzzlePosition.x,
      y: muzzlePosition.y,
      z: muzzlePosition.z
    } : event);
  });
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
    nextPlayers.forEach((nextPlayer, index) => {
      const wasAlive = knownAlive.get(nextPlayer.id);
      const visualPosition = getVisualPosition(nextPlayer, index);
      if (wasAlive === false && nextPlayer.isAlive) {
        vfxPool.emit({ kind: "spawn", x: visualPosition.x, y: visualPosition.y, z: visualPosition.z, team: nextPlayer.team, local: nextPlayer.id === currentPlayerId });
      }
      if (wasAlive === true && !nextPlayer.isAlive) {
        vfxPool.emit({ kind: "elimination", x: visualPosition.x, y: visualPosition.y, z: visualPosition.z, team: nextPlayer.team, local: nextPlayer.id === currentPlayerId });
      }
      knownAlive.set(nextPlayer.id, nextPlayer.isAlive);
    });
    const nextFlag = nextSession?.flag;
    characterManager.sync(getDisplayPlayers(nextPlayers), getVisualPosition, nextFlag?.carrierId);
    if (nextFlag && (knownFlagState !== nextFlag.state || knownFlagInteraction !== nextFlag.interactionPlayerId)) {
      const objectivePlayerId = nextFlag.interactionPlayerId ?? nextFlag.capturedById ?? nextFlag.placedById ?? nextFlag.carrierId;
      const objectivePlayer = nextPlayers.find((candidate) => candidate.id === objectivePlayerId);
      const objectivePosition = objectivePlayer && nextFlag.state === "carried"
        ? { x: objectivePlayer.x ?? nextFlag.position.x, z: objectivePlayer.z ?? nextFlag.position.z }
        : nextFlag.position;
      if (nextFlag.state === "being_placed" || nextFlag.state === "being_captured") {
        vfxPool.emit({ kind: "objective_progress", ...objectivePosition, team: objectivePlayer?.team, local: objectivePlayer?.id === currentPlayerId });
        if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_plant");
      } else if (nextFlag.state === "placed") {
        vfxPool.emit({ kind: "flag_plant", ...objectivePosition, team: objectivePlayer?.team, local: objectivePlayer?.id === currentPlayerId });
        if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_plant");
      } else if (nextFlag.state === "captured") {
        vfxPool.emit({ kind: "flag_capture", ...objectivePosition, team: objectivePlayer?.team, local: objectivePlayer?.id === currentPlayerId });
        if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_capture");
      } else if (nextFlag.state === "carried") {
        vfxPool.emit({
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
        vfxPool.emit({ kind: "round_start", x: anchor?.x ?? 0, z: anchor?.z ?? 0, team: anchor?.team, local: anchor?.id === currentPlayerId });
        characterManager.triggerAnimation({ kind: "respawn" });
      } else if (announcement.kind === "round_result" || announcement.kind === "game_over") {
        const winningTeam = /blue/i.test(announcement.title) ? "blue" : /red/i.test(announcement.title) ? "red" : undefined;
        const localResultKind = winningTeam && anchor?.id === currentPlayerId
          ? anchor.team === winningTeam ? "victory" : "defeat"
          : "round_end";
        vfxPool.emit({ kind: localResultKind, x: anchor?.x ?? 0, z: anchor?.z ?? 0, team: anchor?.team, local: anchor?.id === currentPlayerId });
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
