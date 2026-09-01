import type { ArenaAssetDefinition } from "../assets/ArenaAssetManager";

export type EnvironmentKitCategory = "architecture" | "terrain" | "props" | "vegetation" | "effects";

export type EnvironmentKitAssetDefinition = ArenaAssetDefinition & {
  category: EnvironmentKitCategory;
  position: [number, number, number];
  scale: number;
  scaleVector?: [number, number, number];
  rotationY?: number;
  fallbackObjectNames?: readonly string[];
};

export type EnvironmentKit = {
  id: string;
  title: string;
  description: string;
  architecture: readonly EnvironmentKitAssetDefinition[];
  terrain: readonly EnvironmentKitAssetDefinition[];
  props: readonly EnvironmentKitAssetDefinition[];
  vegetation: readonly EnvironmentKitAssetDefinition[];
  effects: readonly EnvironmentKitAssetDefinition[];
  budget: {
    targetDrawCalls: number;
    targetTriangles: number;
    targetTextureMb: number;
  };
};

const athleticsAssets: readonly EnvironmentKitAssetDefinition[] = [
  {
    id: "athletics-ferris-wheel",
    path: "/assets/athletics/creative-trio-ferris-wheel.glb",
    category: "architecture",
    position: [-72, 35.2, 28],
    scale: 52,
    rotationY: 0,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-ferris-wheel"]
  },
  {
    id: "athletics-park-entrance",
    path: "/assets/athletics/kenney-park-entrance.glb",
    category: "architecture",
    position: [0, 0, 132],
    scale: 4.6,
    rotationY: Math.PI,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-entrance"]
  },
  {
    id: "athletics-food-stall",
    path: "/assets/athletics/kenney-stall-food.glb",
    category: "props",
    position: [-49, 0, -8],
    scale: 6,
    rotationY: Math.PI / 2,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-food-stall"]
  },
  {
    id: "athletics-drinks-stall",
    path: "/assets/athletics/kenney-stall-drinks.glb",
    category: "props",
    position: [24, 0, -55],
    scale: 6,
    rotationY: -Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-drinks-stall"]
  },
  {
    id: "athletics-coaster-straight-a",
    path: "/assets/athletics/kenney-coaster-steel-straight.glb",
    category: "terrain",
    position: [-96, 42, 34],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-coaster-track-a"]
  },
  {
    id: "athletics-coaster-curve",
    path: "/assets/athletics/kenney-coaster-steel-curve.glb",
    category: "terrain",
    position: [-80, 46, 42],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster-track-curve"]
  },
  {
    id: "athletics-coaster-straight-b",
    path: "/assets/athletics/kenney-coaster-steel-straight.glb",
    category: "terrain",
    position: [-64, 42, 36],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster-track-b"]
  },
  {
    id: "athletics-coaster-train",
    path: "/assets/athletics/kenney-coaster-train.glb",
    category: "props",
    position: [-80, 43.4, 39],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster-train"]
  },
  {
    id: "athletics-coaster-support-a",
    path: "/assets/athletics/kenney-support-large.glb",
    category: "terrain",
    position: [-96, 0, 34],
    scale: 1,
    scaleVector: [4.1, 42, 4.1],
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster-support-a"]
  },
  {
    id: "athletics-coaster-support-b",
    path: "/assets/athletics/kenney-support-large.glb",
    category: "terrain",
    position: [-64, 0, 36],
    scale: 1,
    scaleVector: [4.1, 42, 4.1],
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster-support-b"]
  }
];

export const ATHLETICS_ENVIRONMENT_KIT: EnvironmentKit = {
  id: "athletics-skyline-park",
  title: "Skyline Adventure Park",
  description: "A compact attraction district wrapped around the authored Athletics course.",
  architecture: athleticsAssets.filter((asset) => asset.category === "architecture"),
  terrain: athleticsAssets.filter((asset) => asset.category === "terrain"),
  props: athleticsAssets.filter((asset) => asset.category === "props"),
  // The first vertical slice keeps vegetation procedural and instanced. The
  // slot is still explicit so future kits can add authored foliage without
  // changing the map loader contract.
  vegetation: [],
  effects: [],
  budget: { targetDrawCalls: 180, targetTriangles: 350_000, targetTextureMb: 16 }
};

export const getEnvironmentKitAssets = (kit: EnvironmentKit, detail = 2) => [
  ...kit.architecture,
  ...kit.terrain,
  ...kit.props,
  ...kit.vegetation,
  ...kit.effects
].filter((asset) => (asset.minimumDetail ?? 0) <= detail);

export const getEnvironmentKit = (id: string | undefined) => id === ATHLETICS_ENVIRONMENT_KIT.id
  ? ATHLETICS_ENVIRONMENT_KIT
  : undefined;
