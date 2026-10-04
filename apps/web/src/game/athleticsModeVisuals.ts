import { createZeusVisuals, ZEUS_SKY_LAYER } from "./zeusBackdrop";
import * as THREE from "three";
import {
  ATHLETICS_STADIUM_COURSE,
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
  renderOverlay?: (renderer: THREE.WebGLRenderer) => void;
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

export const createAthleticsModeVisuals = ({ scene, mode, camera }: { scene: THREE.Scene; mode: AthleticsMode; camera?: THREE.PerspectiveCamera }): AthleticsModeVisuals => {
  const root = new THREE.Group();
  root.name = `athletics-mode-visuals-${mode}`;
  scene.add(root);
  if (mode === "zeus") {
    const visuals = createZeusVisuals(root, camera, typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const lights: { light: THREE.Light; mask: number }[] = [];
    if (camera) scene.traverse((object) => {
      if (object instanceof THREE.Light) {
        lights.push({ light: object, mask: object.layers.mask });
        object.layers.enable(ZEUS_SKY_LAYER);
      }
    });
    return {
      update: visuals.update,
      renderOverlay: camera ? (renderer) => {
        const cameraMask = camera.layers.mask;
        const background = scene.background;
        const autoClear = renderer.autoClear;
        const autoReset = renderer.info.autoReset;
        const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
        try {
          camera.layers.set(ZEUS_SKY_LAYER);
          scene.background = null;
          renderer.autoClear = false;
          renderer.info.autoReset = false;
          renderer.shadowMap.autoUpdate = false;
          renderer.clearDepth();
          renderer.render(scene, camera);
        } finally {
          camera.layers.mask = cameraMask;
          scene.background = background;
          renderer.autoClear = autoClear;
          renderer.info.autoReset = autoReset;
          renderer.shadowMap.autoUpdate = shadowAutoUpdate;
        }
      } : undefined,
      dispose: () => {
        lights.forEach(({ light, mask }) => { light.layers.mask = mask; });
        disposeVisualObject(root);
      }
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
