import type { ArenaMapId } from "@quizstrike/shared";
import { DESERT_CITADEL, blocks as desertBlocks, cylinders as desertCylinders, floorMarks as desertFloorMarks, props as desertProps, signs as desertSigns } from "./desertCitadelMap";
import { IRON_JUNCTION, blocks as ironBlocks, cylinders as ironCylinders, floorMarks as ironFloorMarks, props as ironProps, signs as ironSigns } from "./ironJunctionMap";
import type { ArenaMapDefinition, CitadelBlock, CitadelCylinder, CitadelFloorMark, CitadelProp, CitadelSign } from "./mapTypes";

export type ArenaMapData = ArenaMapDefinition & {
  blocks: CitadelBlock[];
  cylinders: CitadelCylinder[];
  floorMarks: CitadelFloorMark[];
  props: CitadelProp[];
  signs: CitadelSign[];
};

export const ARENA_MAPS: ArenaMapData[] = [
  { ...DESERT_CITADEL, blocks: desertBlocks, cylinders: desertCylinders, floorMarks: desertFloorMarks, props: desertProps, signs: desertSigns },
  { ...IRON_JUNCTION, blocks: ironBlocks, cylinders: ironCylinders, floorMarks: ironFloorMarks, props: ironProps, signs: ironSigns }
];

export const getArenaMap = (mapId: ArenaMapId | string | undefined): ArenaMapData =>
  ARENA_MAPS.find((map) => map.id === mapId) ?? ARENA_MAPS[0];

export const getArenaMapLabel = (mapId: ArenaMapId | string | undefined) => getArenaMap(mapId).title;
