import * as THREE from "three";
import { ATHLETICS_ENVIRONMENT_KIT, getEnvironmentKitAssets, type EnvironmentKitAssetDefinition } from "./rendering/environment/EnvironmentKit";
import { hideEnvironmentFallbacks, mountEnvironmentKit } from "./rendering/environment/EnvironmentKitLoader";

/** Compatibility export for map QA and asset-manifest tooling. */
export type AthleticsImportedAssetSpec = EnvironmentKitAssetDefinition;

/**
 * Athletics is assembled from one named environment kit. The map builder owns
 * visual fallbacks; this module only handles the optional authored assets.
 */
export const ATHLETICS_IMPORTED_ASSETS: readonly AthleticsImportedAssetSpec[] = getEnvironmentKitAssets(ATHLETICS_ENVIRONMENT_KIT, 2);

export const hideAthleticsImportedAssetFallback = (
  scene: THREE.Object3D,
  asset: Pick<AthleticsImportedAssetSpec, "fallbackObjectNames">
) => hideEnvironmentFallbacks(scene, asset.fallbackObjectNames);

export const mountAthleticsImportedAssets = async ({
  scene,
  detail,
  isFps,
  signal
}: {
  scene: THREE.Scene;
  detail: number;
  isFps: boolean;
  signal?: AbortSignal;
}) => mountEnvironmentKit({
  scene,
  kit: ATHLETICS_ENVIRONMENT_KIT,
  detail,
  isFps,
  signal
});
