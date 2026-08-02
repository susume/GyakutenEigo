import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import {
  ARENA_MAX_AIM_PITCH,
  ARENA_MIN_AIM_PITCH,
  ARENA_SCALE,
  FREE_FOR_ALL_SPAWNS,
  getGearFireCooldownMs,
  getGearZoomFovMultiplier,
  getArenaGroundHeight,
  getArenaGroundHeightForPlayer,
  getArenaRecoveryGroundHeight,
  getArenaLevelLabel,
  getPlayerMoveSpeedMultiplier,
  getPlayerWeaponId,
  getTeamSpawnForMap,
  getTeamSpawnsForMap,
  type ArenaMapId,
  isGearAutoFireEnabled,
  type GameSession,
  type PlayerSession
} from "@quizstrike/shared";
import { attachArenaInputListeners } from "./inputHandling";
import { loadArenaMapContext } from "./mapLoader";
import { buildArenaMapScene } from "./arenaMapBuilder";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_JUMP_GRAVITY,
  FPS_JUMP_VELOCITY,
  FPS_STANDING_EYE_HEIGHT,
  canFpsBodyClearObstacle,
  findFpsSupportSurfaceY,
  getFpsBodyVerticalBounds,
  smoothFpsGroundedCameraY
} from "./ArenaCamera.js";
import { createArenaSceneSetup, FPS_BASE_FOV } from "./sceneSetup";
import { ArenaHudOverlay } from "./hudOverlay";
import { CharacterFactory } from "./characters/CharacterFactory";
import { CharacterManager, type CharacterManagerStats } from "./characters/CharacterManager";
import { isFireKeyboardEvent, isScopeKeyboardEvent, resolveCombatPointerAction, shouldFireFromTouchGesture } from "./arenaInput";
import { gameAudio, type MovementAudioMode } from "./GameAudio";
import { cycleHeavyGunZoom, getWeaponFov, shouldResetWeaponZoom } from "./weaponControls";
import { resolveTouchJoystickVector } from "./touchJoystick";
import { ArenaStaticBatcher, makeSurfaceAtlas } from "./ArenaStaticBatch";
import { ArenaVfxPool, emitArenaVfx, subscribeArenaVfx } from "./ArenaVfx";
import { emitArenaAnimation, subscribeArenaAnimation } from "./ArenaAnimation";
import { ArenaPerformanceCapture, type ArenaPerformanceSnapshot } from "./ArenaPerformance";
import { addIronJunctionArtPass } from "./IronJunctionArtPass";
import { addDesertCitadelVfx } from "./DesertCitadelVfx";
import { addTempleRunoffArtPass } from "./TempleRunoffArtPass";
import {
  readGamePreferences,
  resolveArenaQuality,
  type ArenaQuality,
} from "./gamePreferences";

interface ArenaPreviewProps {
  session?: GameSession;
  currentPlayer?: PlayerSession;
  view?: "overview" | "fps";
  suppressHint?: boolean;
  controlsDisabled?: boolean;
  inputPaused?: boolean;
  debugOverlay?: boolean;
  debugLabel?: string;
  quality?: ArenaQuality;
  gamepadEnabled?: boolean;
  onMove?: (position: ArenaLivePosition) => void;
  onFire?: (position: ArenaLivePosition) => void;
  onInteract?: (position: ArenaLivePosition) => void;
  loadDecalAsset?: (assetId: string) => Promise<Blob>;
}

type ArenaLivePosition = {
  x: number;
  z: number;
  y?: number;
  facing: number;
  pitch?: number;
  scoped?: boolean;
  zoomLevel?: number;
  sprinting?: boolean;
  crouching?: boolean;
  jumping?: boolean;
};

const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 10.8;
const RUN_SPEED = 14.8;
const CROUCH_SPEED = 6.4;
const paleStone = "#dec28a";
const darkStone = "#846744";
const wood = "#65462e";
const steel = "#39464b";
const darkSteel = "#263237";
const rust = "#8b4f37";
const timber = "#765038";
const warning = "#d18a3f";
const MINIMAP_WIDTH = 120;
const MINIMAP_HEIGHT = 110;
const GAMEPAD_DEAD_ZONE = 0.18;
const KEYBOARD_LOOK_SPEED = 1.9;
const TOUCH_LOOK_SENSITIVITY = 0.006;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));

const playerAccuracy = (player: PlayerSession) => {
  const total = player.correctAnswers + player.wrongAnswers;
  return total === 0 ? 0 : Math.round((player.correctAnswers / total) * 100);
};

const movementCode = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  if (event.code === "KeyW" || key === "w") return "KeyW";
  if (event.code === "KeyA" || key === "a") return "KeyA";
  if (event.code === "KeyS" || key === "s") return "KeyS";
  if (event.code === "KeyD" || key === "d") return "KeyD";
  if (event.code === "ShiftLeft" || event.code === "ShiftRight" || key === "shift") return "Shift";
  if (event.code === "Space" || key === " ") return "Space";
  if (event.code === "ControlLeft" || event.code === "ControlRight" || key === "control") return "Control";
  return "";
};

const lookCode = (event: KeyboardEvent) => event.code.startsWith("Arrow") ? event.code : "";

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const makeCanvasTexture = (kind: "floor" | "stone" | "wood" | "water" | "sand" | "metal", accent = "#e8c67a") => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const palettes = {
    floor: ["#b9ab94", "#f2e7cf"],
    stone: ["#bdb3a7", "#f1e9df"],
    wood: ["#a99482", "#e8d5bd"],
    water: ["#7eb8bd", "#ddfbff"],
    sand: ["#c7b99e", "#f7ebcc"],
    metal: ["#8d9a9e", "#e8eef0"]
  } as const;
  const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, palettes[kind][0]);
  gradient.addColorStop(1, palettes[kind][1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  const random = seededRandom({ floor: 17, stone: 31, wood: 47, water: 59, sand: 71, metal: 83 }[kind]);
  ctx.globalAlpha = kind === "water" ? 0.08 : 0.16;
  for (let index = 0; index < 1100; index += 1) {
    const shade = Math.floor(105 + random() * 115);
    ctx.fillStyle = kind === "water" ? `rgba(210,250,255,.8)` : `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(random() * 1024, random() * 1024, 1 + random() * 4, 1 + random() * 4);
  }
  ctx.globalAlpha = 1;

  if (kind !== "water") {
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = kind === "floor" || kind === "sand" ? 3 : 5;
    const step = kind === "wood" ? 128 : kind === "metal" ? 512 : 256;
    for (let pos = 0; pos <= 1024; pos += step) {
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 1024);
      ctx.moveTo(0, pos);
      ctx.lineTo(1024, pos);
      ctx.stroke();
    }
    if (kind === "stone") {
      ctx.strokeStyle = "rgba(78,54,32,.24)";
      ctx.lineWidth = 5;
      for (let y = 128; y < 1024; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
        const offset = (y / 128) % 2 ? 128 : 0;
        for (let x = offset; x < 1024; x += 256) {
          ctx.beginPath();
          ctx.moveTo(x, y - 128);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }
    if (kind === "sand" || kind === "floor") {
      ctx.strokeStyle = "rgba(255,241,199,.2)";
      ctx.lineWidth = 3;
      for (let y = 48; y < 1024; y += 72) {
        ctx.beginPath();
        for (let x = 0; x <= 1024; x += 32) {
          const waveY = y + Math.sin((x + y) * 0.018) * 8;
          if (x === 0) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }
    }
    if (kind === "metal") {
      ctx.fillStyle = "rgba(240,250,252,.2)";
      for (let y = 96; y < 1024; y += 256) {
        for (let x = 96; x < 1024; x += 256) {
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else {
    ctx.strokeStyle = "rgba(190,250,255,.32)";
    ctx.lineWidth = 8;
    for (let pos = -200; pos < 1200; pos += 120) {
      ctx.beginPath();
      ctx.moveTo(pos, 180);
      ctx.bezierCurveTo(pos + 80, 260, pos + 160, 120, pos + 240, 220);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(120, 880);
  ctx.lineTo(904, 880);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "floor" ? 16 : 3, kind === "floor" ? 14 : 3);
  texture.anisotropy = 8;
  return texture;
};

const makeLabelTexture = (label: string, color: string, background = "rgba(41, 28, 16, 0.78)") => {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.roundRect(24, 24, 720, 208, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 384, 128, 660);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const makeSpriteLabel = (label: string, color: string) =>
  new THREE.SpriteMaterial({
    map: makeLabelTexture(label, color, "rgba(21, 15, 9, 0.86)"),
    transparent: true,
    depthWrite: false
  });

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.userData?.preserveSharedResources) return;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose?.();
  });
};

export default function ArenaPreview({
  session,
  currentPlayer,
  view = "overview",
  suppressHint = false,
  controlsDisabled = false,
  inputPaused = false,
  debugOverlay = false,
  debugLabel = "Character debug",
  quality = "auto",
  gamepadEnabled = true,
  onMove,
  onFire,
  onInteract,
  loadDecalAsset
}: ArenaPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const touchMoveRef = useRef({ forward: 0, right: 0 });
  const fireControlRef = useRef<() => void>(() => undefined);
  const onMoveRef = useRef(onMove);
  const onFireRef = useRef(onFire);
  const onInteractRef = useRef(onInteract);
  const currentPlayerRef = useRef(currentPlayer);
  const pendingShotsRef = useRef(0);
  const inputPausedRef = useRef(inputPaused);
  const controlsDisabledRef = useRef(controlsDisabled);
  const joystickPointerRef = useRef<number | null>(null);
  const joystickElementRef = useRef<HTMLButtonElement | null>(null);
  const syncPlayersRef = useRef<(session?: GameSession, currentPlayer?: PlayerSession) => void>(() => undefined);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [hitPulse, setHitPulse] = useState(0);
  const [zoomLevel, setZoomLevelState] = useState(0);
  const [zoomPulse, setZoomPulse] = useState(0);
  const [weaponCooldown, setWeaponCooldown] = useState<{ startedAt: number; durationMs: number } | null>(null);
  const [miniMapPosition, setMiniMapPosition] = useState<ArenaLivePosition | null>(null);
  const [renderError, setRenderError] = useState("");
  const [fallbackQuality, setFallbackQuality] = useState<ArenaQuality | null>(null);
  const [characterDebugStats, setCharacterDebugStats] = useState<CharacterManagerStats | null>(null);
  const [performanceSnapshot, setPerformanceSnapshot] = useState<ArenaPerformanceSnapshot | null>(null);
  const previousWeaponRef = useRef<string | null>(null);
  const sceneSessionId = session?.id ?? "training";
  const currentPlayerId = currentPlayer?.id ?? "";
  const currentPlayerTeam = currentPlayer?.team ?? "blue";
  const arenaMapId: ArenaMapId = session?.settings.mapId ?? "desert_citadel";
  const {
    arenaMap,
    arenaBounds,
    teamBaseZones,
    captureZones,
    searchRetrieveItems,
    searchRetrieveDeliveryZones,
    isIronJunction,
    isDesertCitadel,
    isTempleRunoff,
    hasMultipleLevels
  } = loadArenaMapContext(arenaMapId);
  const activeQuality = resolveArenaQuality(fallbackQuality ?? quality);
  const serverToLocalX = (x: number) => clamp(x, -arenaBounds.limitX, arenaBounds.limitX);
  const serverToLocalZ = (z: number) => clamp(z, -arenaBounds.limitZ, arenaBounds.limitZ);
  const toMiniMapX = (x: number) => ((x + arenaBounds.limitX) / (arenaBounds.limitX * 2)) * MINIMAP_WIDTH;
  const toMiniMapY = (z: number) => ((z + arenaBounds.limitZ) / (arenaBounds.limitZ * 2)) * MINIMAP_HEIGHT;
  const toMiniMapW = (w: number) => (w / (arenaBounds.limitX * 2)) * MINIMAP_WIDTH;
  const toMiniMapH = (d: number) => (d / (arenaBounds.limitZ * 2)) * MINIMAP_HEIGHT;
  const localToServerPosition = (position: THREE.Vector3, facing: number): ArenaLivePosition => ({
    x: clamp(position.x, -arenaBounds.limitX, arenaBounds.limitX),
    z: clamp(position.z, -arenaBounds.limitZ, arenaBounds.limitZ),
    y: Number(position.y.toFixed(2)),
    facing
  });

  useEffect(() => {
    setFallbackQuality(null);
  }, [quality]);

  useEffect(() => {
    onMoveRef.current = onMove;
    onFireRef.current = onFire;
    onInteractRef.current = onInteract;
    inputPausedRef.current = inputPaused;
    controlsDisabledRef.current = controlsDisabled;
  }, [onMove, onFire, onInteract, inputPaused, controlsDisabled]);

  useEffect(() => {
    const resetJoystick = () => {
      joystickPointerRef.current = null;
      touchMoveRef.current = { forward: 0, right: 0 };
      joystickElementRef.current?.style.setProperty("--stick-x", "0px");
      joystickElementRef.current?.style.setProperty("--stick-y", "0px");
    };
    const moveJoystick = (event: PointerEvent) => {
      const joystick = joystickElementRef.current;
      if (!joystick || joystickPointerRef.current !== event.pointerId) return;
      event.preventDefault();
      const vector = resolveTouchJoystickVector(event.clientX, event.clientY, joystick.getBoundingClientRect());
      touchMoveRef.current = { forward: vector.forward, right: vector.right };
      joystick.style.setProperty("--stick-x", `${vector.stickX}px`);
      joystick.style.setProperty("--stick-y", `${vector.stickY}px`);
    };
    const stopJoystick = (event: PointerEvent) => {
      if (joystickPointerRef.current === event.pointerId) resetJoystick();
    };

    window.addEventListener("pointermove", moveJoystick, { passive: false });
    window.addEventListener("pointerup", stopJoystick);
    window.addEventListener("pointercancel", stopJoystick);
    return () => {
      window.removeEventListener("pointermove", moveJoystick);
      window.removeEventListener("pointerup", stopJoystick);
      window.removeEventListener("pointercancel", stopJoystick);
      resetJoystick();
    };
  }, []);

  useEffect(() => {
    if (!controlsDisabled && !inputPaused) return;
    joystickPointerRef.current = null;
    touchMoveRef.current = { forward: 0, right: 0 };
    joystickElementRef.current?.style.setProperty("--stick-x", "0px");
    joystickElementRef.current?.style.setProperty("--stick-y", "0px");
  }, [controlsDisabled, inputPaused]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  useEffect(() => {
    if (!currentPlayer) return;
    const weaponId = getPlayerWeaponId(currentPlayer);
    if (previousWeaponRef.current === null) gameAudio.playEvent("weapon_equip");
    else if (previousWeaponRef.current !== weaponId) gameAudio.playEvent("weapon_switch");
    previousWeaponRef.current = weaponId;
  }, [currentPlayer?.gear, currentPlayer?.weapon, currentPlayer?.perks]);

  useEffect(() => {
    pendingShotsRef.current = 0;
  }, [currentPlayer?.id, currentPlayer?.snowballs, currentPlayer?.isAlive, currentPlayer?.gear, currentPlayer?.weapon, currentPlayer?.perks]);

  useEffect(() => {
    syncPlayersRef.current(session, currentPlayer);
  }, [session, currentPlayer]);

  // Live session payloads replace array references, so only primitive scene-build inputs belong in this dependency list.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setRenderError("");
    setPerformanceSnapshot(null);

    const isFps = view === "fps";
    const isZombieMode = session?.settings.gameMode === "zombie";
    const palette = arenaMap.palette;
    const fallbackSpawn = currentPlayer ? getTeamSpawnForMap(arenaMapId, currentPlayer.team) : getTeamSpawnForMap(arenaMapId, "blue");
    const initialServerX = isFiniteNumber(currentPlayer?.x) ? currentPlayer.x : fallbackSpawn.x;
    const initialServerZ = isFiniteNumber(currentPlayer?.z) ? currentPlayer.z : fallbackSpawn.z;
    const initialGroundY = getArenaGroundHeight(arenaMapId, initialServerX, initialServerZ);
    const initialServerY = isFiniteNumber(currentPlayer?.y) ? currentPlayer.y : fallbackSpawn.y;
    const playerPosition = new THREE.Vector3(
      serverToLocalX(initialServerX),
      isFiniteNumber(initialServerY) ? initialServerY : initialGroundY + FPS_STANDING_EYE_HEIGHT,
      serverToLocalZ(initialServerZ)
    );
    let yaw = isFiniteNumber(currentPlayer?.facing) ? currentPlayer.facing : fallbackSpawn.facing;
    let pitch = -0.12;
    if (isFps) setMiniMapPosition(localToServerPosition(playerPosition, yaw));

    const sceneSetup = createArenaSceneSetup({
      mount,
      arenaMap,
      isFps,
      isZombieMode,
      isIronJunction,
      activeQuality
    });
    if (!sceneSetup) {
      setRenderError("WebGL is not available in this browser. Try updating the browser or enabling hardware acceleration.");
      return;
    }
    const { scene, camera, renderer, qualityConfig } = sceneSetup;
    if (isFps) {
      camera.position.set(0, 0, 0);
    } else {
      camera.position.set(0, 238, 246);
      camera.lookAt(0, 0, 0);
    }

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(560, 20, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(isZombieMode ? "#313b59" : isIronJunction ? "#53666d" : isTempleRunoff ? "#367b80" : "#4c9ccc") },
          horizonColor: { value: new THREE.Color(isZombieMode ? "#8f8395" : palette.sky) },
          groundColor: { value: new THREE.Color(isZombieMode ? "#6b6174" : isIronJunction ? "#a9b7b2" : isTempleRunoff ? "#c79a62" : "#e6c88e") }
        },
        vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition = modelMatrix * vec4(position,1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor; varying vec3 vWorldPosition; void main(){ float h=normalize(vWorldPosition).y; vec3 lower=mix(groundColor,horizonColor,smoothstep(-0.22,0.08,h)); vec3 color=mix(lower,topColor,smoothstep(0.02,0.72,h)); gl_FragColor=vec4(color,1.0); }`
      })
    );
    sky.position.y = -88;
    scene.add(sky);

    const textureLoader = new THREE.TextureLoader();
    const loadTexture = (path: string) => {
      const url = `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
      const texture = textureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const puffTexture = loadTexture("/assets/snowball-puff.svg");
    const {
      floorTexture,
      stoneTexture,
      woodTexture,
      waterTexture,
      sandTexture,
      metalTexture,
      materialCache,
      staticBatcher,
      collisionProxyMaterial,
      coverBoxes,
      flagMarker,
      templeRunoffArt,
      desertCitadelVfx
    } = buildArenaMapScene({
      scene,
      renderer,
      arenaMap,
      arenaMapId,
      session,
      arenaBounds,
      teamBaseZones,
      captureZones,
      searchRetrieveItems,
      searchRetrieveDeliveryZones,
      isIronJunction,
      isDesertCitadel,
      isTempleRunoff,
      isFps,
      isZombieMode,
      activeQuality,
      qualityConfig,
      makeCanvasTexture,
      makeLabelTexture,
      makeSpriteLabel,
      seededRandom,
      scaleArenaValue
    });


    const players = session?.players.length ? session.players : currentPlayer ? [currentPlayer] : [];
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
    const vfxPool = new ArenaVfxPool(scene, qualityConfig.detail);
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
    const performanceCapture = new ArenaPerformanceCapture(renderer, activeQuality);
    const knownAlive = new Map(players.map((player) => [player.id, player.isAlive]));
    let knownFlagState = session?.flag?.state;
    let knownFlagInteraction = session?.flag?.interactionPlayerId;
    let knownAnnouncementId = session?.announcement?.id;

    const getVisualPosition = (player: PlayerSession, index: number) => {
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

    characterManager.sync(getDisplayPlayers(players), getVisualPosition, session?.flag?.carrierId);

    syncPlayersRef.current = (nextSession?: GameSession, nextCurrentPlayer?: PlayerSession) => {
      const nextPlayers = nextSession?.players.length ? nextSession.players : nextCurrentPlayer ? [nextCurrentPlayer] : [];
      nextPlayers.forEach((nextPlayer) => {
        const wasAlive = knownAlive.get(nextPlayer.id);
        if (wasAlive === false && nextPlayer.isAlive) vfxPool.emit({ kind: "spawn", x: nextPlayer.x ?? 0, z: nextPlayer.z ?? 0, team: nextPlayer.team });
        if (wasAlive === true && !nextPlayer.isAlive) vfxPool.emit({ kind: "elimination", x: nextPlayer.x ?? 0, z: nextPlayer.z ?? 0, team: nextPlayer.team });
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
          vfxPool.emit({ kind: "objective_progress", ...objectivePosition, team: objectivePlayer?.team });
          if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_plant");
        } else if (nextFlag.state === "placed") {
          vfxPool.emit({ kind: "flag_plant", ...objectivePosition, team: objectivePlayer?.team });
          if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_plant");
        } else if (nextFlag.state === "captured") {
          vfxPool.emit({ kind: "flag_capture", ...objectivePosition, team: objectivePlayer?.team });
          if (objectivePlayerId) characterManager.triggerPlayerAnimation(objectivePlayerId, "flag_capture");
        } else if (nextFlag.state === "carried") {
          vfxPool.emit({ kind: "objective", ...objectivePosition, team: objectivePlayer?.team });
        }
        knownFlagState = nextFlag.state;
        knownFlagInteraction = nextFlag.interactionPlayerId;
      }
      const announcement = nextSession?.announcement;
      if (announcement?.id && knownAnnouncementId !== announcement.id) {
        const anchor = nextCurrentPlayer ?? nextPlayers[0];
        if (announcement.kind === "round_start") {
          vfxPool.emit({ kind: "round_start", x: anchor?.x ?? 0, z: anchor?.z ?? 0, team: anchor?.team });
          characterManager.triggerAnimation({ kind: "respawn" });
        } else if (announcement.kind === "round_result" || announcement.kind === "game_over") {
          vfxPool.emit({ kind: "round_end", x: anchor?.x ?? 0, z: anchor?.z ?? 0, team: anchor?.team });
          const winningTeam = /blue/i.test(announcement.title) ? "blue" : /red/i.test(announcement.title) ? "red" : undefined;
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
        flagMarker.position.set(nextX, getArenaGroundHeight(arenaMapId, nextX, nextZ), nextZ);
      }
    };
    syncPlayersRef.current(session, currentPlayer);

    const cameraRig = new THREE.Group();
    if (isFps) {
      scene.add(cameraRig);
      cameraRig.add(camera);

      const firstPersonModel = characterFactory.createFirstPersonViewModel(currentPlayerTeam, getPlayerWeaponId(currentPlayer ?? { gear: "starter_blaster" }));
      camera.add(firstPersonModel.root);
      const firstPersonRootBaseY = firstPersonModel.root.position.y;
      const firstPersonWeaponRotation = firstPersonModel.weapon.rotation.clone();
      const fpsMuzzlePosition = new THREE.Vector3();
      const syncFpsMuzzlePosition = () => {
        camera.updateMatrixWorld(true);
        firstPersonModel.muzzle.getWorldPosition(fpsMuzzlePosition);
        camera.worldToLocal(fpsMuzzlePosition);
      };

      const flashMaterial = new THREE.SpriteMaterial({
        map: puffTexture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
      });
      const flash = new THREE.Sprite(flashMaterial);
      flash.scale.set(0.95, 0.5, 1);
      camera.add(flash);

      const muzzleRingMaterial = new THREE.MeshBasicMaterial({ color: "#9cecff", transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 18), muzzleRingMaterial);
      camera.add(muzzleRing);

      const snowball = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 18, 12),
        new THREE.MeshStandardMaterial({ color: "#f7fcff", roughness: 0.32, emissive: "#dff6ff", emissiveIntensity: 0.18 })
      );
      snowball.visible = false;
      camera.add(snowball);

      const projectileTrail = new THREE.Group();
      const trailMaterial = new THREE.MeshBasicMaterial({ color: "#8be9ff", transparent: true, opacity: 0.42, depthWrite: false });
      for (let index = 0; index < 4; index += 1) {
        const mote = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), trailMaterial);
        mote.position.z = index * 0.18;
        mote.scale.setScalar(1 - index * 0.14);
        projectileTrail.add(mote);
      }
      projectileTrail.visible = false;
      camera.add(projectileTrail);

      const impactMaterial = new THREE.SpriteMaterial({ map: puffTexture, color: "#b9f4ff", transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const impactPuff = new THREE.Sprite(impactMaterial);
      impactPuff.scale.set(0.8, 0.8, 1);
      camera.add(impactPuff);

      let flashUntil = 0;
      let snowballLaunchAt = 0;
      let verticalVelocity = 0;
      let jumpQueued = false;
      let lastEmptyFireRequestAt = 0;
      let lastLocalFireAt = 0;
      let lastCooldownFxAt = 0;
      let activeZoomLevel = 0;
      let cooldownTimeout: number | undefined;
      let wasGrounded = true;
      let landedAt = 0;
      let cameraVisualY = playerPosition.y;
      let fireHeld = false;
      const getEquippedGearId = () => getPlayerWeaponId(currentPlayerRef.current ?? { gear: "starter_blaster" });
      const hasZoomGear = () => getGearZoomFovMultiplier(getEquippedGearId()) < 1;
      const hasHeavyGun = () => getEquippedGearId() === "power_blaster";
      const hasAutoFireGear = () => isGearAutoFireEnabled(getEquippedGearId());
      const setZoomLevel = (nextLevel: number) => {
        const maxLevel = hasHeavyGun() ? 2 : hasZoomGear() ? 1 : 0;
        const next = Math.max(0, Math.min(maxLevel, nextLevel));
        if (activeZoomLevel === next) return;
        activeZoomLevel = next;
        renderer.domElement.dataset.zoomLevel = String(next);
        setZoomLevelState(next);
        setZoomPulse((value) => value + 1);
        if (next > 0) emitArenaVfx({ kind: "zoom", x: playerPosition.x, z: playerPosition.z, y: 0.9, team: currentPlayerTeam });
        if (hasHeavyGun()) gameAudio.playEvent("heavy_scope");
        else gameAudio.play(next > 0 ? "zoom_in" : "zoom_out");
      };
      const fire = () => {
        if (controlsDisabledRef.current || inputPausedRef.current || !onFireRef.current) return;
        gameAudio.warm();
        const currentTime = performance.now();
        const equippedGearId = getEquippedGearId();
        if (currentTime - lastLocalFireAt < getGearFireCooldownMs(equippedGearId)) {
          if (currentTime - lastCooldownFxAt > 280) {
            lastCooldownFxAt = currentTime;
            emitArenaVfx({ kind: "cooldown", x: playerPosition.x, z: playerPosition.z, y: 0.8, team: currentPlayerTeam });
            if (equippedGearId === "quick_blaster") gameAudio.playEvent("cooldown_tick");
          }
          return;
        }
        const launchPosition = {
          ...localToServerPosition(playerPosition, yaw),
          pitch,
          scoped: activeZoomLevel > 0,
          zoomLevel: activeZoomLevel
        };
        const authoritativeSnowballs = currentPlayerRef.current?.snowballs;
        const availableSnowballs = isFiniteNumber(authoritativeSnowballs)
          ? Math.floor(authoritativeSnowballs) - pendingShotsRef.current
          : Number.POSITIVE_INFINITY;
        if (availableSnowballs <= 0) {
          if (currentTime - lastEmptyFireRequestAt > 350) {
            lastEmptyFireRequestAt = currentTime;
            gameAudio.play("empty_fire");
            onFireRef.current(launchPosition);
          }
          return;
        }
        lastLocalFireAt = currentTime;
        const cooldownMs = getGearFireCooldownMs(equippedGearId);
        setWeaponCooldown({ startedAt: currentTime, durationMs: cooldownMs });
        if (cooldownTimeout) window.clearTimeout(cooldownTimeout);
        cooldownTimeout = window.setTimeout(() => {
          setWeaponCooldown(null);
          if (equippedGearId !== "quick_blaster") gameAudio.playEvent("cooldown_ready");
        }, cooldownMs);
        pendingShotsRef.current += 1;
        flashUntil = performance.now() + 95;
        snowballLaunchAt = currentTime;
        flash.material.opacity = 1;
        muzzleRingMaterial.opacity = 0.88;
        muzzleRing.scale.setScalar(0.72);
        snowball.visible = true;
        projectileTrail.visible = true;
        impactMaterial.opacity = 0;
        setHitPulse((value) => value + 1);
        if (equippedGearId === "power_blaster") {
          gameAudio.playEvent("weapon_fire_heavy_local");
          emitArenaVfx({
            kind: "heavy_fire",
            x: playerPosition.x - Math.sin(yaw) * 2.2,
            z: playerPosition.z - Math.cos(yaw) * 2.2,
            y: 1.1,
            team: currentPlayerTeam
          });
        }
        else gameAudio.playEvent(equippedGearId === "quick_blaster" ? "weapon_fire_quick" : "weapon_fire_basic");
        window.setTimeout(() => {
          if (readGamePreferences().vibrationEnabled) {
            navigator.vibrate?.(18);
          }
          onFireRef.current?.(launchPosition);
        }, 0);
      };
      fireControlRef.current = fire;

      const keys = new Set<string>();
      const lookKeys = new Set<string>();
      let touchLookPointerId: number | null = null;
      let touchLookX = 0;
      let touchLookY = 0;
      let touchLookStartX = 0;
      let touchLookStartY = 0;
      let touchLookStartedAt = 0;
      let touchLookDistance = 0;
      const gamepadMove = { forward: 0, right: 0 };
      let gamepadFireWasPressed = false;
      let gamepadInteractWasPressed = false;
      const applyGamepadInput = () => {
        if (!gamepadEnabled || controlsDisabledRef.current || inputPausedRef.current || !navigator.getGamepads) {
          gamepadMove.forward = 0;
          gamepadMove.right = 0;
          return;
        }
        const gamepad = Array.from(navigator.getGamepads()).find((item) => item?.connected);
        if (!gamepad) {
          gamepadMove.forward = 0;
          gamepadMove.right = 0;
          return;
        }
        const leftX = Math.abs(gamepad.axes[0] ?? 0) >= GAMEPAD_DEAD_ZONE ? gamepad.axes[0] ?? 0 : 0;
        const leftY = Math.abs(gamepad.axes[1] ?? 0) >= GAMEPAD_DEAD_ZONE ? gamepad.axes[1] ?? 0 : 0;
        const rightX = Math.abs(gamepad.axes[2] ?? 0) >= GAMEPAD_DEAD_ZONE ? gamepad.axes[2] ?? 0 : 0;
        const rightY = Math.abs(gamepad.axes[3] ?? 0) >= GAMEPAD_DEAD_ZONE ? gamepad.axes[3] ?? 0 : 0;
        gamepadMove.forward = -leftY;
        gamepadMove.right = leftX;
        yaw -= rightX * 0.055;
        pitch = clamp(pitch - rightY * 0.042, ARENA_MIN_AIM_PITCH, ARENA_MAX_AIM_PITCH);
        const firePressed = Boolean(gamepad.buttons[7]?.pressed || gamepad.buttons[0]?.pressed);
        const interactPressed = Boolean(gamepad.buttons[2]?.pressed);
        if (firePressed && !gamepadFireWasPressed) fire();
        if (interactPressed && !gamepadInteractWasPressed) onInteractRef.current?.(localToServerPosition(playerPosition, yaw));
        gamepadFireWasPressed = firePressed;
        gamepadInteractWasPressed = interactPressed;
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (controlsDisabledRef.current || inputPausedRef.current) return;
        if (isFireKeyboardEvent(event)) {
          if (hasAutoFireGear()) fireHeld = true;
          fire();
          event.preventDefault();
          return;
        }
        if (event.code === "KeyE" || event.key.toLowerCase() === "e") {
          onInteractRef.current?.(localToServerPosition(playerPosition, yaw));
          event.preventDefault();
          return;
        }
        const code = movementCode(event);
        if (code) {
          if (code === "Space" && !keys.has("Space")) jumpQueued = true;
          keys.add(code);
          event.preventDefault();
          return;
        }
        if (isScopeKeyboardEvent(event) && hasHeavyGun()) {
          setZoomLevel(cycleHeavyGunZoom(activeZoomLevel));
          event.preventDefault();
          return;
        }
        const look = lookCode(event);
        if (look) {
          lookKeys.add(look);
          event.preventDefault();
        }
      };
      const onKeyUp = (event: KeyboardEvent) => {
        if (isFireKeyboardEvent(event)) fireHeld = false;
        const code = movementCode(event);
        if (code) keys.delete(code);
        const look = lookCode(event);
        if (look) lookKeys.delete(look);
      };
      const onMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement !== renderer.domElement) return;
        yaw -= event.movementX * 0.0022;
        pitch = clamp(
          pitch - event.movementY * 0.0018,
          ARENA_MIN_AIM_PITCH,
          ARENA_MAX_AIM_PITCH
        );
      };
      const onPointerLockChange = () => {
        const locked = document.pointerLockElement === renderer.domElement;
        setIsPointerLocked(locked);
        if (!locked) setZoomLevel(0);
      };
      const onPointerLockError = () => setIsPointerLocked(false);
      const onPointerDown = (event: PointerEvent) => {
        if (controlsDisabledRef.current || inputPausedRef.current) return;
        gameAudio.warm();
        renderer.domElement.focus();
        if (event.pointerType === "touch") {
          touchLookPointerId = event.pointerId;
          touchLookX = event.clientX;
          touchLookY = event.clientY;
          touchLookStartX = event.clientX;
          touchLookStartY = event.clientY;
          touchLookStartedAt = performance.now();
          touchLookDistance = 0;
          try {
            renderer.domElement.setPointerCapture(event.pointerId);
          } catch {
            // Window-level tracking keeps touch-look working when capture is unavailable.
          }
          event.preventDefault();
          return;
        }
        if (document.pointerLockElement !== renderer.domElement) {
          void renderer.domElement.requestPointerLock().catch(() => setIsPointerLocked(false));
          return;
        }
        const action = resolveCombatPointerAction({ button: event.button, buttons: event.buttons });
        if (action === "scope") {
          event.preventDefault();
          setZoomLevel(hasHeavyGun() ? cycleHeavyGunZoom(activeZoomLevel) : 1);
          return;
        }
        if (action !== "fire") return;
        if (hasAutoFireGear()) fireHeld = true;
        fire();
      };
      const onPointerUp = (event: PointerEvent) => {
        if (event.button === 2 && !hasHeavyGun()) setZoomLevel(0);
        if (event.button === 0) fireHeld = false;
      };
      const onTouchPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== "touch" || event.pointerId !== touchLookPointerId) return;
        yaw -= (event.clientX - touchLookX) * TOUCH_LOOK_SENSITIVITY;
        pitch = clamp(
          pitch - (event.clientY - touchLookY) * TOUCH_LOOK_SENSITIVITY,
          ARENA_MIN_AIM_PITCH,
          ARENA_MAX_AIM_PITCH
        );
        touchLookDistance = Math.max(touchLookDistance, Math.hypot(event.clientX - touchLookStartX, event.clientY - touchLookStartY));
        touchLookX = event.clientX;
        touchLookY = event.clientY;
        event.preventDefault();
      };
      const finishTouchPointer = (event: PointerEvent) => {
        if (event.pointerType !== "touch" || event.pointerId !== touchLookPointerId) return;
        if (shouldFireFromTouchGesture({ distance: touchLookDistance, durationMs: performance.now() - touchLookStartedAt })) fire();
        touchLookPointerId = null;
      };
      const onTouchPointerCancel = (event: PointerEvent) => {
        if (event.pointerId === touchLookPointerId) touchLookPointerId = null;
      };
      const onContextMenu = (event: MouseEvent) => event.preventDefault();
      const clearKeys = () => {
        keys.clear();
        lookKeys.clear();
        setZoomLevel(0);
        fireHeld = false;
      };
      const cleanupControls = attachArenaInputListeners({
        rendererElement: renderer.domElement,
        onKeyDown,
        onKeyUp,
        onMouseMove,
        onBlur: clearKeys,
        onPointerLockChange,
        onPointerLockError,
        onPointerDown,
        onPointerUp,
        onTouchPointerMove,
        onTouchPointerUp: finishTouchPointer,
        onTouchPointerCancel,
        onContextMenu
      });

      const updateCamera = (delta = 0) => {
        cameraVisualY = wasGrounded
          ? smoothFpsGroundedCameraY(cameraVisualY, playerPosition.y, delta)
          : playerPosition.y;
        cameraRig.position.set(playerPosition.x, cameraVisualY, playerPosition.z);
        camera.rotation.set(pitch, yaw, 0, "YXZ");
        renderer.domElement.dataset.playerX = playerPosition.x.toFixed(3);
        renderer.domElement.dataset.playerY = playerPosition.y.toFixed(3);
        renderer.domElement.dataset.playerZ = playerPosition.z.toFixed(3);
      };
      updateCamera();

      const clock = new THREE.Clock();
      let frame = 0;
      let lastMoveEmitAt = 0;
      let lastMiniMapAt = 0;
      let lastDebugStatsAt = 0;
      let isSprinting = false;
      let isCrouching = false;
      let isJumping = false;
      let previousFloorEyeHeight = FPS_STANDING_EYE_HEIGHT;
      let performanceWindowAt = performance.now();
      let lastSentPosition = {
        ...localToServerPosition(playerPosition, yaw),
        crouching: isCrouching,
        jumping: isJumping
      };
      const forwardVector = new THREE.Vector3();
      const rightVector = new THREE.Vector3();
      const movementVector = new THREE.Vector3();
      const nextPosition = new THREE.Vector3();
      const axisPosition = new THREE.Vector3();
      const bodyBox = new THREE.Box3();
      const bodyMin = new THREE.Vector3();
      const bodyMax = new THREE.Vector3();
      const levelDebugEnabled = import.meta.env.DEV
        && ["1", "true"].includes(
          new URLSearchParams(window.location.search).get("debugArenaLevels")
          ?? new URLSearchParams(window.location.search).get("debugTempleLevels")
          ?? ""
        );
      let lastLevelDebugAt = 0;
      let lastColliderName = "none";
      const maybeEmitPosition = (currentTime: number) => {
        if (currentTime - lastMoveEmitAt < 180) return;
        const nextPosition = {
          ...localToServerPosition(playerPosition, yaw),
          sprinting: isSprinting,
          crouching: isCrouching,
          jumping: isJumping
        };
        const moved = Math.hypot(nextPosition.x - lastSentPosition.x, nextPosition.z - lastSentPosition.z);
        const movedVertically = Math.abs(Number(nextPosition.y) - Number(lastSentPosition.y));
        const turned = Math.abs(nextPosition.facing - lastSentPosition.facing);
        const postureChanged = nextPosition.crouching !== lastSentPosition.crouching
          || nextPosition.jumping !== lastSentPosition.jumping;
        if (moved < 0.3 && movedVertically < 0.12 && turned < 0.08 && !postureChanged) return;
        lastMoveEmitAt = currentTime;
        lastSentPosition = nextPosition;
        if (controlsDisabledRef.current || inputPausedRef.current) return;
        onMoveRef.current?.(nextPosition);
      };

      const canOccupy = (next: THREE.Vector3, floorEyeHeight: number) => {
        const verticalBounds = getFpsBodyVerticalBounds(next.y, floorEyeHeight);
        bodyMin.set(next.x - PLAYER_RADIUS, verticalBounds.minY, next.z - PLAYER_RADIUS);
        bodyMax.set(next.x + PLAYER_RADIUS, verticalBounds.maxY, next.z + PLAYER_RADIUS);
        bodyBox.set(bodyMin, bodyMax);
        const blockingIndex = coverBoxes.findIndex((box) => box.intersectsBox(bodyBox) && !canFpsBodyClearObstacle(verticalBounds, box.max.y));
        lastColliderName = blockingIndex >= 0 ? arenaMap.blocks.filter((block) => block.collides)[blockingIndex]?.id ?? "unknown" : "none";
        return blockingIndex < 0;
      };
      const resolveSurfaceGroundY = (
        x: number,
        z: number,
        eyeY: number,
        floorEyeHeight: number
      ) => {
        const mappedGroundY = getArenaGroundHeightForPlayer(
          arenaMapId,
          x,
          z,
          eyeY,
          floorEyeHeight
        );
        if (verticalVelocity > 0) return mappedGroundY;
        const footY = eyeY - floorEyeHeight;
        const supportY = findFpsSupportSurfaceY(
          coverBoxes,
          x,
          z,
          PLAYER_RADIUS,
          footY,
          footY
        );
        return supportY === undefined ? mappedGroundY : Math.max(mappedGroundY, supportY);
      };

      const animateFps = () => {
        frame = requestAnimationFrame(animateFps);
        const delta = Math.min(clock.getDelta(), 0.035);
        const currentTime = performance.now();
        performanceCapture.frame(currentTime);
        vfxPool.update(currentTime);
        desertCitadelVfx?.update(clock.elapsedTime);
        templeRunoffArt?.update(clock.elapsedTime);
        if (currentTime - performanceWindowAt >= 1000) {
          const profile = performanceCapture.snapshot(currentTime);
          renderer.domElement.dataset.fps = String(profile.fps);
          renderer.domElement.dataset.frameP95 = String(profile.frameMsP95);
          renderer.domElement.dataset.drawCalls = String(profile.drawCalls);
          renderer.domElement.dataset.triangles = String(profile.triangles);
          renderer.domElement.dataset.longTasks = String(profile.longTasks);
          renderer.domElement.dataset.vfxActive = String(vfxPool.activeCount);
          if (debugOverlay) setPerformanceSnapshot(profile);
          performanceWindowAt = currentTime;
        }
        if (controlsDisabledRef.current) {
          const followedPlayer = currentPlayerRef.current;
          if (isFiniteNumber(followedPlayer?.x) && isFiniteNumber(followedPlayer?.z)) {
            playerPosition.x += (serverToLocalX(followedPlayer.x) - playerPosition.x) * 0.24;
            playerPosition.z += (serverToLocalZ(followedPlayer.z) - playerPosition.z) * 0.24;
            const followedEyeY = isFiniteNumber(followedPlayer.y)
              ? followedPlayer.y
              : getArenaGroundHeight(arenaMapId, followedPlayer.x, followedPlayer.z) + FPS_STANDING_EYE_HEIGHT;
            playerPosition.y += (followedEyeY - playerPosition.y) * 0.24;
            if (isFiniteNumber(followedPlayer.facing)) yaw = followedPlayer.facing;
          }
        }
        const horizontalLook = Number(lookKeys.has("ArrowLeft")) - Number(lookKeys.has("ArrowRight"));
        const verticalLook = Number(lookKeys.has("ArrowUp")) - Number(lookKeys.has("ArrowDown"));
        yaw += horizontalLook * KEYBOARD_LOOK_SPEED * delta;
        pitch = clamp(
          pitch + verticalLook * KEYBOARD_LOOK_SPEED * delta,
          ARENA_MIN_AIM_PITCH,
          ARENA_MAX_AIM_PITCH
        );
        if (inputPausedRef.current) {
          keys.clear();
          lookKeys.clear();
          if (activeZoomLevel > 0) setZoomLevel(0);
        }
        applyGamepadInput();
        const crouching = keys.has("Control");
        const floorEyeHeight = crouching ? FPS_CROUCH_EYE_HEIGHT : FPS_STANDING_EYE_HEIGHT;
        if (floorEyeHeight !== previousFloorEyeHeight) {
          playerPosition.y += floorEyeHeight - previousFloorEyeHeight;
          previousFloorEyeHeight = floorEyeHeight;
        }
        isCrouching = crouching;
        const recoveryGroundY = getArenaRecoveryGroundHeight(
          arenaMapId,
          playerPosition.x,
          playerPosition.z,
          playerPosition.y,
          floorEyeHeight
        );
        if (recoveryGroundY !== undefined) {
          playerPosition.y = recoveryGroundY + floorEyeHeight;
          verticalVelocity = 0;
          wasGrounded = true;
        }
        let surfaceGroundY = resolveSurfaceGroundY(
          playerPosition.x,
          playerPosition.z,
          playerPosition.y,
          floorEyeHeight
        );
        let groundEyeY = surfaceGroundY + floorEyeHeight;
        const currentLevel = getArenaLevelLabel(arenaMapId, surfaceGroundY);
        renderer.domElement.dataset.playerGroundY = surfaceGroundY.toFixed(3);
        renderer.domElement.dataset.detectedFloor = surfaceGroundY.toFixed(3);
        renderer.domElement.dataset.currentNavRegion = `${arenaMapId}:${currentLevel}`;
        renderer.domElement.dataset.recoveryTriggered = recoveryGroundY === undefined ? "no" : "yes";
        renderer.domElement.dataset.recoveryReason = recoveryGroundY === undefined ? "none" : "solid_foundation";
        renderer.domElement.dataset.recoveryDestination = recoveryGroundY === undefined ? "none" : recoveryGroundY.toFixed(3);
        renderer.domElement.dataset.colliderName = lastColliderName;
        renderer.domElement.dataset.currentLevel = currentLevel;
        if (levelDebugEnabled && currentTime - lastLevelDebugAt >= 1000) {
          console.debug("[Arena level diagnostics]", {
            playerPosition: {
              x: Number(playerPosition.x.toFixed(2)),
              y: Number(playerPosition.y.toFixed(2)),
              z: Number(playerPosition.z.toFixed(2))
            },
            playerGroundY: surfaceGroundY,
            detectedFloor: surfaceGroundY,
            currentNavRegion: `${arenaMapId}:${currentLevel}`,
            recoveryTriggered: recoveryGroundY !== undefined,
            recoveryReason: recoveryGroundY === undefined ? "none" : "solid_foundation",
            recoveryDestination: recoveryGroundY ?? null,
            colliderName: lastColliderName,
            currentLevel
          });
          lastLevelDebugAt = currentTime;
        }
        const grounded = playerPosition.y <= groundEyeY + 0.02 && Math.abs(verticalVelocity) < 0.01;
        if (jumpQueued && grounded && !crouching) {
          verticalVelocity = FPS_JUMP_VELOCITY;
          emitArenaAnimation({ kind: "jump", playerId: currentPlayerId, team: currentPlayerTeam });
          gameAudio.play("jump");
        }
        jumpQueued = false;
        const previousFootY = playerPosition.y - floorEyeHeight;
        verticalVelocity -= FPS_JUMP_GRAVITY * delta;
        playerPosition.y += verticalVelocity * delta;
        if (verticalVelocity <= 0) {
          const supportY = findFpsSupportSurfaceY(
            coverBoxes,
            playerPosition.x,
            playerPosition.z,
            PLAYER_RADIUS,
            previousFootY,
            playerPosition.y - floorEyeHeight
          );
          if (supportY !== undefined && supportY > surfaceGroundY) {
            surfaceGroundY = supportY;
            groundEyeY = supportY + floorEyeHeight;
          }
        }
        if (playerPosition.y < groundEyeY) {
          playerPosition.y = groundEyeY;
          verticalVelocity = 0;
          if (!wasGrounded) {
            landedAt = currentTime;
            emitArenaAnimation({ kind: "land", playerId: currentPlayerId, team: currentPlayerTeam });
            gameAudio.play("land");
          }
          wasGrounded = true;
        } else if (crouching && verticalVelocity === 0) {
          playerPosition.y += (groundEyeY - playerPosition.y) * 0.18;
        } else {
          wasGrounded = false;
        }
        isJumping = !wasGrounded;

        const activePlayer = currentPlayerRef.current;
        const gearSpeedMultiplier = getPlayerMoveSpeedMultiplier(activePlayer ?? { gear: "starter_blaster" });
        const isZombieHuman = session?.settings.gameMode === "zombie" && activePlayer?.role !== "zombie";
        const hasMovementEnergy = !isZombieHuman || (activePlayer?.energy ?? 0) > 0;
        const runRequested = keys.has("Shift");
        const runAllowed = runRequested && hasMovementEnergy;
        const movementAudioMode: MovementAudioMode = crouching ? "crouch" : runAllowed ? "run" : "walk";
        const moveSpeed = hasMovementEnergy
          ? (crouching ? CROUCH_SPEED : runAllowed ? RUN_SPEED : WALK_SPEED) * gearSpeedMultiplier
          : 0;
        forwardVector.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        rightVector.set(Math.cos(yaw), 0, -Math.sin(yaw));
        movementVector.set(0, 0, 0);
        const touchMove = touchMoveRef.current;
        if (keys.has("KeyW")) movementVector.add(forwardVector);
        if (keys.has("KeyS")) movementVector.sub(forwardVector);
        if (keys.has("KeyD")) movementVector.add(rightVector);
        if (keys.has("KeyA")) movementVector.sub(rightVector);
        if (touchMove.forward > 0) movementVector.add(forwardVector);
        if (touchMove.forward < 0) movementVector.sub(forwardVector);
        if (touchMove.right > 0) movementVector.add(rightVector);
        if (touchMove.right < 0) movementVector.sub(rightVector);
        if (gamepadMove.forward > GAMEPAD_DEAD_ZONE) movementVector.add(forwardVector);
        if (gamepadMove.forward < -GAMEPAD_DEAD_ZONE) movementVector.sub(forwardVector);
        if (gamepadMove.right > GAMEPAD_DEAD_ZONE) movementVector.add(rightVector);
        if (gamepadMove.right < -GAMEPAD_DEAD_ZONE) movementVector.sub(rightVector);
        isSprinting = runAllowed && movementVector.lengthSq() > 0;

        if (movementVector.lengthSq() > 0) {
          if (wasGrounded && moveSpeed > 0) gameAudio.playMovementStep(
            movementAudioMode,
            currentTime,
            isIronJunction ? "metal" : isTempleRunoff ? (surfaceGroundY < 1 ? "water" : "stone") : "sand"
          );
          movementVector.normalize().multiplyScalar(moveSpeed * delta);
          nextPosition.copy(playerPosition).add(movementVector);
          nextPosition.x = clamp(nextPosition.x, -arenaBounds.limitX + PLAYER_RADIUS, arenaBounds.limitX - PLAYER_RADIUS);
          nextPosition.z = clamp(nextPosition.z, -arenaBounds.limitZ + PLAYER_RADIUS, arenaBounds.limitZ - PLAYER_RADIUS);
          axisPosition.copy(playerPosition);
          axisPosition.x = nextPosition.x;
          const xGroundY = resolveSurfaceGroundY(
            axisPosition.x,
            axisPosition.z,
            axisPosition.y,
            floorEyeHeight
          );
          if (wasGrounded && Math.abs(xGroundY - surfaceGroundY) <= 0.8) axisPosition.y = xGroundY + floorEyeHeight;
          if (canOccupy(axisPosition, floorEyeHeight)) {
            playerPosition.x = axisPosition.x;
            if (wasGrounded) playerPosition.y = axisPosition.y;
          }
          axisPosition.copy(playerPosition);
          axisPosition.z = nextPosition.z;
          surfaceGroundY = resolveSurfaceGroundY(
            playerPosition.x,
            playerPosition.z,
            playerPosition.y,
            floorEyeHeight
          );
          const zGroundY = resolveSurfaceGroundY(
            axisPosition.x,
            axisPosition.z,
            axisPosition.y,
            floorEyeHeight
          );
          if (wasGrounded && Math.abs(zGroundY - surfaceGroundY) <= 0.8) axisPosition.y = zGroundY + floorEyeHeight;
          if (canOccupy(axisPosition, floorEyeHeight)) {
            playerPosition.z = axisPosition.z;
            if (wasGrounded) playerPosition.y = axisPosition.y;
          }
          surfaceGroundY = resolveSurfaceGroundY(
            playerPosition.x,
            playerPosition.z,
            playerPosition.y,
            floorEyeHeight
          );
          groundEyeY = surfaceGroundY + floorEyeHeight;
        }

        if (fireHeld && hasAutoFireGear() && !inputPausedRef.current && !controlsDisabledRef.current) fire();

        const equippedGearId = getEquippedGearId();
        if (!hasZoomGear() && activeZoomLevel > 0) setZoomLevel(0);
        if (hasHeavyGun() && activeZoomLevel > 0 && shouldResetWeaponZoom({
          gearId: equippedGearId,
          isAlive: !controlsDisabledRef.current,
          roundActive: !controlsDisabledRef.current,
          inputPaused: inputPausedRef.current,
          pointerLocked: document.pointerLockElement === renderer.domElement
        })) setZoomLevel(0);
        const targetFov = getWeaponFov(equippedGearId, activeZoomLevel, FPS_BASE_FOV);
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov += (targetFov - camera.fov) * 0.18;
          camera.updateProjectionMatrix();
        }
        updateCamera(delta);
        if (currentTime - lastMiniMapAt > 220) {
          lastMiniMapAt = currentTime;
          setMiniMapPosition(localToServerPosition(playerPosition, yaw));
        }
        maybeEmitPosition(currentTime);
        billboardSprites.forEach((sprite) => sprite.lookAt(camera.position));
        characterManager.update(delta, clock.elapsedTime, camera);
        if (debugOverlay && currentTime - lastDebugStatsAt > 500) {
          lastDebugStatsAt = currentTime;
          setCharacterDebugStats(characterManager.getStats());
        }
        flash.material.opacity = currentTime < flashUntil ? 0.86 : Math.max(0, flash.material.opacity - delta * 10);
        muzzleRingMaterial.opacity = Math.max(0, muzzleRingMaterial.opacity - delta * 8.5);
        muzzleRing.scale.multiplyScalar(1 + delta * 3.2);
        const landingPulse = Math.max(0, 1 - (currentTime - landedAt) / 220);
        // The viewmodel is camera-relative. Never derive its offset from world
        // elevation: a valid raised platform previously pushed the blue arm
        // through the near plane as if the player were permanently airborne.
        const airborneDip = wasGrounded ? 0 : -0.025;
        firstPersonModel.root.position.y = firstPersonRootBaseY + Math.sin(currentTime * 0.006) * 0.012 + airborneDip - Math.sin(landingPulse * Math.PI) * 0.055;
        firstPersonModel.weapon.rotation.x = firstPersonWeaponRotation.x - flash.material.opacity * 0.035;
        syncFpsMuzzlePosition();
        flash.position.copy(fpsMuzzlePosition);
        muzzleRing.position.copy(fpsMuzzlePosition);
        if (snowballLaunchAt > 0) {
          const travel = clamp((currentTime - snowballLaunchAt) / 260, 0, 1);
          snowball.visible = travel < 1;
          snowball.position.set(
            fpsMuzzlePosition.x,
            fpsMuzzlePosition.y - travel * 0.08,
            fpsMuzzlePosition.z - travel * 6.5
          );
          projectileTrail.visible = travel < 0.96;
          projectileTrail.position.copy(snowball.position);
          projectileTrail.rotation.z = currentTime * 0.01;
          const scale = Math.max(0.38, 1 - travel * 0.62);
          snowball.scale.setScalar(scale);
          if (travel > 0.82) {
            impactPuff.position.set(fpsMuzzlePosition.x, fpsMuzzlePosition.y - 0.08, fpsMuzzlePosition.z - 6.5);
            impactMaterial.opacity = Math.max(0, (1 - travel) * 3.8);
            impactPuff.scale.setScalar(0.8 + (travel - 0.82) * 5.5);
          }
        }
        renderer.render(scene, camera);
      };
      syncFpsMuzzlePosition();
      flash.position.copy(fpsMuzzlePosition);
      muzzleRing.position.copy(fpsMuzzlePosition);
      flash.material.opacity = 1;
      snowball.visible = true;
      characterManager.update(0, 0, camera);
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      flash.material.opacity = 0;
      snowball.visible = false;
      projectileTrail.visible = false;
      renderer.render(scene, camera);
      renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
      renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
      animateFps();

      const resizeFps = () => {
        const width = mount.clientWidth;
        const height = Math.max(1, mount.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener("resize", resizeFps);

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resizeFps);
        unsubscribeVfx();
        unsubscribeAnimation();
        performanceCapture.dispose();
        vfxPool.dispose();
        desertCitadelVfx?.dispose();
        templeRunoffArt?.dispose();
        fireControlRef.current = () => undefined;
        syncPlayersRef.current = () => undefined;
        if (cooldownTimeout) window.clearTimeout(cooldownTimeout);
        setZoomLevel(0);
        setWeaponCooldown(null);
        cleanupControls();
        disposeObject(scene);
        staticBatcher.dispose();
        collisionProxyMaterial.dispose();
        materialCache.forEach((material) => material.dispose());
        floorTexture.dispose();
        stoneTexture.dispose();
        woodTexture.dispose();
        waterTexture.dispose();
        sandTexture.dispose();
        metalTexture.dispose();
        puffTexture.dispose();
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    }

    const clock = new THREE.Clock();
    let frame = 0;
    let lastDebugStatsAt = 0;
    let performanceWindowAt = performance.now();
    const animateOverview = () => {
      frame = requestAnimationFrame(animateOverview);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const currentTime = performance.now();
      performanceCapture.frame(currentTime);
      vfxPool.update(currentTime);
      desertCitadelVfx?.update(elapsed);
      templeRunoffArt?.update(elapsed);
      if (currentTime - performanceWindowAt >= 1000) {
        const profile = performanceCapture.snapshot(currentTime);
        renderer.domElement.dataset.fps = String(profile.fps);
        renderer.domElement.dataset.frameP95 = String(profile.frameMsP95);
        renderer.domElement.dataset.drawCalls = String(profile.drawCalls);
        renderer.domElement.dataset.triangles = String(profile.triangles);
        renderer.domElement.dataset.longTasks = String(profile.longTasks);
        renderer.domElement.dataset.vfxActive = String(vfxPool.activeCount);
        if (debugOverlay) setPerformanceSnapshot(profile);
        performanceWindowAt = currentTime;
      }
      camera.position.x = Math.sin(elapsed * 0.04) * 24;
      camera.position.z = 246 + Math.cos(elapsed * 0.04) * 16;
      camera.lookAt(0, 0, -6);
      billboardSprites.forEach((sprite) => sprite.lookAt(camera.position));
      characterManager.update(delta, elapsed, camera);
      if (debugOverlay && currentTime - lastDebugStatsAt > 500) {
        lastDebugStatsAt = currentTime;
        setCharacterDebugStats(characterManager.getStats());
      }
      renderer.render(scene, camera);
    };
    characterManager.update(0, 0, camera);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
    animateOverview();

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      unsubscribeVfx();
      unsubscribeAnimation();
      performanceCapture.dispose();
      vfxPool.dispose();
      desertCitadelVfx?.dispose();
      templeRunoffArt?.dispose();
      syncPlayersRef.current = () => undefined;
      characterManager.dispose();
      disposeObject(scene);
      characterFactory.dispose();
      staticBatcher.dispose();
      collisionProxyMaterial.dispose();
      materialCache.forEach((material) => material.dispose());
      floorTexture.dispose();
      stoneTexture.dispose();
      woodTexture.dispose();
      waterTexture.dispose();
      sandTexture.dispose();
      metalTexture.dispose();
      puffTexture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [sceneSessionId, currentPlayerId, currentPlayerTeam, currentPlayer?.gear, currentPlayer?.weapon, view, debugOverlay, activeQuality, gamepadEnabled, arenaMapId, session?.settings.gameMode, session?.flag?.state, session?.flag?.carrierId, session?.flag?.position.x, session?.flag?.position.z, loadDecalAsset]);

  const beginTouchMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (controlsDisabled || inputPausedRef.current) return;
    joystickPointerRef.current = event.pointerId;
    const vector = resolveTouchJoystickVector(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    touchMoveRef.current = { forward: vector.forward, right: vector.right };
    event.currentTarget.style.setProperty("--stick-x", `${vector.stickX}px`);
    event.currentTarget.style.setProperty("--stick-y", `${vector.stickY}px`);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Window-level tracking keeps the joystick working when pointer capture is unavailable.
    }
  };
  const fireFromTouch = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (controlsDisabled || inputPausedRef.current) return;
    fireControlRef.current();
  };
  const miniMapPlayer = miniMapPosition ?? (
    isFiniteNumber(currentPlayer?.x) && isFiniteNumber(currentPlayer?.z)
      ? { x: currentPlayer.x, y: currentPlayer.y, z: currentPlayer.z, facing: currentPlayer.facing ?? 0 }
      : null
  );
  const miniMapPlayerGround = miniMapPlayer
    ? getArenaGroundHeightForPlayer(arenaMapId, miniMapPlayer.x, miniMapPlayer.z, miniMapPlayer.y, FPS_STANDING_EYE_HEIGHT)
    : 0;
  const miniMapLevel = getArenaLevelLabel(arenaMapId, miniMapPlayerGround);
  const flagCarrier = session?.flag?.carrierId
    ? session.players.find((candidate) => candidate.id === session.flag?.carrierId)
    : undefined;
  const displayedFlagPosition = session?.flag
    ? { x: flagCarrier?.x ?? session.flag.position.x, z: flagCarrier?.z ?? session.flag.position.z }
    : undefined;

  return (
    <div className={view === "fps" ? "arena-frame fps-view" : "arena-frame"}>
      <div className="arena-canvas" ref={mountRef} aria-label={`${arenaMap.title} arena`} />
      {renderError && <div className="arena-error" role="alert"><strong>Arena unavailable</strong><span>{renderError}</span><button type="button" onClick={() => { setFallbackQuality("performance"); setRenderError(""); }}>Retry in performance mode</button></div>}
      {debugOverlay && characterDebugStats && (
        <div className="character-debug-overlay" aria-label="Character debug stats">
          <strong>{debugLabel}</strong>
          <span>{characterDebugStats.visible}/{characterDebugStats.total} visible</span>
          <span>{characterDebugStats.alive} alive</span>
          <span>Avg speed {characterDebugStats.averageSpeed}</span>
          <span>
            LOD {characterDebugStats.lod.LOD0}/{characterDebugStats.lod.LOD1}/{characterDebugStats.lod.LOD2}/{characterDebugStats.lod.LOD3}
          </span>
          {performanceSnapshot && (
            <>
              <span>{performanceSnapshot.fps} FPS · p95 {performanceSnapshot.frameMsP95} ms</span>
              <span>{performanceSnapshot.drawCalls} calls · {performanceSnapshot.triangles.toLocaleString()} tris</span>
              <span>{performanceSnapshot.longTasks} long tasks · {performanceSnapshot.heapMb ?? "n/a"} MB heap</span>
            </>
          )}
        </div>
      )}
      {view === "fps" && (
        <>
          <ArenaHudOverlay
            hitPulse={hitPulse}
            zoomLevel={zoomLevel}
            weaponCooldown={weaponCooldown}
            isDesertCitadel={isDesertCitadel}
            isIronJunction={isIronJunction}
            arenaTitle={arenaMap.title}
            controlsDisabled={controlsDisabled}
            isPointerLocked={isPointerLocked}
            suppressHint={suppressHint}
            joystickElementRef={joystickElementRef}
            onBeginTouchMove={beginTouchMove}
            onFireFromTouch={fireFromTouch}
          />
          {zoomLevel > 0 && (
            <div key={`${zoomLevel}-${zoomPulse}`} className={`scope-overlay scope-level-${zoomLevel} scope-pulse`} aria-hidden="true">
              <span>Heavy Scope</span>
              <strong>{zoomLevel === 1 ? "2×" : "4×"}</strong>
            </div>
          )}
          <div className="arena-minimap" aria-label={`${arenaMap.title} minimap`}>
            <div className="minimap-title">Map</div>
            <svg viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} role="img" aria-label={`${arenaMap.title} route overview`}>
              <rect x="0" y="0" width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} rx="5" className={isIronJunction ? "minimap-iron" : isTempleRunoff ? "minimap-temple" : "minimap-sand"} />
              {arenaMap.floorMarks.slice(0, 5).map((mark) => (
                <rect
                  key={mark.id}
                  x={toMiniMapX(mark.x - mark.w / 2)}
                  y={toMiniMapY(mark.z - mark.d / 2)}
                  width={Math.max(1, toMiniMapW(mark.w))}
                  height={Math.max(1, toMiniMapH(mark.d))}
                  className="minimap-route"
                  opacity={!hasMultipleLevels || getArenaLevelLabel(arenaMapId, mark.y ?? 0) === miniMapLevel ? 0.9 : 0.32}
                />
              ))}
              {arenaMap.blocks.filter((block) => block.collides).map((block) => (
                <rect
                  key={block.id}
                  x={toMiniMapX(block.x - block.w / 2)}
                  y={toMiniMapY(block.z - block.d / 2)}
                  width={Math.max(0.7, toMiniMapW(block.w))}
                  height={Math.max(0.7, toMiniMapH(block.d))}
                  className={block.material === "wood" ? "minimap-wood" : "minimap-wall"}
                  opacity={!hasMultipleLevels || getArenaLevelLabel(arenaMapId, (block.y ?? block.h / 2) - block.h / 2) === miniMapLevel ? 0.82 : 0.28}
                />
              ))}
              <rect
                x={toMiniMapX(teamBaseZones.blue.minX)}
                y={toMiniMapY(teamBaseZones.blue.minZ)}
                width={toMiniMapW(teamBaseZones.blue.maxX - teamBaseZones.blue.minX)}
                height={toMiniMapH(teamBaseZones.blue.maxZ - teamBaseZones.blue.minZ)}
                className="minimap-blue-base"
              />
              <rect
                x={toMiniMapX(teamBaseZones.red.minX)}
                y={toMiniMapY(teamBaseZones.red.minZ)}
                width={toMiniMapW(teamBaseZones.red.maxX - teamBaseZones.red.minX)}
                height={toMiniMapH(teamBaseZones.red.maxZ - teamBaseZones.red.minZ)}
                className="minimap-red-base"
              />
              {captureZones.map((zone) => (
                <circle key={zone.id} cx={toMiniMapX(zone.x)} cy={toMiniMapY(zone.z)} r="2.1" className="minimap-capture" />
              ))}
              {searchRetrieveItems.map((item) => (
                <rect key={item.id} x={toMiniMapX(item.x) - 1.4} y={toMiniMapY(item.z) - 1.4} width="2.8" height="2.8" className="minimap-item" />
              ))}
              {session?.settings.gameMode === "flag" && session.flag && displayedFlagPosition && (
                <g className={`minimap-flag minimap-flag-${session.flag.state}`} transform={`translate(${toMiniMapX(displayedFlagPosition.x)} ${toMiniMapY(displayedFlagPosition.z)})`}>
                  <circle r="3" />
                  <path d="M 0 -4 L 0 4 M 0 -4 L 4 -2 L 0 0" />
                </g>
              )}
              {!isDesertCitadel && (
                <>
                  <text x={toMiniMapX(isIronJunction ? scaleArenaValue(-248) : scaleArenaValue(-205))} y={toMiniMapY(isIronJunction ? 0 : scaleArenaValue(-154))} className="minimap-label">Blue</text>
                  <text x={toMiniMapX(isIronJunction ? scaleArenaValue(232) : scaleArenaValue(184))} y={toMiniMapY(isIronJunction ? 0 : scaleArenaValue(-154))} className="minimap-label">Red</text>
                  <text x={toMiniMapX(isIronJunction ? scaleArenaValue(-112) : 0)} y={toMiniMapY(isIronJunction ? scaleArenaValue(-130) : scaleArenaValue(-164))} className="minimap-label">{isIronJunction ? "Warehouse" : "Jungle"}</text>
                  <text x={toMiniMapX(isIronJunction ? scaleArenaValue(58) : 0)} y={toMiniMapY(isIronJunction ? scaleArenaValue(-38) : 0)} className="minimap-label">{isIronJunction ? "Control" : "River"}</text>
                  <text x={toMiniMapX(isIronJunction ? scaleArenaValue(104) : 0)} y={toMiniMapY(isIronJunction ? scaleArenaValue(151) : scaleArenaValue(156))} className="minimap-label">{isIronJunction ? "Depot" : "Court"}</text>
                </>
              )}
              {isDesertCitadel && [
                [-86, 0], [0, -45], [0, 101], [185, 70], [-181, 76], [84, 81]
              ].map(([x, z]) => (
                <rect
                  key={`citadel-stair-${x}-${z}`}
                  x={toMiniMapX(scaleArenaValue(x)) - 1.6}
                  y={toMiniMapY(scaleArenaValue(z)) - 1.6}
                  width="3.2"
                  height="3.2"
                  rx="0.5"
                  className="minimap-stair"
                  transform={`rotate(45 ${toMiniMapX(scaleArenaValue(x))} ${toMiniMapY(scaleArenaValue(z))})`}
                />
              ))}
              {isIronJunction && <text x={toMiniMapX(scaleArenaValue(-35))} y={toMiniMapY(scaleArenaValue(218))} className="minimap-label">Tunnel</text>}
              {hasMultipleLevels && !isDesertCitadel && (
                <text x={MINIMAP_WIDTH - 5} y={10} textAnchor="end" className="minimap-label">
                  {isTempleRunoff
                    ? miniMapLevel === "lower" ? "↓ LOWER" : miniMapLevel === "upper" ? "↑ UPPER" : "• MAIN"
                    : isIronJunction
                      ? miniMapLevel === "ground" ? "• GROUND" : miniMapLevel === "loading" ? "↑ LOADING" : "↑ OVERPASS"
                      : miniMapLevel === "ground" ? "• GROUND" : miniMapLevel === "citadel" ? "↑ CITADEL" : "↑↑ LOOKOUT"}
                </text>
              )}
              {miniMapPlayer && (
                <g
                  className="minimap-player"
                  transform={`translate(${toMiniMapX(miniMapPlayer.x)} ${toMiniMapY(miniMapPlayer.z)}) rotate(${(-miniMapPlayer.facing * 180) / Math.PI})`}
                >
                  <path d="M 0 -5 L 3.5 4 L 0 2 L -3.5 4 Z" />
                </g>
              )}
            </svg>
          </div>
          {!controlsDisabled && !isPointerLocked && !suppressHint && <div className="control-lock">WASD moves. Arrow keys or swipe the arena to look around. Click the arena for mouse aim. F or left click launches. C scopes the Heavy Launcher. E interacts with the flag.</div>}
          <div className="touch-controls" aria-label="Touch controls">
            <button ref={joystickElementRef} type="button" className="touch-joystick" aria-label="Movement joystick" disabled={controlsDisabled} onPointerDown={beginTouchMove}>
              <span aria-hidden="true" />
            </button>
            <div className="touch-action-group">
              <span>Swipe to look · Tap arena to fire</span>
              <button type="button" className="touch-fire" disabled={controlsDisabled} onPointerDown={fireFromTouch}>Fire</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
