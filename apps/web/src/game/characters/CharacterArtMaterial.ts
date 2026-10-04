import * as THREE from "three";

export type CharacterSurface = "fabric" | "paint" | "skin" | "metal" | "glass";

/** Shared art direction for the wardrobe and arena. Keeps Three's skinning,
 * lighting and shadow pipeline, adding a gentle illustrated finish after PBR. */
export function applyCharacterArt<T extends THREE.MeshStandardMaterial>(material: T, surface: CharacterSurface = "paint"): T {
  material.flatShading = false;
  material.userData.characterArt = surface;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vQsArtPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvQsArtPosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vQsArtPosition;")
      .replace("#include <opaque_fragment>", `
        float qsFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        float qsRim = pow(1.0 - qsFacing, 3.0);
        float qsLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        outgoingLight *= mix(0.94, 1.06, smoothstep(0.18, 0.9, qsLuma));
        outgoingLight += diffuseColor.rgb * qsRim * ${surface === "metal" ? "0.055" : "0.085"};
        ${surface === "fabric" ? "float qsWeave = sin(vQsArtPosition.x * 420.0) * sin(vQsArtPosition.y * 420.0); outgoingLight *= 1.0 + qsWeave * 0.018;" : ""}
        #include <opaque_fragment>
      `);
  };
  material.customProgramCacheKey = () => `quizstrike-character-art-v1-${surface}`;
  return material;
}

export function characterArtMaterial(color: THREE.ColorRepresentation, roughness = 0.65, metalness = 0.02, surface: CharacterSurface = "paint") {
  return applyCharacterArt(new THREE.MeshPhysicalMaterial({
    color, roughness, metalness,
    clearcoat: surface === "skin" ? 0.08 : surface === "fabric" ? 0 : 0.22,
    clearcoatRoughness: 0.6,
    sheen: surface === "fabric" ? 0.25 : 0,
    sheenColor: new THREE.Color("#b8ceeb"),
    sheenRoughness: 0.8
  }), surface);
}
