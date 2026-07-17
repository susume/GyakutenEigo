import * as THREE from "three";
import { ARENA_SCALE } from "@quizstrike/shared";

type Ripple = {
  mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  radius: number;
};

export interface DesertCitadelVfxHandle {
  update(elapsed: number): void;
  dispose(): void;
  readonly activeEffects: number;
}

const WATERWORKS_ANCHORS = [
  { x: 0, z: -16, radius: 6, color: "#67e8f9" },
  { x: 0, z: 0, radius: 9, color: "#35d7e8" },
  { x: -20, z: -8, radius: 3.2, color: "#62e2e5" }
] as const;

export const getDesertCitadelVfxCount = (detail: number) => detail === 0 ? 1 : detail === 1 ? 2 : 3;

export const addDesertCitadelVfx = (scene: THREE.Scene, detail: number): DesertCitadelVfxHandle => {
  const group = new THREE.Group();
  group.name = "desert_citadel_waterworks_vfx";
  scene.add(group);

  const ripples: Ripple[] = [];
  const anchorCount = getDesertCitadelVfxCount(detail);
  WATERWORKS_ANCHORS.slice(0, anchorCount).forEach((anchor, anchorIndex) => {
    const rippleCount = detail > 1 && anchorIndex < 2 ? 2 : 1;
    for (let rippleIndex = 0; rippleIndex < rippleCount; rippleIndex += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: anchor.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 6, 24), material);
      mesh.name = `desert_citadel_water_ripple_${anchorIndex}_${rippleIndex}`;
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(anchor.x * ARENA_SCALE, 0.42 + anchorIndex * 0.02, anchor.z * ARENA_SCALE);
      group.add(mesh);
      ripples.push({
        mesh,
        phase: (anchorIndex * 0.31 + rippleIndex * 0.47) % 1,
        radius: anchor.radius * ARENA_SCALE
      });
    }
  });

  return {
    activeEffects: ripples.length,
    update(elapsed: number) {
      ripples.forEach(({ mesh, phase, radius }) => {
        const progress = (elapsed * 0.34 + phase) % 1;
        const ease = 1 - Math.pow(1 - progress, 2);
        mesh.scale.setScalar(Math.max(0.05, radius * (0.28 + ease * 0.72)));
        mesh.material.opacity = (1 - progress) * 0.34;
        mesh.rotation.z = elapsed * 0.16 + phase * Math.PI * 2;
      });
    },
    dispose() {
      scene.remove(group);
      ripples.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
    }
  };
};
