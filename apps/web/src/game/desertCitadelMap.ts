import { ARENA_SCALE } from "@quizstrike/shared";
export type { ArenaMapDefinition, CitadelBlock, CitadelCylinder, CitadelFloorMark, CitadelProp, CitadelSign } from "./mapTypes";
import type { ArenaMapDefinition, CitadelBlock, CitadelCylinder, CitadelFloorMark, CitadelProp, CitadelSign } from "./mapTypes";

const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), w: scaleArenaValue(item.w), d: scaleArenaValue(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), radius: scaleArenaValue(item.radius) }) as T;
const scalePoint = <T extends { x: number; z: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z) }) as T;

export const DESERT_CITADEL: ArenaMapDefinition = {
  title: "Desert Citadel",
  id: "desert_citadel",
  description: "A sun-baked fortress with market lanes, waterworks, and broken ramparts.",
  footprint: { width: scaleArenaValue(350), depth: scaleArenaValue(320) },
  districts: [
    "North Lane • Broken Ramparts",
    "Mid Lane • Waterworks",
    "South Lane • Caravan Quarter",
    "West Gate Court",
    "East Gate Court",
    "Central Cistern"
  ],
  routes: [
    "North Lane • Rampart approach",
    "Mid Lane • Sluice channel",
    "South Lane • Bazaar approach",
    "Service alleys • spawn-to-center rotations",
    "Cistern bridges • cross-lane rotations"
  ],
  palette: {
    sky: "#91c5dd",
    fog: "#d8bd82",
    floor: "#d8b06e",
    floorTexture: "sand",
    accent: "#f2ca73"
  }
};

const stone = "#c79b61";
const darkStone = "#9c7247";
const paleStone = "#dec28a";
const terracotta = "#b96f47";
const wood = "#65462e";
const blue = "#2d84bd";
const red = "#b64a45";
const sand = "#d9b875";
const water = "#21a4b8";

const rawFloorMarks: CitadelFloorMark[] = [
  { id: "route-north", label: "NORTH LANE · RAMPARTS", x: 0, z: -124, w: 82, d: 16, color: "#9acb88" },
  { id: "route-market", label: "MID LANE · WATERWORKS", x: 0, z: -14, w: 92, d: 18, color: "#37aeca" },
  { id: "route-south", label: "SOUTH LANE · BAZAAR", x: 0, z: 112, w: 84, d: 16, color: "#d27b55" },
  { id: "route-aqueduct", label: "CENTRAL SLUICE", x: 0, z: 0, w: 136, d: 12, color: "#33d0dd" },
  { id: "route-rooftop", label: "SERVICE ALLEY", x: 0, z: 66, w: 126, d: 12, color: "#e2b45c" },
  { id: "blue-base", label: "WEST GATE COURT", x: -142, z: 0, w: 46, d: 18, color: "#5db7ff", rotation: Math.PI / 2 },
  { id: "red-base", label: "EAST GATE COURT", x: 142, z: 0, w: 42, d: 18, color: "#ff7777", rotation: -Math.PI / 2 }
];

export const floorMarks: CitadelFloorMark[] = rawFloorMarks.map(scaleRect);

const rawBlocks: CitadelBlock[] = [
  { id: "north-boundary", x: 0, z: -160, w: 350, d: 6, h: 8, color: darkStone, collides: true, style: "wall" },
  { id: "south-boundary", x: 0, z: 160, w: 350, d: 6, h: 8, color: darkStone, collides: true, style: "wall" },
  { id: "west-boundary", x: -175, z: 0, w: 6, d: 320, h: 8, color: darkStone, collides: true, style: "wall" },
  { id: "east-boundary", x: 175, z: 0, w: 6, d: 320, h: 8, color: darkStone, collides: true, style: "wall" },

  { id: "west-fort-north-wall", x: -142, z: -74, w: 66, d: 5, h: 9, color: darkStone, collides: true, style: "wall" },
  { id: "west-fort-south-wall", x: -142, z: 74, w: 66, d: 5, h: 9, color: darkStone, collides: true, style: "wall" },
  { id: "west-fort-inner-north", x: -112, z: -50, w: 5, d: 44, h: 8, color: darkStone, collides: true, style: "wall" },
  { id: "west-fort-inner-south", x: -112, z: 42, w: 5, d: 28, h: 8, color: darkStone, collides: true, style: "wall" },
  { id: "west-fort-back", x: -166, z: 0, w: 5, d: 126, h: 9, color: darkStone, collides: true, style: "wall" },
  { id: "west-barracks", label: "Guard Barracks", x: -150, z: -52, w: 25, d: 18, h: 8, color: stone, collides: true, style: "house" },
  { id: "west-armoury", label: "Armoury Court", x: -149, z: 52, w: 27, d: 18, h: 7, color: paleStone, collides: true, style: "house" },
  { id: "west-watchtower", label: "West Watchtower", x: -118, z: -82, w: 15, d: 15, h: 22, color: darkStone, collides: true, style: "tower" },
  { id: "west-gate-shield", label: "Gatehouse Pier", x: -122, z: -17, w: 9, d: 18, h: 7, color: stone, collides: true, style: "gate" },
  { id: "west-tunnel-mouth", x: -116, z: 66, w: 14, d: 7, h: 4, color: "#6d5b4a" },

  { id: "east-camp-north-wall", x: 142, z: -74, w: 66, d: 5, h: 7, color: darkStone, collides: true, style: "wall" },
  { id: "east-camp-south-wall", x: 142, z: 74, w: 66, d: 5, h: 7, color: darkStone, collides: true, style: "wall" },
  { id: "east-camp-inner-north", x: 112, z: -50, w: 5, d: 44, h: 7, color: darkStone, collides: true, style: "wall" },
  { id: "east-camp-inner-south", x: 112, z: 42, w: 5, d: 28, h: 7, color: darkStone, collides: true, style: "wall" },
  { id: "east-camp-back", x: 166, z: 0, w: 5, d: 126, h: 7, color: darkStone, collides: true, style: "wall" },
  { id: "east-stables", label: "Caravan Stables", x: 149, z: -52, w: 28, d: 17, h: 6, color: paleStone, collides: true, style: "house" },
  { id: "east-storage", label: "Grain Store", x: 149, z: 52, w: 26, d: 18, h: 6, color: stone, collides: true, style: "house" },
  { id: "east-wooden-gate", label: "East Gatehouse", x: 118, z: -8, w: 6, d: 30, h: 11, color: wood, collides: true, material: "wood", style: "gate" },
  { id: "east-carts", label: "Supply Carts", x: 126, z: 35, w: 18, d: 8, h: 3, color: wood, rotationY: 0.22, collides: true, material: "wood", style: "stall" },
  { id: "east-tunnel-mouth", x: 116, z: 66, w: 14, d: 7, h: 4, color: "#6d5b4a" },

  { id: "market-west-shops", label: "Market Arcade", x: -58, z: -32, w: 12, d: 24, h: 7, color: stone, collides: true, style: "house" },
  { id: "market-east-shops", label: "Market Arcade", x: 58, z: -32, w: 12, d: 24, h: 7, color: stone, collides: true, style: "house" },
  { id: "market-north-shops", label: "Covered Bazaar", x: -22, z: -58, w: 44, d: 12, h: 7, color: paleStone, collides: true, style: "house" },
  { id: "market-south-shops", label: "Workshop Arcade", x: 24, z: 28, w: 46, d: 12, h: 7, color: paleStone, collides: true, style: "house" },
  { id: "blue-canopy", label: "Blue Canopy", x: 18, z: -34, w: 24, d: 14, h: 0.5, y: 5.3, color: blue, material: "cloth" },
  { id: "red-awning", x: -26, z: 15, w: 24, d: 12, h: 0.5, y: 4.8, color: red, material: "cloth" },
  { id: "market-stall-a", label: "Spice Stall", x: -32, z: -36, w: 14, d: 6, h: 2.6, color: wood, rotationY: 0.12, collides: true, material: "wood", style: "stall" },
  { id: "market-stall-b", label: "Pottery Stall", x: 34, z: -10, w: 14, d: 6, h: 2.6, color: wood, rotationY: -0.18, collides: true, material: "wood", style: "stall" },
  { id: "market-stall-c", label: "Repair Bench", x: -8, z: 15, w: 13, d: 6, h: 2.6, color: wood, rotationY: 0.32, collides: true, material: "wood", style: "stall" },
  { id: "market-crates-a", label: "Date Crates", x: -45, z: -4, w: 8, d: 8, h: 3.2, color: "#a36b37", collides: true, material: "wood", style: "stall" },
  { id: "market-crates-b", label: "Grain Crates", x: 44, z: 14, w: 8, d: 8, h: 3.2, color: "#a36b37", collides: true, material: "wood", style: "stall" },
  { id: "citadel-base", label: "Central Cistern Tower", x: 0, z: 50, w: 28, d: 24, h: 14, color: darkStone, collides: true, style: "tower" },
  { id: "citadel-spire", x: 0, z: 50, w: 15, d: 15, h: 44, y: 36, color: paleStone },

  { id: "north-ruin-wall-a", label: "Breached Rampart", x: -78, z: -118, w: 46, d: 5, h: 6, color: stone, rotationY: 0.16, collides: true, style: "ruin" },
  { id: "north-ruin-wall-b", label: "Collapsed Barracks", x: -18, z: -138, w: 38, d: 5, h: 5, color: stone, rotationY: -0.18, collides: true, style: "ruin" },
  { id: "north-ruin-wall-c", label: "Outer Wall Breach", x: 48, z: -116, w: 42, d: 5, h: 6, color: stone, rotationY: 0.28, collides: true, style: "ruin" },
  { id: "broken-bridge-left", label: "Rampart Walk", x: 76, z: -138, w: 26, d: 8, h: 4, color: darkStone, rotationY: 0.2, collides: true, style: "bridge" },
  { id: "broken-bridge-right", label: "Broken Rampart Walk", x: 112, z: -126, w: 26, d: 8, h: 4, color: darkStone, rotationY: 0.2, collides: true, style: "bridge" },
  { id: "ruined-watchtower", label: "Ruined Watchtower", x: 98, z: -98, w: 16, d: 16, h: 18, color: darkStone, collides: true, style: "tower" },
  { id: "dry-riverbed", label: "Sandfall Debris Bed", x: 0, z: -122, w: 140, d: 10, h: 0.35, y: 0.03, color: "#bf9259", material: "sand", style: "sandbank" },

  { id: "south-home-a", label: "Weaver House", x: -88, z: 104, w: 22, d: 20, h: 8, color: terracotta, collides: true, style: "house" },
  { id: "south-home-b", label: "Caravanserai Room", x: -54, z: 122, w: 20, d: 18, h: 9, color: stone, collides: true, style: "house" },
  { id: "south-home-c", label: "Potter Workshop", x: -20, z: 96, w: 22, d: 20, h: 8, color: paleStone, collides: true, style: "house" },
  { id: "south-home-d", label: "Dyer House", x: 18, z: 122, w: 20, d: 18, h: 9, color: terracotta, collides: true, style: "house" },
  { id: "south-home-e", label: "Tanner Workshop", x: 54, z: 98, w: 22, d: 20, h: 8, color: stone, collides: true, style: "house" },
  { id: "south-home-f", label: "Caravanserai Room", x: 88, z: 118, w: 22, d: 19, h: 8, color: paleStone, collides: true, style: "house" },
  { id: "south-courtyard-cover-a", label: "Loaded Handcart", x: -36, z: 112, w: 14, d: 6, h: 3, color: wood, collides: true, material: "wood", style: "stall" },
  { id: "south-courtyard-cover-b", label: "Canvas Cart", x: 36, z: 112, w: 14, d: 6, h: 3, color: wood, collides: true, material: "wood", style: "stall" },
  { id: "buried-statue", label: "Buried Wayfinder", x: -112, z: 126, w: 13, d: 24, h: 5, color: "#b88d64", rotationY: -0.5, collides: true, style: "ruin" },

  { id: "aqueduct-north-wall-west", x: -84, z: -10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-north-wall-midwest", x: -30, z: -10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-north-wall-mideast", x: 30, z: -10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-north-wall-east", x: 84, z: -10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-south-wall-west", x: -84, z: 10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-south-wall-midwest", x: -30, z: 10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-south-wall-mideast", x: 30, z: 10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-south-wall-east", x: 84, z: 10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true, style: "channel" },
  { id: "aqueduct-water", label: "Live Water Channel", x: 0, z: 0, w: 112, d: 5, h: 0.25, y: 0.05, color: water, material: "water", style: "channel" },
  { id: "water-chamber-platform", label: "Central Sluice Court", x: 0, z: 0, w: 36, d: 28, h: 0.45, y: 0.06, color: "#2ac6d5", material: "water", style: "bridge" },
  { id: "aqueduct-west-chamber", x: -82, z: 0, w: 22, d: 20, h: 0.4, y: 0.05, color: "#73807a" },
  { id: "aqueduct-east-chamber", x: 82, z: 0, w: 22, d: 20, h: 0.4, y: 0.05, color: "#73807a" },

  { id: "rooftop-west-walk", label: "West Service Arcade", x: -55, z: 66, w: 72, d: 8, h: 4, color: "#b88b56", collides: true, style: "bridge" },
  { id: "rooftop-east-walk", label: "East Service Arcade", x: 55, z: 66, w: 72, d: 8, h: 4, color: "#b88b56", collides: true, style: "bridge" },
  { id: "rooftop-center-gap-cover", label: "Repair Scaffold", x: 0, z: 66, w: 20, d: 8, h: 3, color: wood, collides: true, material: "wood", style: "stall" },

  { id: "north-route-cover-a", label: "Rubble Breastwork", x: -108, z: -82, w: 12, d: 8, h: 4, color: stone, collides: true, style: "ruin" },
  { id: "north-route-cover-b", label: "Shield Wall", x: -44, z: -88, w: 12, d: 8, h: 4, color: stone, collides: true, style: "ruin" },
  { id: "north-route-cover-c", label: "Rubble Breastwork", x: 22, z: -90, w: 12, d: 8, h: 4, color: stone, collides: true, style: "ruin" },
  { id: "north-route-cover-d", label: "Shield Wall", x: 86, z: -78, w: 12, d: 8, h: 4, color: stone, collides: true, style: "ruin" },
  { id: "central-route-cover-a", label: "Sluice Crates", x: -94, z: -14, w: 10, d: 8, h: 4, color: wood, collides: true, material: "wood", style: "stall" },
  { id: "central-route-cover-b", label: "Sluice Crates", x: 94, z: 16, w: 10, d: 8, h: 4, color: wood, collides: true, material: "wood", style: "stall" },
  { id: "south-route-cover-a", label: "Loaded Cart", x: -112, z: 94, w: 12, d: 8, h: 4, color: stone, collides: true, style: "stall" },
  { id: "south-route-cover-b", label: "Loaded Cart", x: 112, z: 94, w: 12, d: 8, h: 4, color: stone, collides: true, style: "stall" }
];

export const blocks: CitadelBlock[] = rawBlocks.map(scaleRect);

const rawProps: CitadelProp[] = [
  // North Lane: military remnants and a readable long-range silhouette.
  { id: "north-arch-west", kind: "arch", x: -92, z: -72, size: 12, h: 9, color: paleStone },
  { id: "north-arch-east", kind: "arch", x: 72, z: -74, size: 12, h: 8, color: stone, rotationY: Math.PI },
  { id: "north-column-a", kind: "column", x: -62, z: -126, size: 4, h: 5, color: paleStone },
  { id: "north-column-b", kind: "column", x: 8, z: -126, size: 4, h: 4, color: paleStone, rotationY: 0.18 },
  { id: "north-debris-a", kind: "debris", x: -54, z: -132, size: 8, h: 2.4, color: darkStone, rotationY: -0.2 },
  { id: "north-debris-b", kind: "debris", x: 62, z: -130, size: 7, h: 2.1, color: stone, rotationY: 0.28 },
  { id: "north-banner", kind: "banner", x: -118, z: -82, size: 5, h: 12, color: "#3f7891", material: "cloth" },
  { id: "north-lamp", kind: "lamp", x: 98, z: -98, size: 2, h: 7, color: "#f7c86b", material: "accent" },

  // Mid Lane: working infrastructure, bridge crossings, and service hardware.
  { id: "sluice-bridge-west", kind: "arch", x: -58, z: 0, size: 10, h: 5, color: "#8b8775", rotationY: Math.PI / 2 },
  { id: "sluice-bridge-center", kind: "arch", x: 0, z: 0, size: 12, h: 5, color: "#9e9277", rotationY: Math.PI / 2 },
  { id: "sluice-bridge-east", kind: "arch", x: 58, z: 0, size: 10, h: 5, color: "#8b8775", rotationY: Math.PI / 2 },
  { id: "sluice-pipe-west", kind: "pipe", x: -70, z: -15, size: 3, h: 12, color: "#5d6d68", rotationY: Math.PI / 2, material: "stone" },
  { id: "sluice-pipe-east", kind: "pipe", x: 70, z: 15, size: 3, h: 12, color: "#5d6d68", rotationY: -Math.PI / 2, material: "stone" },
  { id: "water-lamp-west", kind: "lamp", x: -20, z: -8, size: 1.6, h: 6, color: "#62e2e5", material: "accent" },
  { id: "water-lamp-east", kind: "lamp", x: 20, z: 8, size: 1.6, h: 6, color: "#62e2e5", material: "accent" },
  { id: "cistern-arch", kind: "arch", x: 0, z: 50, size: 16, h: 11, color: paleStone },

  // South Lane: shade, commerce, and civilian-scale props.
  { id: "bazaar-shade-west", kind: "shade", x: -40, z: 82, size: 18, h: 5, color: "#c46d4d", material: "cloth" },
  { id: "bazaar-shade-east", kind: "shade", x: 42, z: 86, size: 18, h: 5, color: "#3f7891", material: "cloth" },
  { id: "south-cart-west", kind: "cart", x: -70, z: 108, size: 8, h: 3, color: wood, material: "wood", rotationY: 0.16 },
  { id: "south-cart-east", kind: "cart", x: 72, z: 112, size: 8, h: 3, color: wood, material: "wood", rotationY: -0.18 },
  { id: "south-crate-stack-a", kind: "crate", x: -4, z: 104, size: 5, h: 4, color: "#9d6335", material: "wood" },
  { id: "south-crate-stack-b", kind: "crate", x: 46, z: 126, size: 5, h: 4, color: "#9d6335", material: "wood" },
  { id: "south-palm-west", kind: "palm", x: -118, z: 116, size: 5, h: 14, color: "#806040", material: "wood" },
  { id: "south-palm-east", kind: "palm", x: 118, z: 104, size: 5, h: 14, color: "#806040", material: "wood" },
  { id: "south-arch-west", kind: "arch", x: -80, z: 94, size: 10, h: 8, color: terracotta },
  { id: "south-arch-east", kind: "arch", x: 80, z: 94, size: 10, h: 8, color: paleStone, rotationY: Math.PI },
  { id: "south-lamp", kind: "lamp", x: 0, z: 112, size: 2, h: 7, color: "#f1a25c", material: "accent" }
];

export const props: CitadelProp[] = rawProps.map((item) => ({
  ...item,
  x: scaleArenaValue(item.x),
  z: scaleArenaValue(item.z),
  size: scaleArenaValue(item.size)
}));

const rawCylinders: CitadelCylinder[] = [
  { id: "old-well", label: "Old Well", x: 0, z: -16, radius: 10, h: 2.2, color: darkStone, collides: true },
  { id: "well-water", x: 0, z: -16, radius: 6, h: 0.18, y: 1.18, color: "#2ba1aa", material: "water" },
  { id: "citadel-round-top", x: 0, z: 50, radius: 9, h: 10, y: 64, color: paleStone },
  { id: "market-pottery-a", x: -30, z: -4, radius: 3, h: 3, color: "#9f5c3a", collides: true },
  { id: "market-pottery-b", x: 34, z: -34, radius: 3, h: 3, color: "#9f5c3a", collides: true },
  { id: "west-tower-cap", x: -118, z: -82, radius: 10, h: 3, y: 23.5, color: paleStone },
  { id: "ruined-tower-cap", x: 98, z: -98, radius: 10, h: 3, y: 19.5, color: paleStone },
  { id: "water-chamber-glow", x: 0, z: 0, radius: 12, h: 0.3, y: 0.25, color: "#35d7e8", material: "water" }
];

export const cylinders: CitadelCylinder[] = rawCylinders.map(scaleCylinder);

const rawSigns: CitadelSign[] = [
  { id: "sign-west", label: "West Gate Court ->", x: -104, z: -28, color: "#7dd3fc", rotationY: Math.PI / 2 },
  { id: "sign-east", label: "<- East Gate Court", x: 104, z: 28, color: "#fb7185", rotationY: -Math.PI / 2 },
  { id: "sign-market", label: "South Lane Bazaar", x: -24, z: 70, color: "#facc15" },
  { id: "sign-north", label: "North Lane Ramparts", x: -6, z: -96, color: "#b8e28d" },
  { id: "sign-south", label: "Caravan Quarter", x: 6, z: 82, color: "#fdba74", rotationY: Math.PI },
  { id: "sign-aqueduct-west", label: "Waterworks", x: -82, z: 18, color: "#67e8f9" },
  { id: "sign-aqueduct-east", label: "Waterworks", x: 82, z: -18, color: "#67e8f9", rotationY: Math.PI },
  { id: "sign-rooftop", label: "Service Arcade", x: 0, z: 78, color: "#fde68a", rotationY: Math.PI }
];

export const signs: CitadelSign[] = rawSigns.map(scalePoint);
