import * as THREE from "three";
import { ARENA_SCALE, TEMPLE_RUNOFF_MAIN_LEVEL_Y } from "@quizstrike/shared";
import { blocks } from "./templeRunoffMap";

type AddStaticMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: string,
  surface?: string
) => THREE.Mesh;

export interface TempleRunoffArtHandle {
  update(elapsed: number): void;
  dispose(): void;
  readonly instancedDraws: number;
}

const scaled = (value: number) => value * ARENA_SCALE;
const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

export const getTempleRunoffVegetationCount = (detail: number) => detail === 0 ? 0 : detail === 1 ? 24 : 40;

export const addTempleRunoffArtPass = (
  scene: THREE.Scene,
  addStaticMesh: AddStaticMesh,
  detail: number,
  isFps: boolean
): TempleRunoffArtHandle => {
  const carvings = new THREE.Group();
  carvings.name = "temple_runoff_carved_stonework";
  scene.add(carvings);
  // Shallow relief follows existing cover rather than inventing new obstacles.
  for (const block of blocks.filter((item) => item.style === "ruin" && item.material === "stone" && item.h >= 8)) {
    const horizontal = block.w >= block.d;
    const width = horizontal ? block.w : block.d;
    const depth = horizontal ? block.d : block.w;
    const face = new THREE.Group();
    face.position.set(block.x, (block.y ?? block.h / 2) - block.h / 2, block.z);
    face.rotation.y = horizontal ? 0 : Math.PI / 2;
    carvings.add(face);
    for (const side of [-1, 1]) {
      const course = addStaticMesh(face, new THREE.BoxGeometry(width * .94, .4, .12), "#a7ad87");
      course.position.set(0, block.h - 1.2, side * depth / 2);
      const sun = addStaticMesh(face, new THREE.TorusGeometry(1.05, .18, 5, 12), "#9aab85");
      sun.position.set(0, block.h * .6, side * depth / 2);
      for (const x of [-2.4, 2.4]) {
        const glyph = addStaticMesh(face, new THREE.BoxGeometry(.45, 2.4, .14), "#a7ad87");
        glyph.position.set(x, block.h * .6, side * depth / 2);
      }
    }
  }
  for (const z of [-192, 192]) {
    const wall = new THREE.Group();
    wall.position.z = scaled(z);
    carvings.add(wall);
    for (const y of [15.5, 25]) {
      const course = addStaticMesh(wall, new THREE.BoxGeometry(scaled(452), .45, .16), "#8e9f80");
      course.position.y = y;
    }
    for (const x of [-192, -128, -64, 0, 64, 128, 192]) {
      const pier = addStaticMesh(wall, new THREE.BoxGeometry(1.2, 16, .16), "#7e9278");
      pier.position.set(scaled(x), 18, 0);
      const seal = addStaticMesh(wall, new THREE.TorusGeometry(1.6, .24, 5, 12), "#a2b491");
      seal.position.set(scaled(x + 24), 20, 0);
    }
  }
  const tunnelStory = new THREE.Group();
  tunnelStory.name = "temple_runoff_sluice_story";
  scene.add(tunnelStory);
  for (const x of [-190, 190].map(scaled)) {
    const roof = addStaticMesh(tunnelStory, new THREE.BoxGeometry(10, 1.2, 18), "#59665b", "stone");
    roof.position.set(x, 10.5, 0);
    for (const z of [-8, 8].map(scaled)) {
      const root = addStaticMesh(tunnelStory, new THREE.TorusGeometry(4.2, 0.42, 6, 16, Math.PI), "#59432e", "wood");
      root.position.set(x, 7.2, z);
      root.rotation.set(0, 0, Math.PI / 2);
    }
  }

  const connectorStory = new THREE.Group();
  connectorStory.name = "temple_runoff_level_connectors";
  scene.add(connectorStory);
  for (const [x, z] of [[-16, -13], [16, 13], [-112, -18], [104, 18]] as const) {
    const lantern = new THREE.PointLight("#8ce2d3", isFps ? 9 : 6, 34, 2);
    lantern.position.set(scaled(x), 5.5, scaled(z));
    connectorStory.add(lantern);
  }

  const waterGroup = new THREE.Group();
  waterGroup.name = "temple_runoff_waterfalls";
  scene.add(waterGroup);
  const waterfallMaterials: THREE.MeshBasicMaterial[] = [];
  const waterfallGeometry = new THREE.PlaneGeometry(5.2, 8.5, 1, 4);
  if (detail > 0) {
    for (const [x, z] of [[-136, -25], [136, 25]] as const) {
      const material = new THREE.MeshBasicMaterial({
        color: "#7df2e8",
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const fall = new THREE.Mesh(waterfallGeometry, material);
      fall.position.set(scaled(x), 4.2, scaled(z));
      fall.rotation.y = x < 0 ? Math.PI : 0;
      waterGroup.add(fall);
      waterfallMaterials.push(material);
    }
  }

  const vegetationGroup = new THREE.Group();
  vegetationGroup.name = "temple_runoff_instanced_vegetation";
  scene.add(vegetationGroup);
  const vegetationCount = getTempleRunoffVegetationCount(detail);
  const disposable: Array<THREE.BufferGeometry | THREE.Material> = [waterfallGeometry, ...waterfallMaterials];
  const instancedMeshes: THREE.InstancedMesh[] = [];
  if (vegetationCount > 0) {
    const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.42, 5.4, 6);
    const leafGeometry = new THREE.IcosahedronGeometry(2.3, 1);
    const fernGeometry = new THREE.BufferGeometry();
    const fernVertices: number[] = [];
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      fernVertices.push(0, 0, 0, dx * 1.1 - dz * .24, .32, dz * 1.1 + dx * .24, dx * 1.8, .15, dz * 1.8);
      fernVertices.push(0, 0, 0, dx * 1.8, .15, dz * 1.8, dx * 1.1 + dz * .24, .32, dz * 1.1 - dx * .24);
    }
    fernGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fernVertices, 3));
    fernGeometry.computeVertexNormals();
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#5f452f", roughness: 0.92 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: "#3f704d", roughness: 0.9 });
    const fernMaterial = new THREE.MeshStandardMaterial({ color: "#6c925c", roughness: 0.94, side: THREE.DoubleSide });
    disposable.push(trunkGeometry, leafGeometry, fernGeometry, trunkMaterial, leafMaterial, fernMaterial);
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, vegetationCount);
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, vegetationCount * 2);
    const ferns = new THREE.InstancedMesh(fernGeometry, fernMaterial, vegetationCount * 2);
    instancedMeshes.push(trunks, leaves, ferns);
    const random = seededRandom(74013);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const itemScale = new THREE.Vector3();
    let leafIndex = 0;
    let fernIndex = 0;

    for (let index = 0; index < vegetationCount; index += 1) {
      const edgeBand = index % 3 !== 0;
      const rawX = edgeBand
        ? (random() > 0.5 ? 1 : -1) * (174 + random() * 46)
        : -166 + random() * 332;
      const rawZ = edgeBand
        ? -184 + random() * 368
        : (random() > 0.5 ? 1 : -1) * (126 + random() * 54);
      const groundY = TEMPLE_RUNOFF_MAIN_LEVEL_Y;
      position.set(scaled(rawX), groundY + 2.5 + random() * 1.4, scaled(rawZ));
      rotation.setFromEuler(new THREE.Euler(0, random() * Math.PI, (random() - 0.5) * 0.12));
      const treeScale = 0.72 + random() * 0.72;
      itemScale.set(treeScale, treeScale, treeScale);
      matrix.compose(position, rotation, itemScale);
      trunks.setMatrixAt(index, matrix);

      for (let crown = 0; crown < 2; crown += 1) {
        position.set(scaled(rawX) + (crown ? 1.35 : -1.1), groundY + 5.2 + treeScale * 2.5 + crown * 0.55, scaled(rawZ) + (crown ? -0.8 : 0.7));
        rotation.setFromEuler(new THREE.Euler(0, random() * Math.PI, 0));
        const crownScale = .9 + random() * .35;
        itemScale.set(crownScale, crownScale * .75, crownScale);
        matrix.compose(position, rotation, itemScale);
        leaves.setColorAt(leafIndex, new THREE.Color(["#92af7a", "#b0bd8e", "#82aa85"][index % 3]));
        leaves.setMatrixAt(leafIndex++, matrix);
      }

      for (let fern = 0; fern < 2; fern += 1) {
        position.set(scaled(rawX) + (fern ? 1.8 : -1.6), groundY + 0.24, scaled(rawZ) + (fern ? 1.2 : -1.1));
        rotation.setFromEuler(new THREE.Euler(0, random() * Math.PI, fern ? 0.22 : -0.22));
        itemScale.setScalar(0.65 + random() * 0.6);
        matrix.compose(position, rotation, itemScale);
        ferns.setMatrixAt(fernIndex++, matrix);
      }
    }
    instancedMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = !isFps;
      mesh.receiveShadow = true;
      vegetationGroup.add(mesh);
    });
  }

  return {
    instancedDraws: instancedMeshes.length,
    update(elapsed: number) {
      waterfallMaterials.forEach((material, index) => {
        material.opacity = 0.4 + Math.sin(elapsed * 1.6 + index * 1.8) * 0.08;
      });
    },
    dispose() {
      scene.remove(carvings, tunnelStory, connectorStory, waterGroup, vegetationGroup);
      disposable.forEach((resource) => resource.dispose());
    }
  };
};
