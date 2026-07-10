import { ARENA_SCALE } from "@quizstrike/shared";

export type CitadelBlock = {
  id: string;
  label?: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  y?: number;
  rotationY?: number;
  collides?: boolean;
  material?: "stone" | "wood" | "cloth" | "sand" | "water" | "accent";
};

export type CitadelCylinder = {
  id: string;
  label?: string;
  x: number;
  z: number;
  radius: number;
  h: number;
  color: string;
  y?: number;
  collides?: boolean;
  material?: "stone" | "wood" | "water" | "accent";
};

export type CitadelSign = {
  id: string;
  label: string;
  x: number;
  z: number;
  color: string;
  rotationY?: number;
  y?: number;
};

export type CitadelFloorMark = {
  id: string;
  label: string;
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
  rotation?: number;
};

const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), w: scaleArenaValue(item.w), d: scaleArenaValue(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), radius: scaleArenaValue(item.radius) }) as T;
const scalePoint = <T extends { x: number; z: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z) }) as T;

export const DESERT_CITADEL = {
  title: "Desert Citadel",
  footprint: { width: scaleArenaValue(350), depth: scaleArenaValue(320) },
  districts: [
    "West Fortress",
    "East Camp",
    "Central Market",
    "North Ruins",
    "South Homes",
    "Aqueduct"
  ],
  routes: [
    "Northern ruins route",
    "Central market route",
    "Southern residential route",
    "Underground aqueduct route",
    "Elevated rooftop and wall route"
  ]
} as const;

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
  { id: "route-north", label: "NORTH RUINS", x: 0, z: -124, w: 74, d: 16, color: "#8fbe72" },
  { id: "route-market", label: "CENTRAL MARKET", x: 0, z: -14, w: 82, d: 18, color: "#2d84bd" },
  { id: "route-south", label: "SOUTH HOMES", x: 0, z: 112, w: 76, d: 16, color: "#c66a4b" },
  { id: "route-aqueduct", label: "AQUEDUCT", x: 0, z: 0, w: 128, d: 12, color: "#25c7d9" },
  { id: "route-rooftop", label: "ROOFTOP WALK", x: 0, z: 66, w: 126, d: 12, color: "#f1c45c" },
  { id: "blue-base", label: "WEST FORTRESS", x: -142, z: 0, w: 46, d: 18, color: "#5db7ff", rotation: Math.PI / 2 },
  { id: "red-base", label: "EAST CAMP", x: 142, z: 0, w: 42, d: 18, color: "#ff7777", rotation: -Math.PI / 2 }
];

export const floorMarks: CitadelFloorMark[] = rawFloorMarks.map(scaleRect);

const rawBlocks: CitadelBlock[] = [
  { id: "north-boundary", x: 0, z: -160, w: 350, d: 6, h: 8, color: darkStone, collides: true },
  { id: "south-boundary", x: 0, z: 160, w: 350, d: 6, h: 8, color: darkStone, collides: true },
  { id: "west-boundary", x: -175, z: 0, w: 6, d: 320, h: 8, color: darkStone, collides: true },
  { id: "east-boundary", x: 175, z: 0, w: 6, d: 320, h: 8, color: darkStone, collides: true },

  { id: "west-fort-north-wall", x: -142, z: -74, w: 66, d: 5, h: 9, color: darkStone, collides: true },
  { id: "west-fort-south-wall", x: -142, z: 74, w: 66, d: 5, h: 9, color: darkStone, collides: true },
  { id: "west-fort-inner-north", x: -112, z: -50, w: 5, d: 44, h: 8, color: darkStone, collides: true },
  { id: "west-fort-inner-south", x: -112, z: 42, w: 5, d: 28, h: 8, color: darkStone, collides: true },
  { id: "west-fort-back", x: -166, z: 0, w: 5, d: 126, h: 9, color: darkStone, collides: true },
  { id: "west-barracks", label: "Barracks", x: -150, z: -52, w: 25, d: 18, h: 8, color: stone, collides: true },
  { id: "west-armoury", label: "Armoury", x: -149, z: 52, w: 27, d: 18, h: 7, color: paleStone, collides: true },
  { id: "west-watchtower", label: "Western Watchtower", x: -118, z: -82, w: 15, d: 15, h: 22, color: darkStone, collides: true },
  { id: "west-gate-shield", x: -122, z: -17, w: 9, d: 18, h: 7, color: stone, collides: true },
  { id: "west-tunnel-mouth", x: -116, z: 66, w: 14, d: 7, h: 4, color: "#6d5b4a" },

  { id: "east-camp-north-wall", x: 142, z: -74, w: 66, d: 5, h: 7, color: darkStone, collides: true },
  { id: "east-camp-south-wall", x: 142, z: 74, w: 66, d: 5, h: 7, color: darkStone, collides: true },
  { id: "east-camp-inner-north", x: 112, z: -50, w: 5, d: 44, h: 7, color: darkStone, collides: true },
  { id: "east-camp-inner-south", x: 112, z: 42, w: 5, d: 28, h: 7, color: darkStone, collides: true },
  { id: "east-camp-back", x: 166, z: 0, w: 5, d: 126, h: 7, color: darkStone, collides: true },
  { id: "east-stables", label: "Stables", x: 149, z: -52, w: 28, d: 17, h: 6, color: paleStone, collides: true },
  { id: "east-storage", label: "Storage", x: 149, z: 52, w: 26, d: 18, h: 6, color: stone, collides: true },
  { id: "east-wooden-gate", label: "Eastern Wooden Gate", x: 118, z: -8, w: 6, d: 30, h: 11, color: wood, collides: true, material: "wood" },
  { id: "east-carts", x: 126, z: 35, w: 18, d: 8, h: 3, color: wood, rotationY: 0.22, collides: true, material: "wood" },
  { id: "east-tunnel-mouth", x: 116, z: 66, w: 14, d: 7, h: 4, color: "#6d5b4a" },

  { id: "market-west-shops", x: -58, z: -32, w: 12, d: 24, h: 7, color: stone, collides: true },
  { id: "market-east-shops", x: 58, z: -32, w: 12, d: 24, h: 7, color: stone, collides: true },
  { id: "market-north-shops", x: -22, z: -58, w: 44, d: 12, h: 7, color: paleStone, collides: true },
  { id: "market-south-shops", x: 24, z: 28, w: 46, d: 12, h: 7, color: paleStone, collides: true },
  { id: "blue-canopy", label: "Blue Canopy", x: 18, z: -34, w: 24, d: 14, h: 0.5, y: 5.3, color: blue, material: "cloth" },
  { id: "red-awning", x: -26, z: 15, w: 24, d: 12, h: 0.5, y: 4.8, color: red, material: "cloth" },
  { id: "market-stall-a", x: -32, z: -36, w: 14, d: 6, h: 2.6, color: wood, rotationY: 0.12, collides: true, material: "wood" },
  { id: "market-stall-b", x: 34, z: -10, w: 14, d: 6, h: 2.6, color: wood, rotationY: -0.18, collides: true, material: "wood" },
  { id: "market-stall-c", x: -8, z: 15, w: 13, d: 6, h: 2.6, color: wood, rotationY: 0.32, collides: true, material: "wood" },
  { id: "market-crates-a", x: -45, z: -4, w: 8, d: 8, h: 3.2, color: "#a36b37", collides: true, material: "wood" },
  { id: "market-crates-b", x: 44, z: 14, w: 8, d: 8, h: 3.2, color: "#a36b37", collides: true, material: "wood" },
  { id: "citadel-base", label: "Citadel Tower", x: 0, z: 50, w: 28, d: 24, h: 14, color: darkStone, collides: true },
  { id: "citadel-spire", x: 0, z: 50, w: 15, d: 15, h: 44, y: 36, color: paleStone },

  { id: "north-ruin-wall-a", x: -78, z: -118, w: 46, d: 5, h: 6, color: stone, rotationY: 0.16, collides: true },
  { id: "north-ruin-wall-b", x: -18, z: -138, w: 38, d: 5, h: 5, color: stone, rotationY: -0.18, collides: true },
  { id: "north-ruin-wall-c", x: 48, z: -116, w: 42, d: 5, h: 6, color: stone, rotationY: 0.28, collides: true },
  { id: "broken-bridge-left", label: "Broken Bridge", x: 76, z: -138, w: 26, d: 8, h: 4, color: darkStone, rotationY: 0.2, collides: true },
  { id: "broken-bridge-right", x: 112, z: -126, w: 26, d: 8, h: 4, color: darkStone, rotationY: 0.2, collides: true },
  { id: "ruined-watchtower", label: "Ruined Watchtower", x: 98, z: -98, w: 16, d: 16, h: 18, color: darkStone, collides: true },
  { id: "dry-riverbed", x: 0, z: -122, w: 140, d: 10, h: 0.35, y: 0.03, color: "#bf9259", material: "sand" },

  { id: "south-home-a", x: -88, z: 104, w: 22, d: 20, h: 8, color: terracotta, collides: true },
  { id: "south-home-b", x: -54, z: 122, w: 20, d: 18, h: 9, color: stone, collides: true },
  { id: "south-home-c", x: -20, z: 96, w: 22, d: 20, h: 8, color: paleStone, collides: true },
  { id: "south-home-d", x: 18, z: 122, w: 20, d: 18, h: 9, color: terracotta, collides: true },
  { id: "south-home-e", x: 54, z: 98, w: 22, d: 20, h: 8, color: stone, collides: true },
  { id: "south-home-f", x: 88, z: 118, w: 22, d: 19, h: 8, color: paleStone, collides: true },
  { id: "south-courtyard-cover-a", x: -36, z: 112, w: 14, d: 6, h: 3, color: wood, collides: true, material: "wood" },
  { id: "south-courtyard-cover-b", x: 36, z: 112, w: 14, d: 6, h: 3, color: wood, collides: true, material: "wood" },
  { id: "buried-statue", label: "Buried Statue", x: -112, z: 126, w: 13, d: 24, h: 5, color: "#b88d64", rotationY: -0.5, collides: true },

  { id: "aqueduct-north-wall-west", x: -84, z: -10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-north-wall-midwest", x: -30, z: -10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-north-wall-mideast", x: 30, z: -10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-north-wall-east", x: 84, z: -10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-south-wall-west", x: -84, z: 10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-south-wall-midwest", x: -30, z: 10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-south-wall-mideast", x: 30, z: 10, w: 28, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-south-wall-east", x: 84, z: 10, w: 42, d: 4, h: 5, color: "#6b675e", collides: true },
  { id: "aqueduct-water", x: 0, z: 0, w: 112, d: 5, h: 0.25, y: 0.05, color: water, material: "water" },
  { id: "water-chamber-platform", label: "Glowing Water Chamber", x: 0, z: 0, w: 36, d: 28, h: 0.45, y: 0.06, color: "#2ac6d5", material: "water" },
  { id: "aqueduct-west-chamber", x: -82, z: 0, w: 22, d: 20, h: 0.4, y: 0.05, color: "#73807a" },
  { id: "aqueduct-east-chamber", x: 82, z: 0, w: 22, d: 20, h: 0.4, y: 0.05, color: "#73807a" },

  { id: "rooftop-west-walk", x: -55, z: 66, w: 72, d: 8, h: 4, color: "#b88b56", collides: true },
  { id: "rooftop-east-walk", x: 55, z: 66, w: 72, d: 8, h: 4, color: "#b88b56", collides: true },
  { id: "rooftop-center-gap-cover", x: 0, z: 66, w: 20, d: 8, h: 3, color: wood, collides: true, material: "wood" },

  { id: "north-route-cover-a", x: -108, z: -82, w: 12, d: 8, h: 4, color: stone, collides: true },
  { id: "north-route-cover-b", x: -44, z: -88, w: 12, d: 8, h: 4, color: stone, collides: true },
  { id: "north-route-cover-c", x: 22, z: -90, w: 12, d: 8, h: 4, color: stone, collides: true },
  { id: "north-route-cover-d", x: 86, z: -78, w: 12, d: 8, h: 4, color: stone, collides: true },
  { id: "central-route-cover-a", x: -94, z: -14, w: 10, d: 8, h: 4, color: wood, collides: true, material: "wood" },
  { id: "central-route-cover-b", x: 94, z: 16, w: 10, d: 8, h: 4, color: wood, collides: true, material: "wood" },
  { id: "south-route-cover-a", x: -112, z: 94, w: 12, d: 8, h: 4, color: stone, collides: true },
  { id: "south-route-cover-b", x: 112, z: 94, w: 12, d: 8, h: 4, color: stone, collides: true }
];

export const blocks: CitadelBlock[] = rawBlocks.map(scaleRect);

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
  { id: "sign-west", label: "West Fortress ->", x: -104, z: -28, color: "#7dd3fc", rotationY: Math.PI / 2 },
  { id: "sign-east", label: "<- East Camp", x: 104, z: 28, color: "#fb7185", rotationY: -Math.PI / 2 },
  { id: "sign-market", label: "Central Market", x: -24, z: -70, color: "#facc15" },
  { id: "sign-north", label: "North Ruins", x: -6, z: -96, color: "#86efac" },
  { id: "sign-south", label: "South Homes", x: 6, z: 82, color: "#fdba74", rotationY: Math.PI },
  { id: "sign-aqueduct-west", label: "Aqueduct", x: -82, z: 18, color: "#67e8f9" },
  { id: "sign-aqueduct-east", label: "Aqueduct", x: 82, z: -18, color: "#67e8f9", rotationY: Math.PI },
  { id: "sign-rooftop", label: "Rooftop Walk", x: 0, z: 78, color: "#fde68a", rotationY: Math.PI }
];

export const signs: CitadelSign[] = rawSigns.map(scalePoint);
