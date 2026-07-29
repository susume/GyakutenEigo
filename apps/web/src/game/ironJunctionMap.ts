import {
  ARENA_SCALE,
  IRON_JUNCTION_LOADING_LEVEL_Y,
  IRON_JUNCTION_OVERPASS_LEVEL_Y
} from "@quizstrike/shared";
import type {
  ArenaMapDefinition,
  CitadelBlock,
  CitadelCylinder,
  CitadelFloorMark,
  CitadelProp,
  CitadelSign
} from "./mapTypes";

const scale = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), w: scale(item.w), d: scale(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), radius: scale(item.radius) }) as T;
const scalePoint = <T extends { x: number; z: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z) }) as T;
const rampAngle = (rise: number, rawRun: number) => Math.atan(rise / scale(rawRun));

export const IRON_JUNCTION: ArenaMapDefinition = {
  id: "iron_junction",
  title: "The Iron Junction",
  description: "A sprawling autumn railway interchange where a grand yard links a depot, freight warehouse, mountain tunnel, dispatch station, and elevated steel route.",
  footprint: { width: scale(560), depth: scale(500) },
  districts: [
    "Grand Rail Yard",
    "Maintenance Depot",
    "Freight Warehouse",
    "Mountain Service Tunnel",
    "Junction Control Overpass",
    "Dispatch Station Complex"
  ],
  routes: [
    "Central Rail Yard · fastest contested route",
    "Freight Warehouse · protected interior route",
    "Maintenance and Tunnel · lower flank route",
    "Loading Platforms · intermediate rotation",
    "Control Overpass · limited upper route"
  ],
  palette: {
    sky: "#718189",
    fog: "#809096",
    floor: "#4b5352",
    floorTexture: "floor",
    accent: "#c98242"
  }
};

const steel = "#39464b";
const darkSteel = "#253136";
const weatheredSteel = "#53615f";
const rust = "#884a33";
const brick = "#705247";
const concrete = "#737b78";
const gravel = "#4d5452";
const dirtyCream = "#b2aa91";
const timber = "#72503a";
const warning = "#cf873d";
const blueStripe = "#3c7f9f";
const redStripe = "#a94d42";

const loadingDeckCenter = IRON_JUNCTION_LOADING_LEVEL_Y - 0.55;
const overpassDeckCenter = IRON_JUNCTION_OVERPASS_LEVEL_Y - 0.6;

const rawBlocks: CitadelBlock[] = [
  // Mountain gorge and outer retaining structure.
  { id: "iron-north-cliff", label: "North Gorge Retaining Wall", x: 0, z: -246, w: 560, d: 8, h: 24, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "iron-south-cliff", label: "South Mountain Face", x: 0, z: 246, w: 560, d: 8, h: 30, color: darkSteel, material: "stone", style: "wall", collides: true },
  { id: "iron-west-cliff", x: -276, z: 0, w: 8, d: 500, h: 22, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "iron-east-cliff", x: 276, z: 0, w: 8, d: 500, h: 22, color: concrete, material: "stone", style: "wall", collides: true },

  // Blue base: a broad assembly yard with four protected exits.
  { id: "blue-base-inner-north", label: "Blue Assembly North", x: -218, z: -92, w: 8, d: 42, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "blue-base-inner-midnorth", x: -218, z: -55, w: 8, d: 16, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "blue-base-inner-center", x: -218, z: 0, w: 8, d: 38, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "blue-base-inner-midsouth", x: -218, z: 55, w: 8, d: 16, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "blue-base-inner-south", x: -218, z: 92, w: 8, d: 42, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "blue-base-sight-screen-north", x: -198, z: -58, w: 28, d: 7, h: 9, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "blue-base-sight-screen-south", x: -198, z: 58, w: 28, d: 7, h: 9, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "blue-objective-booth", label: "Blue Operations Room", x: -247, z: 0, w: 28, d: 32, h: 10, color: dirtyCream, material: "metal", style: "shed", collides: true },

  // Red base mirrors capacity, but not the approach geometry.
  { id: "red-base-inner-north", label: "Red Assembly North", x: 218, z: -92, w: 8, d: 42, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "red-base-inner-midnorth", x: 218, z: -55, w: 8, d: 16, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "red-base-inner-center", x: 218, z: 0, w: 8, d: 38, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "red-base-inner-midsouth", x: 218, z: 55, w: 8, d: 16, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "red-base-inner-south", x: 218, z: 92, w: 8, d: 42, h: 14, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "red-base-sight-screen-north", x: 198, z: -58, w: 28, d: 7, h: 9, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "red-base-sight-screen-south", x: 198, z: 58, w: 28, d: 7, h: 9, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "red-objective-booth", label: "Red Operations Room", x: 247, z: 0, w: 28, d: 32, h: 10, color: dirtyCream, material: "metal", style: "shed", collides: true },

  // Area C: Freight Warehouse. Architecture, not crate stacks, shapes the interior.
  { id: "warehouse-north-wall", label: "Freight Warehouse", x: -112, z: -190, w: 164, d: 8, h: 20, color: brick, material: "stone", style: "wall", collides: true },
  { id: "warehouse-west-wall", x: -194, z: -130, w: 8, d: 128, h: 20, color: brick, material: "stone", style: "wall", collides: true },
  { id: "warehouse-east-wall-north", x: -30, z: -164, w: 8, d: 44, h: 20, color: brick, material: "stone", style: "wall", collides: true },
  { id: "warehouse-east-wall-south", x: -30, z: -94, w: 8, d: 34, h: 20, color: brick, material: "stone", style: "wall", collides: true },
  { id: "warehouse-south-wall-west", x: -165, z: -66, w: 58, d: 8, h: 15, color: brick, material: "stone", style: "wall", collides: true },
  { id: "warehouse-south-wall-center", x: -92, z: -66, w: 40, d: 8, h: 15, color: brick, material: "stone", style: "wall", collides: true },
  { id: "warehouse-south-wall-east", x: -45, z: -66, w: 22, d: 8, h: 15, color: brick, material: "stone", style: "wall", collides: true },
  { id: "warehouse-office", label: "Warehouse Office", x: -158, z: -157, w: 34, d: 26, h: 9, color: dirtyCream, material: "metal", style: "shed", collides: true },
  { id: "warehouse-conveyor", label: "Sorting Conveyor", x: -87, z: -132, w: 52, d: 9, h: 4, color: weatheredSteel, material: "metal", style: "machinery", collides: true },
  { id: "warehouse-pillar-a", x: -126, z: -98, w: 4, d: 4, h: 18, color: darkSteel, material: "metal", style: "tower", collides: true },
  { id: "warehouse-pillar-b", x: -72, z: -98, w: 4, d: 4, h: 18, color: darkSteel, material: "metal", style: "tower", collides: true },
  // The south roof opening gives the upper ramp full player-height clearance.
  { id: "warehouse-roof-west", x: -154.5, z: -130, w: 75, d: 120, h: 1, y: 20, color: weatheredSteel, material: "metal", style: "bridge" },
  { id: "warehouse-roof-east", x: -62.5, z: -130, w: 61, d: 120, h: 1, y: 20, color: weatheredSteel, material: "metal", style: "bridge" },
  { id: "warehouse-roof-north-link", x: -105, z: -154, w: 24, d: 72, h: 1, y: 20, color: weatheredSteel, material: "metal", style: "bridge" },
  { id: "warehouse-mezzanine", label: "WAREHOUSE MEZZANINE", x: -130, z: -147, w: 120, d: 64, h: 1.1, y: loadingDeckCenter, color: steel, material: "metal", style: "bridge" },
  { id: "warehouse-loading-dock", label: "FREIGHT LOADING PLATFORM", x: -108, z: -57, w: 144, d: 18, h: 1.1, y: loadingDeckCenter, color: concrete, material: "stone", style: "bridge" },
  { id: "warehouse-loading-ramp", x: -199, z: -57, w: 38, d: 18, h: 1, y: 4, rotationZ: -rampAngle(IRON_JUNCTION_LOADING_LEVEL_Y, 38), color: steel, material: "metal", style: "bridge" },
  { id: "warehouse-loading-east-ramp", x: -17, z: -57, w: 38, d: 18, h: 1, y: 4, rotationZ: rampAngle(IRON_JUNCTION_LOADING_LEVEL_Y, 38), color: steel, material: "metal", style: "bridge" },

  // Area F: Dispatch station and its landmark control tower.
  { id: "dispatch-north-wall", label: "Old Dispatch Station", x: 135, z: -188, w: 142, d: 8, h: 16, color: brick, material: "stone", style: "wall", collides: true },
  { id: "dispatch-east-wall", x: 206, z: -139, w: 8, d: 106, h: 16, color: brick, material: "stone", style: "wall", collides: true },
  { id: "dispatch-west-wall-north", x: 64, z: -164, w: 8, d: 42, h: 16, color: brick, material: "stone", style: "wall", collides: true },
  { id: "dispatch-west-wall-south", x: 64, z: -103, w: 8, d: 34, h: 16, color: brick, material: "stone", style: "wall", collides: true },
  { id: "dispatch-south-wall-west", x: 91, z: -86, w: 46, d: 8, h: 13, color: brick, material: "stone", style: "wall", collides: true },
  { id: "dispatch-south-wall-east", x: 178, z: -86, w: 48, d: 8, h: 13, color: brick, material: "stone", style: "wall", collides: true },
  { id: "dispatch-operations-room", label: "Dispatch Operations", x: 161, z: -149, w: 54, d: 38, h: 10, color: dirtyCream, material: "metal", style: "shed", collides: true },
  { id: "dispatch-platform", label: "DISPATCH PLATFORM", x: 132, z: -70, w: 116, d: 24, h: 1.1, y: loadingDeckCenter, color: concrete, material: "stone", style: "bridge" },
  { id: "dispatch-platform-ramp", x: 205, z: -70, w: 30, d: 24, h: 1, y: 4, rotationZ: rampAngle(IRON_JUNCTION_LOADING_LEVEL_Y, 30), color: steel, material: "metal", style: "bridge" },
  { id: "dispatch-platform-west-ramp", x: 59, z: -70, w: 30, d: 24, h: 1, y: 4, rotationZ: -rampAngle(IRON_JUNCTION_LOADING_LEVEL_Y, 30), color: steel, material: "metal", style: "bridge" },
  { id: "junction-control-lower", label: "Junction Control Tower", x: 58, z: -38, w: 34, d: 32, h: 9, color: concrete, material: "stone", style: "tower", collides: true },
  { id: "junction-control-upper", label: "JUNCTION CONTROL", x: 58, z: -38, w: 30, d: 28, h: 8, y: 14, color: dirtyCream, material: "metal", style: "tower", collides: true },

  // Area A: four wide rail corridors with four landmark trains.
  { id: "yard-track-bed-a", x: 0, z: -42, w: 390, d: 10, h: 0.3, y: 0.03, color: gravel, material: "gravel" },
  { id: "yard-track-bed-b", x: 0, z: 0, w: 390, d: 10, h: 0.3, y: 0.03, color: gravel, material: "gravel" },
  { id: "yard-track-bed-c", x: 0, z: 42, w: 390, d: 10, h: 0.3, y: 0.03, color: gravel, material: "gravel" },
  { id: "yard-track-bed-d", x: 0, z: 82, w: 390, d: 10, h: 0.3, y: 0.03, color: gravel, material: "gravel" },
  { id: "freight-train-west", label: "West Boxcar", x: -100, z: -42, w: 58, d: 13, h: 8, color: rust, material: "metal", style: "railcar", collides: true },
  { id: "junction-locomotive", label: "Iron Junction Locomotive", x: -8, z: 0, w: 70, d: 15, h: 10, color: darkSteel, material: "metal", style: "railcar", collides: true },
  { id: "freight-train-east", label: "Cream Freight Wagon", x: 105, z: 42, w: 60, d: 13, h: 8, color: dirtyCream, material: "metal", style: "railcar", collides: true },
  { id: "damaged-railcar", label: "Damaged Brake Van", x: -48, z: 82, w: 42, d: 13, h: 7, color: rust, material: "metal", style: "railcar", collides: true },
  { id: "yard-cover-signal-box", label: "Signal Relay Box", x: 112, z: -17, w: 20, d: 18, h: 7, color: weatheredSteel, material: "metal", style: "shed", collides: true },
  { id: "yard-platform-west", label: "West Transfer Platform", x: -155, z: 20, w: 54, d: 17, h: 2, color: concrete, material: "stone", style: "bridge", collides: true },
  { id: "yard-platform-east", label: "East Transfer Platform", x: 157, z: 66, w: 48, d: 17, h: 2, color: concrete, material: "stone", style: "bridge", collides: true },

  // Area B: Maintenance depot with repair pits and broad equipment bays.
  { id: "depot-east-wall", label: "Maintenance Depot", x: 190, z: 151, w: 8, d: 116, h: 18, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-north-wall-west", x: 37, z: 96, w: 58, d: 8, h: 17, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-north-wall-center", x: 106, z: 96, w: 38, d: 8, h: 17, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-north-wall-east", x: 169, z: 96, w: 34, d: 8, h: 17, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-south-wall-west", x: 40, z: 205, w: 64, d: 8, h: 17, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-south-wall-east", x: 157, z: 205, w: 66, d: 8, h: 17, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-west-wall-north", x: 4, z: 120, w: 8, d: 42, h: 17, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-west-wall-south", x: 4, z: 181, w: 8, d: 40, h: 17, color: weatheredSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-side-office", label: "Depot Tool Office", x: 157, z: 174, w: 42, d: 35, h: 9, color: dirtyCream, material: "metal", style: "shed", collides: true },
  { id: "depot-machinery-bay", label: "Wheel Lathe", x: 48, z: 164, w: 31, d: 19, h: 6, color: warning, material: "metal", style: "machinery", collides: true },
  { id: "depot-repair-pit", label: "Maintenance Pit", x: 105, z: 151, w: 70, d: 8, h: 0.35, y: 0.02, color: darkSteel, material: "metal" },
  { id: "depot-walkway", label: "DEPOT WALKWAY", x: 94, z: 106, w: 142, d: 20, h: 1.1, y: loadingDeckCenter, color: steel, material: "metal", style: "bridge" },
  { id: "depot-walkway-ramp", x: 177, z: 106, w: 28, d: 20, h: 1, y: 4, rotationZ: rampAngle(IRON_JUNCTION_LOADING_LEVEL_Y, 28), color: steel, material: "metal", style: "bridge" },
  { id: "depot-roof", x: 98, z: 151, w: 180, d: 105, h: 1, y: 19, color: darkSteel, material: "metal", style: "bridge" },

  // Area D: a broad, broken-sightline mountain tunnel with multiple exits.
  { id: "tunnel-south-wall-west", label: "Mountain Service Tunnel", x: -145, z: 234, w: 142, d: 8, h: 15, color: darkSteel, material: "stone", style: "wall", collides: true },
  { id: "tunnel-south-wall-east", x: 18, z: 238, w: 164, d: 8, h: 15, color: darkSteel, material: "stone", style: "wall", collides: true },
  { id: "tunnel-north-wall-a", x: -177, z: 194, w: 70, d: 8, h: 13, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "tunnel-north-wall-b", x: -78, z: 198, w: 52, d: 8, h: 13, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "tunnel-north-wall-c", x: 16, z: 202, w: 70, d: 8, h: 13, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "tunnel-north-wall-d", x: 110, z: 206, w: 52, d: 8, h: 13, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "tunnel-sight-break-west", x: -104, z: 216, w: 12, d: 16, h: 8, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "tunnel-sight-break-east", x: 54, z: 220, w: 12, d: 16, h: 8, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "tunnel-roof-west", x: -115, z: 214, w: 210, d: 42, h: 1.2, y: 14, color: darkSteel, material: "stone", style: "bridge" },
  { id: "tunnel-roof-east", x: 75, z: 220, w: 170, d: 38, h: 1.2, y: 14, color: darkSteel, material: "stone", style: "bridge" },
  { id: "tunnel-drain", x: -15, z: 224, w: 260, d: 3, h: 0.18, y: 0.02, color: darkSteel, material: "metal" },

  // Area E: intentional upper route. It links landmarks but cannot see the whole district.
  { id: "junction-overpass", label: "JUNCTION OVERPASS", x: 10, z: 25, w: 230, d: 20, h: 1.2, y: overpassDeckCenter, color: steel, material: "metal", style: "bridge" },
  { id: "junction-mid-transfer", label: "MID TRANSFER DECK", x: 10, z: 25, w: 60, d: 20, h: 1.1, y: loadingDeckCenter, color: concrete, material: "stone", style: "bridge" },
  { id: "junction-mid-transfer-ramp", x: -35, z: 25, w: 30, d: 20, h: 1, y: 4, rotationZ: -rampAngle(IRON_JUNCTION_LOADING_LEVEL_Y, 30), color: steel, material: "metal", style: "bridge" },
  { id: "signal-gantry-deck", label: "SIGNAL GANTRY", x: 0, z: -14, w: 142, d: 14, h: 1.2, y: overpassDeckCenter, color: warning, material: "metal", style: "bridge" },
  { id: "warehouse-upper-link", label: "Warehouse Upper Link", x: -105, z: -35.5, w: 20, d: 101, h: 1.2, y: overpassDeckCenter, color: steel, material: "metal", style: "bridge" },
  { id: "dispatch-upper-link", label: "Dispatch Upper Link", x: 119, z: -22, w: 20, d: 80, h: 1.2, y: overpassDeckCenter, color: steel, material: "metal", style: "bridge" },
  { id: "warehouse-upper-ramp", x: -105, z: -101, w: 20, d: 30, h: 1, y: 13, rotationX: -rampAngle(IRON_JUNCTION_OVERPASS_LEVEL_Y - IRON_JUNCTION_LOADING_LEVEL_Y, 30), color: steel, material: "metal", style: "bridge" },
  { id: "overpass-east-ramp", x: 150, z: 25, w: 50, d: 20, h: 1, y: 9, rotationZ: rampAngle(IRON_JUNCTION_OVERPASS_LEVEL_Y, 50), color: steel, material: "metal", style: "bridge" },
  { id: "overpass-depot-ramp", x: 80, z: 65, w: 20, d: 60, h: 1, y: 13, rotationX: rampAngle(IRON_JUNCTION_OVERPASS_LEVEL_Y - IRON_JUNCTION_LOADING_LEVEL_Y, 60), color: steel, material: "metal", style: "bridge" },
  { id: "overpass-support-west", x: -78, z: 25, w: 6, d: 6, h: 18, y: 9, color: rust, material: "metal", style: "gantry", collides: true },
  { id: "overpass-support-center", x: 18, z: 25, w: 6, d: 6, h: 18, y: 9, color: rust, material: "metal", style: "gantry", collides: true },
  { id: "overpass-support-east", x: 92, z: 25, w: 6, d: 6, h: 18, y: 9, color: rust, material: "metal", style: "gantry", collides: true },
  { id: "gantry-sight-screen", x: -6, z: 25, w: 36, d: 5, h: 7, y: 21, color: weatheredSteel, material: "metal", style: "wall", collides: true }
  // Guardrails stop short of the three authored connectors instead of sealing them.
  ,{ id: "overpass-north-rail-west", x: -72, z: 15, w: 44, d: 1.2, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "overpass-north-rail-center", x: 5, z: 15, w: 70, d: 1.2, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "overpass-north-rail-east", x: 83.5, z: 15, w: 47, d: 1.2, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "overpass-south-rail-west", x: -77.5, z: 35, w: 55, d: 1.2, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "overpass-south-rail-center", x: 5, z: 35, w: 70, d: 1.2, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "overpass-south-rail-depot-west", x: 64, z: 35, w: 8, d: 1.2, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "overpass-south-rail-depot-east", x: 108.5, z: 35, w: 33, d: 1.2, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "warehouse-link-west-rail", x: -115, z: -35.5, w: 1.2, d: 101, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "warehouse-link-east-rail", x: -95, z: -35.5, w: 1.2, d: 101, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "dispatch-link-west-rail", x: 109, z: -22, w: 1.2, d: 80, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
  ,{ id: "dispatch-link-east-rail", x: 129, z: -22, w: 1.2, d: 80, h: 2.5, y: 19.25, color: steel, material: "metal", collides: true }
];

export const blocks: CitadelBlock[] = rawBlocks.map(({ label: _label, ...block }) => scaleRect(block));

const rawCylinders: CitadelCylinder[] = [
  { id: "yard-signal-base-west", label: "Signal Mast", x: -150, z: -18, radius: 2.5, h: 10, color: rust, material: "metal", collides: true },
  { id: "yard-signal-base-east", label: "Signal Mast", x: 150, z: 18, radius: 2.5, h: 10, color: rust, material: "metal", collides: true },
  { id: "depot-hydraulic-lift", label: "Hydraulic Lift", x: 94, z: 172, radius: 3, h: 7, color: warning, material: "metal", collides: true },
  { id: "dispatch-clock-column", label: "Broken Station Clock", x: 105, z: -130, radius: 2.5, h: 11, color: dirtyCream, material: "metal", collides: true }
];
export const cylinders: CitadelCylinder[] = rawCylinders.map(({ label: _label, ...cylinder }) => scaleCylinder(cylinder));

// Architecture, rail colors, team banners, and landmarks carry navigation.
// Printed route directions were visually noisy in both overview and FPS views.
export const floorMarks: CitadelFloorMark[] = [];

const rawProps: CitadelProp[] = [
  { id: "blue-route-banner", kind: "banner", x: -210, z: -28, size: 4, h: 10, color: blueStripe, material: "cloth" },
  { id: "red-route-banner", kind: "banner", x: 210, z: 28, size: 4, h: 10, color: redStripe, material: "cloth" },
  { id: "yard-signal-west", kind: "signal", x: -150, z: -18, size: 2, h: 10, color: "#d85b45", material: "metal" },
  { id: "yard-signal-east", kind: "signal", x: 150, z: 18, size: 2, h: 10, color: "#62b29e", material: "metal" },
  { id: "warehouse-lamp", kind: "lamp", x: -52, z: -80, size: 2, h: 8, color: "#ffd08a", material: "accent" },
  { id: "dispatch-lamp", kind: "lamp", x: 78, z: -99, size: 2, h: 8, color: "#ffd08a", material: "accent" },
  { id: "depot-lamp", kind: "lamp", x: 22, z: 116, size: 2, h: 8, color: "#ffb866", material: "accent" },
  { id: "tunnel-emergency-west", kind: "lamp", x: -145, z: 218, size: 1.6, h: 6, color: "#e36a4f", material: "accent" },
  { id: "tunnel-emergency-east", kind: "lamp", x: 22, z: 221, size: 1.6, h: 6, color: "#e36a4f", material: "accent" },
  { id: "control-warning-lamp", kind: "lamp", x: 58, z: -38, size: 1.8, h: 7, y: IRON_JUNCTION_OVERPASS_LEVEL_Y, color: "#ffbd59", material: "accent" },
  { id: "autumn-tree-nw", kind: "tree", x: -236, z: -205, size: 8, h: 20, color: "#7e4b32", material: "wood" },
  { id: "autumn-tree-ne", kind: "tree", x: 235, z: -205, size: 8, h: 19, color: "#995333", material: "wood" },
  { id: "autumn-tree-sw", kind: "tree", x: -235, z: 184, size: 8, h: 20, color: "#a15d33", material: "wood" },
  { id: "autumn-tree-se", kind: "tree", x: 235, z: 195, size: 8, h: 18, color: "#875239", material: "wood" },
  { id: "sparse-container-warehouse", kind: "crate", x: -54, z: -160, size: 6, h: 6, color: weatheredSteel, material: "metal" },
  { id: "maintenance-tarp", kind: "shade", x: 144, z: 128, size: 10, h: 6, color: "#5e6756", material: "cloth" }
];
export const props = rawProps.map(scalePoint);

export const signs: CitadelSign[] = [];
