import * as THREE from "three";
import { ATHLETICS_STADIUM_COURSE, ATHLETICS_PLAYER_EYE_HEIGHT, ZEUS_SUMMIT_SURFACE_INDEX, ZEUS_STRIKE_VISIBLE_MS, getZeusLight, type GameSession } from "@quizstrike/shared";

export const ZEUS_SKY_LAYER = 1;

/** A small sky referee stays visible through bends without dominating the race. */
export const createZeusVisuals = (root: THREE.Group, camera?: THREE.PerspectiveCamera, reducedMotion = false) => {
  const sky = new THREE.Group();
  sky.name = "athletics-zeus-sky";
  const head = new THREE.Group();
  head.name = "athletics-zeus-head";
  sky.add(head);
  root.add(sky);
  const material = (color: string, glow = "#000000") => new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0.18, roughness: 0.8, fog: false });
  const skin = material("#f2c5a1", "#815441");
  const hair = material("#fff8ed", "#827e98");
  const gold = material("#ffd76b", "#bd721b");
  const eyes = material("#fffdf5");
  const pupil = material("#27324b");
  const cheeks = material("#e9a5a0");
  const robe = material("#84c9ed", "#274a69");
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const ellipsoid = (parent: THREE.Group, mat: THREE.Material, position: number[], scale: number[]) => {
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(position[0]!, position[1]!, position[2]!);
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!);
    parent.add(mesh);
    return mesh;
  };
  ellipsoid(head, robe, [0, -1.9, -0.15], [1.5, 0.75, 0.75]);
  ellipsoid(head, hair, [0, 0.38, -0.4], [1.42, 1.47, 1]);
  ellipsoid(head, skin, [0, 0, 0.15], [1.28, 1.35, 1.04]);
  for (const side of [-1, 1]) {
    ellipsoid(head, skin, [side * 1.24, 0, 0.12], [0.23, 0.35, 0.28]);
    ellipsoid(head, eyes, [side * 0.46, 0.21, 1.08], [0.27, 0.25, 0.12]);
    ellipsoid(head, pupil, [side * 0.46, 0.21, 1.19], [0.12, 0.15, 0.06]);
    ellipsoid(head, eyes, [side * 0.46 - 0.035, 0.27, 1.25], [0.036, 0.045, 0.015]);
    ellipsoid(head, cheeks, [side * 0.79, -0.27, 1.04], [0.23, 0.13, 0.07]);
    const brow = ellipsoid(head, hair, [side * 0.46, 0.61, 1.08], [0.31, 0.075, 0.1]);
    brow.rotation.z = -side * 0.08;
    ellipsoid(head, hair, [side * 0.86, -0.9, 0.68], [0.38, 0.48, 0.42]);
    ellipsoid(head, hair, [side * 0.45, -1.18, 0.81], [0.45, 0.48, 0.38]);
    for (let i = 0; i < 3; i++) ellipsoid(head, hair, [side * (0.35 + i * 0.34), 1.18 - i * 0.24, 0.15], [0.46, 0.35, 0.52]);
  }
  ellipsoid(head, skin, [0, -0.13, 1.16], [0.19, 0.24, 0.23]);
  // A shallow upward smile, instead of an opening black mouth and red eyes.
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 20, Math.PI), pupil);
  smile.name = "athletics-zeus-smile";
  smile.position.set(0, -0.43, 1.15);
  smile.rotation.z = Math.PI;
  smile.scale.y = 0.5;
  head.add(smile);
  ellipsoid(head, hair, [0, -1.4, 0.78], [0.47, 0.38, 0.38]);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.11, 8, 28), gold);
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 1.15;
  head.add(crown);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 6), gold);
    spike.position.set(Math.cos(angle) * 1.2, 1.37, Math.sin(angle) * 1.2);
    head.add(spike);
  }
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: "#f4f5ff", emissive: "#8d8fa8", emissiveIntensity: 0.25, roughness: 1, transparent: true, opacity: 0.8, fog: false });
  for (let i = -2; i <= 2; i++) ellipsoid(sky, cloudMaterial, [i * 0.75, -2.22 + Math.abs(i) * 0.08, -0.25], [0.96, 0.4, 0.72]);
  // Render the apparition after the course so nearby scenery cannot hide the
  // signal. Its own depth buffer still keeps the face hidden when turned away.
  if (camera) sky.traverse((object) => object.layers.set(ZEUS_SKY_LAYER));

  const summit = ATHLETICS_STADIUM_COURSE.surfaces[ZEUS_SUMMIT_SURFACE_INDEX]!;
  const gateway = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.25, 8, 40), gold);
  gateway.name = "athletics-zeus-summit";
  gateway.position.set(summit.x, summit.y + 5, summit.z);
  root.add(gateway);
  const boltGeometry = new THREE.CylinderGeometry(0.16, 0.24, 1, 5);
  const boltPoints = [new THREE.Vector3(0, 16, 0), new THREE.Vector3(0.6, 13, 0.1), new THREE.Vector3(-0.7, 10.5, 0), new THREE.Vector3(0.6, 8, 0.2), new THREE.Vector3(-0.45, 5, 0), new THREE.Vector3(0.4, 2.5, 0), new THREE.Vector3(0, 0, 0)];
  const bolts = Array.from({ length: 8 }, (_, index) => {
    const bolt = new THREE.Group();
    bolt.name = `athletics-zeus-lightning-${index}`;
    bolt.visible = false;
    const glow = new THREE.MeshBasicMaterial({ color: "#fff2af", transparent: true, opacity: 1, depthWrite: false, fog: false });
    for (let i = 1; i < boltPoints.length; i++) {
      const a = boltPoints[i - 1]!;
      const b = boltPoints[i]!;
      const segment = new THREE.Mesh(boltGeometry, glow);
      segment.position.copy(a).add(b).multiplyScalar(0.5);
      segment.scale.y = a.distanceTo(b);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      bolt.add(segment);
      const halo = new THREE.Mesh(boltGeometry, new THREE.MeshBasicMaterial({ color: "#b587ff", transparent: true, opacity: 0.25, depthWrite: false, fog: false }));
      halo.position.copy(segment.position);
      halo.quaternion.copy(segment.quaternion);
      halo.scale.set(3, segment.scale.y, 3);
      bolt.add(halo);
    }
    const ringMaterial = new THREE.MeshBasicMaterial({ color: "#c49aff", transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 24), ringMaterial);
    ring.name = `athletics-zeus-impact-${index}`;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    bolt.add(ring);
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 0), glow);
    spark.position.y = 0.9;
    bolt.add(spark);
    root.add(bolt);
    return { bolt, glow, ring, ringMaterial };
  });
  const position = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  let lastPhase: string | undefined;
  let defeatedAt = 0;
  return {
    update: (session: GameSession | null | undefined, nowMs: number) => {
      const zeus = session?.athletics?.zeus;
      bolts.forEach(({ bolt, glow, ring, ringMaterial }, index) => {
        const strike = zeus?.lastStrikes?.[index];
        const age = strike ? nowMs - Date.parse(strike.at) : Infinity;
        bolt.visible = age >= 0 && age < ZEUS_STRIKE_VISIBLE_MS;
        if (strike && bolt.visible) {
          bolt.position.set(strike.position.x, strike.position.y - ATHLETICS_PLAYER_EYE_HEIGHT, strike.position.z);
          const fade = Math.max(0, 1 - age / ZEUS_STRIKE_VISIBLE_MS);
          glow.opacity = fade;
          bolt.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.material !== glow && child.material !== ringMaterial) child.material.opacity = fade * 0.25;
          });
          ringMaterial.opacity = fade * 0.8;
          ring.scale.setScalar(reducedMotion ? 2 : 1 + age / 300);
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
      if (camera) {
        camera.getWorldPosition(position);
        camera.getWorldQuaternion(orientation);
        const halfHeight = 110 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        // Phone HUDs occupy the upper third; place the face below them and
        // beside the central course guide. Wide views leave the right sky free.
        const narrow = camera.aspect < 1;
        sky.position.set(halfHeight * camera.aspect * (narrow ? 0.62 : 0.7), halfHeight * (narrow ? 0.03 : 0.68), -110).applyQuaternion(orientation).add(position);
        sky.quaternion.copy(orientation);
        sky.scale.setScalar((narrow ? 2.8 : 4.6) * (1 - defeat * 0.5));
      } else {
        sky.position.set(summit.x, summit.y + 30, summit.z);
        sky.scale.setScalar(4.6 * (1 - defeat * 0.5));
      }
    }
  };
};
