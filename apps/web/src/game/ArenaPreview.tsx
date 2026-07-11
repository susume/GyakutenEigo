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
  getGearMoveSpeedMultiplier,
  getGearZoomFovMultiplier,
  getTeamSpawn,
  isGearAutoFireEnabled,
  type GameSession,
  type PlayerSession
} from "@quizstrike/shared";
import { blocks, cylinders, floorMarks, signs } from "./desertCitadelMap";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_STANDING_EYE_HEIGHT,
  canFpsBodyClearObstacle,
  getFpsBodyVerticalBounds
} from "./ArenaCamera.js";
import { CharacterFactory } from "./characters/CharacterFactory";
import { CharacterManager, type CharacterManagerStats } from "./characters/CharacterManager";
import { resolveCombatPointerAction } from "./arenaInput";
import { gameAudio, type MovementAudioMode } from "./GameAudio";

interface ArenaPreviewProps {
  session?: GameSession;
  currentPlayer?: PlayerSession;
  view?: "overview" | "fps";
  suppressHint?: boolean;
  controlsDisabled?: boolean;
  inputPaused?: boolean;
  debugOverlay?: boolean;
  debugLabel?: string;
  onMove?: (position: ArenaLivePosition) => void;
  onFire?: (position: ArenaLivePosition) => void;
  onInteract?: (position: ArenaLivePosition) => void;
}

type ArenaLivePosition = { x: number; z: number; y?: number; facing: number; scoped?: boolean };

const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 10.8;
const RUN_SPEED = 14.8;
const CROUCH_SPEED = 6.4;
const FPS_BASE_FOV = 72;
const MINIMAP_WIDTH = 120;
const MINIMAP_HEIGHT = 110;
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
  if (event.code === "ArrowUp") return "KeyW";
  if (event.code === "ArrowLeft") return "KeyA";
  if (event.code === "ArrowDown") return "KeyS";
  if (event.code === "ArrowRight") return "KeyD";
  if (event.code === "ShiftLeft" || event.code === "ShiftRight" || key === "shift") return "Shift";
  if (event.code === "Space" || key === " ") return "Space";
  if (event.code === "ControlLeft" || event.code === "ControlRight" || key === "control") return "Control";
  return "";
};

const makeCanvasTexture = (kind: "floor" | "stone" | "wood" | "water" | "sand", accent = "#e8c67a") => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const palettes = {
    floor: ["#c99d5a", "#e5c17b"],
    stone: ["#a77b4c", "#dec48b"],
    wood: ["#4f3524", "#8b623c"],
    water: ["#137f90", "#36d5e6"],
    sand: ["#cfa660", "#edcf8b"]
  } as const;
  const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, palettes[kind][0]);
  gradient.addColorStop(1, palettes[kind][1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.globalAlpha = kind === "water" ? 0.08 : 0.16;
  for (let index = 0; index < 1100; index += 1) {
    const shade = Math.floor(105 + Math.random() * 115);
    ctx.fillStyle = kind === "water" ? `rgba(210,250,255,.8)` : `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  ctx.globalAlpha = 1;

  if (kind !== "water") {
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = kind === "floor" || kind === "sand" ? 3 : 5;
    const step = kind === "wood" ? 128 : 256;
    for (let pos = 0; pos <= 1024; pos += step) {
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 1024);
      ctx.moveTo(0, pos);
      ctx.lineTo(1024, pos);
      ctx.stroke();
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
  const syncPlayersRef = useRef<(session?: GameSession, currentPlayer?: PlayerSession) => void>(() => undefined);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [hitPulse, setHitPulse] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [miniMapPosition, setMiniMapPosition] = useState<ArenaLivePosition | null>(null);
  const [renderError, setRenderError] = useState("");
  const [characterDebugStats, setCharacterDebugStats] = useState<CharacterManagerStats | null>(null);
  const sceneSessionId = session?.id ?? "training";
  const currentPlayerId = currentPlayer?.id ?? "";
  const currentPlayerTeam = currentPlayer?.team ?? "blue";

  useEffect(() => {
    onMoveRef.current = onMove;
    onFireRef.current = onFire;
    onInteractRef.current = onInteract;
    inputPausedRef.current = inputPaused;
  }, [onMove, onFire, onInteract, inputPaused]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
    pendingShotsRef.current = 0;
  }, [currentPlayer?.id, currentPlayer?.snowballs, currentPlayer?.isAlive]);

  useEffect(() => {
    syncPlayersRef.current(session, currentPlayer);
  }, [session, currentPlayer]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setRenderError("");

    const isFps = view === "fps";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isFps ? "#e8c27b" : "#f4dca8");
    scene.fog = new THREE.Fog("#e8c27b", isFps ? 130 : 220, isFps ? 360 : 520);

    const camera = new THREE.PerspectiveCamera(isFps ? FPS_BASE_FOV : 52, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 620);
    const fallbackSpawn = currentPlayer ? getTeamSpawn(currentPlayer.team) : getTeamSpawn("blue");
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
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setRenderError("WebGL is not available in this browser. Try updating the browser or enabling hardware acceleration.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = !isFps;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isFps ? 0.86 : 0.98;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.className = "arena-webgl";
    mount.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const loadTexture = (path: string) => {
      const url = `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
      const texture = textureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const puffTexture = loadTexture("/assets/snowball-puff.svg");
    const floorTexture = makeCanvasTexture("floor", "#f2ca73");
    const stoneTexture = makeCanvasTexture("stone", "#f6d98e");
    const woodTexture = makeCanvasTexture("wood", "#bb8652");
    const waterTexture = makeCanvasTexture("water", "#67e8f9");
    const sandTexture = makeCanvasTexture("sand", "#f2ca73");

    const materialCache = new Map<string, THREE.MeshStandardMaterial>();
    const materialFor = (color: string, material = "stone") => {
      const key = `${color}-${material}`;
      const cached = materialCache.get(key);
      if (cached) return cached;
      const texture = material === "wood" ? woodTexture : material === "water" ? waterTexture : material === "sand" ? sandTexture : stoneTexture;
      const materialOptions: THREE.MeshStandardMaterialParameters = {
        color,
        roughness: material === "water" ? 0.18 : material === "cloth" ? 0.84 : 0.68,
        metalness: material === "water" ? 0.05 : 0.02,
        emissive: material === "water" ? color : "#000000",
        emissiveIntensity: material === "water" ? 0.35 : 0
      };
      if (material !== "cloth" && material !== "accent") materialOptions.map = texture;
      const next = new THREE.MeshStandardMaterial(materialOptions);
      materialCache.set(key, next);
      return next;
    };

    scene.add(new THREE.HemisphereLight("#fff6d8", "#8f7d6f", isFps ? 1.05 : 1.2));

    const keyLight = new THREE.DirectionalLight("#fff0ca", isFps ? 2.05 : 2.65);
    keyLight.position.set(-85, 180, 95);
    keyLight.castShadow = !isFps;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -190;
    keyLight.shadow.camera.right = 190;
    keyLight.shadow.camera.top = 175;
    keyLight.shadow.camera.bottom = -175;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#ffe7bd", isFps ? 1.15 : 0.75);
    fillLight.position.set(110, 80, -130);
    scene.add(fillLight);

    const aqueductLight = new THREE.PointLight("#53e7ff", 42, 135, 2);
    aqueductLight.position.set(0, 7, 0);
    scene.add(aqueductLight);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_LIMIT_X * 2, 0.3, ARENA_LIMIT_Z * 2),
      new THREE.MeshStandardMaterial({ map: floorTexture, color: "#d8b06e", roughness: 0.88, metalness: 0.01 })
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(ARENA_LIMIT_X * 2, 35, "#fff1c1", "#ad7b45");
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.13;
    scene.add(grid);

    const coverBoxes: THREE.Box3[] = [];
    const colliderForObject = (object: THREE.Object3D, pad = 0.25) => {
      coverBoxes.push(new THREE.Box3().setFromObject(object).expandByScalar(pad));
    };

    const addBlock = (block: (typeof blocks)[number]) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(block.w, block.h, block.d),
        materialFor(block.color, block.material)
      );
      mesh.position.set(block.x, block.y ?? block.h / 2, block.z);
      mesh.rotation.y = block.rotationY ?? 0;
      mesh.castShadow = !isFps;
      mesh.receiveShadow = true;
      scene.add(mesh);
      if (block.collides) colliderForObject(mesh, 0.25);
      if (block.label && !isFps) {
        const label = new THREE.Sprite(makeSpriteLabel(block.label, "#fef3c7"));
        label.position.set(block.x, (block.y ?? block.h) + block.h / 2 + 6, block.z);
        label.scale.set(22, 7.5, 1);
        scene.add(label);
      }
      return mesh;
    };
    blocks.forEach(addBlock);

    cylinders.forEach((cylinder) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(cylinder.radius * 0.88, cylinder.radius, cylinder.h, 24),
        materialFor(cylinder.color, cylinder.material)
      );
      mesh.position.set(cylinder.x, cylinder.y ?? cylinder.h / 2, cylinder.z);
      mesh.castShadow = !isFps;
      mesh.receiveShadow = true;
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

    floorMarks.forEach((mark) => addFloorLabel(mark.label, mark.x, mark.z, mark.w, mark.d, mark.color, mark.rotation));

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
    signs.forEach((sign) => addWallSign(sign.label, sign.x, sign.z, sign.color, sign.rotationY, sign.y));

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

    for (const [x, z, sx, sz] of [
      [-120, -176, 58, 12],
      [116, -176, 48, 10],
      [-142, 174, 42, 10],
      [112, 176, 58, 12],
      [-190, -42, 16, 70],
      [190, 38, 16, 70]
    ] as const) {
      const dune = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 10),
        materialFor("#c99d5a", "sand")
      );
      dune.position.set(scaleArenaValue(x), -0.05, scaleArenaValue(z));
      dune.scale.set(scaleArenaValue(sx), 2.1, scaleArenaValue(sz));
      dune.receiveShadow = true;
      scene.add(dune);
    }

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

    const getVisualPosition = (player: PlayerSession, index: number) => {
      const liveX = player.x;
      const liveZ = player.z;
      const hasLivePosition = isFiniteNumber(liveX) && isFiniteNumber(liveZ);
      const fallback = getTeamSpawn(player.team, index);
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

    characterManager.sync(getDisplayPlayers(players), getVisualPosition);

    syncPlayersRef.current = (nextSession?: GameSession, nextCurrentPlayer?: PlayerSession) => {
      const nextPlayers = nextSession?.players.length ? nextSession.players : nextCurrentPlayer ? [nextCurrentPlayer] : [];
      characterManager.sync(getDisplayPlayers(nextPlayers), getVisualPosition);
    };
    syncPlayersRef.current(session, currentPlayer);

    const cameraRig = new THREE.Group();
    if (isFps) {
      scene.add(cameraRig);
      cameraRig.add(camera);

      const firstPersonModel = characterFactory.createFirstPersonViewModel(currentPlayerTeam);
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

      const snowball = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 18, 12),
        new THREE.MeshStandardMaterial({ color: "#f7fcff", roughness: 0.32, emissive: "#dff6ff", emissiveIntensity: 0.18 })
      );
      snowball.visible = false;
      camera.add(snowball);

      let flashUntil = 0;
      let snowballLaunchAt = 0;
      let verticalVelocity = 0;
      let jumpQueued = false;
      let lastEmptyFireRequestAt = 0;
      let lastLocalFireAt = 0;
      let isZooming = false;
      let wasGrounded = true;
      let fireHeld = false;
      const getEquippedGearId = () => currentPlayerRef.current?.gear ?? "starter_blaster";
      const hasZoomGear = () => getGearZoomFovMultiplier(getEquippedGearId()) < 1;
      const hasAutoFireGear = () => isGearAutoFireEnabled(getEquippedGearId());
      const setZooming = (nextZooming: boolean) => {
        const next = nextZooming && hasZoomGear();
        if (isZooming === next) return;
        isZooming = next;
        renderer.domElement.dataset.zoomed = String(isZooming);
        setZoomActive(isZooming);
        gameAudio.play(isZooming ? "zoom_in" : "zoom_out");
      };
      const fire = () => {
        if (controlsDisabled || inputPausedRef.current || !onFireRef.current) return;
        gameAudio.warm();
        const currentTime = performance.now();
        const equippedGearId = getEquippedGearId();
        if (currentTime - lastLocalFireAt < getGearFireCooldownMs(equippedGearId)) return;
        const launchPosition = { ...localToServerPosition(playerPosition, yaw), scoped: isZooming };
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
        pendingShotsRef.current += 1;
        flashUntil = performance.now() + 95;
        snowballLaunchAt = currentTime;
        flash.material.opacity = 1;
        snowball.visible = true;
        setHitPulse((value) => value + 1);
        if (equippedGearId === "power_blaster") gameAudio.playHeavyFire();
        else gameAudio.play("fire");
        window.setTimeout(() => {
          navigator.vibrate?.(18);
          onFireRef.current?.(launchPosition);
        }, 0);
      };
      fireControlRef.current = fire;

      const keys = new Set<string>();
      const onKeyDown = (event: KeyboardEvent) => {
        if (controlsDisabled || inputPausedRef.current) return;
        if (event.code === "KeyF" || event.key.toLowerCase() === "f") {
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
        }
      };
      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code === "KeyF" || event.key.toLowerCase() === "f") fireHeld = false;
        const code = movementCode(event);
        if (code) keys.delete(code);
      };
      const onMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement !== renderer.domElement) return;
        yaw -= event.movementX * 0.0022;
        pitch = clamp(pitch - event.movementY * 0.0018, -0.85, 0.62);
      };
      const onPointerLockChange = () => {
        const locked = document.pointerLockElement === renderer.domElement;
        setIsPointerLocked(locked);
        if (!locked) setZooming(false);
      };
      const onPointerLockError = () => setIsPointerLocked(false);
      const onPointerDown = (event: PointerEvent) => {
        if (controlsDisabled || inputPausedRef.current) return;
        gameAudio.warm();
        renderer.domElement.focus();
        if (document.pointerLockElement !== renderer.domElement) {
          void renderer.domElement.requestPointerLock().catch(() => setIsPointerLocked(false));
          return;
        }
        const action = resolveCombatPointerAction({ button: event.button, buttons: event.buttons });
        if (action === "scope") {
          event.preventDefault();
          setZooming(true);
          return;
        }
        if (action !== "fire") return;
        if (hasAutoFireGear()) fireHeld = true;
        fire();
      };
      const onMouseDown = (event: MouseEvent) => {
        if (controlsDisabled || inputPausedRef.current || document.pointerLockElement !== renderer.domElement) return;
        const action = resolveCombatPointerAction({ button: event.button, buttons: event.buttons });
        if (action === "scope") {
          event.preventDefault();
          setZooming(true);
          return;
        }
        if (action !== "fire") return;
        if (hasAutoFireGear()) fireHeld = true;
        fire();
      };
      const onPointerUp = (event: PointerEvent) => {
        if (event.button === 2) setZooming(false);
        if (event.button === 0) fireHeld = false;
      };
      const onMouseUp = (event: MouseEvent) => {
        if (event.button === 2) setZooming(false);
        if (event.button === 0) fireHeld = false;
      };
      const onContextMenu = (event: MouseEvent) => event.preventDefault();
      const clearKeys = () => {
        keys.clear();
        setZooming(false);
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
      window.addEventListener("mousedown", onMouseDown, true);
      window.addEventListener("mouseup", onMouseUp, true);
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
        window.removeEventListener("mousedown", onMouseDown, true);
        window.removeEventListener("mouseup", onMouseUp, true);
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
      let lastSentPosition = localToServerPosition(playerPosition, yaw);
      const maybeEmitPosition = (currentTime: number) => {
        if (currentTime - lastMoveEmitAt < 180) return;
        const nextPosition = localToServerPosition(playerPosition, yaw);
        const moved = Math.hypot(nextPosition.x - lastSentPosition.x, nextPosition.z - lastSentPosition.z);
        const turned = Math.abs(nextPosition.facing - lastSentPosition.facing);
        if (moved < 0.3 && turned < 0.08) return;
        lastMoveEmitAt = currentTime;
        lastSentPosition = nextPosition;
        if (controlsDisabled || inputPausedRef.current) return;
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
        if (inputPausedRef.current) keys.clear();
        const crouching = keys.has("Control");
        const floorEyeHeight = crouching ? FPS_CROUCH_EYE_HEIGHT : FPS_STANDING_EYE_HEIGHT;
        const grounded = playerPosition.y <= floorEyeHeight + 0.02 && Math.abs(verticalVelocity) < 0.01;
        if (jumpQueued && grounded && !crouching) {
          verticalVelocity = 5.8;
          gameAudio.play("jump");
        }
        jumpQueued = false;
        verticalVelocity -= 15.5 * delta;
        playerPosition.y += verticalVelocity * delta;
        if (playerPosition.y < floorEyeHeight) {
          playerPosition.y = floorEyeHeight;
          verticalVelocity = 0;
          if (!wasGrounded) gameAudio.play("land");
          wasGrounded = true;
        } else if (crouching && verticalVelocity === 0) {
          playerPosition.y += (floorEyeHeight - playerPosition.y) * 0.18;
        } else {
          wasGrounded = false;
        }

        const gearSpeedMultiplier = getGearMoveSpeedMultiplier(currentPlayerRef.current?.gear ?? "starter_blaster");
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

        if (fireHeld && hasAutoFireGear() && !inputPausedRef.current && !controlsDisabled) fire();

        const zoomMultiplier = isZooming ? getGearZoomFovMultiplier(getEquippedGearId()) : 1;
        const targetFov = FPS_BASE_FOV * zoomMultiplier;
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
        firstPersonModel.root.position.y = -0.58 + Math.sin(currentTime * 0.006) * 0.012;
        firstPersonModel.weapon.rotation.x = -0.1 - flash.material.opacity * 0.035;
        if (snowballLaunchAt > 0) {
          const travel = clamp((currentTime - snowballLaunchAt) / 260, 0, 1);
          snowball.visible = travel < 1;
          snowball.position.set(0.05, -0.36 - travel * 0.08, -1.55 - travel * 6.5);
          const scale = Math.max(0.38, 1 - travel * 0.62);
          snowball.scale.setScalar(scale);
        }
        renderer.render(scene, camera);
      };
      flash.material.opacity = 1;
      snowball.visible = true;
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      flash.material.opacity = 0;
      snowball.visible = false;
      renderer.render(scene, camera);
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
        fireControlRef.current = () => undefined;
        syncPlayersRef.current = () => undefined;
        setZoomActive(false);
        cleanupControls();
        disposeObject(scene);
        materialCache.forEach((material) => material.dispose());
        floorTexture.dispose();
        stoneTexture.dispose();
        woodTexture.dispose();
        waterTexture.dispose();
        sandTexture.dispose();
        puffTexture.dispose();
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    }

    const clock = new THREE.Clock();
    let frame = 0;
    let lastDebugStatsAt = 0;
    const animateOverview = () => {
      frame = requestAnimationFrame(animateOverview);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const currentTime = performance.now();
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
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
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
      syncPlayersRef.current = () => undefined;
      disposeObject(scene);
      materialCache.forEach((material) => material.dispose());
      floorTexture.dispose();
      stoneTexture.dispose();
      woodTexture.dispose();
      waterTexture.dispose();
      sandTexture.dispose();
      puffTexture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [sceneSessionId, currentPlayerId, currentPlayerTeam, view, controlsDisabled, debugOverlay]);

  const beginTouchMove = (forward: number, right: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (controlsDisabled || inputPausedRef.current) return;
    touchMoveRef.current = { forward, right };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const endTouchMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    touchMoveRef.current = { forward: 0, right: 0 };
    event.currentTarget.releasePointerCapture?.(event.pointerId);
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

  return (
    <div className={view === "fps" ? "arena-frame fps-view" : "arena-frame"}>
      <div className="arena-canvas" ref={mountRef} aria-label="Desert Citadel arena" />
      {renderError && <div className="arena-error" role="alert">{renderError}</div>}
      {debugOverlay && characterDebugStats && (
        <div className="character-debug-overlay" aria-label="Character debug stats">
          <strong>{debugLabel}</strong>
          <span>{characterDebugStats.visible}/{characterDebugStats.total} visible</span>
          <span>{characterDebugStats.alive} alive</span>
          <span>Avg speed {characterDebugStats.averageSpeed}</span>
          <span>
            LOD {characterDebugStats.lod.LOD0}/{characterDebugStats.lod.LOD1}/{characterDebugStats.lod.LOD2}/{characterDebugStats.lod.LOD3}
          </span>
        </div>
      )}
      {view === "fps" && (
        <>
          <div className={`${hitPulse % 2 === 0 ? "crosshair" : "crosshair fire"}${zoomActive ? " zoom" : ""}`} aria-hidden="true" />
          <div className="fps-callout">Desert Citadel</div>
          <div className="arena-minimap" aria-label="Desert Citadel minimap">
            <div className="minimap-title">Map</div>
            <svg viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} role="img" aria-label="Desert Citadel route overview">
              <rect x="0" y="0" width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} rx="5" className="minimap-sand" />
              {floorMarks.slice(0, 5).map((mark) => (
                <rect
                  key={mark.id}
                  x={toMiniMapX(mark.x - mark.w / 2)}
                  y={toMiniMapY(mark.z - mark.d / 2)}
                  width={Math.max(1, toMiniMapW(mark.w))}
                  height={Math.max(1, toMiniMapH(mark.d))}
                  className="minimap-route"
                />
              ))}
              {blocks.filter((block) => block.collides).map((block) => (
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
              <text x={toMiniMapX(-140)} y={toMiniMapY(-78)} className="minimap-label">West</text>
              <text x={toMiniMapX(122)} y={toMiniMapY(-78)} className="minimap-label">East</text>
              <text x={toMiniMapX(0)} y={toMiniMapY(-128)} className="minimap-label">Ruins</text>
              <text x={toMiniMapX(0)} y={toMiniMapY(-22)} className="minimap-label">Market</text>
              <text x={toMiniMapX(0)} y={toMiniMapY(118)} className="minimap-label">Homes</text>
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
          {!controlsDisabled && !isPointerLocked && !suppressHint && <div className="control-lock">Click arena to control mouse. WASD or arrows move. F or left click launches. Right click scopes supported gear. E interacts with the flag.</div>}
          <div className="touch-controls" aria-label="Touch controls">
            <div className="touch-dpad" aria-label="Move">
              <button type="button" className="touch-up" aria-label="Move forward" disabled={controlsDisabled} onPointerDown={beginTouchMove(1, 0)} onPointerUp={endTouchMove} onPointerCancel={endTouchMove} onPointerLeave={endTouchMove}>W</button>
              <button type="button" className="touch-left" aria-label="Move left" disabled={controlsDisabled} onPointerDown={beginTouchMove(0, -1)} onPointerUp={endTouchMove} onPointerCancel={endTouchMove} onPointerLeave={endTouchMove}>A</button>
              <button type="button" className="touch-down" aria-label="Move backward" disabled={controlsDisabled} onPointerDown={beginTouchMove(-1, 0)} onPointerUp={endTouchMove} onPointerCancel={endTouchMove} onPointerLeave={endTouchMove}>S</button>
              <button type="button" className="touch-right" aria-label="Move right" disabled={controlsDisabled} onPointerDown={beginTouchMove(0, 1)} onPointerUp={endTouchMove} onPointerCancel={endTouchMove} onPointerLeave={endTouchMove}>D</button>
            </div>
            <button type="button" className="touch-fire" disabled={controlsDisabled} onPointerDown={fireFromTouch}>Fire</button>
          </div>
        </>
      )}
    </div>
  );
}
