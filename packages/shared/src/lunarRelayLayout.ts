/** Raw X/Z design units; heights are world units, like the other combat maps.
 * Both the renderer and authoritative collision consume this single layout. */
export type LunarRelayBlock = {
  id: string; x: number; z: number; w: number; d: number; h: number;
  y?: number; color: string; collides: boolean;
};

export const LUNAR_RELAY_BRIDGE_LEVEL_Y = 10;
export const LUNAR_RELAY_RAW_BOUNDS = { limitX: 240, limitZ: 180 };
export const LUNAR_RELAY_STAIR_FLIGHTS = [
  { id: "lunar-west-stairs", x: -110, z: 0, width: 32, length: 56, axis: "x", direction: 1, startY: 0, endY: 10, steps: 20 },
  { id: "lunar-east-stairs", x: 110, z: 0, width: 32, length: 56, axis: "x", direction: -1, startY: 0, endY: 10, steps: 20 },
  { id: "lunar-north-stairs", x: 0, z: -60, width: 28, length: 56, axis: "z", direction: 1, startY: 0, endY: 10, steps: 20 },
  { id: "lunar-south-stairs", x: 0, z: 60, width: 28, length: 56, axis: "z", direction: -1, startY: 0, endY: 10, steps: 20 }
] as const;

const white = "#c9d7e2";
const slate = "#465b73";
const navy = "#263c58";
const amber = "#d7a45e";

export const LUNAR_RELAY_LAYOUT_BLOCKS: LunarRelayBlock[] = [
  { id: "lunar-north-wall", x: 0, z: -176, w: 480, d: 8, h: 9, color: slate, collides: true },
  { id: "lunar-south-wall", x: 0, z: 176, w: 480, d: 8, h: 9, color: slate, collides: true },
  { id: "lunar-west-wall", x: -236, z: 0, w: 8, d: 352, h: 9, color: slate, collides: true },
  { id: "lunar-east-wall", x: 236, z: 0, w: 8, d: 352, h: 9, color: slate, collides: true },
  // A cross-shaped gantry: the ground route continues underneath its deck.
  // Landings overlap the final tread, so the navigation grid reaches a full
  // height sample from either side before entering the solid deck.
  { id: "lunar-relay-deck", x: 0, z: 0, w: 168, d: 32, h: 1, y: 9.5, color: white, collides: true },
  { id: "lunar-relay-crossing-north", x: 0, z: -25, w: 28, d: 18, h: 1, y: 9.5, color: white, collides: true },
  { id: "lunar-relay-crossing-south", x: 0, z: 25, w: 28, d: 18, h: 1, y: 9.5, color: white, collides: true },
  ...[-58, 58].flatMap((x) => [-11, 11].map((z) => ({
    id: `lunar-pier-${x}-${z}`, x, z, w: 5, d: 5, h: 20, color: slate, collides: true
  }))),
  ...[-58, 58].map(x => ({ id: `lunar-gantry-${x}`, x, z: 0, w: 5, d: 27, h: 1, y: 20.5, color: white, collides: true })),
  ...[-52, 52].flatMap(x => [-15, 15].map(z => ({
    id: `lunar-bridge-rail-${x}-${z}`, x, z, w: 64, d: 1.5, h: 2.4, y: 11.2, color: slate, collides: true
  }))),
  ...[-1, 1].flatMap((side) => [
    // Four shielded five-player fronts and broad exits around each screen.
    ...[-120, -40, 40, 120].map((z, index) => ({
      id: `lunar-${side < 0 ? "blue" : "red"}-screen-${index}`, x: side * 172, z,
      w: 8, d: 28, h: 8, color: side < 0 ? "#648eab" : "#b88381", collides: true
    })),
    { id: `lunar-habitat-${side}`, x: side * 100, z: -116, w: 48, d: 28, h: 13, color: white, collides: true },
    { id: `lunar-habitat-wing-${side}`, x: side * 135, z: -80, w: 26, d: 24, h: 8, color: slate, collides: true },
    { id: `lunar-cargo-${side}`, x: side * 118, z: 82, w: 30, d: 20, h: 6, color: amber, collides: true },
    { id: `lunar-cargo-small-${side}`, x: side * 60, z: 134, w: 24, d: 18, h: 4, color: white, collides: true },
    { id: `lunar-solar-base-${side}`, x: side * 78, z: 54, w: 32, d: 8, h: 5, color: navy, collides: true },
    { id: `lunar-airlock-${side}`, x: side * 146, z: 0, w: 8, d: 12, h: 7, color: slate, collides: true },
    { id: `lunar-relay-shield-${side}`, x: side * 38, z: side * 9, w: 18, d: 5, h: 3.5, y: 11.75, color: slate, collides: true }
  ]),
  // Walls of the north observatory shelter its open, walkable court.
  { id: "lunar-observatory-back", x: 0, z: -146, w: 62, d: 6, h: 12, color: white, collides: true },
  { id: "lunar-observatory-west", x: -34, z: -127, w: 6, d: 44, h: 12, color: white, collides: true },
  { id: "lunar-observatory-east", x: 34, z: -127, w: 6, d: 44, h: 12, color: white, collides: true },
  { id: "lunar-observatory-roof", x: 0, z: -127, w: 74, d: 44, h: 1, y: 12.5, color: white, collides: true },
  { id: "lunar-south-baffle", x: 0, z: 147, w: 36, d: 6, h: 7, color: slate, collides: true }
];

export const LUNAR_RELAY_RAW_CAPTURE_ZONES = [
  { id: "lunar-observatory", label: "Observatory", x: 0, z: -121, radius: 20, y: 0 },
  { id: "lunar-underpass", label: "Service Underpass", x: 0, z: 0, radius: 20, y: 0 },
  { id: "lunar-relay", label: "Relay Bridge", x: 0, z: 0, radius: 20, y: 10 },
  { id: "lunar-solar-court", label: "Solar Court", x: 0, z: 112, radius: 24, y: 0 }
] as const;

export const LUNAR_RELAY_RAW_SEARCH_ITEMS = [
  { id: "lunar-star-chart", label: "Star Chart", x: 0, z: -124, y: 1.4 },
  { id: "lunar-relay-core", label: "Relay Core", x: 0, z: 0, y: 11.4 },
  { id: "lunar-solar-cell", label: "Solar Cell", x: 0, z: 112, y: 1.4 }
] as const;
