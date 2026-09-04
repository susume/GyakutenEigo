import * as THREE from "three";
import {
  FREE_FOR_ALL_SPAWNS,
  getArenaBounds,
  getArenaGroundHeight,
  getArenaObjectiveGroundY,
  getCaptureZonesForMap,
  getSearchRetrieveDeliveryZonesForMap,
  getTeamSpawnsForMap,
  getTeamBaseZones,
  type SessionMapId,
  type FlagStateName,
  type GameSession
} from "@quizstrike/shared";
import type { ArenaMapData } from "./arenaMaps";
import { ArenaStaticBatcher, makeSurfaceAtlas } from "./ArenaStaticBatch";
import { addDesertCitadelVfx } from "./DesertCitadelVfx";
import { addDesertCitadelArtPass } from "./desertCitadelArtPass";
import { addIronJunctionArtPass } from "./IronJunctionArtPass";
import { addTempleRunoffArtPass } from "./TempleRunoffArtPass";
import type { ArenaQuality } from "./gamePreferences";
import type { ArenaQualityConfig } from "./sceneSetup";
import { FPS_CROUCH_EYE_HEIGHT, FPS_STANDING_EYE_HEIGHT } from "./ArenaCamera";
import { createQuizStrikeMaterial, styleForArenaSurface } from "./rendering/materials/QuizStrikeMaterials";

type ActiveArenaQuality = Exclude<ArenaQuality, "auto">;
type TextureKind = "floor" | "stone" | "wood" | "water" | "sand" | "metal";

export const shouldScatterEdgeRocks = (detail: number, mapId: SessionMapId) =>
  detail === 2 && mapId === "iron_junction";
export const shouldAddBaseBeacons = (mapId: string) => mapId === "iron_junction";

type MapBuilderDependencies = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  arenaMap: ArenaMapData;
  arenaMapId: SessionMapId;
  session?: GameSession;
  arenaBounds: ReturnType<typeof getArenaBounds>;
  teamBaseZones: ReturnType<typeof getTeamBaseZones>;
  captureZones: ReturnType<typeof getCaptureZonesForMap>;
  searchRetrieveDeliveryZones: ReturnType<typeof getSearchRetrieveDeliveryZonesForMap>;
  isIronJunction: boolean;
  isDesertCitadel: boolean;
  isTempleRunoff: boolean;
  isFps: boolean;
  isZombieMode: boolean;
  activeQuality: ActiveArenaQuality;
  qualityConfig: ArenaQualityConfig;
  makeCanvasTexture: (kind: TextureKind, accent?: string, resolution?: number) => THREE.CanvasTexture;
  seededRandom: (seed: number) => () => number;
  scaleArenaValue: (value: number) => number;
};

export const buildArenaMapScene = (deps: MapBuilderDependencies) => {
  const {
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
    seededRandom
  } = deps;
  const palette = arenaMap.palette;
  const paleStone = "#dec28a";
  const darkStone = "#846744";
  const wood = "#65462e";
  const steel = "#39464b";
  const darkSteel = "#263237";
  const rust = "#8b4f37";
  const timber = "#765038";
  const warning = "#d18a3f";

const surfaceTextureResolution = activeQuality === "high" ? 1024 : 512;
const floorTexture = makeCanvasTexture(palette.floorTexture, palette.accent, surfaceTextureResolution);
const stoneTexture = makeCanvasTexture("stone", "#f6d98e", surfaceTextureResolution);
const woodTexture = makeCanvasTexture("wood", "#bb8652", surfaceTextureResolution);
const waterTexture = makeCanvasTexture("water", "#67e8f9", surfaceTextureResolution);
const sandTexture = makeCanvasTexture("sand", "#f2ca73", surfaceTextureResolution);
const metalTexture = makeCanvasTexture("metal", "#93a6ad", surfaceTextureResolution);
[floorTexture, stoneTexture, woodTexture, waterTexture, sandTexture, metalTexture].forEach((texture) => {
  texture.anisotropy = qualityConfig.anisotropy;
});
const desertCitadelPbrTextures = isDesertCitadel && qualityConfig.detail > 0
  ? (() => {
      const loader = new THREE.TextureLoader();
      const publicUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
      const load = (path: string, color = false) => {
        const texture = loader.load(publicUrl(path));
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(48, 36);
        texture.anisotropy = qualityConfig.anisotropy;
        if (color) texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      };
      return {
        map: load("/assets/arena/desert-citadel/polyhaven-sand-03/sand_03_diff_1k.jpg", true),
        normalMap: load("/assets/arena/desert-citadel/polyhaven-sand-03/sand_03_nor_gl_1k.jpg"),
        roughnessMap: load("/assets/arena/desert-citadel/polyhaven-sand-03/sand_03_rough_1k.jpg")
      };
    })()
  : null;
const surfaceAtlas = makeSurfaceAtlas(
  { stone: stoneTexture, wood: woodTexture, metal: metalTexture, sand: sandTexture },
  activeQuality === "high" ? 2048 : 1024
);
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
    roughness: material === "water" ? (isTempleRunoff ? 0.32 : 0.18) : material === "cloth" ? 0.84 : material === "metal" ? 0.42 : 0.68,
    metalness: material === "water" ? 0.05 : material === "metal" ? 0.62 : 0.02,
    emissive: material === "water" || material === "accent" ? color : "#000000",
    emissiveIntensity: material === "water" ? (isTempleRunoff ? 0.12 : 0.28) : material === "accent" ? 0.16 : 0,
    transparent: material === "water",
    opacity: material === "water" ? (isTempleRunoff ? 0.78 : 0.84) : 1
  };
  if (material !== "cloth" && material !== "accent") {
    materialOptions.map = texture;
    if (material !== "water") {
      materialOptions.bumpMap = texture;
      materialOptions.bumpScale = material === "metal" ? 0.025 : 0.065;
    }
  }
  const next = createQuizStrikeMaterial(styleForArenaSurface(material), materialOptions);
  materialCache.set(key, next);
  return next;
};

const createFlagClothGeometry = (width: number, height: number, segments = 12) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= 1; row += 1) {
    for (let column = 0; column <= segments; column += 1) {
      const progress = column / segments;
      const wave = Math.sin(progress * Math.PI * 2.4 + row * 0.65) * 0.075 * progress;
      positions.push(progress * width, -row * height, wave);
      uvs.push(progress, 1 - row);
    }
  }
  for (let column = 0; column < segments; column += 1) {
    const topLeft = column;
    const topRight = column + 1;
    const bottomLeft = segments + 1 + column;
    const bottomRight = bottomLeft + 1;
    indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

// The shared QuizStrikeLighting rig is created by sceneSetup. Maps only add
// local accent lights when a landmark genuinely benefits from one.
if (!isIronJunction) {
  const aqueductLight = new THREE.PointLight("#53e7ff", 42, 135, 2);
  aqueductLight.position.set(0, 7, isTempleRunoff ? -27 : 0);
  scene.add(aqueductLight);
}

const addBaseBeacon = (team: "blue" | "red", color: string) => {
  const base = teamBaseZones[team];
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
  const groundY = getArenaGroundHeight(arenaMapId, x, z);
  beacon.position.set(x, groundY, z);
  scene.add(beacon);
  if (activeQuality !== "performance") {
    const accentLight = new THREE.PointLight(color, isFps ? 9 : 16, 42, 2);
    accentLight.position.set(x, groundY + 7, z);
    scene.add(accentLight);
  }
};
if (shouldAddBaseBeacons(arenaMapId)) {
  addBaseBeacon("blue", "#38bdf8");
  addBaseBeacon("red", isZombieMode ? "#c084fc" : "#fb7185");
}

let flagMarker: THREE.Group | undefined;
if (session?.settings.gameMode === "flag" && session.flag) {
  const carrier = session.flag.carrierId ? session.players.find((player) => player.id === session.flag?.carrierId) : undefined;
  const markerX = carrier?.x ?? session.flag.position.x;
  const markerZ = carrier?.z ?? session.flag.position.z;
  const markerY = carrier
    ? getArenaObjectiveGroundY(
        arenaMapId,
        { x: markerX, y: carrier.y, z: markerZ },
        carrier.crouching ? FPS_CROUCH_EYE_HEIGHT : FPS_STANDING_EYE_HEIGHT
      )
    : getArenaObjectiveGroundY(arenaMapId, session.flag.position, FPS_STANDING_EYE_HEIGHT);
  flagMarker = new THREE.Group();
  const markerColor = session.flag.state === "placed" ? "#facc15" : "#fb7185";
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 8.8, 8),
    new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.42, roughness: 0.35 })
  );
  pole.position.y = 4.4;
  flagMarker.add(pole);
  const flagWidth = isFps ? 2.65 : 3.35;
  const flagHeight = isFps ? 1.35 : 1.7;
  const fabricGeometry = createFlagClothGeometry(flagWidth, flagHeight, isFps ? 14 : 10);
  const fabricMaterial = new THREE.MeshStandardMaterial({
    color: markerColor,
    emissive: markerColor,
    emissiveIntensity: 0.16,
    roughness: 0.74,
    metalness: 0.02,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide
  });
  const fabric = new THREE.Mesh(
    fabricGeometry,
    fabricMaterial
  );
  const flagTopY = isFps ? 7.8 : 7.55;
  fabric.position.set(0.16, flagTopY, 0);
  flagMarker.add(fabric);
  const fabricOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(fabricGeometry),
    new THREE.LineBasicMaterial({ color: "#fff7ed", transparent: true, opacity: 0.76 })
  );
  fabricOutline.position.copy(fabric.position);
  flagMarker.add(fabricOutline);
  const emblem = new THREE.Mesh(
    new THREE.CircleGeometry(isFps ? 0.18 : 0.23, 16),
    new THREE.MeshBasicMaterial({ color: "#fff7ed", transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  emblem.position.set(flagWidth * 0.46, flagTopY - flagHeight * 0.5, 0.04);
  flagMarker.add(emblem);
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 10),
    new THREE.MeshStandardMaterial({ color: "#f5d38a", metalness: 0.7, roughness: 0.3, emissive: "#5a3b1a", emissiveIntensity: 0.12 })
  );
  finial.position.y = 8.86;
  flagMarker.add(finial);
  const objectiveRingMaterial = new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.62 });
  const objectiveRing = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.14, 8, 32), objectiveRingMaterial);
  objectiveRing.position.y = 0.23;
  objectiveRing.rotation.x = Math.PI / 2;
  flagMarker.add(objectiveRing);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.5, roughness: 0.32, emissive: markerColor, emissiveIntensity: 0.12 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.18, 16), baseMaterial);
  base.position.y = 0.1;
  flagMarker.add(base);
  const flagGlow = new THREE.PointLight(markerColor, activeQuality === "performance" ? 0 : 18, 42, 2);
  flagGlow.position.y = 5;
  flagMarker.add(flagGlow);
  const updateFlagState = (state: FlagStateName) => {
    const nextColor = state === "placed" ? "#facc15" : "#fb7185";
    fabricMaterial.color.set(nextColor);
    fabricMaterial.emissive.set(nextColor);
    objectiveRingMaterial.color.set(nextColor);
    baseMaterial.emissive.set(nextColor);
    flagGlow.color.set(nextColor);
  };
  flagMarker.userData.updateFlagState = updateFlagState;
  updateFlagState(session.flag.state);
  flagMarker.position.set(markerX, markerY, markerZ);
  scene.add(flagMarker);
}

const floorMaterial = new THREE.MeshStandardMaterial({
  map: desertCitadelPbrTextures?.map ?? floorTexture,
  ...(desertCitadelPbrTextures
    ? {
        normalMap: desertCitadelPbrTextures.normalMap,
        roughnessMap: desertCitadelPbrTextures.roughnessMap
      }
    : {}),
  color: palette.floor,
  roughness: 0.9,
  metalness: 0.01,
  normalScale: new THREE.Vector2(0.32, 0.32)
});
const floor = new THREE.Mesh(new THREE.BoxGeometry(arenaBounds.limitX * 2, 0.3, arenaBounds.limitZ * 2), floorMaterial);
floor.position.y = -0.2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(
  arenaBounds.limitX * 2,
  35,
  isIronJunction ? "#aeb8b5" : isTempleRunoff ? "#b8d8ad" : "#fff1c1",
  isIronJunction ? "#566266" : isTempleRunoff ? "#4f6f52" : "#ad7b45"
);
grid.position.y = 0.012;
grid.material.transparent = true;
grid.material.opacity = 0.13;
if (activeQuality !== "performance") scene.add(grid);

const coverBoxes: THREE.Box3[] = [];
const collisionProxyMaterial = new THREE.MeshBasicMaterial({ visible: false, colorWrite: false, depthWrite: false });
const colliderForObject = (object: THREE.Object3D, pad = 0.25) => {
  const box = new THREE.Box3().setFromObject(object);
  box.min.x -= pad;
  box.max.x += pad;
  box.min.z -= pad;
  box.max.z += pad;
  coverBoxes.push(box);
};

const addDecorativeMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, material = "stone") => {
  const mesh = new THREE.Mesh(geometry, materialFor(color, material));
  staticBatcher.prepare(mesh, color, material);
  parent.add(mesh);
  return mesh;
};

const addBlockDetail = (block: (typeof arenaMap.blocks)[number]) => {
  if (
    !block.style ||
    (qualityConfig.detail === 0 &&
      block.style !== "stair" &&
      block.style !== "railcar" &&
      block.style !== "trackbed")
  ) {
    return;
  }
  const detail = new THREE.Group();
  detail.name = `detail_${block.id}`;
  detail.position.set(block.x, (block.y ?? block.h / 2) - block.h / 2, block.z);
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

  if (block.style === "stair") {
    const alongX = block.w < block.d;
    const nosing = addDecorativeMesh(
      detail,
      new THREE.BoxGeometry(
        alongX ? block.w * 0.22 : block.w * 0.96,
        0.12,
        alongX ? block.d * 0.96 : block.d * 0.22
      ),
      "#d99a3b",
      "accent"
    );
    nosing.position.set(
      alongX ? block.w * 0.37 : 0,
      block.h + 0.065,
      alongX ? 0 : block.d * 0.37
    );
  }

  if (block.style === "trackbed") {
    for (const z of [-block.d * 0.28, block.d * 0.28]) {
      const rail = addDecorativeMesh(
        detail,
        new THREE.BoxGeometry(block.w * 0.98, 0.2, 0.2),
        "#adb2ad",
        "metal"
      );
      rail.position.set(0, block.h + 0.18, z);
    }
    const tieCount = qualityConfig.detail === 0 ? 18 : 30;
    for (let index = 0; index < tieCount; index += 1) {
      const tie = addDecorativeMesh(
        detail,
        new THREE.BoxGeometry(0.34, 0.14, block.d * 0.88),
        "#574337",
        "wood"
      );
      tie.position.set(
        -block.w * 0.47 + (block.w * 0.94 * index) / (tieCount - 1),
        block.h + 0.07,
        0
      );
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
    const isLocomotive = block.id.includes("locomotive");
    const isBrakeVan = block.id.includes("damaged");
    const chassis = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.96, 0.52, block.d * 0.82), "#20282b", "metal");
    chassis.position.y = 1.22;
    const lowerSill = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.94, 0.32, block.d * 1.02), "#303a3d", "metal");
    lowerSill.position.y = 1.78;
    const roof = addDecorativeMesh(
      detail,
      new THREE.BoxGeometry(block.w * 0.94, 0.34, block.d * 1.04),
      isLocomotive ? "#273337" : "#6f4537",
      "metal"
    );
    roof.position.y = block.h + 0.18;
    for (const x of [-block.w * 0.32, -block.w * 0.22, block.w * 0.22, block.w * 0.32]) {
      for (const z of [-block.d * 0.53, block.d * 0.53]) {
        const wheel = addDecorativeMesh(detail, new THREE.CylinderGeometry(0.82, 0.82, 0.32, 12), "#202729", "metal");
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.72, z);
      }
    }
    for (const x of [-block.w * 0.27, block.w * 0.27]) {
      const bogie = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.2, 0.75, block.d * 0.72), "#293235", "metal");
      bogie.position.set(x, 1.05, 0);
    }
    for (const x of [-block.w * 0.51, block.w * 0.51]) {
      const coupler = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.07, 0.34, 0.34), "#202729", "metal");
      coupler.position.set(x, 1.25, 0);
      const bumper = addDecorativeMesh(detail, new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), "#202729", "metal");
      bumper.rotation.z = Math.PI / 2;
      bumper.position.set(x + Math.sign(x) * 0.4, 1.25, 0);
    }
    if (!isLocomotive) {
      const ribCount = Math.max(5, Math.min(9, Math.round(block.w / 5.5)));
      for (let index = 0; index < ribCount; index += 1) {
        const x = -block.w * 0.43 + (block.w * 0.86 * index) / Math.max(1, ribCount - 1);
        if (Math.abs(x) < block.w * 0.17) continue;
        for (const z of [-block.d * 0.515, block.d * 0.515]) {
          const rib = addDecorativeMesh(detail, new THREE.BoxGeometry(0.16, block.h * 0.68, 0.18), "#313b3e", "metal");
          rib.position.set(x, block.h * 0.56, z);
        }
      }
      for (const z of [-block.d * 0.525, block.d * 0.525]) {
        const door = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.3, block.h * 0.64, 0.2), isBrakeVan ? "#6f3f32" : block.color, "metal");
        door.position.set(0, block.h * 0.55, z);
        const doorTrack = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.38, 0.18, 0.25), "#252e31", "metal");
        doorTrack.position.set(0, block.h * 0.88, z);
        for (const x of [-block.w * 0.12, -block.w * 0.04, block.w * 0.04, block.w * 0.12]) {
          const doorRib = addDecorativeMesh(detail, new THREE.BoxGeometry(0.11, block.h * 0.56, 0.24), "#394447", "metal");
          doorRib.position.set(x, block.h * 0.54, z + Math.sign(z) * 0.02);
        }
      }
    }
    for (const x of [-block.w * 0.44, block.w * 0.44]) {
      const endLadder = addDecorativeMesh(detail, new THREE.BoxGeometry(0.16, block.h * 0.62, 0.16), "#d19a55", "metal");
      endLadder.position.set(x, block.h * 0.48, -block.d * 0.53);
    }
    if (isLocomotive) {
      const cab = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.28, block.h * 0.78, block.d * 0.86), "#313d41", "metal");
      cab.position.set(block.w * 0.27, block.h * 0.54, 0);
      const nose = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.2, block.h * 0.42, block.d * 0.72), "#744331", "metal");
      nose.position.set(block.w * 0.45, block.h * 0.3, 0);
      for (const z of [-block.d * 0.44, block.d * 0.44]) {
        const cabWindow = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.1, block.h * 0.2, 0.14), "#8eb2b8", "accent");
        cabWindow.position.set(block.w * 0.28, block.h * 0.68, z);
      }
      const exhaust = addDecorativeMesh(detail, new THREE.CylinderGeometry(0.42, 0.55, 2.2, 10), "#20282b", "metal");
      exhaust.position.set(block.w * 0.08, block.h + 1.15, 0);
    }
    if (isBrakeVan) {
      const lookout = addDecorativeMesh(detail, new THREE.BoxGeometry(block.w * 0.28, 1.6, block.d * 0.62), "#5d3930", "metal");
      lookout.position.set(0, block.h + 0.95, 0);
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
  group.rotation.set(block.rotationX ?? 0, block.rotationY ?? 0, block.rotationZ ?? 0);
  scene.add(group);
  const structural = ["wall", "ruin", "gate", "house", "tower", "shed", "machinery", "gantry"].includes(block.style ?? "");
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
  if (block.collides) {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(block.w, block.h, block.d), collisionProxyMaterial);
    proxy.name = `collision_proxy_${block.id}`;
    proxy.position.set(block.x, block.y ?? block.h / 2, block.z);
    proxy.rotation.set(block.rotationX ?? 0, block.rotationY ?? 0, block.rotationZ ?? 0);
    proxy.visible = false;
    proxy.userData.collisionProxy = true;
    scene.add(proxy);
    // Desert Citadel's shared obstacle proxies already use the player radius
    // during authoritative movement. Keep the client footprint exact so a
    // stair landing or market doorway cannot disagree by an extra 0.25u.
    colliderForObject(proxy, isDesertCitadel ? 0 : 0.25);
  }
  if (block.visual !== false) {
    addModularBlockBody(block);
    addBlockDetail(block);
  }
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
    const flagWidth = Math.max(1.8, prop.size * 2.35);
    const flagHeight = flagWidth * 0.58;
    const flagTopY = height - 0.45;
    const fabric = new THREE.Mesh(
      createFlagClothGeometry(flagWidth, flagHeight, 10),
      new THREE.MeshStandardMaterial({
        color: prop.color,
        roughness: 0.88,
        metalness: 0,
        side: THREE.DoubleSide
      })
    );
    fabric.position.set(0.15, flagTopY, 0);
    fabric.castShadow = !isFps;
    group.add(fabric);
    const finial = addDecorativeMesh(group, new THREE.SphereGeometry(0.18, 12, 8), "#d8b66f", "metal");
    finial.position.y = height + 0.08;
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
  mesh.name = `cylinder_visual_${cylinder.id}`;
  mesh.position.set(cylinder.x, cylinder.y ?? cylinder.h / 2, cylinder.z);
  mesh.castShadow = !isFps;
  mesh.receiveShadow = true;
  if (cylinder.visual !== false) {
    if (cylinder.material !== "water") staticBatcher.prepare(mesh, cylinder.color, cylinder.material ?? "stone");
    scene.add(mesh);
  }
  if (cylinder.collides) {
    const proxy: THREE.Mesh = cylinder.visual === false ? mesh : mesh.clone();
    proxy.name = `collision_proxy_${cylinder.id}`;
    proxy.material = collisionProxyMaterial;
    proxy.visible = false;
    proxy.userData.collisionProxy = true;
    if (cylinder.visual !== false) scene.add(proxy);
    else scene.add(mesh);
    colliderForObject(proxy, isDesertCitadel ? 0 : 0.2);
  }
});

const addCircle = (x: number, z: number, radius: number, color: string, opacity = 0.24, y?: number) => {
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(x, (y ?? getArenaGroundHeight(arenaMapId, x, z)) + 0.07, z);
  scene.add(circle);
  return circle;
};

captureZones.forEach((zone) => {
  const zoneY = "y" in zone ? zone.y : getArenaGroundHeight(arenaMapId, zone.x, zone.z);
  addCircle(zone.x, zone.z, zone.radius, "#facc15", 0.18, zoneY);
  const terminal = new THREE.Group();
  terminal.position.set(zone.x, zoneY + 0.085, zone.z);
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
});
// Search/retrieve items remain authoritative and visible on the minimap, but
// do not get a floating diamond in the 3D arena. The large marker obscured
// sightlines without adding a gameplay interaction.
addCircle(searchRetrieveDeliveryZones.blue.x, searchRetrieveDeliveryZones.blue.z, searchRetrieveDeliveryZones.blue.radius, "#38bdf8", 0.16, "y" in searchRetrieveDeliveryZones.blue ? searchRetrieveDeliveryZones.blue.y : undefined);
addCircle(searchRetrieveDeliveryZones.red.x, searchRetrieveDeliveryZones.red.z, searchRetrieveDeliveryZones.red.radius, "#fb7185", 0.16, "y" in searchRetrieveDeliveryZones.red ? searchRetrieveDeliveryZones.red.y : undefined);

const visibleTeamSpawns = getTeamSpawnsForMap(arenaMapId);
visibleTeamSpawns.blue.forEach((spawn) => addCircle(spawn.x, spawn.z, 2.2, "#38bdf8", isFps ? 0.08 : 0.28, Number.isFinite(spawn.y) ? Number(spawn.y) - FPS_STANDING_EYE_HEIGHT : undefined));
visibleTeamSpawns.red.forEach((spawn) => addCircle(spawn.x, spawn.z, 2.2, "#fb7185", isFps ? 0.08 : 0.28, Number.isFinite(spawn.y) ? Number(spawn.y) - FPS_STANDING_EYE_HEIGHT : undefined));
if (!isFps) FREE_FOR_ALL_SPAWNS.forEach((spawn) => addCircle(spawn.x, spawn.z, 1.3, "#ffffff", 0.18));

// Desert Citadel keeps all visible geometry traceable to its authored map
// manifest. Its edge rocks are intentionally omitted here; the other maps
// retain their seeded decorative scatter because this branch is map-scoped.
if (shouldScatterEdgeRocks(qualityConfig.detail, arenaMapId)) {
  const rockCount = qualityConfig.detail === 2 ? 34 : 20;
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const rockInstances = new THREE.InstancedMesh(rockGeometry, materialFor(isTempleRunoff ? "#56634b" : "#8f704d", "stone"), rockCount);
  const rockMatrix = new THREE.Matrix4();
  const rockPosition = new THREE.Vector3();
  const rockRotation = new THREE.Quaternion();
  const rockScale = new THREE.Vector3();
  const random = seededRandom(isIronJunction ? 913 : isTempleRunoff ? 74013 : 617);
  for (let index = 0; index < rockCount; index += 1) {
    const onHorizontalEdge = index % 2 === 0;
    rockPosition.set(
      onHorizontalEdge ? (random() * 2 - 1) * (arenaBounds.limitX - 9) : (random() > 0.5 ? -1 : 1) * (arenaBounds.limitX - 5 - random() * 5),
      0.28 + random() * 0.45,
      onHorizontalEdge ? (random() > 0.5 ? -1 : 1) * (arenaBounds.limitZ - 5 - random() * 5) : (random() * 2 - 1) * (arenaBounds.limitZ - 9)
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
const templeRunoffArt = isTempleRunoff ? addTempleRunoffArtPass(scene, addDecorativeMesh, qualityConfig.detail, isFps) : null;
const desertCitadelArt = isDesertCitadel ? addDesertCitadelArtPass(scene, addDecorativeMesh, qualityConfig.detail, isFps) : null;
const desertCitadelVfx = isIronJunction || isTempleRunoff ? null : addDesertCitadelVfx(scene, qualityConfig.detail);
const staticBatchStats = staticBatcher.flush(scene);
renderer.domElement.dataset.staticSources = String(staticBatchStats.sourceMeshes);
renderer.domElement.dataset.staticBatches = String(staticBatchStats.batchMeshes);


  return {
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
    athleticsUpdate: undefined,
  };
};
