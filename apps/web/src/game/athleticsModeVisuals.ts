import * as THREE from "three";
import {
  ATHLETICS_STADIUM_COURSE,
  ATHLETICS_PLAYER_EYE_HEIGHT,
  CHAOS_HAZARD_WARNING_MS,
  getAthleticsPointAtProgress,
  getAthleticsRouteTangent,
  getChaosHazardPosition,
  getHunterStationProgress,
  type AthleticsMode,
  type GameSession
} from "@quizstrike/shared";

type AthleticsModeVisuals = {
  update: (session: GameSession | null | undefined, nowMs: number) => void;
  dispose: () => void;
};

const makeMaterial = (color: string, emissive = color) => new THREE.MeshStandardMaterial({
  color,
  emissive,
  emissiveIntensity: 0.55,
  roughness: 0.42,
  metalness: 0.14
});

const disposeVisualObject = (root: THREE.Object3D) => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose?.();
  });
  root.parent?.remove(root);
};

const createZeusVisuals = (root: THREE.Group) => {
  const boss = new THREE.Group();
  boss.name = "athletics-zeus-boss";
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.1, 6.2, 12), makeMaterial("#4f5dbd", "#8d7dff"));
  body.position.y = 3.1;
  boss.add(body);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(3.4, 5.1, 12), makeMaterial("#2a356f", "#554dba"));
  robe.position.y = 1.3;
  boss.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.45, 16, 12), makeMaterial("#e5ad83", "#bd7d62"));
  head.position.y = 7.3;
  boss.add(head);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.18, 8, 20), makeMaterial("#ffd66e", "#ffaf40"));
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 8.35;
  boss.add(crown);
  for (const side of [-1, 1]) {
    const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 5), makeMaterial("#b697ff", "#e8ddff"));
    bolt.position.set(side * 1.28, 8.75, 0);
    bolt.rotation.z = side * -0.46;
    boss.add(bolt);
  }
  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(4.25, 0.18, 8, 40),
    new THREE.MeshBasicMaterial({ color: "#b697ff", transparent: true, opacity: 0.78, depthWrite: false })
  );
  aura.rotation.x = Math.PI / 2;
  aura.position.y = 0.18;
  boss.add(aura);
  const lightning = new THREE.PointLight("#b697ff", 16, 54, 2);
  lightning.position.y = 7;
  boss.add(lightning);
  const finish = getAthleticsPointAtProgress(1, ATHLETICS_STADIUM_COURSE);
  const bossHome = new THREE.Vector3(finish.x, finish.y + 0.25, finish.z);
  boss.position.copy(bossHome);
  root.add(boss);
  let lastPhase: string | undefined;
  let defeatedAt = 0;

  const warningPool = Array.from({ length: 4 }, (_, index) => {
    const warning = new THREE.Group();
    warning.name = `athletics-zeus-warning-${index}`;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.16, 8, 32),
      new THREE.MeshBasicMaterial({ color: "#d8c7ff", transparent: true, opacity: 0.92, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    warning.add(ring);
    const countdown = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 32),
      new THREE.MeshBasicMaterial({ color: "#ffd66e", transparent: true, opacity: 0.9, depthWrite: false }));
    countdown.rotation.x = Math.PI / 2;
    warning.add(countdown);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.42, 5.8, 8),
      new THREE.MeshBasicMaterial({ color: "#b697ff", transparent: true, opacity: 0.16, depthWrite: false })
    );
    column.position.y = 2.8;
    warning.add(column);
    root.add(warning);
    return { warning, ring, countdown, column };
  });

  return {
    update: (session: GameSession | null | undefined, nowMs: number) => {
      const zeus = session?.athletics?.zeus;
      const phase = zeus?.phase;
      if (phase !== lastPhase && phase === "defeated") defeatedAt = nowMs;
      lastPhase = phase;
      const defeatProgress = phase === "defeated" ? Math.min(1, Math.max(0, (nowMs - defeatedAt) / 1100)) : 0;
      boss.visible = phase !== "defeated" || defeatProgress < 1;
      boss.position.set(bossHome.x + defeatProgress * 2.8, bossHome.y + Math.sin(defeatProgress * Math.PI) * 1.4, bossHome.z);
      boss.scale.setScalar(phase === "rage" ? 1.12 + Math.sin(nowMs * 0.008) * 0.03 : Math.max(0.08, 1 - defeatProgress * 0.34));
      boss.rotation.y = nowMs * (phase === "rage" ? 0.0009 : 0.00035);
      boss.rotation.z = defeatProgress * 1.2;
      aura.rotation.z = nowMs * 0.0014;
      lightning.intensity = phase === "rage" ? 24 : phase === "charging" ? 19 : phase === "defeated" ? Math.max(0, 14 * (1 - defeatProgress)) : 12;
      const attack = zeus?.currentAttack;
      const entries = attack ? Object.entries(attack.warningPositions) : [];
      warningPool.forEach(({ warning, ring, countdown, column }, index) => {
        const target = entries[index]?.[1];
        if (!target || !attack) {
          warning.visible = false;
          return;
        }
        warning.visible = true;
        warning.position.set(target.x, target.y - ATHLETICS_PLAYER_EYE_HEIGHT + 0.22, target.z);
        const strikeAt = Date.parse(attack.strikeAt);
        const remaining = Number.isFinite(strikeAt) ? Math.max(0, strikeAt - nowMs) : 0;
        // The outer ring always shows the true damage radius. The inner ring
        // closes toward the centre to communicate time, without flashing.
        ring.scale.setScalar(attack.strikeRadius);
        const duration = Math.max(1, strikeAt - Date.parse(attack.warningStartedAt));
        countdown.scale.setScalar(attack.strikeRadius * Math.max(0.04, Math.min(1, remaining / duration)));
        ring.rotation.z = nowMs * (remaining < 900 ? 0.008 : 0.002);
        (ring.material as THREE.MeshBasicMaterial).opacity = remaining < 900 ? 1 : 0.72;
        (column.material as THREE.MeshBasicMaterial).opacity = remaining < 900 ? 0.3 : 0.12;
      });
    },
    dispose: () => undefined
  };
};

const createChaosVisuals = (root: THREE.Group) => {
  const colors: Record<string, string> = {
    "giant-ball": "#ff7fb4",
    barrel: "#ff9c54",
    "rubber-duck": "#ffd66e",
    "runaway-cart": "#40d9ff",
    "swinging-bumper": "#b697ff"
  };
  const pool = Array.from({ length: 18 }, (_, index) => {
    const hazard = new THREE.Group();
    hazard.name = `athletics-chaos-hazard-${index}`;
    const material = makeMaterial("#ff7fb4", "#ff7fb4");
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.28, 8, 16), material);
    bumper.rotation.x = Math.PI / 2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.8, 10), material);
    barrel.rotation.z = Math.PI / 2;
    const duck = new THREE.Group();
    const duckBody = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), material);
    duckBody.scale.set(1, 0.75, 1.2);
    const duckHead = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), material);
    duckHead.position.set(0, 0.85, 0.5);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 4), makeMaterial("#ff9c54"));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.8, 1.08);
    duck.add(duckBody, duckHead, beak);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), makeMaterial("#26334d"));
      eye.position.set(side * 0.28, 1, 0.87);
      duck.add(eye);
    }
    const cart = new THREE.Group();
    const cartBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 2.2), material);
    cartBody.position.y = 0.2;
    cart.add(cartBody);
    for (const x of [-0.95, 0.95]) for (const z of [-0.7, 0.7]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 8), makeMaterial("#26334d"));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -0.45, z);
      cart.add(wheel);
    }
    hazard.add(ball, bumper, barrel, duck, cart);
    root.add(hazard);
    const warning = new THREE.Group();
    warning.name = `athletics-chaos-warning-${index}`;
    const warningMaterial = new THREE.MeshBasicMaterial({ color: "#ffd66e", transparent: true, opacity: 0.9, depthWrite: false });
    const warningRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 6, 24), warningMaterial);
    warningRing.rotation.x = Math.PI / 2;
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 3), warningMaterial);
    pointer.rotation.x = Math.PI / 2;
    pointer.position.z = 1;
    warning.add(warningRing, pointer);
    root.add(warning);
    return { hazard, ball, bumper, barrel, duck, cart, material, warning, warningRing, warningMaterial };
  });
  return {
    update: (session: GameSession | null | undefined, nowMs: number) => {
      const hazards = session?.athletics?.chaos?.activeHazards ?? [];
      pool.forEach(({ hazard, ball, bumper, barrel, duck, cart, material, warning, warningRing, warningMaterial }, index) => {
        const definition = hazards[index];
        if (!definition) {
          hazard.visible = false;
          warning.visible = false;
          return;
        }
        const position = getChaosHazardPosition(definition, ATHLETICS_STADIUM_COURSE.route, nowMs);
        const spawnAt = Date.parse(definition.spawnAt);
        const expiresAt = Date.parse(definition.expiresAt);
        const telegraphing = nowMs < spawnAt;
        // Keep the direction marker under a travelling prop too, so the
        // player can read its route without taking their eyes off the course.
        warning.visible = nowMs < expiresAt;
        hazard.visible = !telegraphing && nowMs < expiresAt;
        if (warning.visible) {
          warning.position.set(position.x, position.y - (definition.kind === "giant-ball" ? definition.radius : 1.1) + 0.22, position.z);
          warningRing.scale.setScalar(definition.radius + 0.8);
          warningMaterial.opacity = telegraphing
            ? 0.45 + 0.5 * (1 - Math.min(1, (spawnAt - nowMs) / CHAOS_HAZARD_WARNING_MS)) : 0.35;
          const next = getChaosHazardPosition(definition, ATHLETICS_STADIUM_COURSE.route, Math.max(spawnAt, nowMs) + 250);
          warning.rotation.y = Math.atan2(next.x - position.x, next.z - position.z);
        }
        hazard.position.set(position.x, position.y, position.z);
        // Carts and ducks face their travel direction instead of spinning.
        hazard.rotation.y = warning.rotation.y;
        ball.rotation.x = nowMs * 0.002;
        barrel.rotation.x = nowMs * 0.002;
        bumper.rotation.z = nowMs * 0.002;
        const color = colors[definition.kind] ?? "#ff7fb4";
        material.color.set(color);
        material.emissive.set(color);
        material.emissiveIntensity = definition.kind === "giant-ball" ? 0.8 : 0.5;
        const scale = definition.kind === "giant-ball" ? definition.radius : definition.radius / 1.45;
        hazard.scale.setScalar(scale);
        ball.visible = definition.kind === "giant-ball";
        bumper.visible = definition.kind === "swinging-bumper";
        duck.visible = definition.kind === "rubber-duck";
        barrel.visible = definition.kind === "barrel";
        cart.visible = definition.kind === "runaway-cart";
      });
    },
    dispose: () => undefined
  };
};

const createHuntersRunnersVisuals = (root: THREE.Group) => {
  const pool = Array.from({ length: 8 }, (_, index) => {
    const station = new THREE.Group();
    station.name = `athletics-hunter-station-${index}`;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.16, 8, 32),
      new THREE.MeshBasicMaterial({ color: "#ff9c54", transparent: true, opacity: 0.76, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.7, 2.6, 8),
      new THREE.MeshBasicMaterial({ color: "#ffb86b", transparent: true, opacity: 0.28, depthWrite: false })
    );
    beacon.position.y = 1.3;
    station.add(ring, beacon);
    root.add(station);
    return { station, ring, beacon };
  });
  return {
    update: (session: GameSession | null | undefined, nowMs: number) => {
      const hunterCount = Math.min(pool.length, session?.athletics?.hunterIds?.length ?? 0);
      pool.forEach(({ station, ring, beacon }, index) => {
        if (index >= hunterCount) {
          station.visible = false;
          return;
        }
        const progress = getHunterStationProgress(index, hunterCount);
        const point = getAthleticsPointAtProgress(progress, ATHLETICS_STADIUM_COURSE);
        const tangent = getAthleticsRouteTangent(progress, ATHLETICS_STADIUM_COURSE);
        station.visible = true;
        station.position.set(point.x + tangent.z * 5.5, point.y + 0.12, point.z - tangent.x * 5.5);
        station.rotation.y = Math.atan2(-tangent.x, -tangent.z);
        ring.rotation.z = nowMs * 0.0012;
        const pulse = 0.92 + Math.sin(nowMs * 0.004 + index) * 0.08;
        ring.scale.setScalar(pulse);
        beacon.scale.y = 0.85 + Math.sin(nowMs * 0.005 + index) * 0.15;
      });
    },
    dispose: () => undefined
  };
};

export const createAthleticsModeVisuals = ({ scene, mode }: { scene: THREE.Scene; mode: AthleticsMode }): AthleticsModeVisuals => {
  const root = new THREE.Group();
  root.name = `athletics-mode-visuals-${mode}`;
  scene.add(root);
  if (mode === "zeus") {
    const visuals = createZeusVisuals(root);
    return {
      update: visuals.update,
      dispose: () => disposeVisualObject(root)
    };
  }
  if (mode === "chaos-climb") {
    const visuals = createChaosVisuals(root);
    return {
      update: visuals.update,
      dispose: () => disposeVisualObject(root)
    };
  }
  if (mode === "hunters-runners") {
    const visuals = createHuntersRunnersVisuals(root);
    return {
      update: visuals.update,
      dispose: () => disposeVisualObject(root)
    };
  }
  return {
    update: () => undefined,
    dispose: () => disposeVisualObject(root)
  };
};
