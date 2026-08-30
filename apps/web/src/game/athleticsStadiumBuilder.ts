import * as THREE from "three";
import {
  ATHLETICS_COLLISION_PROXIES,
  ATHLETICS_GROUND_SURFACE_SLAB_HEIGHT,
  ATHLETICS_PLAYER_EYE_HEIGHT,
  ATHLETICS_STADIUM_COURSE,
  ATHLETICS_SURFACE_SLAB_HEIGHT,
  getAthleticsMovingObstaclePosition,
  getAthleticsPointAtProgress,
  getAthleticsRouteLength,
  getAthleticsRouteProgress,
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

const addArch = (
  parent: THREE.Object3D,
  material: THREE.Material,
  point: { x: number; y: number; z: number },
  progress: number,
  width = 20,
  height = 7
) => {
  const tangent = getAthleticsRouteTangent(progress);
  const angle = Math.atan2(tangent.x, tangent.z);
  const normal = { x: -tangent.z, z: tangent.x };
  const postOffset = width / 2;
  addBox(parent, material, [0.78, height, 0.78], [point.x + normal.x * postOffset, point.y + height / 2, point.z + normal.z * postOffset]);
  addBox(parent, material, [0.78, height, 0.78], [point.x - normal.x * postOffset, point.y + height / 2, point.z - normal.z * postOffset]);
  addBox(parent, material, [width + 0.78, 0.78, 0.78], [point.x, point.y + height, point.z], [0, angle, 0]);
};

const addFairgroundStallFallback = (
  parent: THREE.Object3D,
  materials: { wall: THREE.Material; roof: THREE.Material; trim: THREE.Material },
  position: { x: number; y: number; z: number }
) => {
  addBox(parent, materials.wall, [10, 5.4, 7], [position.x, position.y + 2.7, position.z]);
  addBox(parent, materials.roof, [12, 0.7, 9], [position.x, position.y + 5.85, position.z]);
  addBox(parent, materials.trim, [10.6, 0.42, 0.5], [position.x, position.y + 4.1, position.z - 3.55]);
  addBox(parent, materials.trim, [0.5, 4.3, 6.6], [position.x - 5.1, position.y + 2.4, position.z]);
};

const addFallbackFerrisWheel = (
  parent: THREE.Object3D,
  metal: THREE.Material,
  accent: THREE.Material,
  gondola: THREE.Material,
  center: { x: number; y: number; z: number }
) => {
  const fallback = new THREE.Group();
  fallback.name = "athletics-fallback-ferris-wheel";
  fallback.position.set(center.x, center.y, center.z);
  parent.add(fallback);
  addMesh(fallback, new THREE.TorusGeometry(29, 1.1, 10, 48), accent);
  addMesh(fallback, new THREE.CylinderGeometry(3, 3, 2.5, 20), metal, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let spoke = 0; spoke < 10; spoke += 1) {
    const angle = (spoke / 10) * Math.PI * 2;
    addBox(fallback, metal, [0.38, 56, 0.38], [0, 0, 0], [0, 0, angle / 2]);
    addBox(fallback, gondola, [4.1, 2.8, 2.7], [Math.cos(angle) * 29, Math.sin(angle) * 29, 0]);
  }
  // The structural foundation is intentionally separate from the fallback
  // wheel silhouette so a successful GLB load still leaves a grounded ride.
  const supports = new THREE.Group();
  supports.name = "athletics-ferris-supports";
  parent.add(supports);
  addBox(supports, metal, [3.2, center.y, 3.2], [center.x - 15, center.y / 2, center.z]);
  addBox(supports, metal, [3.2, center.y, 3.2], [center.x + 15, center.y / 2, center.z]);
  addBox(supports, metal, [40, 2.4, 4.2], [center.x, 1.2, center.z]);
  addBox(supports, metal, [34, 1.1, 2.8], [center.x, center.y - 1.2, center.z]);
  return fallback;
};

const addFallbackCoaster = (
  parent: THREE.Object3D,
  metal: THREE.Material,
  accent: THREE.Material,
  center: { x: number; y: number; z: number }
) => {
  const fallback = new THREE.Group();
  fallback.name = "athletics-fallback-coaster";
  parent.add(fallback);
  const supports = new THREE.Group();
  supports.name = "athletics-coaster-supports";
  parent.add(supports);
  for (let index = 0; index < 7; index += 1) {
    const x = center.x + index * 9;
    const z = center.z + Math.sin(index * 0.9) * 10;
    const y = center.y + (index % 2) * 4;
    const trackRotation: [number, number, number] = [0, Math.sin(index * 0.9) * 0.2, 0];
    addBox(fallback, accent, [8.8, 0.55, 1.1], [x, y, z], trackRotation);
    addBox(supports, metal, [1.4, Math.max(5, y), 1.4], [x, y / 2, z]);
    if (index < 6) addBox(supports, metal, [9.4, 0.7, 0.7], [x + 4.5, y * 0.42, z], trackRotation);
  }
  return fallback;
};

const addDropTower = (
  parent: THREE.Object3D,
  metal: THREE.Material,
  accent: THREE.Material,
  center: { x: number; y: number; z: number }
) => {
  const tower = new THREE.Group();
  tower.name = "athletics-drop-tower";
  parent.add(tower);
  addCylinder(tower, accent, 4.5, 78, [center.x, center.y + 39, center.z], 12);
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2;
    addBox(tower, metal, [0.95, 80, 0.95], [center.x + Math.cos(angle) * 7, center.y + 40, center.z + Math.sin(angle) * 7]);
  }
  for (let ring = 0; ring < 5; ring += 1) {
    addMesh(tower, new THREE.TorusGeometry(8, 0.34, 8, 24), accent, [center.x, center.y + 8 + ring * 15, center.z], [Math.PI / 2, 0, 0]);
  }
  addBox(tower, metal, [20, 1.4, 20], [center.x, center.y + 0.7, center.z]);
};

type AthleticsCollisionBox = THREE.Box3 & {
  footprint?: { x: number; z: number; width: number; depth: number; rotationY?: number };
};

const makeCollisionBox = (obstacle: (typeof ATHLETICS_COLLISION_PROXIES)[number]): AthleticsCollisionBox => {
  const minY = obstacle.minY ?? 0;
  const maxY = obstacle.maxY ?? 3;
  if (obstacle.kind === "rect") {
    const angle = obstacle.rotationY ?? 0;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const halfWidth = Math.abs(cosine) * obstacle.width / 2 + Math.abs(sine) * obstacle.depth / 2;
    const halfDepth = Math.abs(sine) * obstacle.width / 2 + Math.abs(cosine) * obstacle.depth / 2;
    const box = new THREE.Box3(
      new THREE.Vector3(obstacle.x - halfWidth, minY, obstacle.z - halfDepth),
      new THREE.Vector3(obstacle.x + halfWidth, maxY, obstacle.z + halfDepth)
    ) as AthleticsCollisionBox;
    box.footprint = {
      x: obstacle.x,
      z: obstacle.z,
      width: obstacle.width,
      depth: obstacle.depth,
      rotationY: obstacle.rotationY
    };
    return box;
  }
  const halfWidth = obstacle.radius;
  const halfDepth = obstacle.radius;
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
  const floorTexture = makeCanvasTexture("floor", "#83c995");
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

  scene.background = new THREE.Color("#f4b57c");
  scene.fog = new THREE.Fog("#f4d0a5", 125, 420);
  scene.add(new THREE.HemisphereLight("#fff1d0", "#153d52", 1.65));
  const keyLight = new THREE.DirectionalLight("#fff2c7", 3.2);
  keyLight.position.set(-120, 220, 120);
  keyLight.castShadow = qualityConfig.shadows && activeQuality !== "performance";
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -165;
  keyLight.shadow.camera.right = 165;
  keyLight.shadow.camera.top = 180;
  keyLight.shadow.camera.bottom = -180;
  scene.add(keyLight);
  const sunsetFill = new THREE.DirectionalLight("#ff83b0", 1.1);
  sunsetFill.position.set(160, 90, -180);
  scene.add(sunsetFill);
  const parkGlow = new THREE.PointLight("#ffe36e", 80, 180, 2);
  parkGlow.position.set(-24, 44, -20);
  scene.add(parkGlow);

  const turf = makeMaterial(materialCache, "park-turf", "#377b67", { roughness: 0.95 });
  const stone = makeMaterial(materialCache, "park-stone", "#a9c3c4", { roughness: 0.84 });
  const wood = makeMaterial(materialCache, "park-wood", "#c97845", { roughness: 0.76 });
  const metal = makeMaterial(materialCache, "park-metal", "#506a82", { roughness: 0.38, metalness: 0.56 });
  const cream = makeMaterial(materialCache, "park-cream", "#fff0c8", { roughness: 0.68 });
  const dark = makeMaterial(materialCache, "park-dark", "#26334d", { roughness: 0.78 });
  const accentMaterials = Object.fromEntries(
    (Object.entries(sectionColors) as Array<[AthleticsAccent, string]>).map(([accent, color]) => [
      accent,
      makeMaterial(materialCache, `accent-${accent}`, color, { emissive: color, emissiveIntensity: 0.2, roughness: 0.5 })
    ])
  ) as Record<AthleticsAccent, THREE.MeshStandardMaterial>;

  const addBatchedBox = (
    material: THREE.MeshStandardMaterial,
    size: [number, number, number],
    position: [number, number, number],
    surface: "stone" | "wood" | "metal" | "sand" | "accent" = "stone",
    rotation: [number, number, number] = [0, 0, 0]
  ) => staticBatcher.prepare(addBox(park, material, size, position, rotation), `#${material.color.getHexString()}`, surface);

  // 280 x 280 floor and boundary match ATHLETICS_COURSE_BOUNDS. The route is
  // intentionally absent from the floor; only the landings communicate where
  // the player can run and jump.
  addBox(park, turf, [284, 1, 284], [0, -0.52, 0]);
  addBatchedBox(cream, [278, 0.55, 278], [0, -0.3, 0], "sand");
  addBox(park, turf, [272, 0.25, 272], [0, -0.1, 0]);
  addBatchedBox(dark, [4, 11, 276], [-140, 5.5, 0], "stone");
  addBatchedBox(dark, [4, 11, 276], [140, 5.5, 0], "stone");
  addBatchedBox(dark, [276, 11, 4], [0, 5.5, -140], "stone");
  addBatchedBox(dark, [276, 11, 4], [0, 5.5, 140], "stone");
  for (const z of [-112, -56, 0, 56, 112]) {
    addBox(park, metal, [0.9, 14, 0.9], [-136, 8, z]);
    addBox(park, accentMaterials.cyan, [3.2, 0.28, 0.35], [-136, 14.5, z]);
    addBox(park, metal, [0.9, 14, 0.9], [136, 8, z]);
    addBox(park, accentMaterials.cyan, [3.2, 0.28, 0.35], [136, 14.5, z]);
  }

  const course = ATHLETICS_STADIUM_COURSE;
  const routeLength = getAthleticsRouteLength(course);
  renderer.domElement.dataset.athleticsRouteLength = String(Math.round(routeLength));
  renderer.domElement.dataset.athleticsQuestionsPerLap = String(Math.max(0, questionsPerLap));
  const start = getAthleticsPointAtProgress(0, course);
  const finish = getAthleticsPointAtProgress(1, course);
  const startTangent = getAthleticsRouteTangent(0, course);
  const startAngle = Math.atan2(startTangent.x, startTangent.z);

  const labelMaterial = (key: string, texture: THREE.Texture) => makeMaterial(materialCache, key, "#ffffff", {
    map: texture,
    emissive: "#ffffff",
    emissiveMap: texture,
    emissiveIntensity: 0.42
  });

  const getSectionAccent = (progress: number): AthleticsAccent =>
    course.sections.find((section) => progress <= section.endProgress)?.accent ?? course.sections.at(-1)?.accent ?? "cyan";

  type SurfaceVisual = { surface: AthleticsCourseSurface; progress: number; edge: THREE.LineSegments };
  const surfaceVisuals: SurfaceVisual[] = [];
  const allSurfaceEntries = [
    ...course.surfaces.map((surface) => ({ surface, shortcut: false })),
    ...course.shortcuts.flatMap((shortcut) => shortcut.surfaces.map((surface) => ({ surface, shortcut: true })))
  ];
  const supportIndices = new Set([10, 21, 32, 35, 43, 54, 64]);
  const surfacePoint = (surface: AthleticsCourseSurface, localX: number, localZ: number) => {
    const angle = surface.rotationY ?? 0;
    return {
      x: surface.x + Math.cos(angle) * localX + Math.sin(angle) * localZ,
      z: surface.z - Math.sin(angle) * localX + Math.cos(angle) * localZ
    };
  };

  allSurfaceEntries.forEach(({ surface, shortcut }) => {
    const progress = getAthleticsRouteProgress({ x: surface.x, y: surface.y, z: surface.z }, course);
    const accent = shortcut ? "gold" : getSectionAccent(progress);
    const platformMaterial = surface.material === "wood"
      ? wood
      : surface.material === "stone"
        ? stone
        : surface.material === "accent"
        ? accentMaterials[accent]
        : metal;
    const slabHeight = surface.y <= 0 ? ATHLETICS_GROUND_SURFACE_SLAB_HEIGHT : ATHLETICS_SURFACE_SLAB_HEIGHT;
    const surfaceLayer = surface.material === "wood" ? "wood" : surface.material === "accent" ? "accent" : surface.material === "stone" ? "stone" : "metal";
    const surfaceRotation: [number, number, number] = [0, surface.rotationY ?? 0, 0];
    addBatchedBox(platformMaterial, [surface.width, slabHeight, surface.depth], [surface.x, surface.y - slabHeight / 2, surface.z], surfaceLayer, surfaceRotation);
    addBatchedBox(dark, [Math.max(4, surface.width - 1.2), 0.16, Math.max(4, surface.depth - 1.2)], [surface.x, surface.y + 0.08, surface.z], "stone", surfaceRotation);

    // A bright perimeter is the primary next-landing language. It is kept
    // outside the collision proxy and updated only for the upcoming landing.
    const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(surface.width + 0.35, 0.13, surface.depth + 0.35));
    const edgeMaterial = new THREE.LineBasicMaterial({ color: sectionColors[accent], transparent: true, opacity: 0.62, depthWrite: false });
    const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edge.name = `athletics-platform-edge-${surface.id}`;
    edge.position.set(surface.x, surface.y + 0.13, surface.z);
    edge.rotation.y = surface.rotationY ?? 0;
    edge.renderOrder = 3;
    park.add(edge);
    surfaceVisuals.push({ surface, progress, edge });

    if (surface.kind === "stair") {
      for (const inset of [-0.28, 0, 0.28]) {
        const tread = surfacePoint(surface, 0, inset * surface.depth);
        addBatchedBox(cream, [surface.width * 0.7, 0.08, 0.38], [tread.x, surface.y + 0.17, tread.z], "sand", surfaceRotation);
      }
    } else if (surface.kind === "ramp") {
      addBatchedBox(cream, [surface.width * 0.7, 0.08, 0.5], [surface.x, surface.y + 0.17, surface.z], "sand", surfaceRotation);
    }

    if (surface.kind === "checkpoint") {
      addBox(park, accentMaterials[accent], [surface.width * 0.72, 0.16, 0.46], [surface.x, surface.y + 0.18, surface.z], surfaceRotation);
      const leftMarker = surfacePoint(surface, -surface.width * 0.3, 0);
      const rightMarker = surfacePoint(surface, surface.width * 0.3, 0);
      addBox(park, cream, [0.28, 0.18, surface.depth * 0.7], [leftMarker.x, surface.y + 0.18, leftMarker.z], surfaceRotation);
      addBox(park, cream, [0.28, 0.18, surface.depth * 0.7], [rightMarker.x, surface.y + 0.18, rightMarker.z], surfaceRotation);
    }

    const routeIndex = course.surfaces.indexOf(surface);
    if (qualityConfig.detail > 0 && !shortcut && supportIndices.has(routeIndex)) {
      const supportHeight = Math.max(3, surface.y - 0.8);
      const leftSupport = surfacePoint(surface, -surface.width * 0.33, -surface.depth * 0.3);
      const rightSupport = surfacePoint(surface, surface.width * 0.33, surface.depth * 0.3);
      addBatchedBox(metal, [1.25, supportHeight, 1.25], [leftSupport.x, supportHeight / 2, leftSupport.z], "metal", surfaceRotation);
      addBatchedBox(metal, [1.25, supportHeight, 1.25], [rightSupport.x, supportHeight / 2, rightSupport.z], "metal", surfaceRotation);
    }
  });

  // Start teaching is local and concrete: a large pad, a short sign, and one
  // marker hovering over landing #2. No road, centerline, or gate is needed.
  addBox(park, accentMaterials.cyan, [22, 0.12, 0.55], [start.x, start.y + 0.23, start.z - 4.4], [0, startAngle, 0]);
  addBox(park, accentMaterials.cyan, [15, 0.12, 0.45], [start.x - startTangent.x * 4, start.y + 0.24, start.z - startTangent.z * 4], [0, startAngle, 0]);
  const entranceFallback = new THREE.Group();
  entranceFallback.name = "athletics-fallback-entrance";
  park.add(entranceFallback);
  addArch(entranceFallback, accentMaterials.cyan, { x: start.x, y: start.y, z: start.z + 7 }, 0, 24, 8);
  addBox(entranceFallback, dark, [22, 2.4, 0.5], [start.x, start.y + 10.2, start.z + 7], [0, startAngle, 0]);
  const startLabel = makeLabelTexture("JUMP ONTO THE GLOWING PLATFORMS", "#0e1a2d", "#7bf0ff");
  addBox(park, labelMaterial("start-label", startLabel), [22, 1.8, 0.08], [start.x, start.y + 10.2, start.z + 6.68], [0, startAngle, 0]);

  const finishLabel = makeLabelTexture("SUMMIT FINISH", "#2b1731", "#ffd66e");
  addArch(park, accentMaterials.gold, finish, 1, 24, 9);
  addBox(park, labelMaterial("finish-label", finishLabel), [14, 1.9, 0.08], [finish.x, finish.y + 10.1, finish.z]);

  const nextMarker = new THREE.Group();
  nextMarker.name = "athletics-next-landing-marker";
  const markerMaterial = new THREE.MeshBasicMaterial({ color: "#fff4a8", transparent: true, opacity: 0.98, depthWrite: false });
  const markerCone = addMesh(nextMarker, new THREE.ConeGeometry(0.85, 1.5, 4), markerMaterial, [0, 0, 0], [0, 0, Math.PI]);
  markerCone.renderOrder = 6;
  const markerRing = addMesh(nextMarker, new THREE.TorusGeometry(1.05, 0.1, 8, 20), markerMaterial, [0, -0.62, 0], [Math.PI / 2, 0, 0]);
  markerRing.renderOrder = 6;
  park.add(nextMarker);

  course.checkpoints.forEach((progress, index) => {
    const point = getAthleticsPointAtProgress(progress, course);
    const accent = getSectionAccent(progress);
    addArch(park, accentMaterials[accent], point, progress, 18, 6.8);
    const sectionLabel = course.sections.find((section) => progress <= section.endProgress)?.label ?? "Sky Park Summit";
    const checkpointLabel = makeLabelTexture(`CHECKPOINT ${index + 1} · ${sectionLabel.toUpperCase()}`, "#13243b", sectionColors[accent]);
    addBox(park, labelMaterial(`checkpoint-label-${index}`, checkpointLabel), [13.5, 1.1, 0.08], [point.x, point.y + 7.7, point.z]);
  });

  // Ground-level attraction district: imported GLBs can hide these named
  // fallback groups after they load; the authored course remains playable
  // either way.
  const stallFallback = new THREE.Group();
  stallFallback.name = "athletics-fallback-stalls";
  park.add(stallFallback);
  addFairgroundStallFallback(stallFallback, { wall: accentMaterials.orange, roof: accentMaterials.gold, trim: cream }, { x: -49, y: 0, z: -8 });
  addFairgroundStallFallback(stallFallback, { wall: accentMaterials.pink, roof: accentMaterials.violet, trim: cream }, { x: 24, y: 0, z: -55 });

  const bumperGroup = new THREE.Group();
  bumperGroup.name = "athletics-bumper-bowl";
  park.add(bumperGroup);
  const bumperCenter = { x: 20, y: 0, z: -48 };
  addMesh(bumperGroup, new THREE.CylinderGeometry(17, 17, 0.45, 28), dark, [bumperCenter.x, 0.24, bumperCenter.z]);
  addMesh(bumperGroup, new THREE.TorusGeometry(17, 0.75, 8, 32), accentMaterials.lime, [bumperCenter.x, 1, bumperCenter.z], [Math.PI / 2, 0, 0]);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    addBox(bumperGroup, accentMaterials.orange, [2.6, 0.55, 2.6], [bumperCenter.x + Math.cos(angle) * 10, 1.2, bumperCenter.z + Math.sin(angle) * 10], [0, -angle, 0]);
  }

  const ferrisFallback = addFallbackFerrisWheel(park, metal, accentMaterials.gold, accentMaterials.pink, { x: -72, y: 29, z: 28 });
  addFallbackCoaster(park, metal, accentMaterials.cyan, { x: -96, y: 42, z: 34 });
  addDropTower(park, metal, accentMaterials.violet, { x: 61, y: 0, z: -24 });

  const movingGroups = course.movingObstacles.map((obstacle: AthleticsMovingObstacle) => {
    const group = new THREE.Group();
    group.name = `moving-${obstacle.id}`;
    group.position.set(obstacle.x, obstacle.y, obstacle.z);
    const material = obstacle.material === "wood" ? wood : obstacle.material === "accent" ? accentMaterials.orange : metal;
    addBox(group, material, [obstacle.width, obstacle.height, obstacle.depth], [0, obstacle.height / 2, 0]);
    addBox(group, cream, [obstacle.width * 0.68, 0.12, 0.24], [0, obstacle.height + 0.08, -obstacle.depth * 0.28]);
    const movingEdgeMaterial = new THREE.LineBasicMaterial({
      color: obstacle.material === "wood" ? sectionColors.orange : obstacle.material === "accent" ? sectionColors.violet : sectionColors.cyan,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });
    const movingEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(obstacle.width + 0.35, 0.14, obstacle.depth + 0.35)),
      movingEdgeMaterial
    );
    movingEdge.name = `athletics-moving-edge-${obstacle.id}`;
    movingEdge.position.y = obstacle.height + 0.14;
    movingEdge.renderOrder = 3;
    group.add(movingEdge);
    if (obstacle.kind === "elevator") addBox(group, accentMaterials.cyan, [0.35, obstacle.height + 1.4, 0.35], [0, -(obstacle.height + 1.4) / 2, 0]);
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
      const helper = new THREE.Box3Helper(box, index >= movingCoverStartIndex ? "#ff8e5e" : "#66e5ff");
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

  const sortedSurfaceVisuals = surfaceVisuals.slice().sort((left, right) => left.progress - right.progress);
  const firstNextSurface = sortedSurfaceVisuals.find((entry) => entry.progress > 0.01) ?? sortedSurfaceVisuals[0];
  if (firstNextSurface) nextMarker.position.set(firstNextSurface.surface.x, firstNextSurface.surface.y + 3.2, firstNextSurface.surface.z);

  const staticBatchStats = staticBatcher.flush(scene);
  renderer.domElement.dataset.staticSources = String(staticBatchStats.sourceMeshes);
  renderer.domElement.dataset.staticBatches = String(staticBatchStats.batchMeshes);
  const athleticsUpdate = (elapsed: number, currentPosition?: THREE.Vector3, grounded = false) => {
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

    ferrisFallback.rotation.z = nowMs * 0.00008;
    const bob = Math.sin(nowMs * 0.003) * 0.18;
    if (currentPosition) {
      const progress = getAthleticsRouteProgress({ x: currentPosition.x, y: currentPosition.y, z: currentPosition.z }, course);
      let next = sortedSurfaceVisuals.find((entry) => entry.progress > progress + 0.018);
      if (!next && progress < 0.98) next = sortedSurfaceVisuals.at(-1);
      if (next) {
        nextMarker.visible = true;
        nextMarker.position.set(next.surface.x, next.surface.y + 3.2 + bob, next.surface.z);
      } else {
        nextMarker.visible = false;
      }
      let selectedNext = false;
      sortedSurfaceVisuals.forEach((entry) => {
        const isNext = !selectedNext && entry.progress > progress + 0.018;
        selectedNext = selectedNext || isNext;
        const material = entry.edge.material as THREE.LineBasicMaterial;
        material.opacity = isNext ? 1 : entry.surface.safe ? 0.78 : 0.5;
        const accent = entry.surface.material === "accent" ? getSectionAccent(entry.progress) : "cyan";
        material.color.set(isNext ? "#fff4a8" : sectionColors[accent]);
      });
    }
    void elapsed;
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
