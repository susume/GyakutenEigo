import { useEffect, useRef } from "react";
import * as THREE from "three";
import type {
  PlayerBackAccessoryId,
  PlayerAppearance,
  PlayerFootwearId,
  PlayerHeadStyleId,
  PlayerVictoryPoseId,
  Team
} from "@quizstrike/shared";
import { FOOTWEAR_CATALOG, HEAD_STYLE_CATALOG } from "@quizstrike/shared";
import {
  Backpack,
  Bot,
  Cat,
  Circle,
  Crown,
  Feather,
  Flame,
  Footprints,
  Mountain,
  Rabbit,
  RectangleHorizontal,
  Rocket,
  Rotate3d,
  Shield,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sword,
  UserRound,
  Volleyball,
  Waves,
  Zap,
  X,
  type LucideIcon
} from "lucide-react";
import { CharacterFactory } from "../game/characters/CharacterFactory";

const appearanceSignature = (appearance: PlayerAppearance) => JSON.stringify(appearance);

const customizationThumbnail = (
  category: "head" | "back" | "footwear" | "victory",
  id: string
) => `${import.meta.env.BASE_URL}assets/customization-thumbnails/${category}/${id}.png`;

const HEAD_STYLE_ICONS: Record<PlayerHeadStyleId, LucideIcon> = {
  boy_short_hair: UserRound,
  girl_mid_hair: Sparkles,
  fox: Cat,
  panda: Circle,
  bear: Shield,
  rabbit: Rabbit,
  great_white: Waves,
  robot: Bot,
  samurai: Sword,
  ninja: UserRound
};

export const HEAD_STYLE_OPTIONS: ReadonlyArray<{
  id: PlayerHeadStyleId;
  label: string;
  description: string;
  Icon: LucideIcon;
  thumbnail: string;
}> = HEAD_STYLE_CATALOG.map((style) => ({
  id: style.id,
  label: style.name,
  description: style.description,
  Icon: HEAD_STYLE_ICONS[style.id],
  thumbnail: customizationThumbnail("head", style.id)
}));

export const BACK_ACCESSORY_OPTIONS: ReadonlyArray<{
  value: PlayerBackAccessoryId;
  label: string;
  detail: string;
  Icon: LucideIcon;
  thumbnail: string;
}> = ([
  { value: "none", label: "None", detail: "Keep it simple", Icon: X },
  { value: "utility_pack", label: "Utility Pack", detail: "Classic field pack", Icon: Backpack },
  { value: "angel_wings", label: "Angel Wings", detail: "A light, bright look", Icon: Feather },
  { value: "demon_wings", label: "Demon Wings", detail: "A bold, dramatic look", Icon: Flame },
  { value: "devil_tail", label: "Devil Tail", detail: "A playful twist", Icon: Flame },
  { value: "samurai_sword", label: "Samurai Sword", detail: "Warrior style", Icon: Sword },
  { value: "twin_swords", label: "Twin Swords", detail: "Double warrior style", Icon: Sword },
  { value: "boost_pack", label: "Boost Pack", detail: "Ready to go", Icon: Rocket },
  { value: "arena_cape", label: "Arena Cape", detail: "A champion’s finish", Icon: Shield },
  { value: "snowboard", label: "Snowboard", detail: "A relaxed winter look", Icon: Snowflake }
] satisfies ReadonlyArray<{
  value: PlayerBackAccessoryId;
  label: string;
  detail: string;
  Icon: LucideIcon;
}>).map((option) => ({
  ...option,
  thumbnail: customizationThumbnail("back", option.value)
}));

const FOOTWEAR_ICONS: Record<PlayerFootwearId, LucideIcon> = {
  runners: Zap,
  army_boots: Mountain,
  skate_shoes: RectangleHorizontal,
  basketball_shoes: Volleyball,
  sandals: Waves,
  barefoot: Footprints
};

export const FOOTWEAR_OPTIONS: ReadonlyArray<{
  value: PlayerFootwearId;
  label: string;
  detail: string;
  Icon: LucideIcon;
  thumbnail: string;
}> = FOOTWEAR_CATALOG.map((footwear) => ({
  value: footwear.id,
  label: footwear.name,
  detail: footwear.description,
  Icon: FOOTWEAR_ICONS[footwear.id],
  thumbnail: customizationThumbnail("footwear", footwear.id)
}));

export const VICTORY_POSE_OPTIONS: ReadonlyArray<{
  value: PlayerVictoryPoseId;
  label: string;
  detail: string;
  Icon: LucideIcon;
  thumbnail: string;
}> = ([
  { value: "champion", label: "Champion", detail: "Celebrate the win", Icon: Crown },
  { value: "wave", label: "Friendly wave", detail: "Say hello", Icon: Waves },
  { value: "salute", label: "Team salute", detail: "Ready for the round", Icon: ShieldCheck },
  { value: "power", label: "Power pose", detail: "Finish with confidence", Icon: Rotate3d }
] satisfies ReadonlyArray<{
  value: PlayerVictoryPoseId;
  label: string;
  detail: string;
  Icon: LucideIcon;
}>).map((option) => ({
  ...option,
  thumbnail: customizationThumbnail("victory", option.value)
}));

export function CharacterPreview({
  appearance,
  team,
  loadDecalAsset,
  localDecal,
  resetSignal = 0,
  showVictoryPose = false,
  focusBack = false,
  focusFootwear = false
}: {
  appearance: PlayerAppearance;
  team: Team;
  loadDecalAsset: (assetId: string) => Promise<Blob>;
  localDecal?: Blob | null;
  resetSignal?: number;
  showVictoryPose?: boolean;
  focusBack?: boolean;
  focusFootwear?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(loadDecalAsset);
  loadRef.current = loadDecalAsset;

  const appearanceKey = appearanceSignature(appearance);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    const compactLandscape = window.innerHeight <= 620 && window.innerWidth >= 901;
    const minDistance = 12.5;
    const maxDistance = 19;
    let distance = focusFootwear ? (compactLandscape ? 14.5 : 15.1) : (compactLandscape ? 15.2 : 16.1);
    camera.position.set(0.45, focusFootwear ? 2.25 : (compactLandscape ? 2.5 : 2.55), distance);
    camera.lookAt(0, focusFootwear ? 1.8 : (compactLandscape ? 1.95 : 2), 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#e9f7ff", "#152b42", 1.8));
    const key = new THREE.DirectionalLight("#fff6df", 2.7);
    key.position.set(4.5, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#74d7ff", 1.35);
    fill.position.set(-5, 3, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(team === "blue" ? "#31b6ff" : "#ff6b46", 2.2);
    rim.position.set(-3, 4, -5);
    scene.add(rim);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.35, 0.2, 48),
      new THREE.MeshStandardMaterial({
        color: team === "blue" ? "#143b59" : "#4b2932",
        roughness: 0.66,
        metalness: 0.12
      })
    );
    platform.position.y = -0.24;
    platform.receiveShadow = true;
    scene.add(platform);
    const platformRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.035, 8, 56),
      new THREE.MeshBasicMaterial({ color: team === "blue" ? "#49c8ff" : "#ff8268" })
    );
    platformRing.rotation.x = Math.PI / 2;
    platformRing.position.y = -0.125;
    scene.add(platformRing);

    const makeTexture = async (assetId: string) => {
      const blob = assetId === "00000000-0000-0000-0000-000000000000" && localDecal
        ? localDecal
        : await loadRef.current(assetId);
      const url = URL.createObjectURL(blob);
      try {
        return await new Promise<THREE.Texture>((resolve, reject) =>
          new THREE.TextureLoader().load(url, resolve, undefined, reject)
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    const previewAppearance = localDecal
      ? { ...appearance, decalAssetId: "00000000-0000-0000-0000-000000000000" }
      : appearance;
    const factory = new CharacterFactory({ loadDecalTexture: makeTexture });
    const model = factory.createCharacter({
      playerId: "lobby-preview",
      team,
      appearance: previewAppearance,
      gear: "starter_blaster"
    });
    const previewParams = new URLSearchParams(window.location.search);
    const previewView = previewParams.get("characterView");
    const presentationRotation = {
      front: Math.PI,
      left: Math.PI / 2,
      right: -Math.PI / 2,
      rear: 0,
      "three-quarter": Math.PI - 0.55,
      "rear-three-quarter": 0.55
    }[previewView ?? ""] ?? (focusBack ? 0.68 : Math.PI - 0.78);
    const previewPose = previewParams.get("characterPose");
    if (showVictoryPose || previewPose === "victory") {
      model.triggerAnimation("victory");
    } else if (previewPose === "jump") {
      model.triggerAnimation("jump");
    } else if (previewPose === "shoot") {
      model.triggerAnimation("fire");
    } else if (previewPose === "respawn") {
      model.triggerAnimation("respawn");
    }
    model.root.rotation.y = presentationRotation;
    scene.add(model.root);

    const body = model.root.getObjectByName(`stylized_humanoid_${model.appearance.variant}`);
    if (body?.userData.geometryStats) {
      mount.dataset.modelStats = JSON.stringify(body.userData.geometryStats);
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let dragging = false;
    let lastX = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    let lastTime = performance.now();
    let hasInteracted = false;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const animate = (time: number) => {
      if (document.hidden) {
        if (!reducedMotion) frame = requestAnimationFrame(animate);
        return;
      }
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      if (!reducedMotion && !dragging && !hasInteracted) {
        model.root.rotation.y = presentationRotation + Math.sin(time * 0.00042) * 0.12;
      }
      const previewSpeed = previewPose === "walk" ? 3.2 : previewPose === "sprint" ? 5.4 : 0;
      model.update({
        camera,
        delta,
        elapsed: time / 1000,
        speed: previewSpeed,
        forwardSpeed: previewSpeed,
        alive: true,
        aimPitch: previewPose === "aim" ? -0.18 : 0,
        firing: previewPose === "shoot",
        crouching: previewPose === "crouch"
      });
      renderer.render(scene, camera);
      mount.dataset.renderStats = JSON.stringify({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        pixelRatio: renderer.getPixelRatio()
      });
      if (!reducedMotion) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      }
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [first, second] = [...pointers.values()];
        const nextDistance = Math.hypot(second.x - first.x, second.y - first.y);
        if (pinchDistance > 0) {
          distance = Math.max(minDistance, Math.min(maxDistance, distance - (nextDistance - pinchDistance) * 0.02));
          camera.position.z = distance;
        }
        pinchDistance = nextDistance;
        hasInteracted = true;
        return;
      }
      model.root.rotation.y += (event.clientX - lastX) * 0.012;
      lastX = event.clientX;
      hasInteracted = true;
      if (reducedMotion) renderer.render(scene, camera);
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinchDistance = 0;
      dragging = pointers.size > 0;
      const remaining = [...pointers.values()][0];
      if (remaining) lastX = remaining.x;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = Math.max(minDistance, Math.min(maxDistance, distance + event.deltaY * 0.011));
      camera.position.z = distance;
      if (reducedMotion) renderer.render(scene, camera);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      model.dispose();
      factory.dispose();
      renderer.dispose();
      platform.geometry.dispose();
      (platform.material as THREE.Material).dispose();
      platformRing.geometry.dispose();
      (platformRing.material as THREE.Material).dispose();
      renderer.domElement.remove();
    };
  }, [appearance, appearanceKey, team, localDecal, resetSignal, showVictoryPose, focusBack, focusFootwear]);

  return (
    <div
      ref={mountRef}
      className={`character-preview team-${team}`}
      role="img"
      aria-label="Live player preview. Drag to rotate and scroll to zoom."
    />
  );
}
