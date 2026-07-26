import * as THREE from "three";
import { ARENA_SCALE } from "@quizstrike/shared";

type AddStaticMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: string,
  surface?: string
) => THREE.Mesh;

const s = (value: number) => value * ARENA_SCALE;

export const addIronJunctionArtPass = (
  scene: THREE.Scene,
  addStaticMesh: AddStaticMesh,
  detail: number,
  isFps: boolean
) => {
  const railway = new THREE.Group();
  railway.name = "iron_junction_shared_rail_system";
  scene.add(railway);

  const railGeometry = new THREE.BoxGeometry(s(390), 0.16, 0.14);
  const sleeperGeometry = new THREE.BoxGeometry(0.34, 0.12, s(8));
  const sleeperCountPerLine = detail === 0 ? 32 : 54;
  for (const rawZ of [-42, 0, 42, 82]) {
    for (const offset of [-2.1, 2.1]) {
      const rail = addStaticMesh(railway, railGeometry, "#a7aaa2", "metal");
      rail.position.set(0, 0.17, s(rawZ) + offset);
    }
    const sleepers = new THREE.InstancedMesh(
      sleeperGeometry,
      new THREE.MeshStandardMaterial({ color: "#5d4535", roughness: 0.92 }),
      sleeperCountPerLine
    );
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < sleeperCountPerLine; index += 1) {
      const x = s(-192 + (384 * index) / Math.max(1, sleeperCountPerLine - 1));
      matrix.makeTranslation(x, 0.08, s(rawZ));
      sleepers.setMatrixAt(index, matrix);
    }
    sleepers.instanceMatrix.needsUpdate = true;
    sleepers.receiveShadow = true;
    railway.add(sleepers);
  }

  const gorge = new THREE.Group();
  gorge.name = "iron_junction_mountain_gorge";
  scene.add(gorge);
  const rockGeometry = new THREE.IcosahedronGeometry(1, detail === 2 ? 1 : 0);
  const rockCount = detail === 0 ? 18 : 34;
  const rocks = new THREE.InstancedMesh(
    rockGeometry,
    new THREE.MeshStandardMaterial({ color: "#5f6762", roughness: 0.98 }),
    rockCount
  );
  const rockMatrix = new THREE.Matrix4();
  const rockPosition = new THREE.Vector3();
  const rockScale = new THREE.Vector3();
  const rockRotation = new THREE.Quaternion();
  for (let index = 0; index < rockCount; index += 1) {
    const north = index % 2 === 0;
    const x = s(-260 + ((index * 83) % 520));
    rockPosition.set(x, 4 + (index % 5) * 1.4, s(north ? -242 : 242));
    rockScale.set(8 + (index % 4) * 3, 6 + (index % 3) * 3, 7 + (index % 5));
    rockRotation.setFromEuler(new THREE.Euler(0.1 * (index % 3), index * 0.71, 0.04 * (index % 4)));
    rockMatrix.compose(rockPosition, rockRotation, rockScale);
    rocks.setMatrixAt(index, rockMatrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.receiveShadow = true;
  gorge.add(rocks);

  const landmark = new THREE.Group();
  landmark.name = "iron_junction_control_landmark";
  landmark.position.set(s(58), 0, s(-38));
  scene.add(landmark);
  for (const x of [-s(18), s(18)]) {
    const mast = addStaticMesh(landmark, new THREE.BoxGeometry(1.2, 29, 1.2), "#6f3d2f", "metal");
    mast.position.set(x, 14.5, 0);
  }
  for (const y of [10, 18, 27]) {
    const beam = addStaticMesh(landmark, new THREE.BoxGeometry(s(38), 0.7, 1.4), y === 27 ? "#cf873d" : "#39464b", "metal");
    beam.position.y = y;
  }
  const clock = addStaticMesh(landmark, new THREE.CylinderGeometry(3.1, 3.1, 0.55, 20), "#d4c8a7", "accent");
  clock.rotation.x = Math.PI / 2;
  clock.position.set(0, 24, -1.1);
  for (const angle of [0.25, 2.1]) {
    const hand = addStaticMesh(landmark, new THREE.BoxGeometry(0.18, 2.2, 0.18), "#333a3b", "metal");
    hand.position.set(Math.sin(angle) * 0.8, 24 + Math.cos(angle) * 0.8, -1.5);
    hand.rotation.z = -angle;
  }

  const tunnelLights = new THREE.Group();
  tunnelLights.name = "iron_junction_tunnel_lighting";
  scene.add(tunnelLights);
  for (const rawX of [-175, -125, -65, -5, 55, 115]) {
    const fixture = addStaticMesh(tunnelLights, new THREE.BoxGeometry(2.5, 0.35, 0.5), "#d86148", "accent");
    fixture.position.set(s(rawX), 8, s(rawX < -40 ? 213 : 219));
    if (detail > 0 && rawX % 2 !== 0) {
      const light = new THREE.PointLight("#e88662", isFps ? 2.2 : 3.8, 30, 2);
      light.position.copy(fixture.position);
      tunnelLights.add(light);
    }
  }

  if (detail > 0) {
    const warmFillPositions = [
      [-145, -95], [-55, -92], [94, -102], [165, -103], [35, 120], [155, 116]
    ] as const;
    for (const [rawX, rawZ] of warmFillPositions) {
      const light = new THREE.SpotLight("#ffc176", isFps ? 6 : 10, 58, Math.PI / 4, 0.65, 1.7);
      light.position.set(s(rawX), 15, s(rawZ));
      light.target.position.set(s(rawX), 0, s(rawZ + 18));
      scene.add(light, light.target);
    }
  }
};
