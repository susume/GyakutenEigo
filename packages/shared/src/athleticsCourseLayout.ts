import type { AthleticsAccent, AthleticsCourseDefinition, AthleticsCourseSurface, AthleticsCourseTransition, AthleticsRoutePoint } from "./athleticsRace.js";

// A rectangular spiral: each district occupies its own strip of the stadium.
// No main-route landing passes above or below another district's landing.
const route: AthleticsRoutePoint[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ x: -12 * i, z: 123, y: 0 })),
  { x: -110, z: 103, y: 2 },
  ...Array.from({ length: 11 }, (_, i) => ({ x: -110, z: 93 - 10 * i, y: 2.45 + .455 * i })),
  { x: -100, z: -24, y: 8 }, { x: -116, z: -38, y: 9 },
  { x: -100, z: -52, y: 10 }, { x: -116, z: -66, y: 11 },
  { x: -100, z: -80, y: 12 }, { x: -110, z: -94, y: 13 },
  { x: -99, z: -94, y: 13.7 }, { x: -91, z: -94, y: 14.4 },
  { x: -83, z: -94, y: 15.1 }, { x: -75, z: -94, y: 15.8 },
  { x: -66, z: -94, y: 16.5 },
  ...[-54, -33, -12, -2, 19, 29, 50, 60, 81, 102].map((x) => ({ x, z: -94, y: 16.5 })),
  { x: 108, z: -94, y: 18 },
  ...Array.from({ length: 11 }, (_, i) => ({ x: i === 10 ? 108 : 108 + (i % 2 ? -4.5 : 4.5),
    z: -78 + i * 16, y: 18.8 + i * .8 + (i % 2 ? .4 : 0) + (i >= 6 ? 5.2 : 0) })),
  ...[90, 72, 54, 36, 18, 0].map((x, i) => ({ x, z: 82, y: 33 + i })),
  { x: -15, z: 65, y: 38 }, { x: -15, z: 42, y: 38 },
  { x: -15, z: 19, y: 38 }, { x: -15, z: -3, y: 46 },
  { x: -30, z: -3, y: 46 }, { x: -42, z: -3, y: 46 }, { x: -54, z: -3, y: 46 },
  ...Array.from({ length: 64 }, (_, i) => ({ x: -54 + 3.4 * Math.sin(i * Math.PI / 16),
    z: 3.75 + i * 1.5, y: 46 * (1 - (i + 1) / 64) })),
  { x: -54, z: 105, y: 0 },
  ...[-42, -30, -18, -6].map((x) => ({ x, z: 105, y: 0 })),
  { x: 0, z: 105, y: 0 }
];

const checkpointIndices = [10, 21, 32, 43, 54, 64, route.length - 1];
const progressAt = (index: number) => {
  const lengths = route.slice(1).map((point, i) => Math.hypot(point.x - route[i]!.x, point.z - route[i]!.z));
  return lengths.slice(0, index).reduce((sum, length) => sum + length, 0) / lengths.reduce((sum, length) => sum + length, 0);
};
const idAt = (index: number) => `route-platform-${String(index + 1).padStart(3, "0")}`;
const powerFloatId = (index: number) => `power-stairs-float-${index - 43}`;
const surfaces: AthleticsCourseSurface[] = route.map((point, index) => {
  const checkpoint = checkpointIndices.includes(index);
  const headingPoint = checkpoint ? route[index + 1] ?? point : point;
  const previous = checkpoint ? point : route[index - 1] ?? { x: point.x + 1, z: point.z };
  const rotationY = Math.atan2(headingPoint.x - previous.x, headingPoint.z - previous.z);
  const dimensions = index === route.length - 1 ? [10, 10] : index >= 133 ? [8, 12]
    : index === 67 || index === 132 ? [12, 12] : index >= 68 && index <= 131 ? [4.8, 1.52]
      : index >= 65 ? [10, 12] : index === 0 ? [26, 24] : checkpoint ? [26, 18]
    : index <= 9 ? [16, 12] : index <= 20 ? [4, 10.1]
      : index <= 27 ? [9, 9] : index <= 31 ? [8, 12]
        : index <= 42 ? [8, 6] : index <= 53 ? [8, 8] : [14, 12];
  return {
    ...point, id: idAt(index), kind: checkpoint ? "checkpoint" : (index >= 11 && index <= 20) || (index >= 28 && index <= 31) || (index >= 68 && index <= 131) ? "stair" : "platform",
    ...(index >= 44 && index <= 53 ? { movingObstacleId: powerFloatId(index) } : {}),
    width: dimensions[0]!, depth: dimensions[1]!,
    // Square stepping stones/stair treads stay on the grid; their outgoing
    // chevrons describe the zigzag, rather than rotating a whole district.
    rotationY: (index >= 22 && index <= 31) || (index >= 44 && index <= 53) || index === 67 || (index >= 68 && index <= 132) || index === route.length - 1 ? 0 : rotationY,
    material: index >= 65 ? "stone" : index <= 9 ? "stone" : index <= 20 ? "wood" : index <= 31 ? "accent" : "metal",
    safe: checkpoint || index === 0
  };
});

const movingObstacles: AthleticsCourseDefinition["movingObstacles"] = [
  { id: "timing-shuttle-west", kind: "platform", x: -43.5, z: -94, y: 15.7, width: 6, depth: 7, height: .8, axis: "z", amplitude: 6, periodMs: 3600, material: "accent", jumpable: true },
  { id: "timing-shuttle-west-inner", kind: "platform", x: -22.5, z: -94, y: 15.7, width: 6, depth: 7, height: .8, axis: "z", amplitude: 6, periodMs: 3900, phaseMs: 700, material: "accent", jumpable: true },
  { id: "timing-shuttle-center", kind: "platform", x: 8.5, z: -94, y: 15.7, width: 6, depth: 7, height: .8, axis: "z", amplitude: 6, periodMs: 3500, phaseMs: 1600, material: "accent", jumpable: true },
  { id: "timing-shuttle-east", kind: "platform", x: 39.5, z: -94, y: 15.7, width: 6, depth: 7, height: .8, axis: "z", amplitude: 6, periodMs: 4100, phaseMs: 1200, material: "accent", jumpable: true },
  { id: "timing-shuttle-east-inner", kind: "platform", x: 70.5, z: -94, y: 15.7, width: 6, depth: 7, height: .8, axis: "z", amplitude: 6, periodMs: 3700, phaseMs: 2100, material: "accent", jumpable: true },
  { id: "timing-shuttle-final", kind: "platform", x: 91.5, z: -94, y: 15.7, width: 6, depth: 7, height: .8, axis: "z", amplitude: 6, periodMs: 3300, phaseMs: 600, material: "accent", jumpable: true },
  { id: "timing-swing-gate", kind: "barrier", x: 102, z: -94, y: 16.5, width: 2, depth: 7, height: 6, axis: "z", amplitude: 10, periodMs: 3600, material: "metal", jumpable: true },
  { id: "power-stairs-lift", kind: "elevator", x: 108, z: 10, y: 25, width: 8, depth: 6, height: .8, axis: "y", amplitude: 3, periodMs: 4000, material: "metal", jumpable: true },
  ...surfaces.slice(44, 54).map((surface, index) => ({
    id: surface.movingObstacleId!, kind: "elevator" as const,
    x: surface.x, z: surface.z, y: surface.y - .8, width: surface.width, depth: surface.depth,
    height: .8, axis: "y" as const, amplitude: 2.8,
    periodMs: 4800 + (index % 3) * 400, phaseMs: index * 1200,
    material: "accent" as const, jumpable: true
  })),
  { id: "summit-finish-lift", kind: "elevator", x: -15, z: 8, y: 41.2, width: 12, depth: 8, height: .8, axis: "y", amplitude: 4, periodMs: 5800, material: "accent", jumpable: true }
];
const movingTransitions: Record<number, string> = { 33: "timing-shuttle-west", 34: "timing-shuttle-west-inner", 36: "timing-shuttle-center", 38: "timing-shuttle-east", 40: "timing-shuttle-east-inner", 41: "timing-shuttle-final", 42: "timing-swing-gate", 49: "power-stairs-lift", 63: "summit-finish-lift" };
const shuttleTransitions = [33, 34, 36, 38, 40, 41];
const transitions: AthleticsCourseTransition[] = route.slice(0, -1).map((_, index) => ({
  id: `main-transition-${String(index + 1).padStart(3, "0")}`,
  fromSurfaceId: idAt(index), toSurfaceId: idAt(index + 1),
  type: index >= 64 ? "connected" : [49, 63].includes(index) ? "elevator"
    : shuttleTransitions.includes(index) ? "moving_jump"
      : checkpointIndices.includes(index + 1) ? "checkpoint_entry"
        : index <= 20 || (index >= 28 && index <= 32) ? "connected"
          : index >= 55 ? "hard_jump" : (index >= 21 && index <= 27) || index === 43 || index === 54 ? "easy_jump" : "jump",
  ...(movingTransitions[index] ? { movingObstacleId: movingTransitions[index] } : {}),
  note: index >= 64 ? "Follow the narrow weaving stairs, dodge the offset posts, and jump the low hurdles before the finish." : index <= 8 ? "Sprint over low hurdles on the connected runway."
    : index <= 20 ? "Keep centred on the narrow balance beam."
      : index >= 21 && index <= 27 ? "Aim for the small landing and change direction before the next jump."
        : shuttleTransitions.includes(index) ? "Board the moving shuttle; this gap requires two jumps."
        : index === 42 ? "Wait for the gate to move off the landing, or pass around its side."
          : [49, 63].includes(index) ? "Board at the low point, ride up, then jump onto the exit." : undefined
}));
transitions.push({ id: "lap-join", fromSurfaceId: idAt(route.length - 1), toSurfaceId: idAt(0), type: "connected", note: "Keep running onto the start runway; lap changes never stop movement." });

const branch = (id: string, label: string, start: number, end: number, points: AthleticsRoutePoint[], size: number[]): AthleticsCourseDefinition["shortcuts"][number] => {
  const branchSurfaces: AthleticsCourseSurface[] = points.map((point, index) => ({ ...point,
    id: `shortcut-${id}-${index + 1}`, kind: "platform", width: size[0]!, depth: size[1]!, rotationY: 0, material: "accent" }));
  const ids = [idAt(start), ...branchSurfaces.map((surface) => surface.id), idAt(end)];
  return { id, label, startProgress: progressAt(start), endProgress: progressAt(end),
    route: [route[start]!, ...points, route[end]!], surfaces: branchSurfaces, routeWidth: 12,
    transitions: ids.slice(0, -1).map((fromSurfaceId, index) => ({ id: `${id}-${index}`, fromSurfaceId, toSurfaceId: ids[index + 1]!, type: "shortcut_jump" })) };
};

export const SKYLINE_CIRCUIT_COURSE: AthleticsCourseDefinition = {
  id: "stadium_loop", title: "Skyline Adventure Park",
  subtitle: "Seven athletic districts. One continuous circuit. Keep running across the start/finish line.",
  closedLoop: true, finishSurfaceIndex: 0,
  route, surfaces, transitions, checkpoints: checkpointIndices.map(progressAt),
  sections: [
    [0, 10, "hurdle-sprint", "Hurdle Sprint", "Build speed and clear the striped hurdles.", "cyan", "Sprint lanes"],
    [10, 21, "balance-canyon", "Balance Canyon", "Keep your balance on the narrow wooden beam.", "orange", "Balance beams"],
    [21, 32, "zigzag-steps", "Zigzag Steps", "Aim for narrow landings across the wider zigzag, then climb the stair treads.", "lime", "Stepping stones"],
    [32, 43, "timing-traverse", "Timing Traverse", "Cross small floating landings, board six fast shuttles, and time the sliding gate.", "violet", "Moving bridges"],
    [43, 54, "power-stairs", "Power Stairs", "Time your jumps between ten rising and falling pink platforms, then ride the power lift.", "pink", "Floating ascent"],
    [54, 64, "precision-summit", "Precision Summit", "Clear the long jumps and ride the final lift to the lookout.", "gold", "Summit lookout"],
    [64, route.length - 1, "skyline-descent", "Skyline Descent", "Follow the narrow weaving stairs, dodge the offset posts, and jump the low hurdles before the finish.", "cyan", "Continuous return lane"]
  ].map(([start, end, id, label, description, accent, landmark]) => ({
    startProgress: progressAt(Number(start)), endProgress: progressAt(Number(end)),
    id: String(id), label: String(label), description: String(description), accent: accent as AthleticsAccent, landmark: String(landmark)
  })),
  shortcuts: [
    branch("stair-cut", "Stair corner cut", 26, 30, [{ x: -88, z: -80, y: 13.5 }], [8, 8]),
    branch("timing-bypass", "Expert shuttle bypass", 34, 36, [{ x: -22, z: -79, y: 16.5 }], [14, 14]),
    branch("summit-cut", "Summit corner cut", 59, 62, [{ x: 15, z: 61, y: 38 }, { x: 1, z: 48, y: 38 }], [10, 10])
  ],
  movingObstacles,
  challenges: [
    ...[2, 4, 6, 8].map((index) => ({ id: `sprint-hurdle-${index}`, kind: "hurdle" as const,
      x: route[index]!.x, z: route[index]!.z, y: route[index]!.y, width: 1, depth: 13, height: 1.2 })),
    ...[76, 86, 96, 106, 116, 126].map((index, order) => ({ id: `descent-slalom-${index}`, kind: "slalom" as const,
      x: route[index]!.x + (order % 2 ? -.75 : .75), z: route[index]!.z, y: route[index]!.y,
      width: 2, depth: .65, height: 3.5 })),
    ...[81, 101, 121].map((index) => ({ id: `descent-hurdle-${index}`, kind: "hurdle" as const,
      x: route[index]!.x, z: route[index]!.z, y: route[index]!.y, width: 3.8, depth: .55, height: 1.2 }))
  ],
  routeWidth: 18, finishThreshold: .982, bounds: { limitX: 140, limitZ: 140 }
};
