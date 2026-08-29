import * as THREE from "three";
import {
  ATHLETICS_COLLISION_PROXIES,
  ATHLETICS_STADIUM_COURSE,
  getAthleticsPointAtProgress,
  getAthleticsRouteTangent
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
};

const sectionColors = {
  cyan: "#40d9ff",
  orange: "#ff9c54",
  lime: "#b5ef71",
  violet: "#b697ff",
  pink: "#ff7fb4",
  gold: "#ffd66e"
} as const;

const makeMaterial = (
  cache: Map<string, THREE.MeshStandardMaterial>,
  key: string,
  color: string,
  options: THREE.MeshStandardMaterialParameters = {}
) => {
  const existing = cache.get(key);
  if (existing) return existing;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.08,
    ...options
  });
  cache.set(key, material);
  return material;
};

const addMesh = <T extends THREE.BufferGeometry>(
  scene: THREE.Object3D,
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
  scene.add(mesh);
  return mesh;
};

const addBox = (
  scene: THREE.Object3D,
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => addMesh(scene, new THREE.BoxGeometry(...size), material, position, rotation);

const addRouteRibbon = (
  scene: THREE.Object3D,
  material: THREE.Material,
  start: { x: number; z: number },
  end: { x: number; z: number },
  width: number,
  y: number
) => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  const mesh = addBox(
    scene,
    material,
    [width, 0.08, length],
    [(start.x + end.x) / 2, y, (start.z + end.z) / 2],
    [0, Math.atan2(dx, dz), 0]
  );
  mesh.castShadow = false;
  return mesh;
};

const addArch = (
  scene: THREE.Object3D,
  material: THREE.Material,
  point: { x: number; z: number },
  progress: number,
  width = 24,
  height = 9
) => {
  const tangent = getAthleticsRouteTangent(progress);
  const angle = Math.atan2(tangent.x, tangent.z);
  const normal = { x: -tangent.z, z: tangent.x };
  const postOffset = width / 2;
  const left = [point.x + normal.x * postOffset, height / 2, point.z + normal.z * postOffset] as [number, number, number];
  const right = [point.x - normal.x * postOffset, height / 2, point.z - normal.z * postOffset] as [number, number, number];
  addBox(scene, material, [0.8, height, 0.8], left);
  addBox(scene, material, [0.8, height, 0.8], right);
  addBox(scene, material, [width + 0.8, 0.8, 0.8], [point.x, height, point.z], [0, angle, 0]);
};

export const buildAthleticsStadiumScene = ({
  scene,
  renderer,
  activeQuality,
  qualityConfig,
  makeCanvasTexture,
  makeLabelTexture,
  questionsPerLap = 7
}: AthleticsStadiumBuilderDependencies) => {
  const floorTexture = makeCanvasTexture("floor", "#b8e3c5");
  const stoneTexture = makeCanvasTexture("stone", "#dbe6e2");
  const woodTexture = makeCanvasTexture("wood", "#dba16e");
  const waterTexture = makeCanvasTexture("water", "#5de6ec");
  const sandTexture = makeCanvasTexture("sand", "#dfc875");
  const metalTexture = makeCanvasTexture("metal", "#a9c2cc");
  [floorTexture, stoneTexture, woodTexture, waterTexture, sandTexture, metalTexture].forEach((texture) => {
    texture.anisotropy = qualityConfig.anisotropy;
  });
  const surfaceAtlas = makeSurfaceAtlas({ stone: stoneTexture, wood: woodTexture, metal: metalTexture, sand: sandTexture });
  const staticBatcher = new ArenaStaticBatcher(surfaceAtlas, !qualityConfig.shadows ? false : activeQuality !== "performance");
  const addBatchedBox = (
    parent: THREE.Object3D,
    material: THREE.MeshStandardMaterial,
    size: [number, number, number],
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    surface = "stone"
  ) => staticBatcher.prepare(
    addBox(parent, material, size, position, rotation),
    `#${material.color.getHexString()}`,
    surface
  );
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const collisionProxyMaterial = new THREE.MeshBasicMaterial({ visible: false, colorWrite: false, depthWrite: false });
  const stadium = new THREE.Group();
  stadium.name = "athletics-stadium-loop";
  scene.add(stadium);
  scene.background = new THREE.Color("#071625");
  scene.fog = new THREE.Fog("#0d2734", 105, 310);

  // The combat map builder owns its own daylight rig. Athletics bypasses that
  // builder, so give the stadium a compact sports-night rig of its own. Keep
  // the key light shadowed only at higher quality; the emissive gate accents
  // still carry the route at performance quality.
  scene.add(new THREE.HemisphereLight("#dff7ff", "#10283a", 1.45));
  const keyLight = new THREE.DirectionalLight("#fff1cf", 2.35);
  keyLight.position.set(-85, 170, 110);
  keyLight.castShadow = qualityConfig.shadows && activeQuality !== "performance";
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -92;
  keyLight.shadow.camera.right = 92;
  keyLight.shadow.camera.top = 150;
  keyLight.shadow.camera.bottom = -150;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight("#65cfee", 1.18);
  fillLight.position.set(105, 70, -140);
  scene.add(fillLight);
  const stadiumGlow = new THREE.PointLight("#43ddff", 32, 150, 2);
  stadiumGlow.position.set(0, 10, -4);
  scene.add(stadiumGlow);

  const turf = makeMaterial(materialCache, "turf", "#1b674d", { roughness: 0.94 });
  const track = makeMaterial(materialCache, "track", "#27384e", { roughness: 0.8 });
  const lane = makeMaterial(materialCache, "lane", "#b9e8ee", { roughness: 0.48, emissive: "#295b68", emissiveIntensity: 0.22 });
  const curb = makeMaterial(materialCache, "curb", "#d8e0db", { roughness: 0.72 });
  const stand = makeMaterial(materialCache, "stand", "#182c42", { roughness: 0.77 });
  const standAccent = makeMaterial(materialCache, "stand-accent", "#274e6f", { roughness: 0.64, emissive: "#102f47", emissiveIntensity: 0.28 });
  const orange = makeMaterial(materialCache, "orange", sectionColors.orange, { emissive: sectionColors.orange, emissiveIntensity: 0.12 });
  const cyan = makeMaterial(materialCache, "cyan", sectionColors.cyan, { emissive: sectionColors.cyan, emissiveIntensity: 0.16 });
  const lime = makeMaterial(materialCache, "lime", sectionColors.lime, { emissive: sectionColors.lime, emissiveIntensity: 0.12 });
  const violet = makeMaterial(materialCache, "violet", sectionColors.violet, { emissive: sectionColors.violet, emissiveIntensity: 0.14 });
  const pink = makeMaterial(materialCache, "pink", sectionColors.pink, { emissive: sectionColors.pink, emissiveIntensity: 0.13 });
  const gold = makeMaterial(materialCache, "gold", sectionColors.gold, { emissive: sectionColors.gold, emissiveIntensity: 0.13 });

  addBox(stadium, turf, [112, 0.5, 198], [0, -0.32, 0]);
  for (let index = 0; index < ATHLETICS_STADIUM_COURSE.route.length - 1; index += 1) {
    const start = ATHLETICS_STADIUM_COURSE.route[index]!;
    const end = ATHLETICS_STADIUM_COURSE.route[index + 1]!;
    addRouteRibbon(stadium, track, start, end, ATHLETICS_STADIUM_COURSE.routeWidth * 2.35, 0.01);
    addRouteRibbon(stadium, lane, start, end, 0.22, 0.07);
  }
  for (const offset of [-1.95, 1.95]) {
    for (let index = 0; index < ATHLETICS_STADIUM_COURSE.route.length - 1; index += 1) {
      const start = ATHLETICS_STADIUM_COURSE.route[index]!;
      const end = ATHLETICS_STADIUM_COURSE.route[index + 1]!;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz) || 1;
      const normal = { x: -dz / length, z: dx / length };
      addRouteRibbon(
        stadium,
        lane,
        { x: start.x + normal.x * offset, z: start.z + normal.z * offset },
        { x: end.x + normal.x * offset, z: end.z + normal.z * offset },
        0.08,
        0.08
      );
    }
  }

  // Low-profile stands keep the stadium legible without filling the far view
  // with high-poly set dressing.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row += 1) {
      addBatchedBox(stadium, stand, [18, 2.3, 180 - row * 10], [side * (48 - row * 2), 1.2 + row * 2.1, -4]);
      addBatchedBox(stadium, standAccent, [18.5, 0.18, 0.35], [side * (48 - row * 2), 2.35 + row * 2.1, 55 - row * 7], [0, 0, 0], "accent");
      addBatchedBox(stadium, standAccent, [18.5, 0.18, 0.35], [side * (48 - row * 2), 2.35 + row * 2.1, 8 - row * 7], [0, 0, 0], "accent");
    }
  }
  addBatchedBox(stadium, curb, [3, 0.7, 198], [-56, 0.12, 0]);
  addBatchedBox(stadium, curb, [3, 0.7, 198], [56, 0.12, 0]);

  addArch(stadium, cyan, getAthleticsPointAtProgress(0), 0, 22, 8.5);
  addArch(stadium, gold, getAthleticsPointAtProgress(1), 1, 26, 9.5);
  const gateMaterials = { cyan, orange, lime, violet, pink, gold };
  Array.from({ length: Math.max(0, questionsPerLap - 1) }, (_, index) => (index + 1) / questionsPerLap).forEach((progress) => {
    const section = ATHLETICS_STADIUM_COURSE.sections.find((candidate) => progress <= candidate.endProgress);
    const color = gateMaterials[section?.accent ?? "cyan"];
    addArch(stadium, color, getAthleticsPointAtProgress(progress), progress, 19, 6.5);
  });

  const startLabel = makeLabelTexture("START · ANSWER TO RUN", "#051723", "#7bf0ff");
  const finishLabel = makeLabelTexture("FINISH", "#071625", "#ffd66e");
  const labelMaterial = (key: string, texture: THREE.Texture) => makeMaterial(materialCache, key, "#ffffff", {
    map: texture,
    emissive: "#ffffff",
    emissiveMap: texture,
    emissiveIntensity: 0.32
  });
  addBox(stadium, labelMaterial("start-label", startLabel), [13, 2.2, 0.08], [0, 7.05, 84]);
  addBox(stadium, labelMaterial("finish-label", finishLabel), [8, 2.2, 0.08], [0, 8.05, -94]);

  // Hurdle Straight.
  [51, 43, 35].forEach((z) => {
    addBatchedBox(stadium, orange, [0.45, 1.6, 0.45], [-4.2, 0.8, z], [0, 0, 0], "accent");
    addBatchedBox(stadium, orange, [0.45, 1.6, 0.45], [4.2, 0.8, z], [0, 0, 0], "accent");
    addBatchedBox(stadium, orange, [8.8, 0.22, 0.28], [0, 1.6, z], [0, 0, 0], "accent");
  });
  // Slalom cones and the raised balance beam.
  [[9, 25], [20, 14], [8, 4], [-11, -7]].forEach(([x, z]) => {
    addMesh(stadium, new THREE.ConeGeometry(1.05, 2.1, 8), lime, [x, 1.05, z]);
    addMesh(stadium, new THREE.CylinderGeometry(1.12, 1.12, 0.12, 12), curb, [x, 0.06, z]);
  });
  addBox(stadium, violet, [4.4, 1.2, 18], [-15, 0.6, -15]);
  addBox(stadium, curb, [5.4, 0.16, 18.5], [-15, 1.22, -15]);
  // The moving gate and sweeper use the same clear silhouettes at every LOD.
  addBox(stadium, pink, [1, 7, 1], [-8, 3.5, -39]);
  addBox(stadium, pink, [1, 7, 1], [8, 3.5, -39]);
  const movingBar = addBox(stadium, pink, [15, 0.6, 0.7], [0, 3.65, -39]);
  const movingGateBase = addMesh(stadium, new THREE.CylinderGeometry(1.4, 1.8, 2.2, 12), pink, [0, 1.1, -39]);
  const platformMaterial = gold;
  addBatchedBox(stadium, platformMaterial, [6, 1.4, 5], [13, 0.7, -56], [0, 0, 0], "accent");
  addBatchedBox(stadium, platformMaterial, [6, 2.6, 5], [22, 1.3, -65], [0, 0, 0], "accent");
  addBatchedBox(stadium, platformMaterial, [6, 3.8, 5], [7, 1.9, -74], [0, 0, 0], "accent");
  const sweeperBase = addMesh(stadium, new THREE.CylinderGeometry(1.25, 1.6, 2.4, 12), cyan, [-20, 1.2, -83]);
  const sweeperArm = addBox(stadium, cyan, [26, 0.45, 0.7], [-20, 2.15, -83]);
  addMesh(stadium, new THREE.SphereGeometry(0.58, 12, 8), gold, [-33, 2.15, -83]);

  // Shared invisible boxes let the first-person controller reuse the same
  // obstacle vocabulary as the server without adding render work.
  const coverBoxes: THREE.Box3[] = ATHLETICS_COLLISION_PROXIES.map((obstacle) => {
    const minY = obstacle.minY ?? 0;
    const maxY = obstacle.maxY ?? 3;
    const halfWidth = obstacle.kind === "rect" ? obstacle.width / 2 : obstacle.radius;
    const halfDepth = obstacle.kind === "rect" ? obstacle.depth / 2 : obstacle.radius;
    return new THREE.Box3(
      new THREE.Vector3(obstacle.x - halfWidth, minY, obstacle.z - halfDepth),
      new THREE.Vector3(obstacle.x + halfWidth, maxY, obstacle.z + halfDepth)
    );
  });

  const staticBatchStats = staticBatcher.flush(scene);
  renderer.domElement.dataset.staticSources = String(staticBatchStats.sourceMeshes);
  renderer.domElement.dataset.staticBatches = String(staticBatchStats.batchMeshes);
  const athleticsUpdate = (elapsed: number) => {
    movingBar.position.x = 0;
    movingGateBase.rotation.y = elapsed * 0.3;
    sweeperArm.rotation.y = 0;
    sweeperBase.rotation.y = elapsed * 0.15;
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
