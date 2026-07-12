import { ARENA_SCALE } from "@quizstrike/shared";
import type { ArenaMapDefinition, CitadelBlock, CitadelCylinder, CitadelFloorMark, CitadelProp, CitadelSign } from "./mapTypes";

const scale = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), w: scale(item.w), d: scale(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), radius: scale(item.radius) }) as T;
const scalePoint = <T extends { x: number; z: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z) }) as T;

export const IRON_JUNCTION: ArenaMapDefinition = {
  id: "iron_junction",
  title: "The Iron Junction",
  description: "A derelict mountain train yard turned smuggling depot, built around three readable combat lanes.",
  footprint: { width: scale(350), depth: scale(320) },
  districts: [
    "North Lane · Maintenance Depot",
    "Mid Lane · Sorting Tracks and Gantry",
    "South Lane · Timber Line and Gorge",
    "Rear Service Tunnel",
    "Central Rail Switch",
    "Water Tower Sniper Pocket"
  ],
  routes: [
    "North Lane · Maintenance Depot",
    "Mid Lane · Sorting Tracks and Gantry",
    "South Lane · Timber Line and Gorge",
    "Rear Service Tunnel · safe rotation",
    "Central Rail Switch · fast contested rotation",
    "Timber Drop-down · risky shortcut"
  ],
  palette: {
    sky: "#687b86",
    fog: "#718087",
    floor: "#465056",
    floorTexture: "floor",
    accent: "#d58a45"
  }
};

const steel = "#39464b";
const darkSteel = "#263237";
const greenPaint = "#52645f";
const rust = "#8b4f37";
const concrete = "#6d7778";
const gravel = "#4c5354";
const timber = "#765038";
const warning = "#d18a3f";
const fogBlue = "#8da1a3";

const rawBlocks: CitadelBlock[] = [
  { id: "iron-north-retaining-wall", label: "Mountain Retaining Wall", x: 0, z: -156, w: 350, d: 8, h: 14, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "iron-south-cliff-face", label: "Gorge Edge", x: 0, z: 156, w: 350, d: 8, h: 18, color: darkSteel, material: "stone", style: "wall", collides: true },
  { id: "iron-west-embankment", label: "West Signal Embankment", x: -169, z: 0, w: 8, d: 142, h: 11, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "iron-east-embankment", label: "East Signal Embankment", x: 169, z: 0, w: 8, d: 142, h: 11, color: concrete, material: "stone", style: "wall", collides: true },

  { id: "west-signal-house", label: "West Signal House", x: -151, z: -64, w: 24, d: 20, h: 7, color: greenPaint, material: "metal", style: "shed", collides: true },
  { id: "west-freight-office", label: "West Freight Office", x: -151, z: 64, w: 26, d: 18, h: 7, color: concrete, material: "stone", style: "shed", collides: true },
  { id: "east-signal-house", label: "East Signal House", x: 151, z: -64, w: 24, d: 20, h: 7, color: greenPaint, material: "metal", style: "shed", collides: true },
  { id: "east-freight-office", label: "East Freight Office", x: 151, z: 64, w: 26, d: 18, h: 7, color: concrete, material: "stone", style: "shed", collides: true },

  { id: "depot-north-roof", label: "Maintenance Depot", x: 0, z: -151, w: 142, d: 6, h: 12, color: darkSteel, material: "metal", style: "wall", collides: true },
  { id: "depot-south-wall-west", label: "Depot Service Corridor", x: -86, z: -88, w: 48, d: 7, h: 11, color: greenPaint, material: "metal", style: "wall", collides: true },
  { id: "depot-south-wall-east", label: "Depot Emergency Exit", x: 76, z: -88, w: 46, d: 7, h: 11, color: greenPaint, material: "metal", style: "wall", collides: true },
  { id: "depot-railcar-west", label: "Dismantled Train Car", x: -56, z: -119, w: 30, d: 10, h: 5, color: rust, material: "metal", style: "railcar", collides: true },
  { id: "depot-railcar-east", label: "Half-raised Train Car", x: 35, z: -133, w: 34, d: 10, h: 5, color: rust, material: "metal", style: "railcar", collides: true },
  { id: "depot-inspection-pit", label: "Inspection Pit", x: 0, z: -146, w: 34, d: 4, h: 0.35, y: 0.02, color: darkSteel, material: "metal" },
  { id: "depot-control-booth", label: "Depot Control Room", x: 0, z: -99, w: 20, d: 13, h: 13, color: concrete, material: "stone", style: "tower", collides: true },
  { id: "depot-east-workshop", label: "Tool Cage", x: 78, z: -118, w: 22, d: 24, h: 9, color: greenPaint, material: "metal", style: "shed", collides: true },
  { id: "depot-west-tool-cage", label: "Welding Bay", x: -91, z: -113, w: 12, d: 16, h: 8, color: steel, material: "metal", style: "machinery", collides: true },

  { id: "north-track-bed", x: 0, z: -39, w: 300, d: 5, h: 0.35, y: 0.04, color: gravel, material: "gravel" },
  { id: "mid-track-bed", label: "Sorting Tracks", x: 0, z: 0, w: 300, d: 5, h: 0.35, y: 0.04, color: gravel, material: "gravel" },
  { id: "south-track-bed", x: 0, z: 39, w: 300, d: 5, h: 0.35, y: 0.04, color: gravel, material: "gravel" },
  { id: "gantry-foot-west", label: "Gantry Crane", x: -28, z: -14, w: 9, d: 18, h: 20, color: rust, material: "metal", style: "gantry", collides: true },
  { id: "gantry-foot-east", label: "Gantry Crane", x: 28, z: 14, w: 9, d: 18, h: 20, color: rust, material: "metal", style: "gantry", collides: true },
  { id: "sorting-booth", label: "Sorting Booth", x: 0, z: 25, w: 21, d: 16, h: 14, color: greenPaint, material: "metal", style: "tower", collides: true },
  { id: "mid-boxcar-north", label: "Blue Boxcar", x: -68, z: -22, w: 28, d: 10, h: 5, color: rust, material: "metal", style: "railcar", collides: true },
  { id: "mid-boxcar-south", label: "Red Boxcar", x: 60, z: 30, w: 30, d: 10, h: 5, color: rust, material: "metal", style: "railcar", collides: true },
  { id: "mid-flatbed-cover", label: "Overturned Flatbed", x: -20, z: 12, w: 22, d: 7, h: 2.4, color: timber, material: "wood", style: "railcar", collides: true },
  { id: "switch-control-hut", label: "Switch Control Hut", x: 88, z: 0, w: 13, d: 14, h: 5, color: concrete, material: "stone", style: "shed", collides: true },
  { id: "offset-cargo-container", label: "Opened Cargo Container", x: 18, z: -28, w: 14, d: 9, h: 5, color: greenPaint, material: "metal", style: "shed", collides: true },

  { id: "timber-shelter-west", label: "Timber Processing Shed", x: -83, z: 90, w: 32, d: 18, h: 7, color: timber, material: "wood", style: "shed", collides: true },
  { id: "timber-shelter-east", label: "Cable Winch Shelter", x: 85, z: 100, w: 28, d: 18, h: 8, color: greenPaint, material: "metal", style: "shed", collides: true },
  { id: "log-stack-west", label: "Stable Log Stack", x: -50, z: 100, w: 24, d: 10, h: 5, color: timber, material: "wood", style: "logstack", collides: true },
  { id: "log-stack-east", label: "Stable Log Stack", x: 42, z: 124, w: 26, d: 10, h: 6, color: timber, material: "wood", style: "logstack", collides: true },
  { id: "loader-cabin", label: "Log Loader", x: -10, z: 105, w: 14, d: 13, h: 7, color: warning, material: "metal", style: "machinery", collides: true },
  { id: "water-tower-base", label: "Water Tower", x: 82, z: 116, w: 16, d: 16, h: 14, color: timber, material: "wood", style: "tower", collides: true },
  { id: "gorge-retaining-wall", label: "Gorge Guard Wall", x: 0, z: 151, w: 170, d: 7, h: 10, color: concrete, material: "stone", style: "wall", collides: true },
  { id: "rock-outcrop-west", label: "Rock Barrier", x: -117, z: 120, w: 18, d: 16, h: 5, color: concrete, material: "stone", style: "rock", collides: true },
  { id: "rock-outcrop-east", label: "Rock Barrier", x: 115, z: 88, w: 18, d: 14, h: 6, color: concrete, material: "stone", style: "rock", collides: true },
  { id: "timber-drop-landing", label: "Timber Drop-down", x: 14, z: 82, w: 16, d: 8, h: 1.2, color: timber, material: "wood", style: "bridge", collides: true }
];

export const blocks = rawBlocks.map(scaleRect);

const rawCylinders: CitadelCylinder[] = [
  { id: "depot-hydraulic-west", label: "Hydraulic Lift", x: -72, z: -128, radius: 2, h: 7, color: warning, material: "metal", collides: true },
  { id: "depot-hydraulic-east", label: "Hydraulic Lift", x: 51, z: -117, radius: 2, h: 7, color: warning, material: "metal", collides: true },
  { id: "oil-drums-west", label: "Oil Drums", x: -100, z: -94, radius: 3, h: 3, color: rust, material: "metal", collides: true },
  { id: "oil-drums-east", label: "Fuel Cans", x: 104, z: 64, radius: 3, h: 3, color: rust, material: "metal", collides: true },
  { id: "water-tower-tank", label: "Water Tank", x: 82, z: 116, radius: 8, h: 5, y: 14, color: timber, material: "wood" },
  { id: "gorge-winch", label: "Cable Winch", x: -4, z: 133, radius: 3, h: 4, color: warning, material: "metal", collides: true }
];

export const cylinders = rawCylinders.map(scaleCylinder);

const rawFloorMarks: CitadelFloorMark[] = [
  { id: "iron-route-north", label: "NORTH LANE · MAINTENANCE DEPOT", x: 0, z: -108, w: 90, d: 14, color: "#e3a45a" },
  { id: "iron-route-mid", label: "MID LANE · SORTING TRACKS", x: 0, z: -2, w: 92, d: 14, color: "#d4d8d3" },
  { id: "iron-route-south", label: "SOUTH LANE · TIMBER LINE", x: 0, z: 108, w: 88, d: 14, color: "#c78a55" },
  { id: "iron-rail-switch", label: "CENTRAL RAIL SWITCH", x: 0, z: 0, w: 38, d: 11, color: "#e1a550" },
  { id: "iron-rear-tunnel", label: "REAR SERVICE TUNNEL", x: 0, z: 70, w: 112, d: 10, color: "#91a6a1" },
  { id: "iron-drop-route", label: "TIMBER DROP-DOWN", x: 30, z: 82, w: 38, d: 10, color: "#d68b4a" }
];

export const floorMarks = rawFloorMarks.map(scaleRect);

const rawProps: CitadelProp[] = [
  { id: "rail-north-west", kind: "rail", x: -116, z: -39, size: 23, color: "#a8aaa2", material: "metal" },
  { id: "rail-north-east", kind: "rail", x: 116, z: -39, size: 23, color: "#a8aaa2", material: "metal" },
  { id: "rail-mid-west", kind: "rail", x: -116, z: 0, size: 23, color: "#a8aaa2", material: "metal" },
  { id: "rail-mid-east", kind: "rail", x: 116, z: 0, size: 23, color: "#a8aaa2", material: "metal" },
  { id: "rail-south-west", kind: "rail", x: -116, z: 39, size: 23, color: "#a8aaa2", material: "metal" },
  { id: "rail-south-east", kind: "rail", x: 116, z: 39, size: 23, color: "#a8aaa2", material: "metal" },
  { id: "gantry-crossbeam", kind: "cable", x: 0, z: 0, size: 70, h: 20, color: rust, material: "metal" },
  { id: "gantry-hook", kind: "winch", x: 0, z: 0, size: 3, h: 17, color: warning, material: "metal" },
  { id: "work-lamp-north", kind: "lamp", x: -22, z: -103, size: 2, h: 9, color: "#f1ad58", material: "accent" },
  { id: "work-lamp-south", kind: "lamp", x: 58, z: -104, size: 2, h: 8, color: "#f1ad58", material: "accent" },
  { id: "signal-west", kind: "signal", x: -104, z: -38, size: 2, h: 10, color: "#d85b45", material: "metal" },
  { id: "signal-east", kind: "signal", x: 104, z: 38, size: 2, h: 10, color: "#63b4a2", material: "metal" },
  { id: "pipe-depot", kind: "pipe", x: 70, z: -76, size: 3, h: 32, color: steel, material: "metal" },
  { id: "steam-depot", kind: "steam", x: 74, z: -77, size: 4, h: 5, color: fogBlue, material: "accent" },
  { id: "tree-west-north", kind: "tree", x: -132, z: -118, size: 7, h: 18, color: "#9b5c3c", material: "wood" },
  { id: "tree-west-south", kind: "tree", x: -132, z: 115, size: 7, h: 18, color: "#a4633d", material: "wood" },
  { id: "tree-east-north", kind: "tree", x: 132, z: -116, size: 7, h: 17, color: "#87513b", material: "wood" },
  { id: "tree-east-south", kind: "tree", x: 132, z: 112, size: 7, h: 19, color: "#a05d35", material: "wood" },
  { id: "winch-cable-west", kind: "cable", x: -52, z: 127, size: 28, h: 8, color: steel, material: "metal" },
  { id: "winch-cable-east", kind: "cable", x: 56, z: 133, size: 24, h: 9, color: steel, material: "metal" },
  { id: "tarpaulin-south", kind: "shade", x: 0, z: 82, size: 18, h: 5, color: "#495d62", material: "cloth" },
  { id: "depot-debris", kind: "debris", x: 28, z: -104, size: 7, h: 2.2, color: rust, material: "metal" },
  { id: "south-timber-debris", kind: "debris", x: -25, z: 132, size: 8, h: 2.1, color: timber, material: "wood" }
];

export const props = rawProps.map(scalePoint);

const rawSigns: CitadelSign[] = [
  { id: "sign-depot", label: "MAINTENANCE DEPOT", x: -48, z: -87, color: "#f0b05b", rotationY: 0, y: 9 },
  { id: "sign-gantry", label: "SORTING GANTRY", x: 0, z: -14, color: "#dce2dc", rotationY: Math.PI / 2, y: 16 },
  { id: "sign-switch", label: "RAIL SWITCH 04", x: 86, z: -8, color: "#f0b05b", rotationY: Math.PI / 2, y: 7 },
  { id: "sign-timber", label: "TIMBER LINE", x: -76, z: 86, color: "#e8a15e", rotationY: 0, y: 9 },
  { id: "sign-gorge", label: "Gorge Edge · Guard Rail", x: 100, z: 144, color: "#c9d3cf", rotationY: Math.PI, y: 8 },
  { id: "sign-west-spawn", label: "WEST YARD", x: -150, z: -48, color: "#7dd3fc", rotationY: Math.PI / 2, y: 7 },
  { id: "sign-east-spawn", label: "EAST YARD", x: 150, z: 48, color: "#fb9a72", rotationY: -Math.PI / 2, y: 7 }
];

export const signs = rawSigns.map(scalePoint);
