import type { ArenaMapId } from "@quizstrike/shared";

/** Lightweight map metadata for setup screens. Geometry stays in the arena chunk. */
export type ArenaMapCatalogItem = {
  id: ArenaMapId;
  title: string;
  districts: readonly string[];
};

export const ARENA_MAPS: readonly ArenaMapCatalogItem[] = [
  {
    id: "desert_citadel",
    title: "Desert Citadel",
    districts: ["West Assembly Bastion — Blue spawn", "East Assembly Bastion — Red spawn"]
  },
  {
    id: "iron_junction",
    title: "The Iron Junction",
    districts: ["Grand Rail Yard", "Maintenance Depot"]
  },
  {
    id: "temple_runoff",
    title: "Temple Runoff",
    districts: ["Blue Temple Complex · western team staging", "Flooded Ceremonial Canal · continuous lower lane"]
  }
];

export const getArenaMap = (mapId: ArenaMapId | string | undefined): ArenaMapCatalogItem =>
  ARENA_MAPS.find((map) => map.id === mapId) ?? ARENA_MAPS[0];
