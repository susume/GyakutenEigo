import * as THREE from "three";
import type { ArenaQuality } from "./gamePreferences";
import { createQuizStrikeLightingRig, getQuizStrikeLightingConfig } from "./rendering/lighting/QuizStrikeLighting";

type ArenaSceneMap = {
  id?: string;
  palette: {
    sky: string;
    fog: string;
    floor: string;
    floorTexture: string;
    accent: string;
  };
};

type ActiveArenaQuality = Exclude<ArenaQuality, "auto">;

export const FPS_BASE_FOV = 72;

export type ArenaQualityConfig = {
  pixelRatio: number;
  shadows: boolean;
  anisotropy: number;
  detail: number;
};

export type ArenaSceneSetup = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  qualityConfig: ArenaQualityConfig;
};

export const createArenaSceneSetup = ({
  mount,
  arenaMap,
  isFps,
  isZombieMode,
  isIronJunction,
  isTempleRunoff,
  activeQuality
}: {
  mount: HTMLDivElement;
  arenaMap: ArenaSceneMap;
  isFps: boolean;
  isZombieMode: boolean;
  isIronJunction: boolean;
  isTempleRunoff: boolean;
  activeQuality: ActiveArenaQuality;
}): ArenaSceneSetup | null => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    isFps ? FPS_BASE_FOV : 52,
    mount.clientWidth / Math.max(1, mount.clientHeight),
    0.1,
    620
  );

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: activeQuality !== "performance",
      alpha: false,
      powerPreference: "high-performance"
    });
  } catch {
    return null;
  }

  const balancedShadows = arenaMap.id === "athletics_park";
  const qualityConfig: ArenaQualityConfig = activeQuality === "performance"
    ? { pixelRatio: 1, shadows: false, anisotropy: 2, detail: 0 }
    : activeQuality === "balanced"
      ? { pixelRatio: 1.25, shadows: balancedShadows, anisotropy: 4, detail: 1 }
      : { pixelRatio: 1.75, shadows: true, anisotropy: 8, detail: 2 };

  createQuizStrikeLightingRig(scene, getQuizStrikeLightingConfig({
    mapId: arenaMap.id ?? "desert_citadel",
    isFps,
    isZombieMode,
    isIronJunction,
    isTempleRunoff,
    quality: activeQuality
  }));

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityConfig.pixelRatio));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.shadowMap.enabled = !isFps && qualityConfig.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = isFps ? (isIronJunction ? 1.06 : 0.9) : 0.98;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.className = "arena-webgl";
  renderer.domElement.dataset.quality = activeQuality;
  mount.appendChild(renderer.domElement);

  return { scene, camera, renderer, qualityConfig };
};
