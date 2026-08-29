import * as THREE from "three";
import {
  ATHLETICS_COLLISION_PROXIES,
  ATHLETICS_PLAYER_EYE_HEIGHT,
  ATHLETICS_STADIUM_COURSE,
  getAthleticsMovingObstaclePosition,
  getAthleticsPointAtProgress,
  getAthleticsRouteTangent,
  type AthleticsAccent,
  type AthleticsCourseSurface,
  type AthleticsMovingObstacle
} from "@quizstrike/shared";
import { ArenaStaticBatcher, makeSurfaceAtlas } from "./ArenaStaticBatch";
import type { ArenaQuality } from "./gamePreferences";
import type { ArenaQualityConfig } from "./sceneSetup";

type ActiveArenaQuality = Exclude<ArenaQuality, "auto">;
type TextureKind = "floor" | "stone" | "wood" | "water" | "sand" | "metal";

type AthleticsStadiumBuilderDependencies = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  activeQuality: ActiveArenaQuality;
  qualityConfig: ArenaQualityConfig;
  makeCanvasTexture: (kind: TextureKind, accent?: string) => THREE.CanvasTexture;
  makeLabelTexture: (label: string, color?: string, background?: string) => THREE.CanvasTexture;
  questionsPerLap?: number;
  serverTime?: string;
  debugOverlay?: boolean;
};

const sectionColors: Record<AthleticsAccent, string> = {
  cyan: "#40d9ff",
  orange: "#ff9c54",
  lime: "#b5ef71",
  violet: "#b697ff",
  pink: "#ff7fb4",
  gold: "#ffd66e"
};

const makeMaterial = (
  cache: Map<string, THREE.MeshStandardMaterial>,
  key: string,
  color: string,
  options: THREE.MeshStandardMaterialParameters = {}
) => {
  const existing = cache.get(key);
  if (existing) return existing;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08, ...options });
  cache.set(key, material);
  return material;
};

const addMesh = <T extends THREE.BufferGeometry>(
  parent: THREE.Object3D,
  geometry: T,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const addBox = (
  parent: THREE.Object3D,
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => addMesh(parent, new THREE.BoxGeometry(...size), material, position, rotation);

const addCylinder = (
  parent: THREE.Object3D,
  material: THREE.Material,
  radius: number,
  height: number,
  position: [number, number, number],
  segments = 16,
  rotation: [number, number, number] = [0, 0, 0]
) => addMesh(parent, new THREE.CylinderGeometry(radius, radius, height, segments), material, position, rotation);

const addRouteRibbon = (
  parent: THREE.Object3D,
  material: THREE.Material,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  width: number,
  yOffset = 0.1
) => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz) || 1;
  const mesh = addBox(
    parent,
    material,
    [width, 0.08, length],
    [(start.x + end.x) / 2, (start.y + end.y) / 2 + yOffset, (start.z + end.z) / 2],
    [0, Math.atan2(dx, dz), 0]
  );
  mesh.castShadow = false;
  return mesh;
};

const addArch = (
  parent: THREE.Object3D,
  material: THREE.Material,
  point: { x: number; y: number; z: number },
  progress: number,
  width = 24,
  height = 9
) => {
  const tangent = getAthleticsRouteTangent(progress);
  const angle = Math.atan2(tangent.x, tangent.z);
  const normal = { x: -tangent.z, z: tangent.x };
  const postOffset = width / 2;
  addBox(parent, material, [0.85, height, 0.85], [point.x + normal.x * postOffset, point.y + height / 2, point.z + normal.z * postOffset]);
  addBox(parent, material, [0.85, height, 0.85], [point.x - normal.x * postOffset, point.y + height / 2, point.z - normal.z * postOffset]);
  addBox(parent, material, [width + 0.85, 0.85, 0.85], [point.x, point.y + height, point.z], [0, angle, 0]);
};

const addBunting = (
  parent: THREE.Object3D,
  material: THREE.Material,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  count = 8
) => {
  for (let index = 0; index <= count; index += 1) {
    const part = index / count;
    addMesh(
      parent,
      new THREE.SphereGeometry(0.32, 8, 6),
      material,
      [
        start.x + (end.x - start.x) * part,
        start.y + (end.y - start.y) * part - Math.sin(part * Math.PI) * 1.6,
        start.z + (end.z - start.z) * part
      ]
    );
  }
};

const addFairgroundStall = (
  parent: THREE.Object3D,
  materials: { wall: THREE.Material; roof: THREE.Material; trim: THREE.Material },
  position: { x: number; y: number; z: number },
  label: string,
  makeLabelTexture: AthleticsStadiumBuilderDependencies["makeLabelTexture"],
  materialCache: Map<string, THREE.MeshStandardMaterial>
) => {
  addBox(parent, materials.wall, [10, 5.5, 7], [position.x, position.y + 2.75, position.z]);
  addBox(parent, materials.roof, [12, 0.7, 9], [position.x, position.y + 5.9, position.z]);
  addBox(parent, materials.trim, [10.8, 0.45, 0.5], [position.x, position.y + 4.1, position.z - 3.55]);
  addBox(parent, materials.trim, [0.5, 4.4, 6.6], [position.x - 5.1, position.y + 2.4, position.z]);
  const labelTexture = makeLabelTexture(label, "#241525", "#ffe78a");
  const labelMaterial = makeMaterial(materialCache, `stall-label-${label}`, "#ffffff", {
    map: labelTexture,
    emissive: "#ffffff",
    emissiveMap: labelTexture,
    emissiveIntensity: 0.25
  });
  addBox(parent, labelMaterial, [7.6, 1.35, 0.08], [position.x, position.y + 4.8, position.z - 3.62]);
};

const addFerrisWheel = (
  parent: THREE.Object3D,
  metal: THREE.Material,
  accent: THREE.Material,
  gondola: THREE.Material,
  center: { x: number; y: number; z: number }
) => {
  const wheel = new THREE.Group();
  wheel.name = "ferris-wheel-ride";
  wheel.position.set(center.x, center.y, center.z);
  parent.add(wheel);
  addMesh(wheel, new THREE.TorusGeometry(30, 1.15, 10, 48), accent, [0, 0, 0]);
  addMesh(wheel, new THREE.CylinderGeometry(3.2, 3.2, 2.8, 20), metal, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let spoke = 0; spoke < 10; spoke += 1) {
    addBox(wheel, metal, [0.42, 58, 0.42], [0, 0, 0], [0, 0, (spoke / 10) * Math.PI]);
    const angle = (spoke / 10) * Math.PI * 2;
    addBox(wheel, gondola, [4.4, 3.1, 3], [Math.cos(angle) * 30, Math.sin(angle) * 30, 0]);
  }
  addBox(parent, metal, [3, 42, 3], [center.x - 16, center.y - 22, center.z]);
  addBox(parent, metal, [3, 42, 3], [center.x + 16, center.y - 22, center.z]);
  addBox(parent, metal, [42, 2.5, 3], [center.x, center.y - 43, center.z]);
  return wheel;
};

const addBumperCarBowl = (
  parent: THREE.Object3D,
  floor: THREE.Material,
  rail: THREE.Material,
  accent: THREE.Material,
  center: { x: number; y: number; z: number }
) => {
  addMesh(parent, new THREE.CylinderGeometry(22, 22, 0.55, 32), floor, [center.x, center.y + 0.25, center.z]);
  addMesh(parent, new THREE.TorusGeometry(22, 0.8, 8, 36), rail, [center.x, center.y + 1.1, center.z], [Math.PI / 2, 0, 0]);
  addCylinder(parent, accent, 1.25, 6, [center.x, center.y + 3.3, center.z], 14);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    addBox(parent, rail, [3.2, 0.7, 3.2], [center.x + Math.cos(angle) * 13, center.y + 1.1, center.z + Math.sin(angle) * 13], [0, -angle, 0]);
  }
};

const addDropTower = (
  parent: THREE.Object3D,
  metal: THREE.Material,
  accent: THREE.Material,
  center: { x: number; y: number; z: number }
) => {
  addCylinder(parent, accent, 5.5, 86, [center.x, center.y + 43, center.z], 12);
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2;
    addBox(parent, metal, [1.1, 88, 1.1], [center.x + Math.cos(angle) * 8, center.y + 44, center.z + Math.sin(angle) * 8]);
  }
  for (let ring = 0; ring < 5; ring += 1) {
    addMesh(parent, new THREE.TorusGeometry(9, 0.38, 8, 24), accent, [center.x, center.y + 8 + ring * 17, center.z], [Math.PI / 2, 0, 0]);
  }
  addBox(parent, metal, [23, 1.5, 23], [center.x, center.y + 0.75, center.z]);
};

const makeCollisionBox = (obstacle: (typeof ATHLETICS_COLLISION_PROXIES)[number]) => {
  const minY = obstacle.minY ?? 0;
  const maxY = obstacle.maxY ?? 3;
  const halfWidth = obstacle.kind === "rect" ? obstacle.width / 2 : obstacle.radius;
  const halfDepth = obstacle.kind === "rect" ? obstacle.depth / 2 : obstacle.radius;
  return new THREE.Box3(
    new THREE.Vector3(obstacle.x - halfWidth, minY, obstacle.z - halfDepth),
    new THREE.Vector3(obstacle.x + halfWidth, maxY, obstacle.z + halfDepth)
  );
};

export const buildAthleticsStadiumScene = ({
  scene,
  renderer,
  activeQuality,
  qualityConfig,
  makeCanvasTexture,
  makeLabelTexture,
  questionsPerLap = 7,
  serverTime,
  debugOverlay = false
}: AthleticsStadiumBuilderDependencies) => {
  const floorTexture = makeCanvasTexture("floor", "#a8d9a9");
  const stoneTexture = makeCanvasTexture("stone", "#dbe6e2");
  const woodTexture = makeCanvasTexture("wood", "#dba16e");
  const waterTexture = makeCanvasTexture("water", "#5de6ec");
  const sandTexture = makeCanvasTexture("sand", "#dfc875");
  const metalTexture = makeCanvasTexture("metal", "#a9c2cc");
  [floorTexture, stoneTexture, woodTexture, waterTexture, sandTexture, metalTexture].forEach((texture) => {
    texture.anisotropy = qualityConfig.anisotropy;
  });
  const surfaceAtlas = makeSurfaceAtlas({ stone: stoneTexture, wood: woodTexture, metal: metalTexture, sand: sandTexture });
  const staticBatcher = new ArenaStaticBatcher(surfaceAtlas, qualityConfig.shadows && activeQuality !== "performance");
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const collisionProxyMaterial = new THREE.MeshBasicMaterial({ visible: false, colorWrite: false, depthWrite: false });
  const park = new THREE.Group();
  park.name = "skyline-adventure-park";
  scene.add(park);

  scene.background = new THREE.Color("#f3ae78");
  scene.fog = new THREE.Fog("#f3cda7", 150, 560);
  scene.add(new THREE.HemisphereLight("#fff1d0", "#16445a", 1.55));
  const keyLight = new THREE.DirectionalLight("#fff2c7", 3.1);
  keyLight.position.set(-120, 240, 150);
  keyLight.castShadow = qualityConfig.shadows && activeQuality !== "performance";
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -250;
  keyLight.shadow.camera.right = 250;
  keyLight.shadow.camera.top = 270;
  keyLight.shadow.camera.bottom = -270;
  scene.add(keyLight);
  const sunsetFill = new THREE.DirectionalLight("#ff83b0", 1.05);
  sunsetFill.position.set(180, 80, -220);
  scene.add(sunsetFill);
  const parkGlow = new THREE.PointLight("#ffe36e", 70, 220, 2);
  parkGlow.position.set(0, 44, 72);
  scene.add(parkGlow);

  const turf = makeMaterial(materialCache, "park-turf", "#4d9b68", { roughness: 0.95 });
  const path = makeMaterial(materialCache, "park-path", "#4b7189", { roughness: 0.82 });
  const lane = makeMaterial(materialCache, "park-lane", "#eaffd5", { roughness: 0.45, emissive: "#a6ffdc", emissiveIntensity: 0.22 });
  const wood = makeMaterial(materialCache, "park-wood", "#c97845", { roughness: 0.76 });
  const metal = makeMaterial(materialCache, "park-metal", "#5a6c86", { roughness: 0.38, metalness: 0.56 });
  const cream = makeMaterial(materialCache, "park-cream", "#fff0c8", { roughness: 0.68 });
  const dark = makeMaterial(materialCache, "park-dark", "#26334d", { roughness: 0.78 });
  const accentMaterials = Object.fromEntries(
    (Object.entries(sectionColors) as Array<[AthleticsAccent, string]>).map(([accent, color]) => [
      accent,
      makeMaterial(materialCache, `accent-${accent}`, color, { emissive: color, emissiveIntensity: 0.18, roughness: 0.5 })
    ])
  ) as Record<AthleticsAccent, THREE.MeshStandardMaterial>;

  const addBatchedBox = (
    material: THREE.MeshStandardMaterial,
    size: [number, number, number],
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    surface: "stone" | "wood" | "metal" | "sand" | "accent" = "stone"
  ) => staticBatcher.prepare(addBox(park, material, size, position, rotation), `#${material.color.getHexString()}`, surface);

  // A broad fairground floor and perimeter establish scale before the player
  // reaches the first raised platform.
  addBox(park, turf, [460, 1, 460], [0, -0.52, 0]);
  addBatchedBox(cream, [452, 0.7, 452], [0, 0.02, 0], [0, 0, 0], "sand");
  addBox(park, turf, [438, 0.28, 438], [0, 0.48, 0]);
  for (const side of [-1, 1]) {
    addBatchedBox(dark, [4, 10, 438], [side * 224, 5, 0], [0, 0, 0], "stone");
    for (let z = -196; z <= 196; z += 28) {
      addBox(park, metal, [1.2, 15, 1.2], [side * 218, 7.5, z]);
      addBox(park, accentMaterials.cyan, [4, 0.34, 0.4], [side * 218, 13, z]);
    }
  }
  for (const z of [-224, 224]) addBatchedBox(dark, [448, 10, 4], [0, 5, z], [0, 0, 0], "stone");

  const course = ATHLETICS_STADIUM_COURSE;
  for (let index = 0; index < course.route.length - 1; index += 1) {
    const start = course.route[index]!;
    const end = course.route[index + 1]!;
    addRouteRibbon(park, path, start, end, course.routeWidth * 1.95, 0.16);
    addRouteRibbon(park, lane, start, end, 0.26, 0.27);
    if (index % 2 === 0) {
      const section = course.sections[Math.min(course.sections.length - 1, Math.floor(index / 4))]!;
      addRouteRibbon(park, accentMaterials[section.accent], start, end, 0.08, 0.31);
    }
  }

  const supportColumn = (surface: AthleticsCourseSurface, material: THREE.MeshStandardMaterial, index: number) => {
    if (surface.y < 3) return;
    const height = surface.y - 0.8;
    const tangent = getAthleticsRouteTangent(index / Math.max(1, course.surfaces.length - 1));
    const normal = { x: -tangent.z, z: tangent.x };
    const inset = Math.min(surface.width, surface.depth) * 0.34;
    for (const side of [-1, 1]) {
      addBatchedBox(material, [2.4, height, 2.4], [surface.x + normal.x * inset * side, height / 2, surface.z + normal.z * inset * side], [0, 0, 0], "metal");
    }
  };

  course.surfaces.forEach((surface, index) => {
    const progress = index / Math.max(1, course.surfaces.length - 1);
    const accent = course.sections.find((section) => progress <= section.endProgress)?.accent ?? "cyan";
    const platformMaterial = surface.material === "wood" ? wood : surface.material === "accent" ? accentMaterials[accent] : metal;
    const slabHeight = surface.y <= 0 ? 0.55 : 1.1;
    addBatchedBox(
      platformMaterial,
      [surface.width, slabHeight, surface.depth],
      [surface.x, surface.y - slabHeight / 2, surface.z],
      [0, surface.rotationY ?? 0, 0],
      surface.material === "wood" ? "wood" : surface.material === "accent" ? "accent" : "metal"
    );
    if (qualityConfig.detail > 0) supportColumn(surface, platformMaterial, index);
    if (surface.kind === "checkpoint") {
      addBox(park, accentMaterials[accent], [surface.width * 0.72, 0.16, 0.5], [surface.x, surface.y + 0.1, surface.z]);
      addBox(park, cream, [0.35, 0.18, surface.depth * 0.72], [surface.x - surface.width * 0.3, surface.y + 0.11, surface.z]);
      addBox(park, cream, [0.35, 0.18, surface.depth * 0.72], [surface.x + surface.width * 0.3, surface.y + 0.11, surface.z]);
    }
    if (surface.kind === "stair" || index % 9 === 4) {
      const next = course.surfaces[index + 1];
      if (next) {
        const dx = next.x - surface.x;
        const dz = next.z - surface.z;
        const distance = Math.hypot(dx, dz) || 1;
        const steps = 6;
        for (let step = 1; step <= steps; step += 1) {
          const part = step / (steps + 1);
          const topY = surface.y + (next.y - surface.y) * part;
          addBatchedBox(
            platformMaterial,
            [Math.min(surface.width, next.width) * 0.72, 0.5, Math.max(2.4, distance / (steps + 2))],
            [surface.x + dx * part, topY - 0.25, surface.z + dz * part],
            [0, Math.atan2(dx, dz), 0],
            surface.material === "wood" ? "wood" : "metal"
          );
        }
      }
    }
  });

  // Entrance, midway and ride landmarks make each section readable from the
  // overview camera. They are generated geometry, so the course has no asset
  // dependency or attribution burden at runtime.
  const start = getAthleticsPointAtProgress(0);
  const finish = getAthleticsPointAtProgress(1);
  addArch(park, accentMaterials.cyan, start, 0, 28, 11);
  addArch(park, accentMaterials.gold, finish, 1, 30, 13);
  const startLabel = makeLabelTexture(`START · +${questionsPerLap > 0 ? "250" : "ENERGY"} ENERGY`, "#0e1a2d", "#7bf0ff");
  const finishLabel = makeLabelTexture("SUMMIT FINISH", "#2b1731", "#ffd66e");
  const labelMaterial = (key: string, texture: THREE.Texture) => makeMaterial(materialCache, key, "#ffffff", {
    map: texture,
    emissive: "#ffffff",
    emissiveMap: texture,
    emissiveIntensity: 0.38
  });
  addBox(park, labelMaterial("start-label", startLabel), [16, 2.1, 0.08], [start.x, start.y + 8.1, start.z - 0.4]);
  addBox(park, labelMaterial("finish-label", finishLabel), [13, 2.1, 0.08], [finish.x, finish.y + 10.1, finish.z + 0.4]);
  addBunting(park, accentMaterials.orange, { x: start.x - 18, y: start.y + 8, z: start.z + 3 }, { x: start.x + 18, y: start.y + 8, z: start.z + 3 });
  addBunting(park, accentMaterials.gold, { x: finish.x - 19, y: finish.y + 10, z: finish.z - 3 }, { x: finish.x + 19, y: finish.y + 10, z: finish.z - 3 });

  const midway = getAthleticsPointAtProgress(0.15);
  addFairgroundStall(park, { wall: accentMaterials.orange, roof: accentMaterials.gold, trim: cream }, { x: midway.x - 25, y: midway.y, z: midway.z - 18 }, "COTTON CANDY", makeLabelTexture, materialCache);
  addFairgroundStall(park, { wall: accentMaterials.pink, roof: accentMaterials.violet, trim: cream }, { x: midway.x + 25, y: midway.y, z: midway.z + 18 }, "RING TOSS", makeLabelTexture, materialCache);
  addBunting(park, accentMaterials.pink, { x: midway.x - 35, y: midway.y + 8, z: midway.z }, { x: midway.x + 35, y: midway.y + 8, z: midway.z });

  const bumper = getAthleticsPointAtProgress(0.28);
  addBumperCarBowl(park, dark, accentMaterials.lime, accentMaterials.orange, { x: bumper.x + 28, y: bumper.y, z: bumper.z - 14 });
  const funhouse = getAthleticsPointAtProgress(0.38);
  addBox(park, accentMaterials.violet, [38, 16, 5], [funhouse.x - 24, funhouse.y + 8, funhouse.z + 24]);
  for (let stripe = 0; stripe < 7; stripe += 1) {
    addBox(park, stripe % 2 === 0 ? cream : accentMaterials.pink, [5, 16, 0.35], [funhouse.x - 39 + stripe * 5, funhouse.y + 8, funhouse.z + 21.35]);
  }
  addBox(park, accentMaterials.violet, [44, 1.3, 8], [funhouse.x - 24, funhouse.y + 16.7, funhouse.z + 24]);
  addMesh(park, new THREE.TorusGeometry(7, 1.1, 8, 24), accentMaterials.cyan, [funhouse.x - 24, funhouse.y + 8, funhouse.z + 20], [Math.PI / 2, 0, 0]);

  const pier = getAthleticsPointAtProgress(0.47);
  for (let index = -2; index <= 2; index += 1) {
    const x = pier.x + index * 12;
    addBox(park, wood, [2.2, 32, 2.2], [x, pier.y + 16, pier.z + 25]);
    addBox(park, metal, [9, 0.8, 3], [x, pier.y + 31, pier.z + 25]);
    addMesh(park, new THREE.SphereGeometry(1.2, 12, 8), accentMaterials.pink, [x, pier.y + 33, pier.z + 25]);
  }
  addBunting(park, accentMaterials.pink, { x: pier.x - 28, y: pier.y + 33, z: pier.z + 25 }, { x: pier.x + 28, y: pier.y + 33, z: pier.z + 25 });

  const ferris = getAthleticsPointAtProgress(0.55);
  const ferrisWheel = addFerrisWheel(park, metal, accentMaterials.gold, accentMaterials.pink, { x: ferris.x - 30, y: ferris.y + 45, z: ferris.z + 28 });
  const coaster = getAthleticsPointAtProgress(0.66);
  for (let index = 0; index < 9; index += 1) {
    const progress = 0.62 + index * 0.012;
    const point = getAthleticsPointAtProgress(progress);
    const tangent = getAthleticsRouteTangent(progress);
    addBox(park, metal, [1.5, point.y + 5, 1.5], [point.x + 9, (point.y + 5) / 2, point.z + 12]);
    addBox(park, accentMaterials.cyan, [18, 0.7, 1.1], [point.x, point.y + 5.7, point.z + 12], [0, Math.atan2(tangent.x, tangent.z), 0]);
  }
  addBunting(park, accentMaterials.cyan, { x: coaster.x - 20, y: coaster.y + 11, z: coaster.z + 12 }, { x: coaster.x + 20, y: coaster.y + 11, z: coaster.z + 12 });

  const drop = getAthleticsPointAtProgress(0.78);
  addDropTower(park, metal, accentMaterials.orange, { x: drop.x + 28, y: drop.y, z: drop.z - 22 });
  const sky = getAthleticsPointAtProgress(0.88);
  for (const [x, z, color] of [
    [sky.x - 30, sky.z - 22, "pink"],
    [sky.x + 20, sky.z - 30, "cyan"],
    [sky.x + 38, sky.z + 18, "gold"]
  ] as Array<[number, number, AthleticsAccent]>) {
    addMesh(park, new THREE.SphereGeometry(5, 16, 12), accentMaterials[color], [x, sky.y + 35, z]);
    addBox(park, cream, [0.22, 34, 0.22], [x, sky.y + 18, z]);
  }
  addBox(park, accentMaterials.lime, [48, 1.1, 5], [sky.x, sky.y + 20, sky.z + 18]);

  course.checkpoints.forEach((progress, index) => {
    const point = getAthleticsPointAtProgress(progress);
    const section = course.sections.find((candidate) => progress <= candidate.endProgress);
    addArch(park, accentMaterials[section?.accent ?? "cyan"], point, progress, 20, 7.5);
    const checkpointLabel = makeLabelTexture(`CHECKPOINT ${index + 1}`, "#13243b", sectionColors[section?.accent ?? "cyan"]);
    addBox(park, labelMaterial(`checkpoint-label-${index}`, checkpointLabel), [7.5, 1.2, 0.08], [point.x, point.y + 7.9, point.z]);
  });

  const movingGroups = course.movingObstacles.map((obstacle: AthleticsMovingObstacle) => {
    const group = new THREE.Group();
    group.name = `moving-${obstacle.id}`;
    group.position.set(obstacle.x, obstacle.y, obstacle.z);
    const material = obstacle.material === "wood" ? wood : obstacle.material === "accent" ? accentMaterials.orange : metal;
    addBox(group, material, [obstacle.width, obstacle.height, obstacle.depth], [0, obstacle.height / 2, 0]);
    addBox(group, cream, [obstacle.width * 0.72, 0.12, 0.24], [0, obstacle.height + 0.08, -obstacle.depth * 0.28]);
    if (obstacle.kind === "elevator") addBox(group, accentMaterials.cyan, [0.4, obstacle.height + 1.6, 0.4], [0, -(obstacle.height + 1.6) / 2, 0]);
    park.add(group);
    return { obstacle, group };
  });

  const coverBoxes = ATHLETICS_COLLISION_PROXIES.map(makeCollisionBox);
  const movingCoverStartIndex = coverBoxes.length;
  for (const obstacle of course.movingObstacles) {
    const position = getAthleticsMovingObstaclePosition(obstacle, Date.now());
    coverBoxes.push(new THREE.Box3(
      new THREE.Vector3(position.x - obstacle.width / 2, position.y, position.z - obstacle.depth / 2),
      new THREE.Vector3(position.x + obstacle.width / 2, position.y + obstacle.height, position.z + obstacle.depth / 2)
    ));
  }

  if (debugOverlay) {
    const collisionDebug = new THREE.Group();
    collisionDebug.name = "athletics-course-collision-debug";
    coverBoxes.forEach((box, index) => {
      const isMoving = index >= movingCoverStartIndex;
      const helper = new THREE.Box3Helper(box, isMoving ? "#ff8e5e" : "#66e5ff");
      helper.renderOrder = 4;
      collisionDebug.add(helper);
    });
    park.add(collisionDebug);
  }

  const serverTimeMs = serverTime ? Date.parse(serverTime) : Number.NaN;
  const serverOffsetMs = Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0;
  const previousMovingPositions = new Map<string, { x: number; y: number; z: number }>();
  movingGroups.forEach(({ obstacle }) => {
    previousMovingPositions.set(obstacle.id, getAthleticsMovingObstaclePosition(obstacle, Date.now() + serverOffsetMs));
  });

  const staticBatchStats = staticBatcher.flush(scene);
  renderer.domElement.dataset.staticSources = String(staticBatchStats.sourceMeshes);
  renderer.domElement.dataset.staticBatches = String(staticBatchStats.batchMeshes);
  const athleticsUpdate = (elapsed: number, currentPosition?: THREE.Vector3, grounded = false) => {
    void elapsed;
    const nowMs = Date.now() + serverOffsetMs;
    const carry = new THREE.Vector3();
    movingGroups.forEach(({ obstacle, group }, index) => {
      const next = getAthleticsMovingObstaclePosition(obstacle, nowMs);
      const previous = previousMovingPositions.get(obstacle.id) ?? next;
      const coverBox = coverBoxes[movingCoverStartIndex + index];
      if (coverBox) {
        coverBox.min.set(next.x - obstacle.width / 2, next.y, next.z - obstacle.depth / 2);
        coverBox.max.set(next.x + obstacle.width / 2, next.y + obstacle.height, next.z + obstacle.depth / 2);
      }
      if (currentPosition && grounded
        && Math.abs(currentPosition.y - ATHLETICS_PLAYER_EYE_HEIGHT - previous.y) < 1.35
        && Math.abs(currentPosition.x - previous.x) <= obstacle.width / 2 + 0.75
        && Math.abs(currentPosition.z - previous.z) <= obstacle.depth / 2 + 0.75) {
        carry.x += next.x - previous.x;
        carry.y += next.y - previous.y;
        carry.z += next.z - previous.z;
      }
      group.position.set(next.x, next.y, next.z);
      previousMovingPositions.set(obstacle.id, next);
    });
    ferrisWheel.rotation.z = nowMs * 0.00008;
    return { x: carry.x, y: carry.y, z: carry.z };
  };

  return {
    floorTexture,
    stoneTexture,
    woodTexture,
    waterTexture,
    sandTexture,
    metalTexture,
    desertCitadelPbrTextures: null,
    materialCache,
    staticBatcher,
    collisionProxyMaterial,
    coverBoxes,
    flagMarker: undefined,
    templeRunoffArt: null,
    desertCitadelArt: null,
    desertCitadelVfx: null,
    athleticsUpdate
  };
};
