import type { Team } from "@quizstrike/shared";

export type CharacterVariant = "assault" | "support" | "sniper" | "engineer" | "medic" | "heavy";
export type HelmetStyle = "visor" | "rounded" | "hood" | "headset" | "ridge";
export type VestStyle = "plate_carrier" | "compact_rig" | "long_rig" | "utility_rig";
export type BackpackStyle = "radio_pack" | "flat_pack" | "bedroll" | "none";

export interface CharacterAppearanceInput {
  team: Team;
  playerId: string;
  gear?: string;
  variant?: CharacterVariant;
}

export interface CharacterAppearance {
  team: Team;
  teamName: string;
  variant: CharacterVariant;
  palette: {
    uniform: string;
    armor: string;
    cloth: string;
    accent: string;
    accentName: "blue" | "orange";
    dark: string;
    visor: string;
    skin: string;
  };
  silhouette: {
    helmet: HelmetStyle;
    vest: VestStyle;
    backpack: BackpackStyle;
    shoulderBulk: number;
    heightScale: number;
    widthScale: number;
  };
}

export const TEAM_CHARACTER_CONFIGS = {
  blue: {
    teamName: "Team Alpha",
    palette: {
      uniform: "#174a78",
      armor: "#e9f2f7",
      cloth: "#18324c",
      accent: "#31b6ff",
      accentName: "blue",
      dark: "#102334",
      visor: "#8ee8ff",
      skin: "#c99f7c"
    },
    silhouette: {
      helmet: "visor",
      vest: "plate_carrier",
      backpack: "radio_pack",
      shoulderBulk: 1.18,
      heightScale: 1.02,
      widthScale: 1
    }
  },
  red: {
    teamName: "Team Bravo",
    palette: {
      uniform: "#8d2f3f",
      armor: "#fff0e6",
      cloth: "#4b2632",
      accent: "#ff6b46",
      accentName: "orange",
      dark: "#2f1b26",
      visor: "#ffd09c",
      skin: "#b98766"
    },
    silhouette: {
      helmet: "ridge",
      vest: "long_rig",
      backpack: "bedroll",
      shoulderBulk: 1.04,
      heightScale: 0.98,
      widthScale: 1.08
    }
  }
} as const satisfies Record<Team, Omit<CharacterAppearance, "team" | "variant">>;

export const CHARACTER_VARIANTS: Record<CharacterVariant, Partial<CharacterAppearance["silhouette"]>> = {
  assault: { vest: "plate_carrier", backpack: "flat_pack", shoulderBulk: 1.1 },
  support: { helmet: "headset", vest: "utility_rig", backpack: "radio_pack", shoulderBulk: 1.08 },
  sniper: { helmet: "hood", vest: "compact_rig", backpack: "flat_pack", heightScale: 1.04, widthScale: 0.94 },
  engineer: { helmet: "rounded", vest: "utility_rig", backpack: "radio_pack", shoulderBulk: 1.14 },
  medic: { helmet: "rounded", vest: "compact_rig", backpack: "flat_pack", shoulderBulk: 1.02 },
  heavy: { helmet: "visor", vest: "plate_carrier", backpack: "radio_pack", shoulderBulk: 1.26, widthScale: 1.12 }
};

export const CHARACTER_LOD_LEVELS = [
  { name: "LOD0", maxDistance: 15, animationStep: 1, equipment: "full" },
  { name: "LOD1", maxDistance: 35, animationStep: 1, equipment: "full" },
  { name: "LOD2", maxDistance: 70, animationStep: 2, equipment: "reduced" },
  { name: "LOD3", maxDistance: Infinity, animationStep: 4, equipment: "minimal" }
] as const;

export const CHARACTER_HITBOXES = {
  head: { damageMultiplier: 4, centerY: 1.68, radius: 0.22, height: 0.28 },
  torso: { damageMultiplier: 1, centerY: 1.18, radius: 0.36, height: 0.68 },
  pelvis: { damageMultiplier: 1, centerY: 0.78, radius: 0.32, height: 0.32 },
  leftArm: { damageMultiplier: 0.75, centerY: 1.15, radius: 0.15, height: 0.7 },
  rightArm: { damageMultiplier: 0.75, centerY: 1.15, radius: 0.15, height: 0.7 },
  leftLeg: { damageMultiplier: 0.75, centerY: 0.38, radius: 0.17, height: 0.7 },
  rightLeg: { damageMultiplier: 0.75, centerY: 0.38, radius: 0.17, height: 0.7 }
} as const;

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const variantFromGear = (gear?: string): CharacterVariant | null => {
  if (gear === "power_blaster") return "heavy";
  if (gear === "quick_blaster" || gear === "speed_shoes") return "support";
  if (gear === "shield_vest") return "engineer";
  return null;
};

export const resolveCharacterVariant = ({ playerId, gear, variant }: CharacterAppearanceInput): CharacterVariant => {
  if (variant) return variant;
  const gearVariant = variantFromGear(gear);
  if (gearVariant) return gearVariant;
  const variants: CharacterVariant[] = ["assault", "support", "sniper", "engineer", "medic"];
  return variants[stableHash(playerId) % variants.length];
};

export const resolveCharacterAppearance = (input: CharacterAppearanceInput): CharacterAppearance => {
  const base = TEAM_CHARACTER_CONFIGS[input.team];
  const variant = resolveCharacterVariant(input);
  const variantSilhouette = CHARACTER_VARIANTS[variant];
  return {
    team: input.team,
    teamName: base.teamName,
    variant,
    palette: { ...base.palette },
    silhouette: {
      ...base.silhouette,
      ...variantSilhouette
    }
  };
};

export const serializeCharacterAppearance = (input: CharacterAppearanceInput) => {
  const appearance = resolveCharacterAppearance(input);
  return {
    team: appearance.team,
    variant: appearance.variant,
    helmet: appearance.silhouette.helmet,
    vest: appearance.silhouette.vest,
    backpack: appearance.silhouette.backpack,
    accent: appearance.palette.accentName
  };
};
