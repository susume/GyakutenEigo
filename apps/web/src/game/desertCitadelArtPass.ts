import * as THREE from "three";
import { ARENA_SCALE } from "@quizstrike/shared";

type AddStaticMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: string,
  surface?: string
) => THREE.Mesh;

const s = (value: number) => value * ARENA_SCALE;
const plaster = "#c99462";
const sunbleached = "#e1bf83";
const shadowStone = "#744b37";
const cedar = "#8a5735";

/**
 * Adds shallow construction detail directly to the authored perimeter walls.
 * Every element is wall-bound: there are no signs, scenery cones, gates, or
 * freestanding props that can be mistaken for gameplay cover.
 */
const addPerimeterWallDetails = (
  scene: THREE.Scene,
  addStaticMesh: AddStaticMesh,
  detail: number
) => {
  const addFacade = (horizontal: boolean, fixed: number, rotationY: number) => {
    const facade = new THREE.Group();
    facade.name = `desert_citadel_wall_detail_${horizontal ? "horizontal" : "vertical"}_${fixed}`;
    if (horizontal) facade.position.z = s(fixed);
    else facade.position.x = s(fixed);
    facade.rotation.y = rotationY;

    for (const y of [4.2, 9.2]) {
      const course = addStaticMesh(
        facade,
        new THREE.BoxGeometry(s(horizontal ? 492 : 376), 0.16, 0.18),
        y < 5 ? "#c18755" : sunbleached,
        "stone"
      );
      course.position.y = y;
    }

    const bays = horizontal ? [-204, -136, -68, 0, 68, 136, 204] : [-136, -68, 0, 68, 136];
    for (const [index, x] of bays.entries()) {
      const pier = addStaticMesh(facade, new THREE.BoxGeometry(.9, 12.6, .18), plaster);
      pier.position.set(s(x + 24), 6.3, 0);
      const recess = addStaticMesh(
        facade,
        new THREE.BoxGeometry(s(3.1), 2.15, 0.16),
        shadowStone,
        "stone"
      );
      recess.position.set(s(x), 6.7, 0);

      const arch = addStaticMesh(
        facade,
        new THREE.TorusGeometry(s(1.58), 0.14, 6, 14, Math.PI),
        index % 2 ? sunbleached : plaster,
        "stone"
      );
      arch.position.set(s(x), 7.77, 0);

      if (detail === 2) {
        for (const shutterX of [x - 1.35, x + 1.35]) {
          const shutter = addStaticMesh(
            facade,
            new THREE.BoxGeometry(s(0.22), 1.72, 0.2),
            cedar,
            "wood"
          );
          shutter.position.set(s(shutterX), 6.72, -0.1);
        }
      }
    }

    scene.add(facade);
  };

  addFacade(true, -191.7, 0);
  addFacade(true, 191.7, Math.PI);
  addFacade(false, -251.7, Math.PI / 2);
  addFacade(false, 251.7, -Math.PI / 2);
};

export const addDesertCitadelArtPass = (
  scene: THREE.Scene,
  addStaticMesh: AddStaticMesh,
  detail: number,
  _isFps: boolean
) => {
  addPerimeterWallDetails(scene, addStaticMesh, detail);
  // The Falcon Obelisk becomes a recognizable carved landmark. Relief stays
  // inside its existing footprint and below the authored crown height.
  const relief = new THREE.Group();
  relief.name = "desert_citadel_falcon_relief";
  relief.position.set(0, 0, s(-112));
  scene.add(relief);
  for (const side of [-1, 1]) {
    const sun = addStaticMesh(relief, new THREE.CylinderGeometry(1.7, 1.7, .14, 16), "#d9b874", "stone");
    sun.rotation.x = Math.PI / 2;
    sun.position.set(0, 12, side * s(7));
    for (const wing of [-1, 1]) {
      const feather = addStaticMesh(relief, new THREE.BoxGeometry(2.5, .6, .16), "#619e9a", "stone");
      feather.position.set(wing * 1.6, 10.3, side * s(7));
      feather.rotation.z = wing * -.35;
    }
  }
  return { dispose: () => undefined };
};
