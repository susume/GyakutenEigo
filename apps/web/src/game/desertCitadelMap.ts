import {
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  DESERT_CITADEL_STAIR_FLIGHTS
} from "@quizstrike/shared";
export type {
  ArenaMapDefinition,
  CitadelBlock,
  CitadelCylinder,
  CitadelFloorMark,
  CitadelProp,
  CitadelSign
} from "./mapTypes";
import type {
  ArenaMapDefinition,
  CitadelBlock,
  CitadelCylinder,
  CitadelFloorMark,
  CitadelProp,
  CitadelSign
} from "./mapTypes";

const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), w: scaleArenaValue(item.w), d: scaleArenaValue(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), radius: scaleArenaValue(item.radius) }) as T;

export const DESERT_CITADEL: ArenaMapDefinition = {
  title: "Desert Citadel",
  id: "desert_citadel",
  description: "A siege-broken desert fortress fought across the Shaded Souk, raised Royal Causeway, Dry Cistern, and the exposed Crown Rampart.",
  footprint: { width: scaleArenaValue(520), depth: scaleArenaValue(400) },
  districts: [
    "West Assembly Bastion — Blue spawn",
    "East Assembly Bastion — Red spawn",
    "Shaded Souk — northern lower combat",
    "Royal Causeway — raised central contest",
    "Dry Cistern — southern lower flank",
    "Crown Rampart — northern upper route"
  ],
  routes: [
    "North Lane — Shaded Souk and Falcon Obelisk",
    "Center Lane — six-way Royal Causeway",
    "South Lane — Dry Cistern and well cover",
    "Rotations — outer alleys and four Causeway side stairs",
    "Upper Route — four-entry Crown Rampart"
  ],
  palette: {
    sky: "#8fc9df",
    fog: "#d8bd86",
    floor: "#d7ad68",
    floorTexture: "sand",
    accent: "#2ca6af"
  }
};

// Keep the adobe value range sunlit enough for player silhouettes to read;
// shaded contrast comes from geometry and lighting rather than near-black tint.
const warmStone = "#d4a56c";
const paleStone = "#e7cb91";
const goldStone = "#d8aa69";
const ochre = "#bf8150";
const darkStone = "#a06f4d";
const terracotta = "#b96b4b";
const blue = "#287daf";
const red = "#ae4545";
const turquoise = "#2ca6af";
const mainY = DESERT_CITADEL_MAIN_LEVEL_Y;
const roofY = DESERT_CITADEL_ROOFTOP_LEVEL_Y;
const centerAt = (floorY: number, height: number) => floorY + height / 2;

const makeStairFlight = (flight: (typeof DESERT_CITADEL_STAIR_FLIGHTS)[number], color: string): CitadelBlock[] =>
  Array.from({ length: flight.steps }, (_, index) => {
    const progress = (index + 1) / flight.steps;
    const travel = (-0.5 + (index + 0.5) / flight.steps) * flight.length * flight.direction;
    const topY = flight.startY + (flight.endY - flight.startY) * progress;
    const height = Math.max(0.65, topY - flight.startY);
    return {
      id: `${flight.id}-step-${index + 1}`,
      x: flight.x + (flight.axis === "x" ? travel : 0),
      z: flight.z + (flight.axis === "z" ? travel : 0),
      w: flight.axis === "x" ? flight.length / flight.steps : flight.width,
      d: flight.axis === "z" ? flight.length / flight.steps : flight.width,
      h: height,
      y: flight.startY + height / 2,
      color,
      material: "stone",
      style: "stair",
      collides: true
    };
  });

// The arena remains visually uncluttered; navigation comes from geometry,
// objectives, and the player marker rather than decorative route marks.
export const floorMarks: CitadelFloorMark[] = [];

const rawBlocks: CitadelBlock[] = [
  // Edge-touching shell: no corner overlap and no boundary escape.
  { id: "citadel-north-wall", x: 0, z: -196, w: 512, d: 8, h: 14, color: darkStone, collides: true, style: "wall" },
  { id: "citadel-south-wall", x: 0, z: 196, w: 512, d: 8, h: 14, color: darkStone, collides: true, style: "wall" },
  { id: "citadel-west-wall", x: -256, z: 0, w: 8, d: 384, h: 16, color: darkStone, collides: true, style: "wall" },
  { id: "citadel-east-wall", x: 256, z: 0, w: 8, d: 384, h: 16, color: darkStone, collides: true, style: "wall" },

  // Lower, main, and upper authored surfaces.
  { id: "blue-assembly-paving", x: -226, z: 0, w: 52, d: 174, h: 0.3, y: -0.15, color: warmStone, material: "stone", style: "bridge" },
  { id: "red-assembly-paving", x: 226, z: 0, w: 52, d: 174, h: 0.3, y: -0.15, color: goldStone, material: "stone", style: "bridge" },
  { id: "shaded-souk-paving", x: 0, z: -118, w: 392, d: 72, h: 0.3, y: -0.15, color: warmStone, material: "stone", style: "bridge" },
  { id: "dry-cistern-paving", x: 0, z: 118, w: 392, d: 72, h: 0.3, y: -0.15, color: goldStone, material: "stone", style: "bridge" },
  { id: "royal-causeway-floor", x: 0, z: 0, w: 236, d: 64, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "royal-causeway-foundation", x: 0, z: 0, w: 236, d: 64, h: mainY - 1, y: (mainY - 1) / 2, color: darkStone, collides: true, style: "wall" },
  { id: "crown-rampart-floor", x: 0, z: -160, w: 354, d: 32, h: 1, y: roofY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "crown-rampart-foundation", x: 0, z: -160, w: 354, d: 32, h: roofY - 1, y: (roofY - 1) / 2, color: darkStone, collides: true, style: "wall" },

  // Twenty-player Assembly Bastions retain their south protection while the
  // north sides stay open for immediate access to each Crown stair flight.
  { id: "blue-assembly-south-wall", x: -228, z: 90, w: 48, d: 6, h: 12, color: warmStone, collides: true, style: "wall" },
  { id: "red-assembly-south-wall", x: 228, z: 90, w: 48, d: 6, h: 12, color: goldStone, collides: true, style: "wall" },
  { id: "blue-screen-north-outer", x: -198, z: -80, w: 8, d: 32, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "blue-screen-north-inner", x: -198, z: -32, w: 8, d: 20, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "blue-screen-south-inner", x: -198, z: 32, w: 8, d: 20, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "blue-screen-south-outer", x: -198, z: 80, w: 8, d: 32, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "red-screen-north-outer", x: 198, z: -80, w: 8, d: 32, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "red-screen-north-inner", x: 198, z: -32, w: 8, d: 20, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "red-screen-south-inner", x: 198, z: 32, w: 8, d: 20, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "red-screen-south-outer", x: 198, z: 80, w: 8, d: 32, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "blue-baffle-north", x: -166, z: -53, w: 8, d: 18, h: 9, color: blue, collides: true, style: "wall" },
  { id: "blue-baffle-center", x: -166, z: 28, w: 8, d: 20, h: 9, color: blue, collides: true, style: "wall" },
  { id: "blue-baffle-south", x: -166, z: 53, w: 8, d: 18, h: 9, color: blue, collides: true, style: "wall" },
  { id: "red-baffle-north", x: 166, z: -53, w: 8, d: 18, h: 9, color: red, collides: true, style: "wall" },
  { id: "red-baffle-center", x: 166, z: 28, w: 8, d: 20, h: 9, color: red, collides: true, style: "wall" },
  { id: "red-baffle-south", x: 166, z: 53, w: 8, d: 18, h: 9, color: red, collides: true, style: "wall" },

  // Ten shared flights define every legitimate elevation change.
  ...DESERT_CITADEL_STAIR_FLIGHTS.slice(0, 6).flatMap((flight) => makeStairFlight(flight, paleStone)),
  ...DESERT_CITADEL_STAIR_FLIGHTS.slice(6).flatMap((flight) => makeStairFlight(flight, goldStone)),

  // Main-level edge protection leaves exact openings for the four side stairs.
  { id: "royal-parapet-north-west", x: -94, z: -30.5, w: 48, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "royal-parapet-north-center", x: 0, z: -30.5, w: 92, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "royal-parapet-north-east", x: 94, z: -30.5, w: 48, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "royal-parapet-south-west", x: -94, z: 30.5, w: 48, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "royal-parapet-south-center", x: 0, z: 30.5, w: 92, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "royal-parapet-south-east", x: 94, z: 30.5, w: 48, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "royal-cover-west", x: -42, z: 0, w: 14, d: 12, h: 5, y: centerAt(mainY, 5), color: terracotta, collides: true, style: "tower" },
  { id: "royal-cover-east", x: 42, z: 0, w: 14, d: 12, h: 5, y: centerAt(mainY, 5), color: terracotta, collides: true, style: "tower" },

  // Upper Rampart has four entries, open stair mouths, and lateral counterplay.
  { id: "crown-rail-north", x: 0, z: -174.5, w: 354, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "crown-rail-south-west", x: -120, z: -145.5, w: 114, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "crown-rail-south-center", x: 0, z: -145.5, w: 82, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "crown-rail-south-east", x: 120, z: -145.5, w: 114, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "crown-cover-west", x: -88, z: -160, w: 22, d: 6, h: 5, y: centerAt(roofY, 5), color: ochre, collides: true, style: "wall" },
  { id: "crown-cover-center", x: 0, z: -160, w: 22, d: 6, h: 5, y: centerAt(roofY, 5), color: paleStone, collides: true, style: "wall" },
  { id: "crown-cover-east", x: 88, z: -160, w: 22, d: 6, h: 5, y: centerAt(roofY, 5), color: ochre, collides: true, style: "wall" },

  // Shaded Souk: one evenly spaced, wall-aligned row of pass-through stalls.
  // Decorative market cover is intentionally non-colliding: players can run
  // through the stalls and use the surrounding architecture/car for cover.
  { id: "souk-stall-west-outer", x: -140, z: -131, w: 38, d: 27, h: 12.77, color: terracotta, collides: false, visual: false, style: "stall" },
  { id: "souk-stall-west-inner", x: -84, z: -131, w: 38, d: 27, h: 12.77, color: warmStone, collides: false, visual: false, style: "stall" },
  { id: "souk-stall-center-west", x: -28, z: -131, w: 38, d: 27, h: 12.77, color: terracotta, collides: false, visual: false, style: "stall" },
  { id: "souk-stall-center-east", x: 28, z: -131, w: 38, d: 27, h: 12.77, color: terracotta, collides: false, visual: false, style: "stall" },
  { id: "souk-stall-east-inner", x: 84, z: -131, w: 38, d: 27, h: 12.77, color: warmStone, collides: false, visual: false, style: "stall" },
  { id: "souk-stall-east-outer", x: 140, z: -131, w: 38, d: 27, h: 12.77, color: terracotta, collides: false, visual: false, style: "stall" },
  // Only the central counters are solid. Canopies, posts, and the remaining
  // stall interior stay traversable so players can enter and circulate.
  // Imported meshes are not multiplied by ARENA_SCALE. These authored raw
  // dimensions therefore compensate for that scale so the resulting 20.46 x
  // 4.34 world-unit proxy fully covers the visible 20.2 x 4.2 counter.
  { id: "souk-table-west-outer", x: -140, z: -131, w: 33, d: 7, h: 3.64, color: terracotta, collides: true, visual: false, style: "stall" },
  { id: "souk-table-west-inner", x: -84, z: -131, w: 33, d: 7, h: 3.64, color: warmStone, collides: true, visual: false, style: "stall" },
  { id: "souk-table-center-west", x: -28, z: -131, w: 33, d: 7, h: 3.64, color: terracotta, collides: true, visual: false, style: "stall" },
  { id: "souk-table-center-east", x: 28, z: -131, w: 33, d: 7, h: 3.64, color: terracotta, collides: true, visual: false, style: "stall" },
  { id: "souk-table-east-inner", x: 84, z: -131, w: 33, d: 7, h: 3.64, color: warmStone, collides: true, visual: false, style: "stall" },
  { id: "souk-table-east-outer", x: 140, z: -131, w: 33, d: 7, h: 3.64, color: terracotta, collides: true, visual: false, style: "stall" },
  { id: "falcon-obelisk", x: 0, z: -112, w: 14, d: 14, h: 16, color: darkStone, collides: true, style: "tower" },
  { id: "falcon-obelisk-crown", x: 0, z: -112, w: 9, d: 9, h: 6, y: 19, color: paleStone, style: "tower" },

  // Dry Cistern: low staggered cover keeps both sides of the route live.
  { id: "cistern-cover-west-outer", x: -145, z: 104, w: 34, d: 8, h: 5, color: darkStone, collides: true, style: "ruin" },
  { id: "cistern-cover-west-inner", x: -88, z: 132, w: 30, d: 8, h: 5, color: ochre, collides: true, style: "ruin" },
  { id: "cistern-cover-center-west", x: -30, z: 104, w: 24, d: 8, h: 5, color: darkStone, collides: true, style: "ruin" },
  { id: "cistern-cover-center-east", x: 30, z: 104, w: 24, d: 8, h: 5, color: darkStone, collides: true, style: "ruin" },
  { id: "cistern-cover-east-inner", x: 88, z: 132, w: 30, d: 8, h: 5, color: ochre, collides: true, style: "ruin" },
  { id: "cistern-cover-east-outer", x: 145, z: 104, w: 34, d: 8, h: 5, color: darkStone, collides: true, style: "ruin" },

  // Simple authoritative collision and a load-failure fallback for the
  // Blender-processed covered service vehicle.
  { id: "cistern-service-car", x: -115, z: 150, w: 23, d: 10, h: 4.61, color: ochre, collides: true, visual: false, material: "metal", style: "machinery" }
];

export const DESERT_CITADEL_PHASE3_MANIFEST = {
  structureBlockIds: [
    "citadel-north-wall", "citadel-south-wall", "citadel-west-wall", "citadel-east-wall",
    "blue-assembly-paving", "red-assembly-paving", "shaded-souk-paving", "dry-cistern-paving",
    "royal-causeway-floor", "royal-causeway-foundation", "crown-rampart-floor", "crown-rampart-foundation",
    "blue-assembly-south-wall", "red-assembly-south-wall",
    "blue-screen-north-outer", "blue-screen-north-inner", "blue-screen-south-inner", "blue-screen-south-outer",
    "red-screen-north-outer", "red-screen-north-inner", "red-screen-south-inner", "red-screen-south-outer",
    "blue-baffle-north", "blue-baffle-center", "blue-baffle-south", "red-baffle-north", "red-baffle-center", "red-baffle-south",
    "royal-parapet-north-west", "royal-parapet-north-center", "royal-parapet-north-east",
    "royal-parapet-south-west", "royal-parapet-south-center", "royal-parapet-south-east",
    "royal-cover-west", "royal-cover-east", "crown-rail-north", "crown-rail-south-west", "crown-rail-south-center", "crown-rail-south-east",
    "crown-cover-west", "crown-cover-center", "crown-cover-east",
    "souk-stall-west-outer", "souk-stall-west-inner", "souk-stall-center-west", "souk-stall-center-east", "souk-stall-east-inner", "souk-stall-east-outer",
    "souk-table-west-outer", "souk-table-west-inner", "souk-table-center-west", "souk-table-center-east", "souk-table-east-inner", "souk-table-east-outer",
    "falcon-obelisk", "falcon-obelisk-crown",
    "cistern-cover-west-outer", "cistern-cover-west-inner", "cistern-cover-center-west", "cistern-cover-center-east", "cistern-cover-east-inner", "cistern-cover-east-outer",
    "cistern-service-car"
  ],
  stairFlightIds: DESERT_CITADEL_STAIR_FLIGHTS.map((flight) => flight.id),
  propIds: [],
  cylinderIds: ["royal-sundial-ring", "royal-sundial-core", "cistern-well-rim", "cistern-well-water"]
} as const;

export const blocks: CitadelBlock[] = rawBlocks.map(scaleRect);

const rawProps: CitadelProp[] = [];

export const props: CitadelProp[] = rawProps.map((item) => ({
  ...item,
  x: scaleArenaValue(item.x),
  z: scaleArenaValue(item.z),
  size: scaleArenaValue(item.size)
}));

const rawCylinders: CitadelCylinder[] = [
  { id: "royal-sundial-ring", x: 0, z: 0, radius: 10, h: 2, y: mainY + 1, color: paleStone, collides: true, material: "stone" },
  { id: "royal-sundial-core", x: 0, z: 0, radius: 1.25, h: 3, y: mainY + 3.5, color: ochre, material: "stone" },
  { id: "cistern-well-rim", x: 0, z: 120, radius: 12, h: 2.4, y: 1.2, color: paleStone, collides: true, material: "stone" },
  { id: "cistern-well-water", x: 0, z: 120, radius: 8, h: 0.25, y: 2.525, color: turquoise, material: "water" }
];

export const cylinders: CitadelCylinder[] = rawCylinders.map(scaleCylinder);
export const signs: CitadelSign[] = [];
