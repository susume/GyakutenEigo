import * as THREE from "three";
import { ATHLETICS_STADIUM_COURSE, ATHLETICS_PLAYER_EYE_HEIGHT, ZEUS_SUMMIT_SURFACE_INDEX, getZeusLight, type GameSession } from "@quizstrike/shared";

export const ZEUS_SKY_LAYER = 1;

/** A sky apparition follows the view so the course's bends cannot hide Zeus. */
export const createZeusVisuals = (root: THREE.Group, camera?: THREE.PerspectiveCamera, reducedMotion = false) => {
  const sky = new THREE.Group();
  sky.name = "athletics-zeus-sky";
  const head = new THREE.Group();
  head.name = "athletics-zeus-head";
  sky.add(head);
  root.add(sky);
  const material = (color: string, glow = "#000000") => new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0.4, roughness: 0.8, fog: false });
  const skin = material("#d6a475", "#493626");
  const hair = material("#f3f0e5", "#58546a");
  const gold = material("#ffce55", "#bd721b");
  const eyes = material("#fff7d8", "#ffe4a0");
  const pupil = material("#27324b");
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const ellipsoid = (parent: THREE.Group, mat: THREE.Material, position: number[], scale: number[]) => {
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(position[0]!, position[1]!, position[2]!);
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!);
    parent.add(mesh);
    return mesh;
  };
  ellipsoid(head, hair, [0, 0.35, -0.45], [1.62, 1.75, 1.1]);
  ellipsoid(head, skin, [0, 0, 0.15], [1.45, 1.65, 1.15]);
  for (const side of [-1, 1]) {
    ellipsoid(head, skin, [side * 1.42, 0, 0.12], [0.24, 0.46, 0.32]);
    ellipsoid(head, eyes, [side * 0.55, 0.24, 1.16], [0.33, 0.2, 0.14]);
    ellipsoid(head, pupil, [side * 0.55, 0.23, 1.28], [0.13, 0.14, 0.07]);
    const brow = ellipsoid(head, hair, [side * 0.55, 0.55, 1.22], [0.44, 0.12, 0.13]);
    brow.rotation.z = side * 0.14;
    ellipsoid(head, hair, [side * 0.34, -0.67, 1.24], [0.54, 0.23, 0.3]);
    for (let i = 0; i < 4; i++) {
      ellipsoid(head, hair, [side * (1.08 - i * 0.21), -0.9 - i * 0.34, 0.65 + i * 0.11], [0.5 - i * 0.045, 0.58, 0.47]);
    }
    for (let i = 0; i < 4; i++) ellipsoid(head, hair, [side * (0.5 + i * 0.3), 1.35 - i * 0.28, 0.15], [0.5, 0.42, 0.6]);
  }
  ellipsoid(head, skin, [0, -0.14, 1.25], [0.23, 0.48, 0.38]);
  const mouth = ellipsoid(head, pupil, [0, -0.88, 1.25], [0.34, 0.1, 0.08]);
  ellipsoid(head, hair, [0, -1.96, 0.84], [0.45, 0.59, 0.44]);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.14, 8, 24), gold);
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 1.34;
  head.add(crown);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 5), gold);
    spike.position.set(Math.cos(angle) * 1.36, 1.72, Math.sin(angle) * 1.36);
    head.add(spike);
  }
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: "#e9e3fa", emissive: "#70658e", emissiveIntensity: 0.25, roughness: 1, transparent: true, opacity: 0.75, fog: false });
  for (let i = -3; i <= 3; i++) ellipsoid(sky, cloudMaterial, [i * 0.86, -2.68 + Math.abs(i) * 0.08, -0.25], [1.15, 0.42, 0.76]);
  // Render the apparition after the course so nearby scenery cannot hide the
  // signal. Its own depth buffer still keeps the face hidden when turned away.
  if (camera) sky.traverse((object) => object.layers.set(ZEUS_SKY_LAYER));

  const summit = ATHLETICS_STADIUM_COURSE.surfaces[ZEUS_SUMMIT_SURFACE_INDEX]!;
  const gateway = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.25, 8, 40), gold);
  gateway.name = "athletics-zeus-summit";
  gateway.position.set(summit.x, summit.y + 5, summit.z);
  root.add(gateway);
  const boltGeometry = new THREE.CylinderGeometry(0.1, 0.16, 1, 5);
  const boltPoints = [new THREE.Vector3(0, 16, 0), new THREE.Vector3(0.6, 13, 0.1), new THREE.Vector3(-0.7, 10.5, 0), new THREE.Vector3(0.6, 8, 0.2), new THREE.Vector3(-0.45, 5, 0), new THREE.Vector3(0.4, 2.5, 0), new THREE.Vector3(0, 0, 0)];
  const bolts = Array.from({ length: 8 }, (_, index) => {
    const bolt = new THREE.Group();
    bolt.name = `athletics-zeus-lightning-${index}`;
    const glow = new THREE.MeshBasicMaterial({ color: "#e9d5ff", transparent: true, opacity: 1 });
    for (let i = 1; i < boltPoints.length; i++) {
      const a = boltPoints[i - 1]!;
      const b = boltPoints[i]!;
      const segment = new THREE.Mesh(boltGeometry, glow);
      segment.position.copy(a).add(b).multiplyScalar(0.5);
      segment.scale.y = a.distanceTo(b);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      bolt.add(segment);
    }
    root.add(bolt);
    return { bolt, glow };
  });
  const position = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  let lastPhase: string | undefined;
  let defeatedAt = 0;
  return {
    update: (session: GameSession | null | undefined, nowMs: number) => {
      const zeus = session?.athletics?.zeus;
      bolts.forEach(({ bolt, glow }, index) => {
        const strike = zeus?.lastStrikes?.[index];
        const age = strike ? nowMs - Date.parse(strike.at) : Infinity;
        bolt.visible = age >= 0 && age < 600;
        if (strike && bolt.visible) {
          bolt.position.set(strike.position.x, strike.position.y - ATHLETICS_PLAYER_EYE_HEIGHT, strike.position.z);
          glow.opacity = Math.max(0, 1 - age / 600);
        }
      });
      const light = getZeusLight(zeus, nowMs);
      if (light === "defeated" && lastPhase !== light) defeatedAt = nowMs;
      lastPhase = light;
      const defeat = light === "defeated" ? Math.min(1, Math.max(0, (nowMs - defeatedAt) / 1100)) : 0;
      sky.visible = defeat < 1;
      gateway.visible = light !== "defeated";
      const phaseStart = light === "red" && zeus?.phase === "green" ? Date.parse(zeus.phaseEndsAt ?? "") : Date.parse(zeus?.phaseStartedAt ?? "");
      const turn = !reducedMotion && Number.isFinite(phaseStart) ? THREE.MathUtils.clamp((nowMs - phaseStart) / 450, 0, 1) : 1;
      const smoothTurn = turn * turn * (3 - 2 * turn);
      head.rotation.y = light === "red" ? Math.PI * (1 - smoothTurn) : light === "green" ? Math.PI * smoothTurn : Math.PI;
      head.rotation.z = defeat * 0.65;
      sky.userData.light = light;
      mouth.scale.y = light === "green" ? 0.1 + Math.max(0, Math.sin(nowMs * 0.019)) * 0.12 : 0.1;
      eyes.emissive.set(light === "red" ? "#ff6846" : "#ffe4a0");
      eyes.emissiveIntensity = light === "red" ? 1.7 : 0.4;
      if (camera) {
        camera.getWorldPosition(position);
        camera.getWorldQuaternion(orientation);
        const halfHeight = 110 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        // Phone HUDs occupy the upper third; place the face below them and
        // beside the central course guide. Wide views leave the right sky free.
        const narrow = camera.aspect < 0.65;
        sky.position.set(halfHeight * camera.aspect * (narrow ? 0.55 : 0.48), halfHeight * (narrow ? 0.03 : 0.68), -110).applyQuaternion(orientation).add(position);
        sky.quaternion.copy(orientation);
        sky.scale.setScalar(Math.max(0.75, Math.min(1, camera.aspect)) * 8.5 * (1 - defeat * 0.5));
      } else {
        sky.position.set(summit.x, summit.y + 30, summit.z);
        sky.scale.setScalar(8 * (1 - defeat * 0.5));
      }
    }
  };
};
