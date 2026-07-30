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
  material?: "stone" | "wood" | "cloth" | "sand" | "water" | "accent" | "metal" | "gravel";
  style?:
    | "wall"
    | "ruin"
    | "gate"
    | "stall"
    | "house"
    | "channel"
    | "bridge"
    | "tower"
    | "sandbank"
    | "railcar"
    | "gantry"
    | "shed"
    | "machinery"
    | "logstack"
    | "rock";
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
  material?: "stone" | "wood" | "water" | "accent" | "metal";
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

export type CitadelProp = {
  id: string;
  kind:
    | "arch"
    | "banner"
    | "cart"
    | "column"
    | "crate"
    | "debris"
    | "lamp"
    | "palm"
    | "pipe"
    | "shade"
    | "tree"
    | "rail"
    | "cable"
    | "steam"
    | "signal"
    | "winch";
  x: number;
  z: number;
  size: number;
  color: string;
  h?: number;
  y?: number;
  rotationY?: number;
  material?: "stone" | "wood" | "cloth" | "sand" | "water" | "accent" | "metal" | "gravel";
};

export type ArenaMapDefinition = {
  id: "desert_citadel" | "iron_junction";
  title: string;
  description: string;
  districts: readonly string[];
  routes: readonly string[];
  footprint: { width: number; depth: number };
  palette: {
    sky: string;
    fog: string;
    floor: string;
    floorTexture: "floor" | "sand";
    accent: string;
  };
};
