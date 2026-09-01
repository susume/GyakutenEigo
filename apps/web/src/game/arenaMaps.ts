import type { ArenaMapId } from "@quizstrike/shared";
import { DESERT_CITADEL, blocks as desertBlocks, cylinders as desertCylinders, floorMarks as desertFloorMarks, props as desertProps, signs as desertSigns } from "./desertCitadelMap";
import { IRON_JUNCTION, blocks as ironBlocks, cylinders as ironCylinders, floorMarks as ironFloorMarks, props as ironProps, signs as ironSigns } from "./ironJunctionMap";
import { TEMPLE_RUNOFF, blocks as templeBlocks, cylinders as templeCylinders, floorMarks as templeFloorMarks, props as templeProps, signs as templeSigns } from "./templeRunoffMap";
import type { ArenaMapDefinition, CitadelBlock, CitadelCylinder, CitadelFloorMark, CitadelProp, CitadelSign } from "./mapTypes";

export type ArenaMapData = ArenaMapDefinition & {
  blocks: CitadelBlock[];
  cylinders: CitadelCylinder[];
  floorMarks: CitadelFloorMark[];
  props: CitadelProp[];
  signs: CitadelSign[];
};

export const ARENA_MAPS: ArenaMapData[] = [
  {
    id: "athletics_park",
    title: "Skyline Adventure Park",
    description: "A vertical parkour course built for Athletics.",
    environmentKitId: "athletics-skyline-park",
    districts: ["Start plaza", "Skyline summit"],
    routes: ["Stadium loop"],
    footprint: { width: 280, depth: 280 },
    palette: {
      sky: "#9edcff",
      fog: "#d8f3ff",
      floor: "#83c995",
      floorTexture: "floor",
      accent: "#40d9ff"
    },
    blocks: [],
    cylinders: [],
    floorMarks: [],
    props: [],
    signs: []
  },
  { ...DESERT_CITADEL, blocks: desertBlocks, cylinders: desertCylinders, floorMarks: desertFloorMarks, props: desertProps, signs: desertSigns },
  { ...IRON_JUNCTION, blocks: ironBlocks, cylinders: ironCylinders, floorMarks: ironFloorMarks, props: ironProps, signs: ironSigns },
  { ...TEMPLE_RUNOFF, blocks: templeBlocks, cylinders: templeCylinders, floorMarks: templeFloorMarks, props: templeProps, signs: templeSigns }
];

export const getArenaMap = (mapId: ArenaMapId | string | undefined): ArenaMapData =>
  ARENA_MAPS.find((map) => map.id === mapId) ?? ARENA_MAPS.find((map) => map.id === "desert_citadel")!;

export const getArenaMapLabel = (mapId: ArenaMapId | string | undefined) => getArenaMap(mapId).title;
