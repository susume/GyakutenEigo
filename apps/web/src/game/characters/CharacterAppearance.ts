import {
  sanitizePlayerAppearance,
  type PlayerAppearance,
  type PlayerBackAccessoryId,
  type PlayerFootwearId,
  type PlayerHeadStyleId,
  type PlayerVictoryPoseId,
  type Team
} from "@quizstrike/shared";

export type CharacterVariant = "assault" | "support" | "sniper" | "engineer" | "medic" | "heavy";
export type VestStyle = "plate_carrier" | "compact_rig" | "long_rig" | "utility_rig";

export interface CharacterAppearanceInput {
  team: Team;
  playerId: string;
  gear?: string;
  variant?: CharacterVariant;
  appearance?: PlayerAppearance;
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
    vest: VestStyle;
    shoulderBulk: number;
    heightScale: number;
    widthScale: number;
  };
  customization: {
    headStyleId: PlayerHeadStyleId;
    backAccessoryId: PlayerBackAccessoryId;
    footwearId: PlayerFootwearId;
    victoryPoseId: PlayerVictoryPoseId;
    decalAssetId?: string;
  };
}

export const TEAM_APPEARANCE = {
  blue: {
    teamName: "Team Alpha",
    palette: {
      uniform: "#1671bd",
      armor: "#e8f0f4",
      cloth: "#173250",
      accent: "#49c8ff",
      accentName: "blue",
      dark: "#0c1b2b",
      visor: "#9be9ff",
      skin: "#c99f7c"
    }
  },
  red: {
    teamName: "Team Bravo",
    palette: {
      uniform: "#c93643",
      armor: "#f1eee9",
      cloth: "#532433",
      accent: "#ff6a55",
      accentName: "orange",
      dark: "#281923",
      visor: "#ffd1bd",
      skin: "#b98766"
    }
  }
} as const satisfies Record<Team, Pick<CharacterAppearance, "teamName" | "palette">>;

export const TEAM_CHARACTER_CONFIGS = {
  blue: {
    ...TEAM_APPEARANCE.blue,
    silhouette: {
      vest: "plate_carrier",
      shoulderBulk: 1.1,
      heightScale: 1,
      widthScale: 1
    }
  },
  red: {
    ...TEAM_APPEARANCE.red,
    silhouette: {
      vest: "plate_carrier",
      shoulderBulk: 1.1,
      heightScale: 1,
      widthScale: 1
    }
  }
} as const satisfies Record<Team, Omit<CharacterAppearance, "team" | "variant" | "customization">>;

export const CHARACTER_VARIANTS: Record<CharacterVariant, Partial<CharacterAppearance["silhouette"]>> = {
  assault: { vest: "plate_carrier", shoulderBulk: 1.1 },
  support: { vest: "utility_rig", shoulderBulk: 1.08 },
  sniper: { vest: "compact_rig", heightScale: 1.04, widthScale: 0.94 },
  engineer: { vest: "utility_rig", shoulderBulk: 1.14 },
  medic: { vest: "compact_rig", shoulderBulk: 1.02 },
  heavy: { vest: "plate_carrier", shoulderBulk: 1.26, widthScale: 1.12 }
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

export const resolveCharacterVariant = ({ variant }: CharacterAppearanceInput): CharacterVariant =>
  variant ?? "assault";

export const resolveCharacterAppearance = (input: CharacterAppearanceInput): CharacterAppearance => {
  const base = TEAM_CHARACTER_CONFIGS[input.team];
  const custom = input.appearance ? sanitizePlayerAppearance(input.appearance) : undefined;
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
    },
    customization: {
      headStyleId: custom?.headStyleId ?? "boy_short_hair",
      backAccessoryId: custom?.backAccessoryId ?? "none",
      footwearId: custom?.footwearId ?? "runners",
      victoryPoseId: custom?.victoryPoseId ?? "champion",
      ...(custom?.decalAssetId ? { decalAssetId: custom.decalAssetId } : {})
    }
  };
};

export const serializeCharacterAppearance = (input: CharacterAppearanceInput) => {
  const appearance = resolveCharacterAppearance(input);
  return {
    team: appearance.team,
    variant: appearance.variant,
    headStyleId: appearance.customization.headStyleId,
    vest: appearance.silhouette.vest,
    backAccessoryId: appearance.customization.backAccessoryId,
    footwearId: appearance.customization.footwearId,
    victoryPoseId: appearance.customization.victoryPoseId,
    accent: appearance.palette.accentName
  };
};
