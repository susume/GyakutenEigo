import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import {
  ARENA_LIMIT_X,
  ARENA_LIMIT_Z,
  ARENA_SCALE,
  CAPTURE_ZONES,
  FREE_FOR_ALL_SPAWNS,
  SEARCH_RETRIEVE_DELIVERY_ZONES,
  SEARCH_RETRIEVE_ITEMS,
  TEAM_BASE_ZONES,
  TEAM_SPAWNS,
  getGearFireCooldownMs,
  getGearZoomFovMultiplier,
  getPlayerMoveSpeedMultiplier,
  getPlayerWeaponId,
  getTeamSpawnForMap,
  type ArenaMapId,
  isGearAutoFireEnabled,
  type GameSession,
  type PlayerSession
} from "@quizstrike/shared";
import { getArenaMap } from "./arenaMaps";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_STANDING_EYE_HEIGHT,
  canFpsBodyClearObstacle,
  getFpsBodyVerticalBounds
} from "./ArenaCamera.js";
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
}

type ArenaLivePosition = { x: number; z: number; y?: number; facing: number; scoped?: boolean; zoomLevel?: number };

const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 10.8;
const RUN_SPEED = 14.8;
const CROUCH_SPEED = 6.4;
const FPS_BASE_FOV = 72;
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
const serverToLocalX = (x: number) => clamp(x, -ARENA_LIMIT_X, ARENA_LIMIT_X);
const serverToLocalZ = (z: number) => clamp(z, -ARENA_LIMIT_Z, ARENA_LIMIT_Z);
const toMiniMapX = (x: number) => ((x + ARENA_LIMIT_X) / (ARENA_LIMIT_X * 2)) * MINIMAP_WIDTH;
const toMiniMapY = (z: number) => ((z + ARENA_LIMIT_Z) / (ARENA_LIMIT_Z * 2)) * MINIMAP_HEIGHT;
const toMiniMapW = (w: number) => (w / (ARENA_LIMIT_X * 2)) * MINIMAP_WIDTH;
const toMiniMapH = (d: number) => (d / (ARENA_LIMIT_Z * 2)) * MINIMAP_HEIGHT;
const localToServerPosition = (position: THREE.Vector3, facing: number): ArenaLivePosition => ({
  x: clamp(position.x, -ARENA_LIMIT_X, ARENA_LIMIT_X),
  z: clamp(position.z, -ARENA_LIMIT_Z, ARENA_LIMIT_Z),
  y: Number(position.y.toFixed(2)),
  facing
});
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
  onInteract
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
  const sceneSessionId = session?.id ?? "training";
  const currentPlayerId = currentPlayer?.id ?? "";
  const currentPlayerTeam = currentPlayer?.team ?? "blue";
  const arenaMapId: ArenaMapId = session?.settings.mapId ?? "desert_citadel";
  const arenaMap = getArenaMap(arenaMapId);
  const activeQuality = resolveArenaQuality(fallbackQuality ?? quality);

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
    pendingShotsRef.current = 0;
  }, [currentPlayer?.id, currentPlayer?.snowballs, currentPlayer?.isAlive, currentPlayer?.gear, currentPlayer?.weapon, currentPlayer?.perks]);

  useEffect(() => {
    syncPlayersRef.current(session, currentPlayer);
  }, [session, currentPlayer]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setRenderError("");
    setPerformanceSnapshot(null);

    const isFps = view === "fps";
    const isZombieMode = session?.settings.gameMode === "zombie";
    const isIronJunction = arenaMapId === "iron_junction";
    const palette = arenaMap.palette;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isZombieMode ? "#5d668a" : palette.sky);
    scene.fog = new THREE.Fog(isZombieMode ? "#8f8395" : palette.fog, isFps ? 120 : 210, isFps ? 350 : 500);

    const camera = new THREE.PerspectiveCamera(isFps ? FPS_BASE_FOV : 52, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 620);
    const fallbackSpawn = currentPlayer ? getTeamSpawnForMap(arenaMapId, currentPlayer.team) : getTeamSpawnForMap(arenaMapId, "blue");
    const initialServerX = isFiniteNumber(currentPlayer?.x) ? currentPlayer.x : fallbackSpawn.x;
    const initialServerZ = isFiniteNumber(currentPlayer?.z) ? currentPlayer.z : fallbackSpawn.z;
    const playerPosition = new THREE.Vector3(serverToLocalX(initialServerX), FPS_STANDING_EYE_HEIGHT, serverToLocalZ(initialServerZ));
    let yaw = isFiniteNumber(currentPlayer?.facing) ? currentPlayer.facing : fallbackSpawn.facing;
    let pitch = -0.12;
    if (isFps) setMiniMapPosition(localToServerPosition(playerPosition, yaw));

    if (isFps) {
      camera.position.set(0, 0, 0);
    } else {
      camera.position.set(0, 238, 246);
      camera.lookAt(0, 0, 0);
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: activeQuality !== "performance", alpha: false, powerPreference: "high-performance" });
    } catch {
      setRenderError("WebGL is not available in this browser. Try updating the browser or enabling hardware acceleration.");
      return;
    }
    const qualityConfig = activeQuality === "performance"
      ? { pixelRatio: 1, shadows: false, anisotropy: 2, detail: 0 }
      : activeQuality === "balanced"
        ? { pixelRatio: 1.25, shadows: false, anisotropy: 4, detail: 1 }
        : { pixelRatio: 1.75, shadows: true, anisotropy: 8, detail: 2 };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityConfig.pixelRatio));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = !isFps && qualityConfig.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isFps ? 0.86 : 0.98;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.className = "arena-webgl";
    renderer.domElement.dataset.quality = activeQuality;
    mount.appendChild(renderer.domElement);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(560, 20, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(isZombieMode ? "#313b59" : isIronJunction ? "#53666d" : "#4c9ccc") },
          horizonColor: { value: new THREE.Color(isZombieMode ? "#8f8395" : palette.sky) },
          groundColor: { value: new THREE.Color(isZombieMode ? "#6b6174" : isIronJunction ? "#a9b7b2" : "#e6c88e") }
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
    const floorTexture = makeCanvasTexture(palette.floorTexture, palette.accent);
    const stoneTexture = makeCanvasTexture("stone", "#f6d98e");
    const woodTexture = makeCanvasTexture("wood", "#bb8652");
    const waterTexture = makeCanvasTexture("water", "#67e8f9");
    const sandTexture = makeCanvasTexture("sand", "#f2ca73");
    const metalTexture = makeCanvasTexture("metal", "#93a6ad");
    [floorTexture, stoneTexture, woodTexture, waterTexture, sandTexture, metalTexture].forEach((texture) => {
      texture.anisotropy = qualityConfig.anisotropy;
    });
    const surfaceAtlas = makeSurfaceAtlas({ stone: stoneTexture, wood: woodTexture, metal: metalTexture, sand: sandTexture });
    surfaceAtlas.anisotropy = qualityConfig.anisotropy;
    const staticBatcher = new ArenaStaticBatcher(surfaceAtlas, !isFps && qualityConfig.shadows);

    const materialCache = new Map<string, THREE.MeshStandardMaterial>();
    const materialFor = (color: string, material = "stone") => {
      const key = `${color}-${material}`;
      const cached = materialCache.get(key);
      if (cached) return cached;
      const texture = material === "wood"
        ? woodTexture
        : material === "metal"
          ? metalTexture
        : material === "water"
          ? waterTexture
          : material === "sand"
            ? sandTexture
            : material === "gravel"
              ? floorTexture
              : stoneTexture;
      const materialOptions: THREE.MeshStandardMaterialParameters = {
        color,
        roughness: material === "water" ? 0.18 : material === "cloth" ? 0.84 : material === "metal" ? 0.42 : 0.68,
        metalness: material === "water" ? 0.05 : material === "metal" ? 0.62 : 0.02,
        emissive: material === "water" || material === "accent" ? color : "#000000",
        emissiveIntensity: material === "water" ? 0.28 : material === "accent" ? 0.16 : 0,
        transparent: material === "water",
        opacity: material === "water" ? 0.84 : 1
      };
      if (material !== "cloth" && material !== "accent") {
        materialOptions.map = texture;
        if (material !== "water") {
          materialOptions.bumpMap = texture;
          materialOptions.bumpScale = material === "metal" ? 0.025 : 0.065;
        }
      }
      const next = new THREE.MeshStandardMaterial(materialOptions);
      materialCache.set(key, next);
      return next;
    };

    scene.add(new THREE.HemisphereLight(
      isZombieMode ? "#d8ddff" : isIronJunction ? "#d9edf0" : "#fff6d8",
      isZombieMode ? "#65556e" : isIronJunction ? "#354146" : "#8f7d6f",
      isFps ? 1.12 : 1.28
    ));

    const keyLight = new THREE.DirectionalLight(isZombieMode ? "#d9e1ff" : isIronJunction ? "#d6edf0" : "#fff0ca", isFps ? 2.18 : isIronJunction ? 2.35 : 2.72);
    keyLight.position.set(isIronJunction ? -120 : -85, 180, isIronJunction ? -60 : 95);
    keyLight.castShadow = !isFps;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -190;
    keyLight.shadow.camera.right = 190;
    keyLight.shadow.camera.top = 175;
    keyLight.shadow.camera.bottom = -175;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(isZombieMode ? "#b7a8de" : isIronJunction ? "#f3b47a" : "#ffe7bd", isFps ? 1.22 : 0.82);
    fillLight.position.set(110, 80, -130);
    scene.add(fillLight);

    if (!isIronJunction) {
      const aqueductLight = new THREE.PointLight("#53e7ff", 42, 135, 2);
      aqueductLight.position.set(0, 7, 0);
      scene.add(aqueductLight);
    }

    const addBaseBeacon = (team: "blue" | "red", color: string) => {
      const base = TEAM_BASE_ZONES[team];
      const x = team === "blue" ? base.minX + 4.5 : base.maxX - 4.5;
      const z = (base.minZ + base.maxZ) / 2;
      const beacon = new THREE.Group();
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(4.8, 5.4, 0.6, 12),
        materialFor(team === "blue" ? "#27485d" : "#5a343a", "metal")
      );
      plinth.position.y = 0.3;
      beacon.add(plinth);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 1.05, 8, 10),
        new THREE.MeshStandardMaterial({ color: "#fff7df", emissive: color, emissiveIntensity: 0.5, roughness: 0.36 })
      );
      pillar.position.y = 4;
      beacon.add(pillar);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.4, 0.16, 8, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.66 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.16;
      beacon.add(ring);
      const crown = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.95, 0),
        new THREE.MeshStandardMaterial({ color: "#f3fbff", emissive: color, emissiveIntensity: 0.85, roughness: 0.22 })
      );
      crown.position.y = 8.9;
      beacon.add(crown);
      if (qualityConfig.detail === 2) {
        for (let index = 0; index < 4; index += 1) {
          const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
          const pylon = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 3.6, 0.42),
            materialFor(team === "blue" ? "#8cd9ff" : "#ff9d9d", "metal")
          );
          pylon.position.set(Math.cos(angle) * 3.7, 1.8, Math.sin(angle) * 3.7);
          pylon.rotation.y = -angle;
          beacon.add(pylon);
        }
      }
      beacon.position.set(x, 0, z);
      scene.add(beacon);
      if (activeQuality !== "performance") {
        const accentLight = new THREE.PointLight(color, isFps ? 9 : 16, 42, 2);
        accentLight.position.set(x, 7, z);
        scene.add(accentLight);
      }
    };
    addBaseBeacon("blue", "#38bdf8");
    addBaseBeacon("red", isZombieMode ? "#c084fc" : "#fb7185");

    let flagMarker: THREE.Group | undefined;
    if (session?.settings.gameMode === "flag" && session.flag) {
      const carrier = session.flag.carrierId ? session.players.find((player) => player.id === session.flag?.carrierId) : undefined;
      const markerX = carrier?.x ?? session.flag.position.x;
      const markerZ = carrier?.z ?? session.flag.position.z;
      flagMarker = new THREE.Group();
      const markerColor = session.flag.state === "placed" ? "#facc15" : "#fb7185";
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 8.8, 8),
        new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.42, roughness: 0.35 })
      );
      pole.position.y = 4.4;
      flagMarker.add(pole);
      if (isFps) {
        const objectiveCore = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.72, 0),
          new THREE.MeshStandardMaterial({ color: "#fff7ed", emissive: markerColor, emissiveIntensity: 0.9, roughness: 0.24 })
        );
        objectiveCore.position.y = 7.6;
        flagMarker.add(objectiveCore);
      } else {
        const fabric = new THREE.Mesh(
          new THREE.PlaneGeometry(3.2, 1.55, 2, 1),
          new THREE.MeshStandardMaterial({
            color: markerColor,
            emissive: markerColor,
            emissiveIntensity: 0.22,
            roughness: 0.82,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
          })
        );
        fabric.position.set(1.55, 6.5, 0);
        fabric.rotation.y = Math.PI / 2;
        flagMarker.add(fabric);
      }
      const objectiveRing = new THREE.Mesh(
        new THREE.TorusGeometry(4.8, 0.2, 8, 32),
        new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.72 })
      );
      objectiveRing.position.y = 0.23;
      objectiveRing.rotation.x = Math.PI / 2;
      flagMarker.add(objectiveRing);
      const flagGlow = new THREE.PointLight(markerColor, activeQuality === "performance" ? 0 : 18, 42, 2);
      flagGlow.position.y = 5;
      flagMarker.add(flagGlow);
      flagMarker.position.set(markerX, 0, markerZ);
      scene.add(flagMarker);
    }

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_LIMIT_X * 2, 0.3, ARENA_LIMIT_Z * 2),
      new THREE.MeshStandardMaterial({ map: floorTexture, color: palette.floor, roughness: 0.88, metalness: 0.01 })
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(ARENA_LIMIT_X * 2, 35, arenaMapId === "iron_junction" ? "#aeb8b5" : "#fff1c1", arenaMapId === "iron_junction" ? "#566266" : "#ad7b45");
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.13;
    if (activeQuality !== "performance") scene.add(grid);

    const coverBoxes: THREE.Box3[] = [];
    const collisionProxyMaterial = new THREE.MeshBasicMaterial({ visible: false, colorWrite: false, depthWrite: false });
    const colliderForObject = (object: THREE.Object3D, pad = 0.25) => {
      coverBoxes.push(new THREE.Box3().setFromObject(object).expandByScalar(pad));
    };

    const addDecorativeMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, material = "stone") => {
      const mesh = new THREE.Mesh(geometry, materialFor(color, material));
      staticBatcher.prepare(mesh, color, material);
      parent.add(mesh);
      return mesh;
    };

    const addBlockDetail = (block: (typeof arenaMap.blocks)[number]) => {
      if (!block.style || qualityConfig.detail === 0) return;
      const detail = new THREE.Group();
      detail.position.set(block.x, block.y ?? 0, block.z);
      detail.rotation.y = block.rotationY ?? 0;
      scene.add(detail);
      const stoneTone = block.material === "wood" ? block.color : paleStone;
      const structuralStyle = ["wall", "ruin", "gate", "house", "tower", "shed", "machinery"].includes(block.style);

      if (structuralStyle) {
        const foundation = addDecorativeMesh(
          detail,
          new THREE.BoxGeometry(block.w * 1.025, Math.min(0.48, Math.max(0.22, block.h * 0.065)), block.d * 1.025),
          block.material === "metal" ? darkSteel : block.material === "wood" ? "#49311f" : "#846744",
          block.material === "metal" ? "metal" : block.material === "wood" ? "wood" : "stone"
        );
        foundation.position.y = Math.min(0.24, block.h * 0.04);
      }

      if (block.style === "wall") {
        addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.98, 0.28, block.d * 1.08), stoneTone);
        const crenelCount = Math.min(10, Math.max(2, Math.floor(block.w / 22)));
        for (let index = 0; index < crenelCount; index += 1) {
          const x = -block.w / 2 + ((index + 0.5) / crenelCount) * block.w;
          const crenel = addDecorativeMesh(detail, new THREE.BoxGeometry(Math.min(3.6, block.w / crenelCount * 0.55), 0.85, block.d * 1.1), stoneTone);
          crenel.position.set(x, block.h + 0.56, 0);
        }
        if (qualityConfig.detail === 2) {
          const supportCount = Math.min(8, Math.max(2, Math.floor(block.w / 24)));
          for (let index = 0; index < supportCount; index += 1) {
            const x = -block.w / 2 + ((index + 0.5) / supportCount) * block.w;
            const buttress = addDecorativeMesh(detail, new THREE.BoxGeometry(0.5, block.h * 0.72, block.d * 1.24), darkStone);
            buttress.position.set(x, block.h * 0.36, 0);
          }
          const course = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 1.01, 0.22, block.d * 1.14), "#e5c98f");
          course.position.y = block.h * 0.62;
        }
      }

      if (block.style === "ruin") {
        const alongX = block.w >= block.d;
        const chunkCount = alongX ? 3 : 2;
        for (let index = 0; index < chunkCount; index += 1) {
          const span = alongX ? block.w : block.d;
          const chunk = addDecorativeMesh(detail, new THREE.BoxGeometry(
            alongX ? span / chunkCount * 0.72 : block.w * 0.95,
            0.65 + (index % 2) * 0.42,
            alongX ? block.d * 1.04 : span / chunkCount * 0.7
          ), index % 2 === 0 ? paleStone : stoneTone);
          const offset = -span / 2 + (index + 0.5) * (span / chunkCount);
          chunk.position.set(alongX ? offset : 0, block.h + 0.35 + (index % 2) * 0.2, alongX ? 0 : offset);
          chunk.rotation.y = (index - 1) * 0.08;
        }
      }

      if (block.style === "gate") {
        const brace = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.68, Math.min(0.42, block.h * 0.08), Math.max(0.18, block.d * 0.76)), wood, "wood");
        brace.position.y = Math.min(block.h * 0.7, 4.8);
        for (const x of [-block.w * 0.28, block.w * 0.28]) {
          const post = addDecorativeMesh(detail, new THREE.BoxGeometry(0.28, block.h * 0.78, 0.28), "#b98950", "wood");
          post.position.set(x, block.h * 0.42, block.d * 0.4);
        }
        if (qualityConfig.detail === 2) {
          const crest = addDecorativeMesh(detail, new THREE.TorusGeometry(Math.min(block.w, block.h) * 0.16, 0.12, 6, 18, Math.PI), "#e9c77f", "metal");
          crest.position.set(0, block.h * 0.78, -block.d * 0.51);
          crest.rotation.z = Math.PI;
        }
      }

      if (block.style === "stall") {
        const canopy = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 1.12, 0.22, block.d * 1.3), block.color, "cloth");
        canopy.position.y = block.h + 1.6;
        for (const x of [-block.w * 0.42, block.w * 0.42]) {
          const post = addDecorativeMesh(detail, new THREE.CylinderGeometry(0.12, 0.16, Math.max(2.6, block.h + 1.4), 8), "#b9874c", "wood");
          post.position.set(x, (block.h + 1.4) / 2, 0);
        }
        if (qualityConfig.detail === 2) {
          for (const x of [-block.w * 0.32, 0, block.w * 0.32]) {
            const stripe = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.16, 0.235, block.d * 1.32), x === 0 ? "#f4dfb4" : block.color, "cloth");
            stripe.position.set(x, block.h + 1.61, 0);
          }
        }
      }

      if (block.style === "house") {
        const roof = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.94, 0.24, block.d * 0.94), block.color, "stone");
        roof.position.y = block.h + 0.18;
        const beam = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.7, 0.18, 0.22), wood, "wood");
        beam.position.set(0, Math.min(block.h * 0.65, 4.5), block.d * 0.5 + 0.12);
        const roofTrim = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 1.04, 0.34, block.d * 1.04), stoneTone, "stone");
        roofTrim.position.y = block.h + 0.38;
        if (qualityConfig.detail === 2) {
          for (const x of [-block.w * 0.33, block.w * 0.33]) {
            const windowFrame = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.18, Math.min(1.8, block.h * 0.24), 0.14), "#375d69", "accent");
            windowFrame.position.set(x, block.h * 0.58, -block.d * 0.505);
            const sill = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.22, 0.16, 0.32), "#e1c58e", "stone");
            sill.position.set(x, block.h * 0.45, -block.d * 0.51);
          }
          for (const x of [-block.w * 0.46, block.w * 0.46]) {
            const corner = addDecorativeMesh(detail, new THREE.BoxGeometry(0.38, block.h * 0.9, block.d * 1.035), "#b68b58", "stone");
            corner.position.set(x, block.h * 0.48, 0);
          }
        }
      }

      if (block.style === "channel" && block.material !== "water") {
        const coping = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 1.04, 0.22, block.d * 1.3), "#b7b09a");
        coping.position.y = block.h + 0.14;
      }

      if (block.style === "bridge") {
        for (const z of [-block.d * 0.46, block.d * 0.46]) {
          const rail = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.92, 0.38, 0.18), "#b7a27c");
          rail.position.set(0, block.h + 0.35, z);
        }
      }

      if (block.style === "tower") {
        const battlementCount = Math.max(3, Math.min(6, Math.floor(block.w / 3.5)));
        for (let index = 0; index < battlementCount; index += 1) {
          const cap = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w / battlementCount * 0.55, 0.8, block.d * 0.18), paleStone);
          cap.position.set(-block.w / 2 + (index + 0.5) * block.w / battlementCount, block.h + 0.45, block.d / 2 - block.d * 0.12);
        }
        if (qualityConfig.detail === 2) {
          for (const x of [-block.w * 0.43, block.w * 0.43]) {
            for (const z of [-block.d * 0.43, block.d * 0.43]) {
              const pier = addDecorativeMesh(detail, new THREE.BoxGeometry(0.65, block.h * 0.82, 0.65), "#846744", "stone");
              pier.position.set(x, block.h * 0.42, z);
            }
          }
          const arenaBand = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 1.025, 0.42, block.d * 1.025), "#d8b46f", "metal");
          arenaBand.position.y = block.h * 0.68;
        }
      }

      if (block.style === "sandbank") {
        detail.scale.y = 0.5;
        const lip = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.85, 0.18, block.d * 0.65), "#e6bf76", "sand");
        lip.position.y = block.h + 0.12;
      }

      if (block.style === "railcar") {
        const roof = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.88, 0.28, block.d * 0.9), "#a85c3d", "metal");
        roof.position.y = block.h + 0.2;
        for (const x of [-block.w * 0.28, block.w * 0.28]) {
          const wheel = addDecorativeMesh(detail, new THREE.CylinderGeometry(0.85, 0.85, 0.35, 12), "#222b2d", "metal");
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(x, 0.7, block.d * 0.54);
        }
      }

      if (block.style === "gantry") {
        const beam = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 1.7, 0.6, block.d * 0.42), rust, "metal");
        beam.position.y = block.h + 0.5;
        const brace = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.22, block.h * 0.9, block.d * 0.32), warning, "metal");
        brace.position.set(0, block.h * 0.48, 0);
      }

      if (block.style === "shed") {
        const roof = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 1.04, 0.28, block.d * 1.04), block.material === "wood" ? timber : steel, block.material === "wood" ? "wood" : "metal");
        roof.position.y = block.h + 0.2;
        for (const x of [-block.w * 0.38, block.w * 0.38]) {
          const post = addDecorativeMesh(detail, new THREE.BoxGeometry(0.22, block.h * 0.9, 0.22), block.material === "wood" ? timber : warning, block.material === "wood" ? "wood" : "metal");
          post.position.set(x, block.h * 0.45, block.d * 0.48);
        }
      }

      if (block.style === "machinery") {
        for (const x of [-block.w * 0.3, 0, block.w * 0.3]) {
          const pipe = addDecorativeMesh(detail, new THREE.CylinderGeometry(0.16, 0.16, block.h * 1.1, 8), warning, "metal");
          pipe.position.set(x, block.h * 0.62, 0);
        }
        const top = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.86, 0.32, block.d * 0.7), darkSteel, "metal");
        top.position.y = block.h + 0.4;
      }

      if (block.style === "logstack") {
        for (let row = 0; row < 3; row += 1) {
          const log = addDecorativeMesh(detail, new THREE.CylinderGeometry(1.35, 1.35, block.w * 0.86, 10), timber, "wood");
          log.rotation.z = Math.PI / 2;
          log.position.set(0, 1.25 + row * 1.9, (row % 2 ? 1 : -1) * block.d * 0.18);
        }
      }

      if (block.style === "rock") {
        const rock = addDecorativeMesh(detail, new THREE.IcosahedronGeometry(Math.max(block.w, block.d) * 0.34, 1), block.color, "stone");
        rock.scale.y = 0.72;
        rock.position.y = block.h * 0.42;
      }

    };

    const addModularBlockBody = (block: (typeof arenaMap.blocks)[number]) => {
      const group = new THREE.Group();
      group.name = `modular_${block.id}`;
      group.position.set(block.x, block.y ?? block.h / 2, block.z);
      group.rotation.y = block.rotationY ?? 0;
      scene.add(group);
      const structural = ["wall", "ruin", "gate", "house", "tower", "shed", "machinery", "railcar", "gantry"].includes(block.style ?? "");
      if (qualityConfig.detail === 0 || !structural || block.material === "water") {
        const body = new THREE.Mesh(new THREE.BoxGeometry(block.w, block.h, block.d), materialFor(block.color, block.material ?? "stone"));
        if (block.material === "water") {
          body.castShadow = false;
          body.receiveShadow = true;
          group.add(body);
        } else {
          staticBatcher.prepare(body, block.color, block.material ?? "stone");
          group.add(body);
        }
        return group;
      }
      const surface = block.material ?? "stone";
      const bayCount = Math.max(1, Math.min(8, Math.ceil(block.w / 18)));
      const bayWidth = block.w / bayCount;
      const seam = Math.min(0.22, bayWidth * 0.025);
      for (let index = 0; index < bayCount; index += 1) {
        const x = -block.w / 2 + bayWidth * (index + 0.5);
        for (const z of [-block.d / 2, block.d / 2]) {
          const panel = addDecorativeMesh(group, new THREE.BoxGeometry(Math.max(0.25, bayWidth - seam), block.h * 0.94, 0.34), block.color, surface);
          panel.position.set(x, -block.h * 0.02, z);
        }
      }
      const sideCount = Math.max(1, Math.min(5, Math.ceil(block.d / 16)));
      const sideDepth = block.d / sideCount;
      for (let index = 0; index < sideCount; index += 1) {
        const z = -block.d / 2 + sideDepth * (index + 0.5);
        for (const x of [-block.w / 2, block.w / 2]) {
          const panel = addDecorativeMesh(group, new THREE.BoxGeometry(0.34, block.h * 0.94, Math.max(0.25, sideDepth - seam)), block.color, surface);
          panel.position.set(x, -block.h * 0.02, z);
        }
      }
      const cornerColor = surface === "metal" ? darkSteel : surface === "wood" ? "#4b3221" : darkStone;
      for (const x of [-block.w / 2, block.w / 2]) {
        for (const z of [-block.d / 2, block.d / 2]) {
          const pier = addDecorativeMesh(group, new THREE.BoxGeometry(0.68, block.h, 0.68), cornerColor, surface);
          pier.position.set(x, 0, z);
        }
      }
      const roof = addDecorativeMesh(group, new THREE.BoxGeometry(block.w * 1.025, 0.32, block.d * 1.025), surface === "metal" ? rust : paleStone, surface);
      roof.position.y = block.h / 2 + 0.1;
      return group;
    };

    const addBlock = (block: (typeof arenaMap.blocks)[number]) => {
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(block.w, block.h, block.d), collisionProxyMaterial);
      proxy.name = `collision_proxy_${block.id}`;
      proxy.position.set(block.x, block.y ?? block.h / 2, block.z);
      proxy.rotation.y = block.rotationY ?? 0;
      proxy.visible = false;
      proxy.userData.collisionProxy = true;
      scene.add(proxy);
      if (block.collides) colliderForObject(proxy, 0.25);
      addModularBlockBody(block);
      addBlockDetail(block);
      if (block.label && !isFps) {
        const label = new THREE.Sprite(makeSpriteLabel(block.label, "#fef3c7"));
        label.position.set(block.x, (block.y ?? block.h) + block.h / 2 + 6, block.z);
        label.scale.set(22, 7.5, 1);
        scene.add(label);
      }
      return proxy;
    };
    arenaMap.blocks.forEach(addBlock);

    const addProp = (prop: (typeof arenaMap.props)[number]) => {
      const group = new THREE.Group();
      group.position.set(prop.x, prop.y ?? 0, prop.z);
      group.rotation.y = prop.rotationY ?? 0;
      scene.add(group);
      const height = prop.h ?? Math.max(3, prop.size);
      const propMaterial = prop.material ?? "stone";

      if (prop.kind === "arch") {
        const columnWidth = Math.max(0.8, prop.size * 0.16);
        for (const x of [-prop.size * 0.42, prop.size * 0.42]) {
          const column = addDecorativeMesh(group, new THREE.BoxGeometry(columnWidth, height, prop.size * 0.32), prop.color, propMaterial);
          column.position.set(x, height / 2, 0);
        }
        const lintel = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size, Math.max(0.8, prop.size * 0.16), prop.size * 0.36), prop.color, propMaterial);
        lintel.position.y = height - Math.max(0.4, prop.size * 0.08);
        if (qualityConfig.detail === 2) {
          const archFace = addDecorativeMesh(
            group,
            new THREE.TorusGeometry(prop.size * 0.33, Math.max(0.16, prop.size * 0.055), 7, 20, Math.PI),
            paleStone,
            propMaterial
          );
          archFace.position.set(0, height - prop.size * 0.18, -prop.size * 0.19);
        }
      }

      if (prop.kind === "banner") {
        const pole = addDecorativeMesh(group, new THREE.CylinderGeometry(0.1, 0.14, height, 8), "#c49a5b", "wood");
        pole.position.y = height / 2;
        const fabric = addDecorativeMesh(group, new THREE.PlaneGeometry(prop.size * 1.3, prop.size * 1.7), prop.color, "cloth");
        fabric.position.set(prop.size * 0.62, height * 0.7, 0);
        fabric.rotation.y = Math.PI / 2;
        const crossbar = addDecorativeMesh(group, new THREE.CylinderGeometry(0.08, 0.08, prop.size * 1.45, 8), "#c49a5b", "wood");
        crossbar.rotation.z = Math.PI / 2;
        crossbar.position.set(prop.size * 0.58, height * 0.92, 0);
      }

      if (prop.kind === "column") {
        const column = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.4, prop.size * 0.52, height, 10), prop.color, propMaterial);
        column.position.y = height / 2;
        const capital = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.58, prop.size * 0.58, 0.3, 10), paleStone);
        capital.position.y = height + 0.12;
      }

      if (prop.kind === "cart") {
        const body = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * 1.55, prop.size * 0.42, prop.size), prop.color, "wood");
        body.position.y = prop.size * 0.65;
        for (const x of [-prop.size * 0.58, prop.size * 0.58]) {
          const wheel = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.35, prop.size * 0.35, 0.28, 14), "#3c2a1d", "wood");
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(x, prop.size * 0.42, prop.size * 0.56);
        }
        const load = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * 0.9, prop.size * 0.45, prop.size * 0.7), "#a36b37", "wood");
        load.position.set(0, prop.size * 1.05, 0);
      }

      if (prop.kind === "crate") {
        const lower = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size, Math.min(height * 0.55, prop.size), prop.size), prop.color, "wood");
        lower.position.y = Math.min(height * 0.28, prop.size * 0.5);
        const upper = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * 0.72, Math.min(height * 0.35, prop.size * 0.7), prop.size * 0.72), prop.color, "wood");
        upper.position.y = Math.min(height * 0.76, prop.size * 1.1);
        if (qualityConfig.detail === 2) {
          for (const y of [prop.size * 0.22, prop.size * 0.72]) {
            const band = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * 1.04, 0.12, prop.size * 1.04), "#51341f", "wood");
            band.position.y = y;
          }
          for (const x of [-prop.size * 0.36, prop.size * 0.36]) {
            const slat = addDecorativeMesh(group, new THREE.BoxGeometry(0.12, prop.size * 0.78, prop.size * 1.03), "#c58a47", "wood");
            slat.position.set(x, prop.size * 0.46, 0);
          }
        }
      }

      if (prop.kind === "debris") {
        for (let index = 0; index < 3; index += 1) {
          const chunk = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * (0.34 + index * 0.08), prop.h ?? 1.4, prop.size * (0.28 + (2 - index) * 0.08)), index === 1 ? paleStone : prop.color);
          chunk.position.set((index - 1) * prop.size * 0.3, (prop.h ?? 1.4) / 2 + index * 0.12, (index % 2 ? 1 : -1) * prop.size * 0.12);
          chunk.rotation.y = (index - 1) * 0.22;
        }
      }

      if (prop.kind === "lamp") {
        const pole = addDecorativeMesh(group, new THREE.CylinderGeometry(0.12, 0.16, height, 8), "#704a2d", "wood");
        pole.position.y = height / 2;
        const glow = addDecorativeMesh(group, new THREE.SphereGeometry(prop.size * 0.45, 12, 8), prop.color, "accent");
        glow.position.y = height + prop.size * 0.2;
        const shade = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.62, prop.size * 0.34, prop.size * 0.4, 10, 1, true), "#3d4548", "metal");
        shade.position.y = height + prop.size * 0.42;
        if (activeQuality !== "performance") {
          const light = new THREE.PointLight(prop.color, isFps ? 2.5 : 5, 18, 2);
          light.position.y = height + prop.size * 0.2;
          group.add(light);
        }
      }

      if (prop.kind === "palm") {
        const trunk = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.18, prop.size * 0.32, height, 8), prop.color, "wood");
        trunk.position.y = height / 2;
        for (let index = 0; index < 5; index += 1) {
          const leaf = addDecorativeMesh(group, new THREE.ConeGeometry(prop.size * 0.16, prop.size * 1.4, 5), "#6f8b50", "accent");
          leaf.position.set(Math.cos(index * 1.26) * prop.size * 0.55, height + 0.15, Math.sin(index * 1.26) * prop.size * 0.55);
          leaf.rotation.z = Math.PI / 2.6;
          leaf.rotation.y = index * 1.26;
        }
      }

      if (prop.kind === "pipe") {
        const pipe = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.24, prop.size * 0.24, height, 12), prop.color, propMaterial);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.y = prop.size * 0.5;
      }

      if (prop.kind === "shade") {
        const postHeight = Math.max(2.8, height - 0.8);
        for (const x of [-prop.size * 0.48, prop.size * 0.48]) {
          for (const z of [-prop.size * 0.42, prop.size * 0.42]) {
            const post = addDecorativeMesh(group, new THREE.CylinderGeometry(0.1, 0.14, postHeight, 8), "#9b6a40", "wood");
            post.position.set(x, postHeight / 2, z);
          }
        }
        const canopy = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * 1.25, 0.22, prop.size), prop.color, "cloth");
        canopy.position.y = postHeight + 0.15;
      }

      if (prop.kind === "tree") {
        const trunk = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.16, prop.size * 0.24, height, 8), prop.color, "wood");
        trunk.position.y = height / 2;
        for (let index = 0; index < 5; index += 1) {
          const crown = addDecorativeMesh(group, new THREE.IcosahedronGeometry(prop.size * 0.5, 1), ["#a54f32", "#c4773e", "#7f5b36"][index % 3], "accent");
          crown.position.set(Math.cos(index * 1.25) * prop.size * 0.38, height * 0.82 + (index % 2) * 0.7, Math.sin(index * 1.25) * prop.size * 0.38);
        }
      }

      if (prop.kind === "rail") {
        for (const z of [-prop.size * 0.08, prop.size * 0.08]) {
          const rail = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size, 0.14, 0.12), prop.color, "metal");
          rail.position.set(0, 0.16, z);
        }
        for (let x = -prop.size / 2; x <= prop.size / 2; x += Math.max(2, prop.size / 6)) {
          const sleeper = addDecorativeMesh(group, new THREE.BoxGeometry(0.32, 0.12, prop.size * 0.22), timber, "wood");
          sleeper.position.set(x, 0.08, 0);
        }
      }

      if (prop.kind === "cable") {
        const mast = addDecorativeMesh(group, new THREE.CylinderGeometry(0.14, 0.2, height, 8), steel, "metal");
        mast.position.y = height / 2;
        const cable = addDecorativeMesh(group, new THREE.CylinderGeometry(0.08, 0.08, prop.size, 8), prop.color, "metal");
        cable.rotation.z = Math.PI / 2;
        cable.position.y = height;
      }

      if (prop.kind === "signal") {
        const pole = addDecorativeMesh(group, new THREE.CylinderGeometry(0.12, 0.16, height, 8), steel, "metal");
        pole.position.y = height / 2;
        const signal = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * 0.8, prop.size * 1.2, 0.35), prop.color, "accent");
        signal.position.y = height * 0.84;
      }

      if (prop.kind === "steam") {
        const steam = new THREE.Mesh(
          new THREE.SphereGeometry(prop.size * 0.55, 10, 8),
          new THREE.MeshBasicMaterial({ color: prop.color, transparent: true, opacity: 0.18, depthWrite: false })
        );
        steam.position.y = height;
        group.add(steam);
      }

      if (prop.kind === "winch") {
        const drum = addDecorativeMesh(group, new THREE.CylinderGeometry(prop.size * 0.48, prop.size * 0.48, prop.size * 0.7, 12), prop.color, "metal");
        drum.rotation.z = Math.PI / 2;
        drum.position.y = prop.size * 0.7;
        const arm = addDecorativeMesh(group, new THREE.BoxGeometry(prop.size * 0.18, height, prop.size * 0.18), steel, "metal");
        arm.position.y = height / 2;
      }
    };

    const lowQualityLandmarks = new Set(["arch", "banner", "lamp", "rail", "signal"]);
    arenaMap.props.forEach((prop) => {
      if (qualityConfig.detail === 0 && !lowQualityLandmarks.has(prop.kind)) return;
      addProp(prop);
    });

    arenaMap.cylinders.forEach((cylinder) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(cylinder.radius * 0.88, cylinder.radius, cylinder.h, 24),
        materialFor(cylinder.color, cylinder.material ?? "stone")
      );
      mesh.position.set(cylinder.x, cylinder.y ?? cylinder.h / 2, cylinder.z);
      mesh.castShadow = !isFps;
      mesh.receiveShadow = true;
      if (cylinder.material !== "water") staticBatcher.prepare(mesh, cylinder.color, cylinder.material ?? "stone");
      scene.add(mesh);
      if (cylinder.collides) colliderForObject(mesh, 0.2);
      if (cylinder.label && !isFps) {
        const label = new THREE.Sprite(makeSpriteLabel(cylinder.label, "#fef3c7"));
        label.position.set(cylinder.x, (cylinder.y ?? cylinder.h) + cylinder.h / 2 + 5, cylinder.z);
        label.scale.set(22, 7.5, 1);
        scene.add(label);
      }
    });

    const addFloorLabel = (label: string, x: number, z: number, width: number, depth: number, color: string, rotation = 0) => {
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({
          map: makeLabelTexture(label, color, "rgba(53, 35, 16, 0.66)"),
          transparent: true,
          opacity: 0.88,
          depthWrite: false
        })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.rotation.z = rotation;
      marker.position.set(x, 0.045, z);
      scene.add(marker);
      return marker;
    };

    arenaMap.floorMarks.forEach((mark) => addFloorLabel(mark.label, mark.x, mark.z, mark.w, mark.d, mark.color, mark.rotation));

    const addWallSign = (label: string, x: number, z: number, color: string, rotationY = 0, y = 7) => {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 8),
        new THREE.MeshBasicMaterial({
          map: makeLabelTexture(label, color),
          transparent: true,
          opacity: 0.94,
          depthWrite: false
        })
      );
      sign.position.set(x, y, z);
      sign.rotation.y = rotationY;
      scene.add(sign);
    };
    // Overview labels help teachers orient to the map, but billboard-scale signs would
    // become misleading visual cover at first-person distance.
    if (!isFps) arenaMap.signs.forEach((sign) => addWallSign(sign.label, sign.x, sign.z, sign.color, sign.rotationY, sign.y));

    const addCircle = (x: number, z: number, radius: number, color: string, opacity = 0.24) => {
      const circle = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
      );
      circle.rotation.x = -Math.PI / 2;
      circle.position.set(x, 0.07, z);
      scene.add(circle);
      return circle;
    };

    CAPTURE_ZONES.forEach((zone) => {
      addCircle(zone.x, zone.z, zone.radius, "#facc15", 0.18);
      const terminal = new THREE.Group();
      terminal.position.set(zone.x, 0.085, zone.z);
      const terminalRing = addDecorativeMesh(terminal, new THREE.TorusGeometry(Math.max(1.2, zone.radius * 0.18), 0.1, 6, 24), "#facc15", "accent");
      terminalRing.rotation.x = Math.PI / 2;
      for (let index = -1; index <= 1; index += 1) {
        const answerPad = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.max(0.7, zone.radius * 0.11), Math.max(0.9, zone.radius * 0.16)),
          new THREE.MeshBasicMaterial({
            color: ["#38bdf8", "#facc15", "#fb7185"][index + 1],
            transparent: true,
            opacity: 0.52,
            depthWrite: false
          })
        );
        answerPad.rotation.x = -Math.PI / 2;
        answerPad.position.set(index * Math.max(0.9, zone.radius * 0.14), 0.012, 0);
        terminal.add(answerPad);
      }
      scene.add(terminal);
      if (!isFps) {
        const label = new THREE.Sprite(makeSpriteLabel(zone.label, "#fde68a"));
        label.position.set(zone.x, 12, zone.z);
        label.scale.set(22, 7.5, 1);
        scene.add(label);
      }
    });

    SEARCH_RETRIEVE_ITEMS.forEach((item) => {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(3.2),
        new THREE.MeshStandardMaterial({ color: "#f8fafc", emissive: "#67e8f9", emissiveIntensity: 0.52, roughness: 0.2 })
      );
      gem.position.set(item.x, 4.2, item.z);
      scene.add(gem);
    });
    addCircle(SEARCH_RETRIEVE_DELIVERY_ZONES.blue.x, SEARCH_RETRIEVE_DELIVERY_ZONES.blue.z, SEARCH_RETRIEVE_DELIVERY_ZONES.blue.radius, "#38bdf8", 0.16);
    addCircle(SEARCH_RETRIEVE_DELIVERY_ZONES.red.x, SEARCH_RETRIEVE_DELIVERY_ZONES.red.z, SEARCH_RETRIEVE_DELIVERY_ZONES.red.radius, "#fb7185", 0.16);

    TEAM_SPAWNS.blue.forEach((spawn) => addCircle(spawn.x, spawn.z, 2.2, "#38bdf8", isFps ? 0.08 : 0.28));
    TEAM_SPAWNS.red.forEach((spawn) => addCircle(spawn.x, spawn.z, 2.2, "#fb7185", isFps ? 0.08 : 0.28));
    if (!isFps) FREE_FOR_ALL_SPAWNS.forEach((spawn) => addCircle(spawn.x, spawn.z, 1.3, "#ffffff", 0.18));

    if (!isIronJunction) {
      for (const [x, z, sx, sz] of [
        [-120, -176, 58, 12],
        [116, -176, 48, 10],
        [-142, 174, 42, 10],
        [112, 176, 58, 12],
        [-190, -42, 16, 70],
        [190, 38, 16, 70]
      ] as const) {
        const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10), materialFor("#c99d5a", "sand"));
        dune.position.set(scaleArenaValue(x), -0.05, scaleArenaValue(z));
        dune.scale.set(scaleArenaValue(sx), 2.1, scaleArenaValue(sz));
        dune.receiveShadow = true;
        scene.add(dune);
      }
    }

    if (qualityConfig.detail === 2) {
      const rockCount = qualityConfig.detail === 2 ? 34 : 20;
      const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
      const rockInstances = new THREE.InstancedMesh(rockGeometry, materialFor("#8f704d", "stone"), rockCount);
      const rockMatrix = new THREE.Matrix4();
      const rockPosition = new THREE.Vector3();
      const rockRotation = new THREE.Quaternion();
      const rockScale = new THREE.Vector3();
      const random = seededRandom(arenaMapId === "iron_junction" ? 913 : 617);
      for (let index = 0; index < rockCount; index += 1) {
        const onHorizontalEdge = index % 2 === 0;
        rockPosition.set(
          onHorizontalEdge ? (random() * 2 - 1) * (ARENA_LIMIT_X - 9) : (random() > 0.5 ? -1 : 1) * (ARENA_LIMIT_X - 5 - random() * 5),
          0.28 + random() * 0.45,
          onHorizontalEdge ? (random() > 0.5 ? -1 : 1) * (ARENA_LIMIT_Z - 5 - random() * 5) : (random() * 2 - 1) * (ARENA_LIMIT_Z - 9)
        );
        rockRotation.setFromEuler(new THREE.Euler(random() * 0.4, random() * Math.PI, random() * 0.25));
        rockScale.set(0.4 + random() * 1.2, 0.32 + random() * 0.62, 0.45 + random() * 1.3);
        rockMatrix.compose(rockPosition, rockRotation, rockScale);
        rockInstances.setMatrixAt(index, rockMatrix);
      }
      rockInstances.instanceMatrix.needsUpdate = true;
      rockInstances.receiveShadow = true;
      scene.add(rockInstances);
    }

    if (isIronJunction) addIronJunctionArtPass(scene, addDecorativeMesh, qualityConfig.detail, isFps);
    const desertCitadelVfx = isIronJunction ? null : addDesertCitadelVfx(scene, qualityConfig.detail);
    const staticBatchStats = staticBatcher.flush(scene);
    renderer.domElement.dataset.staticSources = String(staticBatchStats.sourceMeshes);
    renderer.domElement.dataset.staticBatches = String(staticBatchStats.batchMeshes);

    const players = session?.players.length ? session.players : currentPlayer ? [currentPlayer] : [];
    const billboardSprites: THREE.Sprite[] = [];
    const characterFactory = new CharacterFactory();
    const characterManager = new CharacterManager(scene, characterFactory, {
      isFps,
      currentPlayerId,
      makeBadgeMaterial: (player) => new THREE.SpriteMaterial({
        map: makeLabelTexture(player.isBot ? "BOT" : `${playerAccuracy(player)}%`, player.team === "blue" ? "#7dd3fc" : "#fb923c"),
        transparent: true,
        depthWrite: false
      })
    });
    const vfxPool = new ArenaVfxPool(scene, qualityConfig.detail);
    const unsubscribeVfx = subscribeArenaVfx((event) => vfxPool.emit(event));
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
      return {
        x: hasLivePosition ? serverToLocalX(liveX) : fallback.x,
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
        flagMarker.position.set(nextCarrier?.x ?? nextFlag.position.x, 0, nextCarrier?.z ?? nextFlag.position.z);
      }
    };
    syncPlayersRef.current(session, currentPlayer);

    const cameraRig = new THREE.Group();
    if (isFps) {
      scene.add(cameraRig);
      cameraRig.add(camera);

      const firstPersonModel = characterFactory.createFirstPersonViewModel(currentPlayerTeam, getPlayerWeaponId(currentPlayer ?? { gear: "starter_blaster" }));
      camera.add(firstPersonModel.root);

      const flashMaterial = new THREE.SpriteMaterial({
        map: puffTexture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
      });
      const flash = new THREE.Sprite(flashMaterial);
      flash.position.set(0.06, -0.36, -1.98);
      flash.scale.set(0.95, 0.5, 1);
      camera.add(flash);

      const muzzleRingMaterial = new THREE.MeshBasicMaterial({ color: "#9cecff", transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 18), muzzleRingMaterial);
      muzzleRing.position.set(0.06, -0.36, -1.96);
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
        gameAudio.play(next > 0 ? "zoom_in" : "zoom_out");
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
          }
          return;
        }
        const launchPosition = { ...localToServerPosition(playerPosition, yaw), scoped: activeZoomLevel > 0, zoomLevel: activeZoomLevel };
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
        cooldownTimeout = window.setTimeout(() => setWeaponCooldown(null), cooldownMs);
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
          gameAudio.playHeavyFire();
          emitArenaVfx({
            kind: "heavy_fire",
            x: playerPosition.x - Math.sin(yaw) * 2.2,
            z: playerPosition.z - Math.cos(yaw) * 2.2,
            y: 1.1,
            team: currentPlayerTeam
          });
        }
        else gameAudio.play("fire");
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
        pitch = clamp(pitch - rightY * 0.042, -0.85, 0.62);
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
        pitch = clamp(pitch - event.movementY * 0.0018, -0.85, 0.62);
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
        pitch = clamp(pitch - (event.clientY - touchLookY) * TOUCH_LOOK_SENSITIVITY, -0.85, 0.62);
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
      const verifyPointerLock = window.setInterval(() => {
        setIsPointerLocked(document.pointerLockElement === renderer.domElement);
      }, 300);

      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("keyup", onKeyUp, true);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("blur", clearKeys);
      document.addEventListener("pointerlockchange", onPointerLockChange);
      document.addEventListener("pointerlockerror", onPointerLockError);
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointermove", onTouchPointerMove, { passive: false });
      window.addEventListener("pointerup", finishTouchPointer);
      window.addEventListener("pointercancel", onTouchPointerCancel);
      renderer.domElement.addEventListener("contextmenu", onContextMenu);

      const cleanupControls = () => {
        window.clearInterval(verifyPointerLock);
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("keyup", onKeyUp, true);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("blur", clearKeys);
        document.removeEventListener("pointerlockchange", onPointerLockChange);
        document.removeEventListener("pointerlockerror", onPointerLockError);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointermove", onTouchPointerMove);
        window.removeEventListener("pointerup", finishTouchPointer);
        window.removeEventListener("pointercancel", onTouchPointerCancel);
        renderer.domElement.removeEventListener("contextmenu", onContextMenu);
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      };

      const updateCamera = () => {
        cameraRig.position.set(playerPosition.x, playerPosition.y, playerPosition.z);
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
      let performanceWindowAt = performance.now();
      let lastSentPosition = localToServerPosition(playerPosition, yaw);
      const maybeEmitPosition = (currentTime: number) => {
        if (currentTime - lastMoveEmitAt < 180) return;
        const nextPosition = localToServerPosition(playerPosition, yaw);
        const moved = Math.hypot(nextPosition.x - lastSentPosition.x, nextPosition.z - lastSentPosition.z);
        const turned = Math.abs(nextPosition.facing - lastSentPosition.facing);
        if (moved < 0.3 && turned < 0.08) return;
        lastMoveEmitAt = currentTime;
        lastSentPosition = nextPosition;
        if (controlsDisabledRef.current || inputPausedRef.current) return;
        onMoveRef.current?.(nextPosition);
      };

      const canOccupy = (next: THREE.Vector3, floorEyeHeight: number) => {
        const verticalBounds = getFpsBodyVerticalBounds(next.y, floorEyeHeight);
        const bodyBox = new THREE.Box3(
          new THREE.Vector3(next.x - PLAYER_RADIUS, verticalBounds.minY, next.z - PLAYER_RADIUS),
          new THREE.Vector3(next.x + PLAYER_RADIUS, verticalBounds.maxY, next.z + PLAYER_RADIUS)
        );
        return !coverBoxes.some((box) => box.intersectsBox(bodyBox) && !canFpsBodyClearObstacle(verticalBounds, box.max.y));
      };

      const animateFps = () => {
        frame = requestAnimationFrame(animateFps);
        const delta = Math.min(clock.getDelta(), 0.035);
        const currentTime = performance.now();
        performanceCapture.frame(currentTime);
        vfxPool.update(currentTime);
        desertCitadelVfx?.update(clock.elapsedTime);
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
            if (isFiniteNumber(followedPlayer.facing)) yaw = followedPlayer.facing;
          }
        }
        const horizontalLook = Number(lookKeys.has("ArrowLeft")) - Number(lookKeys.has("ArrowRight"));
        const verticalLook = Number(lookKeys.has("ArrowUp")) - Number(lookKeys.has("ArrowDown"));
        yaw += horizontalLook * KEYBOARD_LOOK_SPEED * delta;
        pitch = clamp(pitch + verticalLook * KEYBOARD_LOOK_SPEED * delta, -0.85, 0.62);
        if (inputPausedRef.current) {
          keys.clear();
          lookKeys.clear();
          if (activeZoomLevel > 0) setZoomLevel(0);
        }
        applyGamepadInput();
        const crouching = keys.has("Control");
        const floorEyeHeight = crouching ? FPS_CROUCH_EYE_HEIGHT : FPS_STANDING_EYE_HEIGHT;
        const grounded = playerPosition.y <= floorEyeHeight + 0.02 && Math.abs(verticalVelocity) < 0.01;
        if (jumpQueued && grounded && !crouching) {
          verticalVelocity = 5.8;
          emitArenaAnimation({ kind: "jump", playerId: currentPlayerId, team: currentPlayerTeam });
          gameAudio.play("jump");
        }
        jumpQueued = false;
        verticalVelocity -= 15.5 * delta;
        playerPosition.y += verticalVelocity * delta;
        if (playerPosition.y < floorEyeHeight) {
          playerPosition.y = floorEyeHeight;
          verticalVelocity = 0;
          if (!wasGrounded) {
            landedAt = currentTime;
            emitArenaAnimation({ kind: "land", playerId: currentPlayerId, team: currentPlayerTeam });
            gameAudio.play("land");
          }
          wasGrounded = true;
        } else if (crouching && verticalVelocity === 0) {
          playerPosition.y += (floorEyeHeight - playerPosition.y) * 0.18;
        } else {
          wasGrounded = false;
        }

        const gearSpeedMultiplier = getPlayerMoveSpeedMultiplier(currentPlayerRef.current ?? { gear: "starter_blaster" });
        const movementAudioMode: MovementAudioMode = crouching ? "crouch" : keys.has("Shift") ? "run" : "walk";
        const moveSpeed = (crouching ? CROUCH_SPEED : keys.has("Shift") ? RUN_SPEED : WALK_SPEED) * gearSpeedMultiplier;
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const movement = new THREE.Vector3();
        const touchMove = touchMoveRef.current;
        if (keys.has("KeyW")) movement.add(forward);
        if (keys.has("KeyS")) movement.sub(forward);
        if (keys.has("KeyD")) movement.add(right);
        if (keys.has("KeyA")) movement.sub(right);
        if (touchMove.forward > 0) movement.add(forward);
        if (touchMove.forward < 0) movement.sub(forward);
        if (touchMove.right > 0) movement.add(right);
        if (touchMove.right < 0) movement.sub(right);
        if (gamepadMove.forward > GAMEPAD_DEAD_ZONE) movement.add(forward);
        if (gamepadMove.forward < -GAMEPAD_DEAD_ZONE) movement.sub(forward);
        if (gamepadMove.right > GAMEPAD_DEAD_ZONE) movement.add(right);
        if (gamepadMove.right < -GAMEPAD_DEAD_ZONE) movement.sub(right);

        if (movement.lengthSq() > 0) {
          if (wasGrounded) gameAudio.playMovementStep(movementAudioMode, currentTime);
          movement.normalize().multiplyScalar(moveSpeed * delta);
          const next = playerPosition.clone().add(movement);
          next.x = clamp(next.x, -ARENA_LIMIT_X + PLAYER_RADIUS, ARENA_LIMIT_X - PLAYER_RADIUS);
          next.z = clamp(next.z, -ARENA_LIMIT_Z + PLAYER_RADIUS, ARENA_LIMIT_Z - PLAYER_RADIUS);
          const tryX = playerPosition.clone();
          tryX.x = next.x;
          if (canOccupy(tryX, floorEyeHeight)) playerPosition.x = tryX.x;
          const tryZ = playerPosition.clone();
          tryZ.z = next.z;
          if (canOccupy(tryZ, floorEyeHeight)) playerPosition.z = tryZ.z;
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
        updateCamera();
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
        const airborneLift = Math.max(0, playerPosition.y - floorEyeHeight) * 0.045;
        firstPersonModel.root.position.y = -0.58 + Math.sin(currentTime * 0.006) * 0.012 + airborneLift - Math.sin(landingPulse * Math.PI) * 0.055;
        firstPersonModel.weapon.rotation.x = -0.1 - flash.material.opacity * 0.035;
        if (snowballLaunchAt > 0) {
          const travel = clamp((currentTime - snowballLaunchAt) / 260, 0, 1);
          snowball.visible = travel < 1;
          snowball.position.set(0.05, -0.36 - travel * 0.08, -1.55 - travel * 6.5);
          projectileTrail.visible = travel < 0.96;
          projectileTrail.position.copy(snowball.position);
          projectileTrail.rotation.z = currentTime * 0.01;
          const scale = Math.max(0.38, 1 - travel * 0.62);
          snowball.scale.setScalar(scale);
          if (travel > 0.82) {
            impactPuff.position.set(0.05, -0.44, -8.02);
            impactMaterial.opacity = Math.max(0, (1 - travel) * 3.8);
            impactPuff.scale.setScalar(0.8 + (travel - 0.82) * 5.5);
          }
        }
        renderer.render(scene, camera);
      };
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
      syncPlayersRef.current = () => undefined;
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
  }, [sceneSessionId, currentPlayerId, currentPlayerTeam, currentPlayer?.gear, currentPlayer?.weapon, currentPlayer?.perks, view, debugOverlay, activeQuality, gamepadEnabled, arenaMapId, session?.settings.gameMode, session?.flag?.state, session?.flag?.carrierId, session?.flag?.position.x, session?.flag?.position.z]);

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
      ? { x: currentPlayer.x, z: currentPlayer.z, facing: currentPlayer.facing ?? 0 }
      : null
  );
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
          <div className={`${hitPulse % 2 === 0 ? "crosshair" : "crosshair fire"}${zoomLevel > 0 ? ` zoom zoom-level-${zoomLevel}` : ""}`} aria-hidden="true" />
          {zoomLevel > 0 && (
            <div key={`${zoomLevel}-${zoomPulse}`} className={`scope-overlay scope-level-${zoomLevel} scope-pulse`} aria-hidden="true">
              <span>Heavy Scope</span>
              <strong>{zoomLevel === 1 ? "2×" : "4×"}</strong>
            </div>
          )}
          {weaponCooldown && (
            <div className="weapon-cooldown" aria-label="Weapon cooldown">
              <span key={weaponCooldown.startedAt} style={{ animationDuration: `${weaponCooldown.durationMs}ms` }} />
            </div>
          )}
          <div className="fps-callout">{arenaMap.title}</div>
          <div className="arena-minimap" aria-label={`${arenaMap.title} minimap`}>
            <div className="minimap-title">Map</div>
            <svg viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} role="img" aria-label={`${arenaMap.title} route overview`}>
              <rect x="0" y="0" width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} rx="5" className={arenaMapId === "iron_junction" ? "minimap-iron" : "minimap-sand"} />
              {arenaMap.floorMarks.slice(0, 5).map((mark) => (
                <rect
                  key={mark.id}
                  x={toMiniMapX(mark.x - mark.w / 2)}
                  y={toMiniMapY(mark.z - mark.d / 2)}
                  width={Math.max(1, toMiniMapW(mark.w))}
                  height={Math.max(1, toMiniMapH(mark.d))}
                  className="minimap-route"
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
                />
              ))}
              <rect
                x={toMiniMapX(TEAM_BASE_ZONES.blue.minX)}
                y={toMiniMapY(TEAM_BASE_ZONES.blue.minZ)}
                width={toMiniMapW(TEAM_BASE_ZONES.blue.maxX - TEAM_BASE_ZONES.blue.minX)}
                height={toMiniMapH(TEAM_BASE_ZONES.blue.maxZ - TEAM_BASE_ZONES.blue.minZ)}
                className="minimap-blue-base"
              />
              <rect
                x={toMiniMapX(TEAM_BASE_ZONES.red.minX)}
                y={toMiniMapY(TEAM_BASE_ZONES.red.minZ)}
                width={toMiniMapW(TEAM_BASE_ZONES.red.maxX - TEAM_BASE_ZONES.red.minX)}
                height={toMiniMapH(TEAM_BASE_ZONES.red.maxZ - TEAM_BASE_ZONES.red.minZ)}
                className="minimap-red-base"
              />
              {CAPTURE_ZONES.map((zone) => (
                <circle key={zone.id} cx={toMiniMapX(zone.x)} cy={toMiniMapY(zone.z)} r="2.1" className="minimap-capture" />
              ))}
              {SEARCH_RETRIEVE_ITEMS.map((item) => (
                <rect key={item.id} x={toMiniMapX(item.x) - 1.4} y={toMiniMapY(item.z) - 1.4} width="2.8" height="2.8" className="minimap-item" />
              ))}
              {session?.settings.gameMode === "flag" && session.flag && displayedFlagPosition && (
                <g className={`minimap-flag minimap-flag-${session.flag.state}`} transform={`translate(${toMiniMapX(displayedFlagPosition.x)} ${toMiniMapY(displayedFlagPosition.z)})`}>
                  <circle r="3" />
                  <path d="M 0 -4 L 0 4 M 0 -4 L 4 -2 L 0 0" />
                </g>
              )}
              <text x={toMiniMapX(-140)} y={toMiniMapY(-78)} className="minimap-label">West</text>
              <text x={toMiniMapX(122)} y={toMiniMapY(-78)} className="minimap-label">East</text>
              <text x={toMiniMapX(0)} y={toMiniMapY(-128)} className="minimap-label">{arenaMapId === "iron_junction" ? "Depot" : "Ruins"}</text>
              <text x={toMiniMapX(0)} y={toMiniMapY(-22)} className="minimap-label">{arenaMapId === "iron_junction" ? "Gantry" : "Market"}</text>
              <text x={toMiniMapX(0)} y={toMiniMapY(118)} className="minimap-label">{arenaMapId === "iron_junction" ? "Timber" : "Homes"}</text>
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
