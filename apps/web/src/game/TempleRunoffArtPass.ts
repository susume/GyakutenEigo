import * as THREE from "three";
import { ARENA_SCALE, TEMPLE_RUNOFF_MAIN_LEVEL_Y } from "@quizstrike/shared";

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
    const leafGeometry = new THREE.ConeGeometry(1.9, 5.2, 5);
    const fernGeometry = new THREE.BoxGeometry(0.12, 0.05, 3.8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#5f452f", roughness: 0.92 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: "#3f704d", roughness: 0.9 });
    const fernMaterial = new THREE.MeshStandardMaterial({ color: "#6c925c", roughness: 0.94 });
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
        rotation.setFromEuler(new THREE.Euler(crown ? 1.16 : -1.12, random() * Math.PI, 0));
        itemScale.setScalar(0.72 + random() * 0.38);
        matrix.compose(position, rotation, itemScale);
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
      scene.remove(tunnelStory, connectorStory, waterGroup, vegetationGroup);
      disposable.forEach((resource) => resource.dispose());
    }
  };
};
