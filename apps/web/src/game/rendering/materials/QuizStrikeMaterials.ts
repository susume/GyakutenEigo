import * as THREE from "three";

export type QuizStrikeMaterialStyle =
  | "stone"
  | "sand"
  | "wood"
  | "metal"
  | "fabric"
  | "vegetation"
  | "painted"
  | "emissive"
  | "water";

const PRESETS: Record<QuizStrikeMaterialStyle, Pick<THREE.MeshStandardMaterialParameters, "roughness" | "metalness">> = {
  stone: { roughness: 0.86, metalness: 0.02 },
  sand: { roughness: 0.94, metalness: 0.01 },
  wood: { roughness: 0.8, metalness: 0.03 },
  metal: { roughness: 0.46, metalness: 0.58 },
  fabric: { roughness: 0.9, metalness: 0.01 },
  vegetation: { roughness: 0.92, metalness: 0 },
  painted: { roughness: 0.64, metalness: 0.08 },
  emissive: { roughness: 0.52, metalness: 0.04 },
  water: { roughness: 0.28, metalness: 0.04 }
};

const clampMaterialResponse = (material: THREE.Material) => {
  const standard = material as THREE.MeshStandardMaterial;
  if ("roughness" in standard) standard.roughness = THREE.MathUtils.clamp(standard.roughness ?? 0.72, 0.28, 0.96);
  if ("metalness" in standard) standard.metalness = THREE.MathUtils.clamp(standard.metalness ?? 0.04, 0, 0.72);
  if ("envMapIntensity" in standard) standard.envMapIntensity = Math.min(1.25, standard.envMapIntensity ?? 1);
  return material;
};

export const createQuizStrikeMaterial = (
  style: QuizStrikeMaterialStyle,
  options: THREE.MeshStandardMaterialParameters = {}
) => {
  const preset = PRESETS[style];
  const material = new THREE.MeshStandardMaterial({
    ...preset,
    color: "#ffffff",
    ...options
  });
  if (style === "emissive") {
    const color = options.color ?? "#ffffff";
    material.emissive.set(color as THREE.ColorRepresentation);
    material.emissiveIntensity = options.emissiveIntensity ?? 0.18;
  }
  return clampMaterialResponse(material) as THREE.MeshStandardMaterial;
};

export class QuizStrikeMaterialLibrary {
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  get(
    key: string,
    style: QuizStrikeMaterialStyle,
    options: THREE.MeshStandardMaterialParameters = {}
  ) {
    const existing = this.materials.get(key);
    if (existing) return existing;
    const material = createQuizStrikeMaterial(style, options);
    this.materials.set(key, material);
    return material;
  }

  normalize(material: THREE.Material) {
    return clampMaterialResponse(material);
  }

  dispose() {
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
  }
}

export const styleForArenaSurface = (surface: string): QuizStrikeMaterialStyle => {
  if (surface === "wood") return "wood";
  if (surface === "metal") return "metal";
  if (surface === "sand" || surface === "gravel") return "sand";
  if (surface === "cloth" || surface === "fabric") return "fabric";
  if (surface === "vegetation") return "vegetation";
  if (surface === "water") return "water";
  if (surface === "accent" || surface === "painted") return "painted";
  if (surface === "emissive") return "emissive";
  return "stone";
};
