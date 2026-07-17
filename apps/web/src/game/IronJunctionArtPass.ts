import * as THREE from "three";

type AddStaticMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: string,
  surface?: string
) => THREE.Mesh;

export const addIronJunctionArtPass = (
  scene: THREE.Scene,
  addStaticMesh: AddStaticMesh,
  detail: number,
  isFps: boolean
) => {
  const terrain = new THREE.Group();
  terrain.name = "iron_junction_terrain_transitions";
  scene.add(terrain);

  for (const z of [-42, -3, 36]) {
    const ballast = addStaticMesh(terrain, new THREE.BoxGeometry(306, 0.12, 9.5), "#515b5e", "gravel");
    ballast.position.set(0, 0.01, z);
    for (const edge of [-1, 1]) {
      const frost = addStaticMesh(terrain, new THREE.BoxGeometry(304, 0.045, 1.2), edge > 0 ? "#c8d6d4" : "#9fb0af", "stone");
      frost.position.set(0, 0.09, z + edge * 5.1);
    }
  }

  for (const [x, z, sx, sz] of [
    [-168, -126, 42, 8], [154, -102, 48, 7], [-164, 118, 50, 9], [146, 134, 54, 8]
  ] as const) {
    const berm = addStaticMesh(terrain, new THREE.SphereGeometry(1, 14, 7), "#d8e1df", "stone");
    berm.position.set(x, -0.18, z);
    berm.scale.set(sx, 1.6, sz);
  }

  const landmark = new THREE.Group();
  landmark.name = "iron_junction_switchyard_landmark";
  landmark.position.set(2, 0, -18);
  scene.add(landmark);
  for (const x of [-17, 17]) {
    const tower = addStaticMesh(landmark, new THREE.BoxGeometry(1.4, 24, 1.4), "#743f2e", "metal");
    tower.position.set(x, 12, 0);
    for (const y of [5, 11, 17]) {
      const brace = addStaticMesh(landmark, new THREE.BoxGeometry(10.5, 0.42, 0.48), "#d18a3f", "metal");
      brace.position.set(x > 0 ? -11.5 : 11.5, y, 0);
      brace.rotation.z = x > 0 ? 0.42 : -0.42;
    }
  }
  const bridge = addStaticMesh(landmark, new THREE.BoxGeometry(36, 1.4, 2.2), "#39464b", "metal");
  bridge.position.y = 23;
  const sign = addStaticMesh(landmark, new THREE.BoxGeometry(13, 3.2, 0.5), "#e79a44", "accent");
  sign.position.set(0, 20, -1.35);
  const hookCable = addStaticMesh(landmark, new THREE.CylinderGeometry(0.1, 0.1, 11, 6), "#273236", "metal");
  hookCable.position.set(7, 16.8, 0);
  const hook = addStaticMesh(landmark, new THREE.TorusGeometry(0.8, 0.14, 6, 12, Math.PI * 1.35), "#e79a44", "metal");
  hook.position.set(7, 11.3, 0);
  hook.rotation.z = 0.3;

  const story = new THREE.Group();
  story.name = "iron_junction_maintenance_story";
  story.position.set(-58, 0, -112);
  scene.add(story);
  const workbench = addStaticMesh(story, new THREE.BoxGeometry(8.5, 1.1, 2.5), "#765038", "wood");
  workbench.position.y = 1.4;
  for (const x of [-3.4, 3.4]) {
    const leg = addStaticMesh(story, new THREE.BoxGeometry(0.45, 2.3, 0.45), "#343f42", "metal");
    leg.position.set(x, 1.1, 0);
  }
  const blueprint = addStaticMesh(story, new THREE.BoxGeometry(3.8, 0.05, 1.5), "#4aa3b8", "accent");
  blueprint.position.set(-1.2, 2, 0);
  const abandonedMug = addStaticMesh(story, new THREE.CylinderGeometry(0.35, 0.3, 0.6, 8), "#e8ddd0", "metal");
  abandonedMug.position.set(2.6, 2.25, 0);

  if (detail > 0) {
    for (const [x, z, color] of [[-46, -88, "#ffd38a"], [48, -88, "#ffd38a"], [-88, 92, "#80d8ff"], [92, 88, "#ff9b7d"]] as const) {
      const light = new THREE.SpotLight(color, isFps ? 12 : 22, 74, Math.PI / 5, 0.5, 1.6);
      light.position.set(x, 15, z);
      light.target.position.set(x * 0.72, 0, z * 0.72);
      scene.add(light, light.target);
    }
  }
};
