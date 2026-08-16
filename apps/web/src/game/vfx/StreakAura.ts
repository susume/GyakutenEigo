import * as THREE from "three";

export type StreakAuraTierKey =
  | "heatingUp"
  | "dominating"
  | "wickedSick"
  | "monster"
  | "tier7"
  | "unstoppable"
  | "godlike"
  | "maximum";

export interface StreakAuraTier {
  key: StreakAuraTierKey;
  minStreak: number;
  /** The close-to-character energy color; this remains bright on every tier. */
  innerColor: THREE.ColorRepresentation;
  /** The tier's readable outer energy color. */
  outerColor: THREE.ColorRepresentation;
  /** Optional restrained accent used only by the maximum tier. */
  accentColor?: THREE.ColorRepresentation;
  /** Dimensions are authored in the same unscaled units as the character model. */
  radius: number;
  height: number;
  coreRadius: number;
  coreOpacity: number;
  outerOpacity: number;
  pulseSpeed: number;
  flowSpeed: number;
  particleCount: number;
  particleSpeed: number;
  wispIntensity: number;
  ringOpacity: number;
  burstIntensity: number;
}

/**
 * The streak VFX intentionally has its own visual ladder. The server-owned
 * freezeStreak remains the only gameplay state; these values are just render
 * parameters derived from that state.
 */
export const STREAK_AURA_TIERS: readonly StreakAuraTier[] = [
  {
    key: "heatingUp",
    minStreak: 3,
    innerColor: "#FFFFFF",
    outerColor: "#79E7FF",
    radius: 0.4,
    height: 2.12,
    coreRadius: 0.3,
    coreOpacity: 0.16,
    outerOpacity: 0.18,
    pulseSpeed: 1.25,
    flowSpeed: 0.48,
    particleCount: 1,
    particleSpeed: 0.42,
    wispIntensity: 0.12,
    ringOpacity: 0,
    burstIntensity: 0.28
  },
  {
    key: "dominating",
    minStreak: 4,
    innerColor: "#FFFFFF",
    outerColor: "#20CFFF",
    radius: 0.48,
    height: 2.24,
    coreRadius: 0.34,
    coreOpacity: 0.18,
    outerOpacity: 0.2,
    pulseSpeed: 1.45,
    flowSpeed: 0.62,
    particleCount: 1,
    particleSpeed: 0.52,
    wispIntensity: 0.18,
    ringOpacity: 0,
    burstIntensity: 0.34
  },
  {
    key: "wickedSick",
    minStreak: 5,
    innerColor: "#FFFFFF",
    outerColor: "#A86CFF",
    radius: 0.58,
    height: 2.4,
    coreRadius: 0.38,
    coreOpacity: 0.2,
    outerOpacity: 0.22,
    pulseSpeed: 1.65,
    flowSpeed: 0.78,
    particleCount: 2,
    particleSpeed: 0.62,
    wispIntensity: 0.28,
    ringOpacity: 0,
    burstIntensity: 0.42
  },
  {
    key: "monster",
    minStreak: 6,
    innerColor: "#FFFFFF",
    outerColor: "#854DFF",
    radius: 0.68,
    height: 2.56,
    coreRadius: 0.42,
    coreOpacity: 0.22,
    outerOpacity: 0.23,
    pulseSpeed: 1.85,
    flowSpeed: 0.94,
    particleCount: 2,
    particleSpeed: 0.72,
    wispIntensity: 0.38,
    ringOpacity: 0.08,
    burstIntensity: 0.5
  },
  {
    key: "tier7",
    minStreak: 7,
    innerColor: "#FFFFFF",
    outerColor: "#D44CFF",
    radius: 0.78,
    height: 2.72,
    coreRadius: 0.46,
    coreOpacity: 0.24,
    outerOpacity: 0.24,
    pulseSpeed: 2.05,
    flowSpeed: 1.12,
    particleCount: 3,
    particleSpeed: 0.84,
    wispIntensity: 0.5,
    ringOpacity: 0.12,
    burstIntensity: 0.58
  },
  {
    key: "unstoppable",
    minStreak: 8,
    innerColor: "#FFFFFF",
    outerColor: "#FFD84A",
    radius: 0.9,
    height: 2.88,
    coreRadius: 0.5,
    coreOpacity: 0.26,
    outerOpacity: 0.255,
    pulseSpeed: 2.3,
    flowSpeed: 1.32,
    particleCount: 4,
    particleSpeed: 0.98,
    wispIntensity: 0.62,
    ringOpacity: 0.17,
    burstIntensity: 0.68
  },
  {
    key: "godlike",
    minStreak: 9,
    innerColor: "#FFF4C2",
    outerColor: "#FFD24A",
    radius: 1.02,
    height: 3.04,
    coreRadius: 0.55,
    coreOpacity: 0.28,
    outerOpacity: 0.27,
    pulseSpeed: 2.58,
    flowSpeed: 1.55,
    particleCount: 4,
    particleSpeed: 1.12,
    wispIntensity: 0.74,
    ringOpacity: 0.22,
    burstIntensity: 0.78
  },
  {
    key: "maximum",
    minStreak: 10,
    innerColor: "#FFFFFF",
    outerColor: "#FFD43B",
    accentColor: "#B85CFF",
    radius: 1.14,
    height: 3.2,
    coreRadius: 0.6,
    coreOpacity: 0.3,
    outerOpacity: 0.285,
    pulseSpeed: 2.85,
    flowSpeed: 1.8,
    particleCount: 5,
    particleSpeed: 1.28,
    wispIntensity: 0.86,
    ringOpacity: 0.28,
    burstIntensity: 0.9
  }
] as const;

const DEFAULT_AURA_INNER_COLOR: THREE.ColorRepresentation = STREAK_AURA_TIERS[0]?.innerColor ?? "#FFFFFF";
const DEFAULT_AURA_OUTER_COLOR: THREE.ColorRepresentation = STREAK_AURA_TIERS[0]?.outerColor ?? "#79E7FF";
const DEFAULT_AURA_ACCENT_COLOR: THREE.ColorRepresentation = STREAK_AURA_TIERS.at(-1)?.accentColor ?? DEFAULT_AURA_OUTER_COLOR;

export interface StreakAuraTextures {
  magic?: THREE.Texture;
  circle?: THREE.Texture;
}

export interface StreakAuraOptions {
  scene: THREE.Scene;
  target: THREE.Object3D;
  textures?: StreakAuraTextures;
  detail?: number;
  seed?: string;
  initialStreak?: number;
}

export interface StreakAuraDebugState {
  streak: number;
  tierKey: StreakAuraTierKey | null;
  persistentActive: boolean;
  shuttingDown: boolean;
  visible: boolean;
}

const AURA_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  uniform float uWarp;
  uniform float uPhase;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vHeight;

  void main() {
    vec3 transformed = position;
    float height = clamp(uv.y, 0.0, 1.0);
    float wave = sin(uTime * uFlow + position.y * 4.4 + position.x * 2.2 + uPhase);
    float crossWave = cos(uTime * uFlow * 0.71 + position.z * 3.5 + position.y * 2.1 + uPhase * 0.7);
    transformed.x += wave * uWarp * (0.35 + height * 0.65);
    transformed.z += crossWave * uWarp * (0.3 + height * 0.7);

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vHeight = height;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const OUTER_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uFlash;
  uniform float uPhase;
  uniform vec3 uOuterColor;
  uniform vec3 uCoreColor;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vHeight;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 2.2);
    float verticalFade = smoothstep(0.02, 0.16, vHeight) * (1.0 - smoothstep(0.82, 0.99, vHeight));
    float energyBand = 0.68 + 0.32 * sin(vHeight * 28.0 + uPhase + vWorldPosition.x * 1.4);
    float edgeEnergy = smoothstep(0.04, 0.86, fresnel);
    float alpha = (0.018 + edgeEnergy * 0.2) * verticalFade * energyBand * uOpacity * (1.0 + uFlash * 0.65);
    vec3 color = mix(uOuterColor, uCoreColor, clamp(edgeEnergy * 0.8 + uFlash * 0.42, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
  }
`;

const INNER_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uFlash;
  uniform vec3 uOuterColor;
  uniform vec3 uCoreColor;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vHeight;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float facing = max(0.0, dot(normalize(vWorldNormal), viewDirection));
    float rim = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 1.6);
    float verticalFade = smoothstep(0.01, 0.15, vHeight) * (1.0 - smoothstep(0.86, 1.0, vHeight));
    float alpha = (0.035 + facing * 0.16 + rim * 0.08) * verticalFade * uOpacity * (1.0 + uFlash);
    vec3 color = mix(uOuterColor, uCoreColor, clamp(0.58 + facing * 0.34 + uFlash * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
  }
`;

const WISP_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  uniform float uWarp;
  uniform float uPhase;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float wave = sin(uTime * uFlow + uv.y * 7.0 + uPhase);
    float counterWave = cos(uTime * uFlow * 0.82 + uv.y * 5.1 + uPhase * 0.63);
    transformed.x += wave * uWarp * (0.2 + uv.y * 0.8);
    transformed.z += counterWave * uWarp * (0.16 + uv.y * 0.7);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const WISP_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uFlash;
  uniform float uPhase;
  uniform vec3 uOuterColor;
  uniform vec3 uCoreColor;
  uniform vec3 uAccentColor;
  uniform float uAccentAmount;
  varying vec2 vUv;

  void main() {
    float verticalFade = sin(vUv.y * 3.14159265);
    float edgeFade = 0.58 + 0.42 * sin(vUv.x * 3.14159265);
    float flicker = 0.72 + 0.28 * sin(vUv.y * 19.0 + uPhase);
    float alpha = verticalFade * edgeFade * flicker * uOpacity * (1.0 + uFlash * 0.7);
    vec3 baseColor = mix(uOuterColor, uCoreColor, clamp(vUv.y * 0.62 + uFlash * 0.45, 0.0, 1.0));
    float accentBand = smoothstep(0.76, 0.98, 0.5 + 0.5 * sin(vUv.y * 15.0 + uPhase * 1.7));
    vec3 color = mix(baseColor, uAccentColor, accentBand * uAccentAmount);
    gl_FragColor = vec4(color, alpha);
  }
`;

type StreakAuraValues = {
  innerColor: THREE.Color;
  outerColor: THREE.Color;
  accentColor: THREE.Color;
  accentAmount: number;
  radius: number;
  height: number;
  coreRadius: number;
  coreOpacity: number;
  outerOpacity: number;
  pulseSpeed: number;
  flowSpeed: number;
  particleCount: number;
  particleSpeed: number;
  wispIntensity: number;
  ringOpacity: number;
  burstIntensity: number;
};

const makeZeroValues = (): StreakAuraValues => ({
  innerColor: new THREE.Color(DEFAULT_AURA_INNER_COLOR),
  outerColor: new THREE.Color(DEFAULT_AURA_OUTER_COLOR),
  accentColor: new THREE.Color(DEFAULT_AURA_ACCENT_COLOR),
  accentAmount: 0,
  radius: 0,
  height: 0,
  coreRadius: 0,
  coreOpacity: 0,
  outerOpacity: 0,
  pulseSpeed: 0,
  flowSpeed: 0,
  particleCount: 0,
  particleSpeed: 0,
  wispIntensity: 0,
  ringOpacity: 0,
  burstIntensity: 0
});

const normalizeStreak = (streak: number) => Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;

export const getStreakAuraTier = (streak: number): StreakAuraTier | null => {
  const normalized = normalizeStreak(streak);
  for (let index = STREAK_AURA_TIERS.length - 1; index >= 0; index -= 1) {
    const tier = STREAK_AURA_TIERS[index];
    if (tier && normalized >= tier.minStreak) return tier;
  }
  return null;
};

export const getStreakAuraTierKey = (streak: number): StreakAuraTierKey | null => getStreakAuraTier(streak)?.key ?? null;

const getSeedPhase = (seed = "") => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * Math.PI * 2;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothStep = (value: number) => value * value * (3 - 2 * value);
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

const lerpColor = (current: THREE.Color, target: THREE.Color, amount: number) => {
  const currentHsl = { h: 0, s: 0, l: 0 };
  const targetHsl = { h: 0, s: 0, l: 0 };
  current.getHSL(currentHsl);
  target.getHSL(targetHsl);

  // Keep white and pale-gold core transitions neutral; use a short HSL hue
  // path for saturated tier colors so cyan → violet and magenta → gold do not
  // spend the transition in a muddy gray midpoint.
  if (currentHsl.s < 0.08 || targetHsl.s < 0.08) {
    current.lerp(target, amount);
    return;
  }

  let hueDelta = targetHsl.h - currentHsl.h;
  if (hueDelta > 0.5) hueDelta -= 1;
  if (hueDelta < -0.5) hueDelta += 1;
  current.setHSL(
    (currentHsl.h + hueDelta * amount + 1) % 1,
    mix(currentHsl.s, targetHsl.s, amount),
    mix(currentHsl.l, targetHsl.l, amount)
  );
};

type SharedStreakAuraResources = {
  shellGeometry: THREE.CapsuleGeometry;
  wispGeometry: THREE.PlaneGeometry;
  ringGeometry: THREE.TorusGeometry;
};

let sharedResources: SharedStreakAuraResources | undefined;
let sharedResourceReferences = 0;

const acquireSharedResources = () => {
  sharedResources ??= {
    shellGeometry: new THREE.CapsuleGeometry(0.5, 1, 4, 16),
    wispGeometry: new THREE.PlaneGeometry(1, 1, 1, 8),
    ringGeometry: new THREE.TorusGeometry(0.5, 0.018, 5, 32)
  };
  sharedResourceReferences += 1;
  return sharedResources;
};

const releaseSharedResources = () => {
  sharedResourceReferences = Math.max(0, sharedResourceReferences - 1);
  if (sharedResourceReferences > 0 || !sharedResources) return;
  sharedResources.shellGeometry.dispose();
  sharedResources.wispGeometry.dispose();
  sharedResources.ringGeometry.dispose();
  sharedResources = undefined;
};

const setTierValues = (target: StreakAuraValues, tier: StreakAuraTier | null) => {
  if (tier) {
    target.innerColor.set(tier.innerColor);
    target.outerColor.set(tier.outerColor);
    target.accentColor.set(tier.accentColor ?? tier.outerColor);
  }
  target.accentAmount = tier?.accentColor ? 0.24 : 0;
  target.radius = tier?.radius ?? 0;
  target.height = tier?.height ?? 0;
  target.coreRadius = tier?.coreRadius ?? 0;
  target.coreOpacity = tier?.coreOpacity ?? 0;
  target.outerOpacity = tier?.outerOpacity ?? 0;
  target.pulseSpeed = tier?.pulseSpeed ?? 0;
  target.flowSpeed = tier?.flowSpeed ?? 0;
  target.particleCount = tier?.particleCount ?? 0;
  target.particleSpeed = tier?.particleSpeed ?? 0;
  target.wispIntensity = tier?.wispIntensity ?? 0;
  target.ringOpacity = tier?.ringOpacity ?? 0;
  target.burstIntensity = tier?.burstIntensity ?? 0;
};

const lerpTierValues = (current: StreakAuraValues, target: StreakAuraValues, amount: number) => {
  lerpColor(current.innerColor, target.innerColor, amount);
  lerpColor(current.outerColor, target.outerColor, amount);
  lerpColor(current.accentColor, target.accentColor, amount);
  current.accentAmount = mix(current.accentAmount, target.accentAmount, amount);
  current.radius = mix(current.radius, target.radius, amount);
  current.height = mix(current.height, target.height, amount);
  current.coreRadius = mix(current.coreRadius, target.coreRadius, amount);
  current.coreOpacity = mix(current.coreOpacity, target.coreOpacity, amount);
  current.outerOpacity = mix(current.outerOpacity, target.outerOpacity, amount);
  current.pulseSpeed = mix(current.pulseSpeed, target.pulseSpeed, amount);
  current.flowSpeed = mix(current.flowSpeed, target.flowSpeed, amount);
  current.particleCount = mix(current.particleCount, target.particleCount, amount);
  current.particleSpeed = mix(current.particleSpeed, target.particleSpeed, amount);
  current.wispIntensity = mix(current.wispIntensity, target.wispIntensity, amount);
  current.ringOpacity = mix(current.ringOpacity, target.ringOpacity, amount);
  current.burstIntensity = mix(current.burstIntensity, target.burstIntensity, amount);
};

const makeShellMaterial = (phase: number, fragmentShader: string) => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uFlow: { value: 0 },
    uWarp: { value: 0 },
    uPhase: { value: phase },
    uOpacity: { value: 0 },
    uFlash: { value: 0 },
    uOuterColor: { value: new THREE.Color(DEFAULT_AURA_OUTER_COLOR) },
    uCoreColor: { value: new THREE.Color(DEFAULT_AURA_INNER_COLOR) }
  },
  vertexShader: AURA_VERTEX_SHADER,
  fragmentShader,
  transparent: true,
  depthTest: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  toneMapped: false
});

const makeWispMaterial = (phase: number) => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uFlow: { value: 0 },
    uWarp: { value: 0 },
    uPhase: { value: phase },
    uOpacity: { value: 0 },
    uFlash: { value: 0 },
    uOuterColor: { value: new THREE.Color(DEFAULT_AURA_OUTER_COLOR) },
    uCoreColor: { value: new THREE.Color(DEFAULT_AURA_INNER_COLOR) },
    uAccentColor: { value: new THREE.Color(DEFAULT_AURA_ACCENT_COLOR) },
    uAccentAmount: { value: 0 }
  },
  vertexShader: WISP_VERTEX_SHADER,
  fragmentShader: WISP_FRAGMENT_SHADER,
  transparent: true,
  depthTest: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  toneMapped: false
});

export class StreakAura {
  readonly group = new THREE.Group();

  private readonly target: THREE.Object3D;
  private readonly detail: number;
  private readonly textures: StreakAuraTextures;
  private readonly resources: SharedStreakAuraResources;
  private readonly phase: number;
  private readonly current = makeZeroValues();
  private readonly targetValues = makeZeroValues();
  private readonly targetPosition = new THREE.Vector3();
  private readonly targetScale = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly outerShell: THREE.Mesh<THREE.CapsuleGeometry, THREE.ShaderMaterial>;
  private readonly innerShell: THREE.Mesh<THREE.CapsuleGeometry, THREE.ShaderMaterial>;
  private readonly wispMaterial: THREE.ShaderMaterial;
  private readonly wispMeshes: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>;
  private readonly coreGlow: THREE.Sprite;
  private readonly energySprites: [THREE.Sprite, THREE.Sprite];
  private readonly groundRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly burstRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly burstInnerColor = new THREE.Color(DEFAULT_AURA_INNER_COLOR);
  private readonly burstOuterColor = new THREE.Color(DEFAULT_AURA_OUTER_COLOR);
  private readonly burstAccentColor = new THREE.Color(DEFAULT_AURA_ACCENT_COLOR);
  private burstAccentAmount = 0;
  private streak = 0;
  private persistentActive = false;
  private shutdownElapsed = -1;
  private burstElapsed = -1;
  private burstDuration = 0;
  private burstStrength = 0;
  private burstKind: "threshold" | "shutdown" | undefined;
  private disposed = false;

  constructor(options: StreakAuraOptions) {
    this.target = options.target;
    this.detail = Math.max(0, Math.min(2, Math.floor(options.detail ?? 2)));
    this.textures = options.textures ?? {};
    this.resources = acquireSharedResources();
    this.phase = getSeedPhase(options.seed);
    this.group.name = "StreakAura";
    this.group.visible = false;
    this.group.renderOrder = 2;

    this.outerShell = new THREE.Mesh(this.resources.shellGeometry, makeShellMaterial(this.phase, OUTER_FRAGMENT_SHADER));
    this.innerShell = new THREE.Mesh(this.resources.shellGeometry, makeShellMaterial(this.phase + 1.3, INNER_FRAGMENT_SHADER));
    this.outerShell.material.uniforms.uOuterColor.value = this.current.outerColor;
    this.outerShell.material.uniforms.uCoreColor.value = this.current.innerColor;
    this.innerShell.material.uniforms.uOuterColor.value = this.current.outerColor;
    this.innerShell.material.uniforms.uCoreColor.value = this.current.innerColor;
    this.outerShell.renderOrder = 2;
    this.innerShell.renderOrder = 2;
    this.outerShell.frustumCulled = false;
    this.innerShell.frustumCulled = false;

    this.wispMaterial = makeWispMaterial(this.phase + 0.4);
    this.wispMeshes = Array.from({ length: 4 }, (_, index) => {
      const wisp = new THREE.Mesh(this.resources.wispGeometry, this.wispMaterial);
      wisp.renderOrder = 2;
      wisp.frustumCulled = false;
      wisp.rotation.y = this.phase + index * Math.PI * 0.5;
      return wisp;
    });
    this.wispMaterial.uniforms.uOuterColor.value = this.current.outerColor;
    this.wispMaterial.uniforms.uCoreColor.value = this.current.innerColor;
    this.wispMaterial.uniforms.uAccentColor.value = this.current.accentColor;

    const coreTexture = this.textures.circle ?? this.textures.magic;
    const energyTexture = this.textures.magic ?? this.textures.circle;
    this.coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTexture ?? null,
      color: DEFAULT_AURA_INNER_COLOR,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    }));
    this.coreGlow.visible = Boolean(coreTexture);
    this.coreGlow.renderOrder = 2;

    const energyMaterial = new THREE.SpriteMaterial({
      map: energyTexture ?? null,
      color: DEFAULT_AURA_OUTER_COLOR,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    this.energySprites = [new THREE.Sprite(energyMaterial), new THREE.Sprite(energyMaterial.clone())];
    this.energySprites.forEach((sprite) => {
      sprite.visible = Boolean(energyTexture);
      sprite.renderOrder = 2;
    });

    this.groundRing = new THREE.Mesh(
      this.resources.ringGeometry,
      new THREE.MeshBasicMaterial({
        color: DEFAULT_AURA_OUTER_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      })
    );
    this.groundRing.rotation.x = Math.PI / 2;
    this.groundRing.position.y = 0.035;
    this.groundRing.renderOrder = 2;

    this.burstRing = new THREE.Mesh(
      this.resources.ringGeometry,
      new THREE.MeshBasicMaterial({
        color: DEFAULT_AURA_INNER_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      })
    );
    this.burstRing.rotation.x = Math.PI / 2;
    this.burstRing.position.y = 0.07;
    this.burstRing.renderOrder = 2;
    this.burstRing.visible = false;

    this.group.add(
      this.outerShell,
      this.innerShell,
      ...this.wispMeshes,
      this.coreGlow,
      ...this.energySprites,
      this.groundRing,
      this.burstRing
    );
    options.scene.add(this.group);

    if (options.initialStreak !== undefined) {
      this.setStreak(options.initialStreak, { initial: true });
    }
  }

  setStreak(streak: number, options: { initial?: boolean } = {}) {
    if (this.disposed) return;
    const normalized = normalizeStreak(streak);
    if (!options.initial && normalized === this.streak) return;
    const previousStreak = this.streak;
    const previousTier = getStreakAuraTier(previousStreak);
    const nextTier = getStreakAuraTier(normalized);
    this.streak = normalized;

    if (!nextTier) {
      if (this.persistentActive || previousTier) this.startShutdown();
      else {
        this.persistentActive = false;
        setTierValues(this.targetValues, null);
      }
      return;
    }

    this.persistentActive = true;
    this.shutdownElapsed = -1;
    setTierValues(this.targetValues, nextTier);
    if (options.initial) {
      setTierValues(this.current, nextTier);
      this.group.visible = true;
      return;
    }

    if (previousTier?.key !== nextTier.key || previousStreak < nextTier.minStreak) {
      this.startThresholdBurst(nextTier);
    }
  }

  triggerShutdown() {
    if (this.disposed || (!this.persistentActive && this.shutdownElapsed < 0)) return;
    this.persistentActive = false;
    this.startShutdown();
  }

  update(delta: number, elapsed: number, camera: THREE.Camera) {
    if (this.disposed) return;
    const hasTransientEffect = this.shutdownElapsed >= 0 || this.burstElapsed >= 0;
    if (!this.persistentActive && !hasTransientEffect) {
      this.group.visible = false;
      return;
    }

    this.target.getWorldPosition(this.targetPosition);
    this.target.getWorldScale(this.targetScale);
    camera.getWorldPosition(this.cameraPosition);
    this.group.position.copy(this.targetPosition);

    const transitionAmount = 1 - Math.exp(-Math.max(delta, 0.001) / 0.28);
    lerpTierValues(this.current, this.targetValues, transitionAmount);

    let shutdownAlpha = 1;
    let contraction = 1;
    if (this.shutdownElapsed >= 0) {
      this.shutdownElapsed += Math.max(0, delta);
      const progress = clamp01(this.shutdownElapsed / 0.72);
      shutdownAlpha = 1 - smoothStep(progress);
      contraction = 0.28 + shutdownAlpha * 0.72;
      if (progress >= 1) {
        this.shutdownElapsed = -1;
        this.burstElapsed = -1;
        this.burstRing.visible = false;
        this.persistentActive = false;
        setTierValues(this.current, null);
        this.group.visible = false;
        return;
      }
    }

    const distance = this.group.position.distanceTo(this.cameraPosition);
    const maxDistance = this.detail === 0 ? 155 : this.detail === 1 ? 230 : 310;
    const withinRange = distance <= maxDistance;
    this.group.visible = withinRange && (this.persistentActive || this.shutdownElapsed >= 0 || this.burstElapsed >= 0);
    if (!this.group.visible) {
      this.advanceBurst(delta);
      return;
    }

    const distanceBand = distance <= 35 ? 1 : distance <= 90 ? 0.86 : 0.68;
    const burstFlash = this.getBurstFlash();
    const pulse = 0.5
      + 0.5 * Math.sin(elapsed * Math.max(0.5, this.current.pulseSpeed) + this.phase)
      + 0.18 * Math.sin(elapsed * Math.max(0.35, this.current.pulseSpeed * 0.61) + this.phase * 1.7);
    const pulse01 = clamp01(pulse / 1.18);
    const visibleAlpha = shutdownAlpha * distanceBand;
    const scaleX = this.targetScale.x * contraction;
    const scaleY = this.targetScale.y * contraction;
    const scaleZ = this.targetScale.z * contraction;
    this.group.scale.set(scaleX, scaleY, scaleZ);

    const radiusPulse = 1 + (pulse01 - 0.5) * 0.08;
    const heightPulse = 1 + (pulse01 - 0.5) * 0.045;
    this.outerShell.position.y = this.current.height * 0.5;
    this.outerShell.scale.set(
      Math.max(0.001, this.current.radius * 2 * radiusPulse),
      Math.max(0.001, this.current.height * 0.5 * heightPulse),
      Math.max(0.001, this.current.radius * 2 * radiusPulse)
    );
    this.innerShell.position.y = this.current.height * 0.49;
    this.innerShell.scale.set(
      Math.max(0.001, this.current.coreRadius * 2.1 * radiusPulse),
      Math.max(0.001, this.current.height * 0.41 * heightPulse),
      Math.max(0.001, this.current.coreRadius * 2.1 * radiusPulse)
    );

    const outerUniforms = this.outerShell.material.uniforms;
    outerUniforms.uTime.value = elapsed;
    outerUniforms.uFlow.value = this.current.flowSpeed;
    outerUniforms.uWarp.value = 0.018 + this.current.wispIntensity * 0.045;
    outerUniforms.uOpacity.value = this.current.outerOpacity * visibleAlpha;
    outerUniforms.uFlash.value = burstFlash;

    const innerUniforms = this.innerShell.material.uniforms;
    innerUniforms.uTime.value = elapsed * 0.92;
    innerUniforms.uFlow.value = Math.max(0.3, this.current.flowSpeed * 0.8);
    innerUniforms.uWarp.value = 0.01 + this.current.wispIntensity * 0.024;
    innerUniforms.uOpacity.value = this.current.coreOpacity * visibleAlpha;
    innerUniforms.uFlash.value = burstFlash;

    const wispUniforms = this.wispMaterial.uniforms;
    wispUniforms.uTime.value = elapsed;
    wispUniforms.uFlow.value = Math.max(0.25, this.current.particleSpeed * this.current.flowSpeed);
    wispUniforms.uWarp.value = 0.07 + this.current.wispIntensity * 0.16;
    wispUniforms.uOpacity.value = this.current.wispIntensity * visibleAlpha;
    wispUniforms.uFlash.value = burstFlash;
    wispUniforms.uAccentAmount.value = this.current.accentAmount;
    const wispBudget = this.getWispBudget(distance);
    const activeWispCount = Math.min(this.wispMeshes.length, Math.max(0, Math.round(this.current.particleCount)), wispBudget);
    for (let index = 0; index < this.wispMeshes.length; index += 1) {
      const wisp = this.wispMeshes[index];
      const angle = this.phase + index * Math.PI * 0.5 + elapsed * (0.12 + this.current.flowSpeed * 0.05);
      const sideOffset = this.current.radius * 0.16;
      wisp.visible = index < activeWispCount;
      if (!wisp.visible) continue;
      wisp.position.set(
        Math.cos(angle) * sideOffset,
        this.current.height * (0.47 + Math.sin(elapsed * this.current.flowSpeed + index) * 0.025),
        Math.sin(angle) * sideOffset
      );
      wisp.rotation.y = angle + Math.PI * 0.5;
      const width = this.current.radius * (1.25 + 0.12 * Math.sin(elapsed * 0.7 + index));
      wisp.scale.set(width, this.current.height * (1.03 + 0.04 * Math.sin(elapsed * 0.55 + index)), 1);
    }

    this.updateSprites(elapsed, pulse01, visibleAlpha, burstFlash);
    this.updateGroundRing(elapsed, pulse01, visibleAlpha, distance);
    this.updateBurstRing(delta, elapsed, visibleAlpha);
  }

  getDebugState(): StreakAuraDebugState {
    return {
      streak: this.streak,
      tierKey: getStreakAuraTierKey(this.streak),
      persistentActive: this.persistentActive,
      shuttingDown: this.shutdownElapsed >= 0,
      visible: this.group.visible
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.parent?.remove(this.group);
    this.outerShell.material.dispose();
    this.innerShell.material.dispose();
    this.wispMaterial.dispose();
    this.coreGlow.material.dispose();
    this.energySprites.forEach((sprite) => sprite.material.dispose());
    this.groundRing.material.dispose();
    this.burstRing.material.dispose();
    releaseSharedResources();
  }

  private startThresholdBurst(tier: StreakAuraTier) {
    this.burstInnerColor.set(tier.innerColor);
    this.burstOuterColor.set(tier.outerColor);
    this.burstAccentColor.set(tier.accentColor ?? tier.outerColor);
    this.burstAccentAmount = tier.accentColor ? 0.24 : 0;
    this.burstElapsed = 0;
    this.burstDuration = 0.46;
    this.burstStrength = tier.burstIntensity;
    this.burstKind = "threshold";
    this.group.visible = true;
  }

  private startShutdown() {
    this.burstInnerColor.copy(this.current.innerColor);
    this.burstOuterColor.copy(this.current.outerColor);
    this.burstAccentColor.copy(this.current.accentColor);
    this.burstAccentAmount = this.current.accentAmount;
    this.shutdownElapsed = 0;
    this.burstElapsed = 0;
    this.burstDuration = 0.72;
    this.burstStrength = Math.max(0.42, this.current.burstIntensity);
    this.burstKind = "shutdown";
    this.targetValues.innerColor.copy(this.current.innerColor);
    this.targetValues.outerColor.copy(this.current.outerColor);
    this.targetValues.accentColor.copy(this.current.accentColor);
    setTierValues(this.targetValues, null);
    this.group.visible = true;
  }

  private advanceBurst(delta: number) {
    if (this.burstElapsed < 0) return;
    this.burstElapsed += Math.max(0, delta);
    if (this.burstElapsed >= this.burstDuration) {
      this.burstElapsed = -1;
      this.burstKind = undefined;
      this.burstRing.visible = false;
    }
  }

  private getBurstFlash() {
    if (this.burstElapsed < 0 || this.burstDuration <= 0) return 0;
    const progress = clamp01(this.burstElapsed / this.burstDuration);
    return this.burstKind === "shutdown"
      ? (1 - progress) * this.burstStrength
      : (progress < 0.22 ? progress / 0.22 : 1 - smoothStep(clamp01((progress - 0.22) / 0.78))) * this.burstStrength;
  }

  private getWispBudget(distance: number) {
    const qualityBudget = this.detail === 0 ? 1 : this.detail === 1 ? 3 : 4;
    if (distance <= 35) return qualityBudget;
    if (distance <= 90) return Math.max(1, qualityBudget - 1);
    return 0;
  }

  private updateSprites(elapsed: number, pulse01: number, visibleAlpha: number, burstFlash: number) {
    const height = this.current.height;
    const radius = this.current.radius;
    this.coreGlow.position.set(0, height * 0.46, 0);
    this.coreGlow.material.color.copy(this.current.innerColor);
    this.coreGlow.scale.setScalar(Math.max(0.001, this.current.coreRadius * (2.35 + pulse01 * 0.2)));
    this.coreGlow.material.opacity = this.coreGlow.visible
      ? this.current.coreOpacity * 1.18 * visibleAlpha * (0.78 + pulse01 * 0.22 + burstFlash * 0.6)
      : 0;

    const energyVisible = this.detail > 0;
    const flow = elapsed * Math.max(0.25, this.current.flowSpeed);
    const energyOpacity = this.current.wispIntensity * 0.75 * visibleAlpha * (0.72 + pulse01 * 0.28 + burstFlash * 0.45);
    for (let index = 0; index < this.energySprites.length; index += 1) {
      const sprite = this.energySprites[index];
      const angle = this.phase + flow * (index === 0 ? 0.72 : -0.63) + index * Math.PI;
      const vertical = height * (index === 0 ? 0.32 : 0.6) + Math.sin(flow * 1.2 + index) * height * 0.06;
      const isAccentSprite = index === 1 && this.current.accentAmount > 0.01;
      sprite.material.color.copy(isAccentSprite ? this.current.accentColor : this.current.outerColor);
      sprite.visible = energyVisible && Boolean(sprite.material.map);
      if (!sprite.visible) continue;
      sprite.position.set(
        Math.cos(angle) * radius * 0.46,
        vertical,
        Math.sin(angle) * radius * 0.46
      );
      sprite.scale.setScalar(Math.max(0.001, radius * (0.82 + pulse01 * 0.12)));
      const opacityScale = index === 0
        ? 1
        : isAccentSprite
          ? Math.min(0.48, this.current.accentAmount * 1.8)
          : 0.8;
      sprite.material.opacity = energyOpacity * opacityScale;
      sprite.material.rotation = angle * 0.4;
    }
  }

  private updateGroundRing(elapsed: number, pulse01: number, visibleAlpha: number, distance: number) {
    const ringAllowed = this.detail > 0 && distance <= 90 && this.current.ringOpacity > 0.001;
    this.groundRing.visible = ringAllowed;
    this.groundRing.material.color.copy(this.current.outerColor);
    if (!ringAllowed) {
      this.groundRing.material.opacity = 0;
      return;
    }
    this.groundRing.scale.setScalar(Math.max(0.001, this.current.radius * (1.72 + pulse01 * 0.1)));
    this.groundRing.material.opacity = this.current.ringOpacity
      * visibleAlpha
      * (0.78 + pulse01 * 0.22)
      * (0.9 + 0.1 * Math.sin(elapsed * 1.4 + this.phase));
  }

  private updateBurstRing(delta: number, elapsed: number, visibleAlpha: number) {
    if (this.burstElapsed < 0 || this.burstDuration <= 0) {
      this.burstRing.visible = false;
      return;
    }
    const progress = clamp01(this.burstElapsed / this.burstDuration);
    const radius = Math.max(0.12, this.current.radius, this.targetValues.radius);
    this.burstRing.visible = true;
    const flash = this.getBurstFlash();
    this.burstRing.material.color.copy(this.burstOuterColor);
    this.burstRing.material.color.lerp(this.burstInnerColor, clamp01(flash * 1.15));
    if (this.burstKind === "threshold" && this.burstAccentAmount > 0) {
      const accentMix = smoothStep(clamp01((progress - 0.56) / 0.32)) * this.burstAccentAmount * 0.36;
      this.burstRing.material.color.lerp(this.burstAccentColor, accentMix);
    }
    if (this.burstKind === "shutdown") {
      this.burstRing.scale.setScalar(radius * (1.8 - smoothStep(progress) * 0.9));
      this.burstRing.material.opacity = (1 - progress) * this.burstStrength * visibleAlpha * 0.55;
    } else {
      this.burstRing.scale.setScalar(radius * (0.24 + smoothStep(progress) * 1.35));
      this.burstRing.material.opacity = (1 - progress) ** 1.35 * this.burstStrength * visibleAlpha * 0.7;
    }
    this.burstRing.rotation.z = elapsed * 0.65 + this.phase;
    this.advanceBurst(delta);
  }
}
