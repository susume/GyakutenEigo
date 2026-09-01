import * as THREE from "three";
import type { ArenaQuality } from "../../gamePreferences";

export type QuizStrikeLightingConfig = {
  background: string;
  fog: { color: string; near: number; far: number };
  ambient: { sky: string; ground: string; intensity: number };
  sun: { color: string; intensity: number; direction: [number, number, number] };
  fill: { color: string; intensity: number; direction: [number, number, number] };
  shadowQuality: "off" | "soft" | "high";
  shadowBounds: { left: number; right: number; top: number; bottom: number; near: number; far: number };
};

type LightingContext = {
  mapId: string;
  isFps: boolean;
  isZombieMode: boolean;
  isIronJunction: boolean;
  isTempleRunoff: boolean;
  quality: Exclude<ArenaQuality, "auto">;
};

export const getQuizStrikeLightingConfig = ({
  mapId,
  isFps,
  isZombieMode,
  isIronJunction,
  isTempleRunoff,
  quality
}: LightingContext): QuizStrikeLightingConfig => {
  const isAthletics = mapId === "athletics_park";
  const shadowQuality = quality === "high" && !isFps ? "high" : quality === "balanced" && !isFps ? "soft" : "off";
  if (isAthletics) {
    return {
      background: "#82cbe5",
      fog: { color: "#c3e6e1", near: isFps ? 120 : 210, far: isFps ? 430 : 560 },
      ambient: { sky: "#f7f6df", ground: "#1c5360", intensity: isFps ? 1.05 : 1.28 },
      sun: { color: "#fff0ca", intensity: isFps ? 1.75 : 2.15, direction: [-120, 220, 120] },
      fill: { color: "#8bcbd4", intensity: isFps ? 0.48 : 0.62, direction: [160, 90, -180] },
      shadowQuality,
      shadowBounds: { left: -170, right: 170, top: 190, bottom: -190, near: 1, far: 520 }
    };
  }
  return {
    background: isZombieMode ? "#5d668a" : isIronJunction ? "#8da6aa" : isTempleRunoff ? "#a9cfbe" : "#d5b56e",
    fog: {
      color: isZombieMode ? "#8f8395" : isIronJunction ? "#bfd4d0" : isTempleRunoff ? "#b9d9ca" : "#eed9ad",
      near: isFps ? 110 : 185,
      far: isFps ? 360 : 520
    },
    ambient: {
      sky: isZombieMode ? "#d8ddff" : isIronJunction ? "#d9edf0" : isTempleRunoff ? "#e7f4d5" : "#fff6d8",
      ground: isZombieMode ? "#65556e" : isIronJunction ? "#354146" : isTempleRunoff ? "#334836" : "#8f7d6f",
      intensity: isFps ? 1.04 : 1.18
    },
    sun: {
      color: isZombieMode ? "#d9e1ff" : isIronJunction ? "#d6edf0" : isTempleRunoff ? "#ffd798" : "#fff0ca",
      intensity: isFps ? 1.72 : 2.1,
      direction: [isIronJunction ? -120 : isTempleRunoff ? -105 : -85, 180, isIronJunction ? -60 : 95]
    },
    fill: {
      color: isZombieMode ? "#b7a8de" : isIronJunction ? "#f3b47a" : isTempleRunoff ? "#7ed9c8" : "#ffe7bd",
      intensity: isFps ? 0.66 : 0.52,
      direction: [110, 80, -130]
    },
    shadowQuality,
    shadowBounds: { left: -190, right: 190, top: 175, bottom: -175, near: 1, far: 500 }
  };
};

export const createQuizStrikeLightingRig = (
  scene: THREE.Scene,
  config: QuizStrikeLightingConfig
) => {
  scene.background = new THREE.Color(config.background);
  scene.fog = new THREE.Fog(config.fog.color, config.fog.near, config.fog.far);

  const hemisphere = new THREE.HemisphereLight(config.ambient.sky, config.ambient.ground, config.ambient.intensity);
  hemisphere.name = "quizstrike_ambient_fill";
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(config.sun.color, config.sun.intensity);
  sun.name = "quizstrike_key_sun";
  sun.position.set(...config.sun.direction);
  sun.castShadow = config.shadowQuality !== "off";
  if (sun.castShadow) {
    const resolution = config.shadowQuality === "high" ? 2048 : 1024;
    sun.shadow.mapSize.set(resolution, resolution);
    sun.shadow.camera.left = config.shadowBounds.left;
    sun.shadow.camera.right = config.shadowBounds.right;
    sun.shadow.camera.top = config.shadowBounds.top;
    sun.shadow.camera.bottom = config.shadowBounds.bottom;
    sun.shadow.camera.near = config.shadowBounds.near;
    sun.shadow.camera.far = config.shadowBounds.far;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.025;
  }
  scene.add(sun);

  const fill = new THREE.DirectionalLight(config.fill.color, config.fill.intensity);
  fill.name = "quizstrike_colored_fill";
  fill.position.set(...config.fill.direction);
  scene.add(fill);

  return { hemisphere, sun, fill };
};
