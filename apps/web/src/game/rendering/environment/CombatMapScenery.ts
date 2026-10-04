import * as THREE from "three";
import type { SessionMapId } from "@quizstrike/shared";

type AddMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, surface?: string) => THREE.Mesh;
type Bounds = { limitX: number; limitZ: number };

/** All scenery is outside the authoritative arena. Nothing here is cover. */
export const addCombatMapScenery = (scene: THREE.Scene, mapId: SessionMapId, bounds: Bounds, detail: number, addMesh: AddMesh) => {
  const desert = mapId === "desert_citadel";
  const iron = mapId === "iron_junction";
  const root = new THREE.Group();
  root.name = `scenery_${mapId}`;
  scene.add(root);
  const apron = 150;
  for (let side = 0; side < 4; side++) {
    const horizontal = side < 2;
    const ground = addMesh(root, new THREE.BoxGeometry(horizontal ? bounds.limitX * 2 + apron * 2 : apron, .8, horizontal ? apron : bounds.limitZ * 2),
      desert ? "#d5ad7a" : iron ? "#86917c" : "#70876a", "sand");
    ground.name = `exterior_ground_${side}`;
    ground.position.set(horizontal ? 0 : (side === 2 ? -1 : 1) * (bounds.limitX + apron / 2), -.5,
      horizontal ? (side === 0 ? -1 : 1) * (bounds.limitZ + apron / 2) : 0);
  }
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const edgePoint = (side: number, fraction: number, clearance: number) => {
    const along = fraction * 2 - 1;
    return side < 2
      ? new THREE.Vector3(along * bounds.limitX, 0, (side === 0 ? -1 : 1) * (bounds.limitZ + clearance))
      : new THREE.Vector3((side === 2 ? -1 : 1) * (bounds.limitX + clearance), 0, along * bounds.limitZ);
  };
  const makeInstances = (name: string, geometry: THREE.BufferGeometry, count: number, color: string) => {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }), count);
    mesh.name = name;
    // Distant silhouettes don't need shadow-map passes on classroom devices.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
    return mesh;
  };
  const terrainCount = detail === 0 ? 12 : detail === 1 ? 20 : 28;
  const terrain = makeInstances(desert ? "desert_dunes" : iron ? "junction_mountain_ridge" : "temple_jungle_escarpment",
    desert ? new THREE.SphereGeometry(1, 12, 6) : iron ? new THREE.ConeGeometry(1, 1, 5) : new THREE.IcosahedronGeometry(1, detail === 2 ? 1 : 0), terrainCount,
    "#ffffff");
  for (let i = 0; i < terrainCount; i++) {
    const side = i % 4;
    const radius = desert ? 36 + i % 3 * 9 : 28 + i % 3 * 10;
    position.copy(edgePoint(side, (Math.floor(i / 4) + .5) / Math.ceil(terrainCount / 4), radius * 1.5 + 24));
    position.y = desert ? 0 : iron ? 26 : 18;
    rotation.setFromEuler(new THREE.Euler(0, i * .71, desert ? 0 : .13 * (i % 3 - 1)));
    scale.set(radius, desert ? 12 + i % 3 * 4 : iron ? 45 + Math.floor(i / 4) % 4 * 12 : 30 + i % 3 * 7, radius);
    matrix.compose(position, rotation, scale);
    terrain.setMatrixAt(i, matrix);
    terrain.setColorAt(i, new THREE.Color(desert ? ["#ead0a4", "#d5a575", "#e0ba8c"][i % 3] : iron ? ["#71878a", "#819492", "#667b7d"][i % 3] : ["#6b826a", "#7c8c70", "#607763"][i % 3]));
  }
  terrain.instanceMatrix.needsUpdate = true;

  if (desert) {
    const count = detail === 0 ? 8 : detail === 1 ? 12 : 16;
    for (let i = 0; i < count; i++) {
      const building = new THREE.Group();
      building.name = `citadel_skyline_${i}`;
      building.position.copy(edgePoint(i % 4, (Math.floor(i / 4) + .5) / Math.ceil(count / 4), 25));
      root.add(building);
      const height = 20 + (i * 7) % 5 * 5;
      const body = addMesh(building, new THREE.BoxGeometry(15, height, 15), i % 2 ? "#d4a26f" : "#e7c08a");
      body.position.y = height / 2;
      const cornice = addMesh(building, new THREE.BoxGeometry(16, .8, 16), "#f0d2a0");
      cornice.position.y = height;
      if (i % 3 === 0) {
        const dome = addMesh(building, new THREE.SphereGeometry(7.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#6ea4a2");
        dome.position.y = height + .4;
        const finial = addMesh(building, new THREE.ConeGeometry(.65, 2.4, 6), "#d3af66", "metal");
        finial.position.y = height + 8.7;
      } else {
        for (const x of [-5, 5]) {
          const cap = addMesh(building, new THREE.BoxGeometry(3, 2, 16), "#e5bd86");
          cap.position.set(x, height + 1.1, 0);
        }
      }
      for (const z of [-7.55, 7.55]) {
        const recess = addMesh(building, new THREE.BoxGeometry(3, 5, .12), "#876c52");
        recess.position.set(0, height - 6, z);
      }
    }
  } else {
    const count = detail === 0 ? 16 : detail === 1 ? 28 : 44;
    const trunks = makeInstances("backdrop_tree_trunks", new THREE.CylinderGeometry(.65, 1.1, 1, 6), count, iron ? "#685449" : "#665d42");
    const crowns = makeInstances(iron ? "junction_pine_canopies" : "temple_broadleaf_canopies",
      iron ? new THREE.ConeGeometry(1, 1, 7) : new THREE.IcosahedronGeometry(1, 1), count * 3, "#ffffff");
    for (let i = 0; i < count; i++) {
      const fraction = (Math.floor(i / 4) + .5 + Math.sin(i * 2.1) * .18) / Math.ceil(count / 4);
      position.copy(edgePoint(i % 4, fraction, 25 + i % 3 * 8));
      const height = iron ? 30 + (i * 7) % 5 * 5 : 42 + (i * 7) % 5 * 4;
      position.y = height / 2;
      rotation.identity(); scale.set(1, height, 1);
      matrix.compose(position, rotation, scale); trunks.setMatrixAt(i, matrix);
      for (let tier = 0; tier < 3; tier++) {
        const crownPosition = position.clone();
        crownPosition.y = height - (iron ? 6 + tier * 6 : tier * 3);
        crownPosition.x += iron ? 0 : (tier - 1) * 5;
        crownPosition.z += iron ? 0 : (tier % 2 ? 4 : -2);
        const radius = iron ? 7 + tier * 2 : 9 + i % 3 * 1.5;
        scale.set(radius, iron ? 17 : 6.5, radius);
        rotation.setFromEuler(new THREE.Euler(0, i * .63 + tier, 0));
        matrix.compose(crownPosition, rotation, scale); crowns.setMatrixAt(i * 3 + tier, matrix);
        crowns.setColorAt(i * 3 + tier, new THREE.Color(iron ? ["#577567", "#6e8870", "#899571"][i % 3] : ["#568465", "#6c956e", "#44765c"][i % 3]));
      }
    }
    trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
  }
  return root;
};
