import {
  HEAVY_GUN_ZOOM_LEVEL_0_FOV,
  HEAVY_GUN_ZOOM_LEVEL_1_FOV,
  HEAVY_GUN_ZOOM_LEVEL_2_FOV,
  getGearZoomFovMultiplier
} from "@quizstrike/shared";

export type HeavyGunZoomLevel = 0 | 1 | 2;

export const cycleHeavyGunZoom = (currentLevel: number): HeavyGunZoomLevel =>
  ((Math.max(0, Math.min(2, Math.floor(currentLevel))) + 1) % 3) as HeavyGunZoomLevel;

export const normalizeWeaponZoom = (gearId: string, zoomLevel: number): HeavyGunZoomLevel =>
  gearId === "power_blaster" ? Math.max(0, Math.min(2, Math.floor(zoomLevel))) as HeavyGunZoomLevel : 0;

export const getWeaponFov = (gearId: string, zoomLevel: number, defaultFov = HEAVY_GUN_ZOOM_LEVEL_0_FOV) => {
  const normalizedLevel = normalizeWeaponZoom(gearId, zoomLevel);
  if (gearId === "power_blaster") {
    return [HEAVY_GUN_ZOOM_LEVEL_0_FOV, HEAVY_GUN_ZOOM_LEVEL_1_FOV, HEAVY_GUN_ZOOM_LEVEL_2_FOV][normalizedLevel];
  }
  return zoomLevel > 0 ? defaultFov * getGearZoomFovMultiplier(gearId) : defaultFov;
};

export const shouldResetWeaponZoom = ({
  gearId,
  isAlive,
  roundActive,
  inputPaused
}: {
  gearId: string;
  isAlive: boolean;
  roundActive: boolean;
  inputPaused: boolean;
  pointerLocked: boolean;
}) => gearId !== "power_blaster" || !isAlive || !roundActive || inputPaused;
