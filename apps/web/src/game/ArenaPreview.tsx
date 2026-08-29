import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import {
  ARENA_MAX_AIM_PITCH,
  ARENA_MIN_AIM_PITCH,
  ARENA_SCALE,
  ATHLETICS_COURSE_BOUNDS,
  ATHLETICS_JUMP_ENERGY_COST,
  ATHLETICS_STADIUM_COURSE,
  getAthleticsObstacles,
  getAthleticsStartPosition,
  getGearFireCooldownMs,
  getGearZoomFovMultiplier,
  getArenaGroundHeight,
  getArenaGroundHeightForPlayer,
  getArenaLevelLabel,
  getPlayerMoveSpeedMultiplier,
  getPlayerWeaponId,
  getTeamSpawnForMap,
  type SessionMapId,
  isGearAutoFireEnabled,
  type GameSession,
  type PlayerSession
} from "@quizstrike/shared";
import { attachArenaInputListeners } from "./inputHandling";
import { loadArenaMapContext } from "./mapLoader";
import { buildArenaMapScene } from "./arenaMapBuilder";
import { createCharacterSync } from "./characterSync";
import { ArenaMinimap } from "./ArenaMinimap";
import { createArenaRenderLoop } from "./arenaLoop";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_JUMP_GRAVITY,
  FPS_JUMP_VELOCITY,
  FPS_STANDING_EYE_HEIGHT,
  canFpsBodyAutoStepOnto,
  canFpsBodyClearObstacle,
  findFpsSupportSurfaceY,
  getFpsBodyVerticalBounds,
  smoothFpsGroundedCameraY
} from "./ArenaCamera.js";
import { createArenaSceneSetup, FPS_BASE_FOV } from "./sceneSetup";
import { ArenaHudOverlay, type AthleticsHudState } from "./hudOverlay";
import { type CharacterManagerStats } from "./characters/CharacterManager";
import { isFireKeyboardEvent, isScopeKeyboardEvent, resolveCombatPointerAction, shouldFireFromTouchGesture } from "./arenaInput";
import { gameAudio, type MovementAudioMode } from "./GameAudio";
import { cycleHeavyGunZoom, getWeaponFov, shouldResetWeaponZoom } from "./weaponControls";
import { resolveTouchJoystickVector } from "./touchJoystick";
import { emitArenaVfx, getArenaVfxAnchor, getArenaWeaponVfxKind, type ArenaVfxStats } from "./ArenaVfx";
import { emitArenaAnimation } from "./ArenaAnimation";
import { ArenaPerformanceCapture, AutoGraphicsQualityController, type ArenaPerformanceSnapshot } from "./ArenaPerformance";
import { mountIronJunctionImportedAssets } from "./ironJunctionImportedAssets";
import { mountDesertCitadelImportedAssets } from "./desertCitadelImportedAssets";
import { mountTempleRunoffImportedAssets } from "./templeRunoffImportedAssets";
import { getTempleRunoffReviewViewpoint } from "./templeRunoffReviewViewpoints";
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
  hitConfirmPulse?: number;
  quality?: ArenaQuality;
  gamepadEnabled?: boolean;
  onMove?: (position: ArenaLivePosition) => void;
  onFire?: (position: ArenaLivePosition) => void;
  onInteract?: (position: ArenaLivePosition) => void;
  onOpenQuestion?: () => void;
  athleticsHud?: AthleticsHudState;
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
const GAMEPAD_DEAD_ZONE = 0.18;
const KEYBOARD_LOOK_SPEED = 1.9;
const TOUCH_LOOK_SENSITIVITY = 0.006;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const VFX_DEBUG_CUES = [
  ["Weapon fire", "weapon_fire"],
  ["Quick fire", "quick_fire"],
  ["Heavy fire", "heavy_fire"],
  ["Wall hit", "impact"],
  ["Player hit", "player_hit"],
  ["Snow hit", "snowball_impact"],
  ["Correct answer", "reward_burst"],
  ["Purchase", "purchase"],
  ["Elimination", "elimination"],
  ["Spawn", "spawn"],
  ["Flag capture", "flag_capture"],
  ["Round win", "victory"]
] as const;

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

const makeLabelTexture = (label: string, color = "#ffffff", background = "rgba(41, 28, 16, 0.78)") => {
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
  hitConfirmPulse = 0,
  quality = "auto",
  gamepadEnabled = true,
  onMove,
  onFire,
  onInteract,
  onOpenQuestion,
  athleticsHud,
  loadDecalAsset
}: ArenaPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const touchMoveRef = useRef({ forward: 0, right: 0 });
  const fireControlRef = useRef<() => void>(() => undefined);
  const zoomControlRef = useRef<() => void>(() => undefined);
  const interactControlRef = useRef<() => void>(() => undefined);
  const jumpControlRef = useRef<() => void>(() => undefined);
  const questionControlRef = useRef<() => void>(() => undefined);
  const onMoveRef = useRef(onMove);
  const onFireRef = useRef(onFire);
  const onInteractRef = useRef(onInteract);
  const onOpenQuestionRef = useRef(onOpenQuestion);
  const currentPlayerRef = useRef(currentPlayer);
  const sessionRef = useRef(session);
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
  const [fallbackQuality, setFallbackQuality] = useState<Exclude<ArenaQuality, "auto"> | null>(null);
  const [autoResolvedQuality, setAutoResolvedQuality] = useState<Exclude<ArenaQuality, "auto">>(() => resolveArenaQuality("auto"));
  const [autoQualityNotice, setAutoQualityNotice] = useState(false);
  const autoQualityControllerRef = useRef<AutoGraphicsQualityController | null>(null);
  const autoQualityNoticeShownRef = useRef(false);
  const [characterDebugStats, setCharacterDebugStats] = useState<CharacterManagerStats | null>(null);
  const [performanceSnapshot, setPerformanceSnapshot] = useState<ArenaPerformanceSnapshot | null>(null);
  const [vfxDebugStats, setVfxDebugStats] = useState<ArenaVfxStats | null>(null);
  const [athleticsSceneBuilder, setAthleticsSceneBuilder] = useState<typeof import("./athleticsStadiumBuilder")["buildAthleticsStadiumScene"] | null>(null);
  const debugVfxPositionRef = useRef({ x: 0, y: 0.12, z: 0 });
  const previousWeaponRef = useRef<string | null>(null);
  const sceneSessionId = session?.id ?? "training";
  const currentPlayerId = currentPlayer?.id ?? "";
  const currentPlayerTeam = currentPlayer?.team ?? "blue";
  const currentWeaponId = currentPlayer ? getPlayerWeaponId(currentPlayer) : undefined;
  const isAthleticsMode = session?.settings.gameMode === "athletics";
  useEffect(() => {
    if (!isAthleticsMode || athleticsSceneBuilder) return;
    let active = true;
    void import("./athleticsStadiumBuilder").then((module) => {
      if (active) setAthleticsSceneBuilder(() => module.buildAthleticsStadiumScene);
    });
    return () => { active = false; };
  }, [athleticsSceneBuilder, isAthleticsMode]);
  const arenaMapId: SessionMapId = session?.settings.mapId ?? "desert_citadel";
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
  } = useMemo(() => loadArenaMapContext(arenaMapId), [arenaMapId]);
  const activeQuality = fallbackQuality
    ?? (quality === "auto" ? autoResolvedQuality : quality);
  const movementLimitX = isAthleticsMode ? ATHLETICS_COURSE_BOUNDS.limitX : arenaBounds.limitX;
  const movementLimitZ = isAthleticsMode ? ATHLETICS_COURSE_BOUNDS.limitZ : arenaBounds.limitZ;
  const serverToLocalX = useCallback((x: number) => clamp(x, -movementLimitX, movementLimitX), [movementLimitX]);
  const serverToLocalZ = useCallback((z: number) => clamp(z, -movementLimitZ, movementLimitZ), [movementLimitZ]);
  const localToServerPosition = useCallback((position: THREE.Vector3, facing: number): ArenaLivePosition => ({
    x: clamp(position.x, -movementLimitX, movementLimitX),
    z: clamp(position.z, -movementLimitZ, movementLimitZ),
    y: Number(position.y.toFixed(2)),
    facing
  }), [movementLimitX, movementLimitZ]);
  currentPlayerRef.current = currentPlayer;
  sessionRef.current = session;

  useEffect(() => {
    setFallbackQuality(null);
    const initialAutoQuality = resolveArenaQuality("auto");
    setAutoResolvedQuality(initialAutoQuality);
    autoQualityControllerRef.current = quality === "auto"
      ? new AutoGraphicsQualityController(initialAutoQuality)
      : null;
    autoQualityNoticeShownRef.current = false;
    setAutoQualityNotice(false);
  }, [quality]);

  useEffect(() => {
    if (!autoQualityNotice) return;
    const timeout = window.setTimeout(() => setAutoQualityNotice(false), 4_500);
    return () => window.clearTimeout(timeout);
  }, [autoQualityNotice]);

  useEffect(() => {
    onMoveRef.current = onMove;
    onFireRef.current = onFire;
    onInteractRef.current = onInteract;
    onOpenQuestionRef.current = onOpenQuestion;
    inputPausedRef.current = inputPaused;
    controlsDisabledRef.current = controlsDisabled;
  }, [onMove, onFire, onInteract, onOpenQuestion, inputPaused, controlsDisabled]);

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
    if (isAthleticsMode || !currentWeaponId) return;
    const weaponId = currentWeaponId;
    if (previousWeaponRef.current === null) gameAudio.playEvent("weapon_equip");
    else if (previousWeaponRef.current !== weaponId) gameAudio.playEvent("weapon_switch");
    previousWeaponRef.current = weaponId;
  }, [currentWeaponId, isAthleticsMode]);

  useEffect(() => {
    pendingShotsRef.current = 0;
  }, [currentPlayer?.id, currentPlayer?.snowballs, currentPlayer?.isAlive, currentPlayer?.gear, currentPlayer?.weapon, currentPlayer?.perks]);

  useEffect(() => {
    syncPlayersRef.current(session, currentPlayer);
  }, [session, currentPlayer]);

  // Live session payloads replace array references, so only primitive scene-build inputs belong in this dependency list.
  useEffect(() => {
    const session = sessionRef.current;
    const currentPlayer = currentPlayerRef.current;
    const mount = mountRef.current;
    if (!mount) return;
    if (isAthleticsMode && !athleticsSceneBuilder) return;
    setRenderError("");
    setPerformanceSnapshot(null);
    setVfxDebugStats(null);

    const isFps = view === "fps";
    const isZombieMode = session?.settings.gameMode === "zombie";
    const fallbackSpawn = isAthleticsMode
      ? getAthleticsStartPosition(0, Math.max(1, session?.players.length ?? 1))
      : currentPlayer ? getTeamSpawnForMap(arenaMapId, currentPlayer.team) : getTeamSpawnForMap(arenaMapId, "blue");
    const templeReviewViewpoint = debugOverlay && isFps && isTempleRunoff
      ? getTempleRunoffReviewViewpoint(new URLSearchParams(window.location.search).get("templeView"))
      : undefined;
    const initialServerX = templeReviewViewpoint?.position[0] ?? (isFiniteNumber(currentPlayer?.x) ? currentPlayer.x : fallbackSpawn.x);
    const initialServerZ = templeReviewViewpoint?.position[2] ?? (isFiniteNumber(currentPlayer?.z) ? currentPlayer.z : fallbackSpawn.z);
    const initialGroundY = isAthleticsMode ? 0 : getArenaGroundHeight(arenaMapId, initialServerX, initialServerZ);
    const initialServerY = templeReviewViewpoint?.position[1] ?? (isFiniteNumber(currentPlayer?.y) ? currentPlayer.y : fallbackSpawn.y);
    const playerPosition = new THREE.Vector3(
      serverToLocalX(initialServerX),
      isFiniteNumber(initialServerY) ? initialServerY : initialGroundY + FPS_STANDING_EYE_HEIGHT,
      serverToLocalZ(initialServerZ)
    );
    debugVfxPositionRef.current = { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z };
    let yaw = templeReviewViewpoint?.yaw ?? (isFiniteNumber(currentPlayer?.facing) ? currentPlayer.facing : fallbackSpawn.facing);
    let pitch = templeReviewViewpoint?.pitch ?? -0.12;
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
    const onWebglContextLost = (event: Event) => {
      event.preventDefault();
      setRenderError("The 3D renderer paused on this device. Retry in performance mode, then re-enter the game if needed.");
    };
    const onWebglContextRestored = () => {
      setFallbackQuality("performance");
      setRenderError("");
    };
    renderer.domElement.addEventListener("webglcontextlost", onWebglContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", onWebglContextRestored, false);
    const autoQualityController = quality === "auto" && !fallbackQuality
      ? autoQualityControllerRef.current ?? undefined
      : undefined;
    if (isFps) {
      camera.position.set(0, 0, 0);
    } else {
      camera.position.set(0, 238, 246);
      camera.lookAt(0, 0, 0);
    }

    const textureLoader = new THREE.TextureLoader();
    const loadTexture = (path: string) => {
      const url = `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
      const texture = textureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const emptyVfxTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1, THREE.RGBAFormat);
    emptyVfxTexture.needsUpdate = true;
    const puffTexture = isAthleticsMode ? emptyVfxTexture : loadTexture("/assets/snowball-puff.svg");
    const vfxTextures = isAthleticsMode ? {
      muzzle: emptyVfxTexture,
      trace: emptyVfxTexture,
      spark: emptyVfxTexture,
      smoke: emptyVfxTexture,
      circle: emptyVfxTexture,
      star: emptyVfxTexture,
      magic: emptyVfxTexture,
      snow: emptyVfxTexture
    } : {
      muzzle: loadTexture("/assets/vfx/kenney/muzzle_03.png?v=2"),
      trace: loadTexture("/assets/vfx/kenney/trace_03.png?v=2"),
      spark: loadTexture("/assets/vfx/kenney/spark_03.png?v=2"),
      smoke: loadTexture("/assets/vfx/kenney/smoke_03.png"),
      circle: loadTexture("/assets/vfx/kenney/circle_03.png"),
      star: loadTexture("/assets/vfx/kenney/star_03.png?v=2"),
      magic: loadTexture("/assets/vfx/kenney/magic_03.png?v=2"),
      snow: puffTexture
    };
    const {
      floorTexture,
      stoneTexture,
      woodTexture,
      waterTexture,
      sandTexture,
      metalTexture,
      desertCitadelPbrTextures,
      materialCache,
      staticBatcher,
      collisionProxyMaterial,
      coverBoxes,
      flagMarker,
      templeRunoffArt,
      desertCitadelArt,
      desertCitadelVfx,
      athleticsUpdate
    } = isAthleticsMode
      ? athleticsSceneBuilder!({
          scene,
          renderer,
          activeQuality,
          qualityConfig,
          makeCanvasTexture,
          makeLabelTexture,
          questionsPerLap: session?.athletics?.questionsPerLap,
          serverTime: session?.serverTime,
          debugOverlay
        })
      : buildArenaMapScene({
      scene,
      renderer,
      arenaMap,
      arenaMapId,
      session,
      arenaBounds,
      teamBaseZones,
      captureZones,
      searchRetrieveDeliveryZones,
      isIronJunction,
      isDesertCitadel,
      isTempleRunoff,
      isFps,
      isZombieMode,
      activeQuality,
      qualityConfig,
      makeCanvasTexture,
      seededRandom,
      scaleArenaValue
    });
    const ironJunctionAssetsPromise = !isAthleticsMode && isIronJunction
      ? mountIronJunctionImportedAssets({ scene, detail: qualityConfig.detail, isFps })
      : Promise.resolve(null);
    const desertCitadelAssetsPromise = !isAthleticsMode && isDesertCitadel
      ? mountDesertCitadelImportedAssets({ scene, isFps })
      : Promise.resolve(null);
    const templeRunoffAssetsPromise = !isAthleticsMode && isTempleRunoff
      ? mountTempleRunoffImportedAssets({ scene, isFps })
      : Promise.resolve(null);


    const players = session?.players.length ? session.players : currentPlayer ? [currentPlayer] : [];
    const {
      billboardSprites,
      characterFactory,
      characterManager,
      vfxPool,
      unsubscribeVfx,
      unsubscribeAnimation,
      syncPlayers
    } = createCharacterSync({
      scene,
      isFps,
      currentPlayerId,
      players,
      currentPlayer,
      session,
      arenaMapId,
      activeQuality,
      loadDecalAsset,
      vfxTextures,
      makeLabelTexture,
      serverToLocalX,
      serverToLocalZ,
      flagMarker
    });
    const performanceCapture = new ArenaPerformanceCapture(renderer, activeQuality);
    syncPlayersRef.current = syncPlayers;
    syncPlayers(session, currentPlayer);


    const cameraRig = new THREE.Group();
    if (isFps) {
      scene.add(cameraRig);
      cameraRig.add(camera);

      const firstPersonModel = characterFactory.createFirstPersonViewModel(currentPlayerTeam, getPlayerWeaponId(currentPlayer ?? { gear: "starter_blaster" }));
      if (isAthleticsMode) firstPersonModel.root.visible = false;
      camera.add(firstPersonModel.root);
      const firstPersonRootBaseY = firstPersonModel.root.position.y;
      const firstPersonWeaponRotation = firstPersonModel.weapon.rotation.clone();
      const fpsMuzzlePosition = new THREE.Vector3();
      const fpsMuzzleWorldPosition = new THREE.Vector3();
      const syncFpsMuzzlePosition = () => {
        camera.updateMatrixWorld(true);
        firstPersonModel.muzzle.getWorldPosition(fpsMuzzleWorldPosition);
        fpsMuzzlePosition.copy(fpsMuzzleWorldPosition);
        camera.worldToLocal(fpsMuzzlePosition);
      };

      const flashMaterial = new THREE.SpriteMaterial({
        map: vfxTextures.muzzle,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
      });
      const flash = new THREE.Sprite(flashMaterial);
      flash.scale.set(0.62, 0.78, 1);
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

      const tracerMaterial = new THREE.SpriteMaterial({
        map: vfxTextures.trace,
        color: "#b9f4ff",
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const tracer = new THREE.Sprite(tracerMaterial);
      tracer.scale.set(0.09, 0.72, 1);
      tracer.visible = false;
      camera.add(tracer);

      const impactMaterial = new THREE.SpriteMaterial({ map: puffTexture, color: "#b9f4ff", transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
      const impactPuff = new THREE.Sprite(impactMaterial);
      impactPuff.scale.set(0.8, 0.8, 1);
      camera.add(impactPuff);

      let flashUntil = 0;
      let snowballLaunchAt = 0;
      let verticalVelocity = 0;
      let jumpQueuedAt = 0;
      let lastGroundedAt = performance.now();
      const jumpBufferMs = 150;
      const coyoteTimeMs = 110;
      let lastEmptyFireRequestAt = 0;
      let lastLocalFireAt = 0;
      let lastCooldownFxAt = 0;
      let lastFootstepVfxAt = 0;
      let activeZoomLevel = 0;
      let hadPointerLock = false;
      let cooldownTimeout: number | undefined;
      let wasGrounded = true;
      let landedAt = 0;
      let cameraVisualY = playerPosition.y;
      let fireHeld = false;
      let questionHoldPosition: THREE.Vector3 | null = null;
      jumpControlRef.current = () => {
        if (controlsDisabledRef.current || inputPausedRef.current) return;
        if (isAthleticsMode && (currentPlayerRef.current?.energy ?? 0) < ATHLETICS_JUMP_ENERGY_COST) return;
        jumpQueuedAt = performance.now();
      };
      questionControlRef.current = () => {
        if (controlsDisabledRef.current || inputPausedRef.current || !isAthleticsMode) return;
        if (!wasGrounded || isJumping) return;
        questionHoldPosition = playerPosition.clone();
        onOpenQuestionRef.current?.();
      };
      const getEquippedGearId = () => getPlayerWeaponId(currentPlayerRef.current ?? { gear: "starter_blaster" });
      const hasHeavyGun = () => currentWeaponId === "power_blaster";
      const hasZoomGear = () => hasHeavyGun() || getGearZoomFovMultiplier(getEquippedGearId()) < 1;
      const hasAutoFireGear = () => isGearAutoFireEnabled(getEquippedGearId());
      const setZoomLevel = (nextLevel: number) => {
        const maxLevel = hasHeavyGun() ? 2 : hasZoomGear() ? 1 : 0;
        const next = Math.max(0, Math.min(maxLevel, nextLevel));
        if (activeZoomLevel === next) return;
        activeZoomLevel = next;
        renderer.domElement.dataset.zoomLevel = String(next);
        setZoomLevelState(next);
        setZoomPulse((value) => value + 1);
        if (hasHeavyGun()) gameAudio.playEvent("heavy_scope");
        else gameAudio.play(next > 0 ? "zoom_in" : "zoom_out");
      };
      zoomControlRef.current = () => {
        if (controlsDisabledRef.current || inputPausedRef.current || !hasHeavyGun()) return;
        setZoomLevel(cycleHeavyGunZoom(activeZoomLevel));
      };
      const fire = () => {
        if (controlsDisabledRef.current || inputPausedRef.current || !onFireRef.current) return;
        gameAudio.warm();
        const currentTime = performance.now();
        const equippedGearId = getEquippedGearId();
        if (currentTime - lastLocalFireAt < getGearFireCooldownMs(equippedGearId)) {
          if (currentTime - lastCooldownFxAt > 280) {
            lastCooldownFxAt = currentTime;
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
        vfxPool.emit({
          kind: getArenaWeaponVfxKind(equippedGearId),
          x: fpsMuzzleWorldPosition.x,
          y: fpsMuzzleWorldPosition.y,
          z: fpsMuzzleWorldPosition.z,
          team: currentPlayerTeam,
          local: true
        });
        flash.material.opacity = 1;
        muzzleRingMaterial.opacity = 0.88;
        muzzleRing.scale.setScalar(0.72);
        snowball.visible = true;
        projectileTrail.visible = true;
        impactMaterial.opacity = 0;
        setHitPulse((value) => value + 1);
        if (equippedGearId === "power_blaster") {
          gameAudio.playEvent("weapon_fire_heavy_local");
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
      interactControlRef.current = () => {
        if (controlsDisabledRef.current || inputPausedRef.current) return;
        onInteractRef.current?.(localToServerPosition(playerPosition, yaw));
      };

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
          if (code === "Space" && !keys.has("Space")) jumpQueuedAt = performance.now();
          keys.add(code);
          event.preventDefault();
          return;
        }
        if (isScopeKeyboardEvent(event) && hasHeavyGun()) {
          // Keyboard repeat must not spin through every scope level while C is held.
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
        if (locked) hadPointerLock = true;
        else if (hadPointerLock) {
          hadPointerLock = false;
          setZoomLevel(0);
        }
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
      const collisionSources = isAthleticsMode
        ? getAthleticsObstacles()
        : arenaMap.blocks.filter((block) => block.collides);
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
        const blockingIndex = coverBoxes.findIndex((box, index) => {
          if (!box.intersectsBox(bodyBox) || canFpsBodyClearObstacle(verticalBounds, box.max.y)) return false;
          const source = collisionSources[index] as { style?: string; stair?: boolean } | undefined;
          const isStair = source?.style === "stair" || source?.stair === true;
          return !isStair || !canFpsBodyAutoStepOnto(verticalBounds, box.max.y);
        });
        lastColliderName = blockingIndex >= 0 ? collisionSources[blockingIndex]?.id ?? "unknown" : "none";
        return blockingIndex < 0;
      };
      const resolveSurfaceGroundY = (
        x: number,
        z: number,
        eyeY: number,
        floorEyeHeight: number
      ) => {
        const mappedGroundY = isAthleticsMode
          ? 0
          : getArenaGroundHeightForPlayer(
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

      const fpsLoop = createArenaRenderLoop(({ delta, currentTime, elapsed }) => {
        performanceCapture.frame(currentTime);
        // Put target/body previews downrange on the aim line. The former close,
        // side-offset point made them read like HUD clutter beside the weapon.
        debugVfxPositionRef.current = {
          x: playerPosition.x - Math.sin(yaw) * 4.2,
          y: playerPosition.y - FPS_STANDING_EYE_HEIGHT + 0.08,
          z: playerPosition.z - Math.cos(yaw) * 4.2
        };
        vfxPool.setViewPosition(playerPosition);
        vfxPool.update(currentTime);
        const platformCarry = athleticsUpdate?.(elapsed, playerPosition, wasGrounded);
        if (isAthleticsMode && platformCarry && !inputPausedRef.current && !controlsDisabledRef.current) {
          playerPosition.x += platformCarry.x;
          playerPosition.y += platformCarry.y;
          playerPosition.z += platformCarry.z;
        }
        desertCitadelVfx?.update(elapsed);
        templeRunoffArt?.update(elapsed);
        if (currentTime - performanceWindowAt >= 1000) {
          const profile = performanceCapture.snapshot(currentTime);
          const adjustment = autoQualityController?.update(profile, currentTime);
          if (adjustment) {
            if (adjustment.direction === "lower" && !autoQualityNoticeShownRef.current) {
              autoQualityNoticeShownRef.current = true;
              setAutoQualityNotice(true);
            }
            setAutoResolvedQuality(adjustment.quality);
          }
          renderer.domElement.dataset.fps = String(profile.fps);
          renderer.domElement.dataset.frameP95 = String(profile.frameMsP95);
          renderer.domElement.dataset.drawCalls = String(profile.drawCalls);
          renderer.domElement.dataset.triangles = String(profile.triangles);
          renderer.domElement.dataset.longTasks = String(profile.longTasks);
          renderer.domElement.dataset.vfxActive = String(vfxPool.activeCount);
          renderer.domElement.dataset.vfxSprites = String(vfxPool.particleCount);
          renderer.domElement.dataset.vfxDropped = String(vfxPool.getStats().dropped);
          if (debugOverlay) setPerformanceSnapshot(profile);
          if (debugOverlay) setVfxDebugStats(vfxPool.getStats());
          performanceWindowAt = currentTime;
        }
        if (controlsDisabledRef.current) {
          verticalVelocity = 0;
          jumpQueuedAt = 0;
          keys.clear();
          const followedPlayer = currentPlayerRef.current;
          if (isFiniteNumber(followedPlayer?.x) && isFiniteNumber(followedPlayer?.z)) {
            playerPosition.x += (serverToLocalX(followedPlayer.x) - playerPosition.x) * 0.24;
            playerPosition.z += (serverToLocalZ(followedPlayer.z) - playerPosition.z) * 0.24;
            const followedEyeY = isFiniteNumber(followedPlayer.y)
              ? followedPlayer.y
              : (isAthleticsMode ? 0 : getArenaGroundHeight(arenaMapId, followedPlayer.x, followedPlayer.z)) + FPS_STANDING_EYE_HEIGHT;
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
          if (isAthleticsMode && !questionHoldPosition && wasGrounded) questionHoldPosition = playerPosition.clone();
        } else {
          questionHoldPosition = null;
        }
        applyGamepadInput();
        const crouching = keys.has("Control");
        const floorEyeHeight = crouching ? FPS_CROUCH_EYE_HEIGHT : FPS_STANDING_EYE_HEIGHT;
        if (floorEyeHeight !== previousFloorEyeHeight) {
          playerPosition.y += floorEyeHeight - previousFloorEyeHeight;
          previousFloorEyeHeight = floorEyeHeight;
        }
        isCrouching = crouching;
        let surfaceGroundY = resolveSurfaceGroundY(
          playerPosition.x,
          playerPosition.z,
          playerPosition.y,
          floorEyeHeight
        );
        let groundEyeY = surfaceGroundY + floorEyeHeight;
        const currentLevel = isAthleticsMode ? "skyline_adventure_park" : getArenaLevelLabel(arenaMapId, surfaceGroundY);
        const currentNavRegion = isAthleticsMode ? "stadium_loop:skyline_adventure_park" : `${arenaMapId}:${currentLevel}`;
        renderer.domElement.dataset.playerGroundY = surfaceGroundY.toFixed(3);
        renderer.domElement.dataset.detectedFloor = surfaceGroundY.toFixed(3);
        renderer.domElement.dataset.currentNavRegion = currentNavRegion;
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
            currentNavRegion,
            colliderName: lastColliderName,
            currentLevel
          });
          lastLevelDebugAt = currentTime;
        }
        const grounded = playerPosition.y <= groundEyeY + 0.02 && Math.abs(verticalVelocity) < 0.01;
        if (grounded) lastGroundedAt = currentTime;
        const bufferedJump = jumpQueuedAt > 0 && currentTime - jumpQueuedAt <= jumpBufferMs;
        const canUseCoyoteTime = grounded || currentTime - lastGroundedAt <= coyoteTimeMs;
        if (bufferedJump && canUseCoyoteTime && !crouching) {
          verticalVelocity = FPS_JUMP_VELOCITY;
          jumpQueuedAt = 0;
          emitArenaAnimation({ kind: "jump", playerId: currentPlayerId, team: currentPlayerTeam });
          gameAudio.play("jump");
        }
        if (jumpQueuedAt > 0 && currentTime - jumpQueuedAt > jumpBufferMs) jumpQueuedAt = 0;
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
        const hasMovementEnergy = isAthleticsMode || isZombieHuman
          ? (activePlayer?.energy ?? 0) > 0
          : true;
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
          const movementSurface: "metal" | "water" | "stone" | "sand" = isAthleticsMode ? "stone" : isIronJunction ? "metal" : isTempleRunoff ? (surfaceGroundY < 1 ? "water" : "stone") : "sand";
          if (wasGrounded && moveSpeed > 0) {
            gameAudio.playMovementStep(movementAudioMode, currentTime, movementSurface);
            const footstepInterval = isSprinting ? 240 : 360;
            if (currentTime - lastFootstepVfxAt >= footstepInterval) {
              lastFootstepVfxAt = currentTime;
              vfxPool.emit({
                kind: "footstep",
                x: playerPosition.x,
                y: surfaceGroundY + 0.03,
                z: playerPosition.z,
                surface: movementSurface === "metal" ? "metal" : movementSurface === "water" ? "water" : movementSurface === "stone" ? "stone" : "sand",
                local: true,
                intensity: isSprinting ? 0.9 : 0.62
              });
            }
          }
          movementVector.normalize().multiplyScalar(moveSpeed * delta);
          nextPosition.copy(playerPosition).add(movementVector);
          nextPosition.x = clamp(nextPosition.x, -movementLimitX + PLAYER_RADIUS, movementLimitX - PLAYER_RADIUS);
          nextPosition.z = clamp(nextPosition.z, -movementLimitZ + PLAYER_RADIUS, movementLimitZ - PLAYER_RADIUS);
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

        if (isAthleticsMode && inputPausedRef.current && questionHoldPosition) {
          playerPosition.copy(questionHoldPosition);
          verticalVelocity = 0;
          jumpQueuedAt = 0;
          wasGrounded = true;
          isJumping = false;
        }

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
        characterManager.update(delta, elapsed, camera);
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
          tracer.visible = travel < 0.92;
          tracer.position.copy(snowball.position);
          tracerMaterial.rotation = currentTime * 0.008;
          tracerMaterial.opacity = tracer.visible ? (1 - travel) * 0.72 : 0;
          tracer.scale.set(0.06 + (1 - travel) * 0.04, 0.42 + (1 - travel) * 0.42, 1);
          const scale = Math.max(0.38, 1 - travel * 0.62);
          snowball.scale.setScalar(scale);
          if (travel > 0.82) {
            impactPuff.position.set(fpsMuzzlePosition.x, fpsMuzzlePosition.y - 0.08, fpsMuzzlePosition.z - 6.5);
            impactMaterial.opacity = Math.max(0, (1 - travel) * 3.8);
            impactPuff.scale.setScalar(0.8 + (travel - 0.82) * 5.5);
          }
        }
        renderer.render(scene, camera);
      }, 0.035);
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
      tracer.visible = false;
      renderer.render(scene, camera);
      renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
      renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
      fpsLoop.start();

      const resizeFps = () => {
        const width = mount.clientWidth;
        const height = Math.max(1, mount.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener("resize", resizeFps);

      return () => {
        fpsLoop.stop();
        window.removeEventListener("resize", resizeFps);
        renderer.domElement.removeEventListener("webglcontextlost", onWebglContextLost);
        renderer.domElement.removeEventListener("webglcontextrestored", onWebglContextRestored);
        unsubscribeVfx();
        unsubscribeAnimation();
        performanceCapture.dispose();
        vfxPool.dispose();
        desertCitadelArt?.dispose();
        desertCitadelVfx?.dispose();
        templeRunoffArt?.dispose();
        void ironJunctionAssetsPromise.then((assets) => assets?.dispose());
        void desertCitadelAssetsPromise.then((assets) => assets?.dispose());
        fireControlRef.current = () => undefined;
        zoomControlRef.current = () => undefined;
        interactControlRef.current = () => undefined;
        jumpControlRef.current = () => undefined;
        questionControlRef.current = () => undefined;
        syncPlayersRef.current = () => undefined;
        if (cooldownTimeout) window.clearTimeout(cooldownTimeout);
        setZoomLevel(0);
        setWeaponCooldown(null);
        cleanupControls();
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
        desertCitadelPbrTextures?.map.dispose();
        desertCitadelPbrTextures?.normalMap.dispose();
        desertCitadelPbrTextures?.roughnessMap.dispose();
        puffTexture.dispose();
        Object.values(vfxTextures).forEach((texture) => {
          if (texture !== puffTexture) texture.dispose();
        });
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    }

    let lastDebugStatsAt = 0;
    let performanceWindowAt = performance.now();
    const overviewLoop = createArenaRenderLoop(({ delta, elapsed, currentTime }) => {
      performanceCapture.frame(currentTime);
      // Keep overview previews on the arena floor, not at the orbit camera.
      debugVfxPositionRef.current = { x: 0, y: 0.12, z: -6 };
      vfxPool.setViewPosition(camera.position);
      vfxPool.update(currentTime);
      athleticsUpdate?.(elapsed);
      desertCitadelVfx?.update(elapsed);
      templeRunoffArt?.update(elapsed);
      if (currentTime - performanceWindowAt >= 1000) {
        const profile = performanceCapture.snapshot(currentTime);
        const adjustment = autoQualityController?.update(profile, currentTime);
        if (adjustment) {
          if (adjustment.direction === "lower" && !autoQualityNoticeShownRef.current) {
            autoQualityNoticeShownRef.current = true;
            setAutoQualityNotice(true);
          }
          setAutoResolvedQuality(adjustment.quality);
        }
        renderer.domElement.dataset.fps = String(profile.fps);
        renderer.domElement.dataset.frameP95 = String(profile.frameMsP95);
        renderer.domElement.dataset.drawCalls = String(profile.drawCalls);
        renderer.domElement.dataset.triangles = String(profile.triangles);
        renderer.domElement.dataset.longTasks = String(profile.longTasks);
        renderer.domElement.dataset.vfxActive = String(vfxPool.activeCount);
        renderer.domElement.dataset.vfxSprites = String(vfxPool.particleCount);
        renderer.domElement.dataset.vfxDropped = String(vfxPool.getStats().dropped);
        if (debugOverlay) setPerformanceSnapshot(profile);
        if (debugOverlay) setVfxDebugStats(vfxPool.getStats());
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
    }, 0.05);
    characterManager.update(0, 0, camera);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
    overviewLoop.start();

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", resize);

    return () => {
      overviewLoop.stop();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("webglcontextlost", onWebglContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onWebglContextRestored);
      unsubscribeVfx();
      unsubscribeAnimation();
      performanceCapture.dispose();
      vfxPool.dispose();
      desertCitadelArt?.dispose();
      desertCitadelVfx?.dispose();
      templeRunoffArt?.dispose();
      void ironJunctionAssetsPromise.then((assets) => assets?.dispose());
      void desertCitadelAssetsPromise.then((assets) => assets?.dispose());
      void templeRunoffAssetsPromise.then((assets) => assets?.dispose());
      interactControlRef.current = () => undefined;
      jumpControlRef.current = () => undefined;
      questionControlRef.current = () => undefined;
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
      desertCitadelPbrTextures?.map.dispose();
      desertCitadelPbrTextures?.normalMap.dispose();
      desertCitadelPbrTextures?.roughnessMap.dispose();
      puffTexture.dispose();
      Object.values(vfxTextures).forEach((texture) => {
        if (texture !== puffTexture) texture.dispose();
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [sceneSessionId, currentPlayerId, currentPlayerTeam, currentWeaponId, currentPlayer?.gear, currentPlayer?.weapon, view, debugOverlay, quality, fallbackQuality, activeQuality, gamepadEnabled, arenaMapId, arenaMap, arenaBounds, teamBaseZones, captureZones, searchRetrieveItems, searchRetrieveDeliveryZones, isIronJunction, isDesertCitadel, isTempleRunoff, isAthleticsMode, athleticsSceneBuilder, localToServerPosition, serverToLocalX, serverToLocalZ, movementLimitX, movementLimitZ, session?.settings.gameMode, session?.serverTime, loadDecalAsset]);

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
  const zoomFromTouch = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (controlsDisabled || inputPausedRef.current) return;
    zoomControlRef.current();
  };
  const interactFromTouch = () => {
    interactControlRef.current();
  };
  const jumpFromTouch = () => {
    jumpControlRef.current();
  };
  const questionFromTouch = () => {
    questionControlRef.current();
  };
  const miniMapPlayer = miniMapPosition ?? (
    isFiniteNumber(currentPlayer?.x) && isFiniteNumber(currentPlayer?.z)
      ? { x: currentPlayer.x, y: currentPlayer.y, z: currentPlayer.z, facing: currentPlayer.facing ?? 0 }
      : null
  );
  const miniMapPlayerGround = miniMapPlayer
    ? isAthleticsMode ? 0 : getArenaGroundHeightForPlayer(arenaMapId, miniMapPlayer.x, miniMapPlayer.z, miniMapPlayer.y, FPS_STANDING_EYE_HEIGHT)
    : 0;
  const miniMapLevel = getArenaLevelLabel(arenaMapId, miniMapPlayerGround);
  const flagCarrier = session?.flag?.carrierId
    ? session.players.find((candidate) => candidate.id === session.flag?.carrierId)
    : undefined;
  const displayedFlagPosition = session?.flag
    ? {
      x: flagCarrier?.x ?? session.flag.position.x,
      y: flagCarrier?.y ?? session.flag.position.y,
      z: flagCarrier?.z ?? session.flag.position.z
    }
    : undefined;
  const vfxDebugEnabled = import.meta.env.DEV && debugOverlay && new URLSearchParams(window.location.search).get("vfxDebug") === "1";
  const triggerDebugVfx = (kind: (typeof VFX_DEBUG_CUES)[number][1]) => {
    const position = debugVfxPositionRef.current;
    const anchor = getArenaVfxAnchor({ kind });
    const anchorY = anchor === "head"
      ? position.y + 4.12
      : anchor === "torso" || anchor === "muzzle"
        ? position.y + 2.9
        : position.y;
    emitArenaVfx({
      kind,
      x: position.x,
      y: anchorY,
      z: position.z,
      anchor,
      team: currentPlayerTeam,
      local: true,
      surface: kind === "impact" ? "metal" : kind === "snowball_impact" ? "snow" : undefined
    });
  };

  return (
    <div
      className={view === "fps" ? "arena-frame fps-view" : "arena-frame"}
      data-weapon-id={isAthleticsMode ? "none" : currentWeaponId ?? "starter_blaster"}
      data-zoom-level={zoomLevel}
    >
      <div className="arena-canvas" ref={mountRef} aria-label={isAthleticsMode ? "Skyline Adventure Park athletics course" : `${arenaMap.title} arena`} />
      {autoQualityNotice && quality === "auto" && !fallbackQuality && (
        <div className="arena-quality-notice" role="status" aria-live="polite">
          Graphics adjusted for smoother gameplay
        </div>
      )}
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
          {isAthleticsMode && currentPlayer?.athletics && (
            <>
              <span>Course {Math.round(currentPlayer.athletics.routeProgress * 100)}% · checkpoint {currentPlayer.athletics.checkpointIndex}/{ATHLETICS_STADIUM_COURSE.checkpoints.length}</span>
              <span>Lap {(currentPlayer.athletics.completedLaps ?? 0) + 1}/{session?.athletics?.requiredLaps ?? 1} · energy {Math.round(currentPlayer.energy ?? 0)}</span>
              <span>Ground normal 0,1,0 · fall boundary y &lt; 0.5 · {ATHLETICS_STADIUM_COURSE.movingObstacles.length} moving colliders</span>
              <span>Course bounds ±{ATHLETICS_COURSE_BOUNDS.limitX} × ±{ATHLETICS_COURSE_BOUNDS.limitZ}</span>
            </>
          )}
          {performanceSnapshot && (
            <>
              <span>{performanceSnapshot.fps} FPS · p95 {performanceSnapshot.frameMsP95} ms</span>
              <span>{performanceSnapshot.drawCalls} calls · {performanceSnapshot.triangles.toLocaleString()} tris</span>
              <span>{performanceSnapshot.longTasks} long tasks · {performanceSnapshot.heapMb ?? "n/a"} MB heap</span>
            </>
          )}
          {vfxDebugStats && (
            <span>VFX {vfxDebugStats.active}/{vfxDebugStats.budget.maxActive} · {vfxDebugStats.sprites} sprites · {vfxDebugStats.dropped} dropped</span>
          )}
        </div>
      )}
      {vfxDebugEnabled && (
        <div className="vfx-debug-panel" aria-label="VFX debug controls">
          <strong>VFX Debug</strong>
          <div>
            {VFX_DEBUG_CUES.map(([label, kind]) => (
              <button key={kind} type="button" onClick={() => triggerDebugVfx(kind)}>{label}</button>
            ))}
          </div>
        </div>
      )}
      {view === "fps" && (
        <>
          <ArenaHudOverlay
            hitPulse={hitPulse}
            hitConfirmPulse={hitConfirmPulse}
            zoomLevel={zoomLevel}
            currentWeaponId={currentWeaponId}
            snowballs={currentPlayer?.snowballs ?? session?.settings.startingSnowballs ?? 0}
            weaponCooldown={weaponCooldown}
            controlsDisabled={controlsDisabled || inputPaused}
            isPointerLocked={isPointerLocked}
            suppressHint={suppressHint}
            joystickElementRef={joystickElementRef}
            onBeginTouchMove={beginTouchMove}
            onZoomFromTouch={zoomFromTouch}
            onInteractFromTouch={onInteract ? interactFromTouch : undefined}
            onJumpFromTouch={isAthleticsMode ? jumpFromTouch : undefined}
            onQuestionFromTouch={isAthleticsMode ? questionFromTouch : undefined}
            athleticsHud={isAthleticsMode ? athleticsHud : undefined}
          />
          {!isAthleticsMode && zoomLevel > 0 && (
            <div key={`${zoomLevel}-${zoomPulse}`} className={`scope-overlay scope-level-${zoomLevel} scope-pulse`} aria-hidden="true">
              <span>Heavy Scope</span>
              <strong>{zoomLevel === 1 ? "3×" : "7×"}</strong>
            </div>
          )}
          {!isAthleticsMode && <ArenaMinimap
            arenaMap={arenaMap}
            arenaMapId={arenaMapId}
            arenaBounds={arenaBounds}
            teamBaseZones={teamBaseZones}
            captureZones={captureZones}
            searchRetrieveItems={searchRetrieveItems}
            searchRetrieveDeliveryZones={searchRetrieveDeliveryZones}
            hasMultipleLevels={hasMultipleLevels}
            miniMapLevel={miniMapLevel}
            miniMapPlayer={miniMapPlayer}
            displayedFlagPosition={displayedFlagPosition}
            session={session}
          />}
        </>
      )}
    </div>
  );
}
