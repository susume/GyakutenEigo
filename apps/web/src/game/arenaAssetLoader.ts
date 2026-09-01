import type * as THREE from "three";
import {
  arenaAssetManager,
  cloneArenaAsset,
  type ArenaAssetDefinition,
  type ArenaAssetPackLoad,
  type ArenaAssetPack
} from "./rendering/assets/ArenaAssetManager";

export type LoadedArenaAsset = THREE.Group;

/** Compatibility facade for existing map mounts. The manager owns caching,
 * Meshopt support, shared-resource lifetimes, and skeleton-safe cloning. */
export const loadArenaAsset = (path: string | ArenaAssetDefinition) => arenaAssetManager.loadAsset(path);
export const releaseArenaAsset = (path: string | ArenaAssetDefinition) => arenaAssetManager.releaseAsset(path);
export const instantiateArenaAsset = cloneArenaAsset;
export const registerArenaAssetPack = (pack: ArenaAssetPack) => arenaAssetManager.registerPack(pack);
export const preloadArenaAssetPack = (packId: string, detail = 2): Promise<ArenaAssetPackLoad> => arenaAssetManager.preloadAssetPack(packId, detail);
export const releaseArenaAssetPack = (packId: string, detail = 2) => arenaAssetManager.releaseAssetPack(packId, detail);
export const unloadUnusedArenaAssets = () => arenaAssetManager.unloadUnusedAssets();
