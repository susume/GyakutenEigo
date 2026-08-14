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
        new THREE.BoxGeometry(s(492), 0.16, 0.18),
        y < 5 ? "#c18755" : sunbleached,
        "stone"
      );
      course.position.y = y;
    }

    for (const [index, x] of [-204, -136, -68, 0, 68, 136, 204].entries()) {
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
  return { dispose: () => undefined };
};
