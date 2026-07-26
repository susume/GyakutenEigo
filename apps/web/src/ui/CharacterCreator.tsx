import { useEffect, useRef } from "react";
import * as THREE from "three";
import type {
  PlayerBackAccessoryId,
  PlayerDetailAccessoryId,
  PlayerAppearance,
  PlayerHeadStyleId,
  PlayerVictoryPoseId,
  Team
} from "@quizstrike/shared";
import { HEAD_STYLE_CATALOG } from "@quizstrike/shared";
import {
  Badge,
  Backpack,
  Bot,
  BookOpen,
  BriefcaseBusiness,
  Cat,
  Circle,
  Crown,
  Compass,
  Flag,
  Medal,
  Package,
  Rabbit,
  Radio,
  Rocket,
  Rotate3d,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Telescope,
  UserRound,
  Watch,
  Waves,
  Wrench,
  X,
  type LucideIcon
} from "lucide-react";
import { CharacterFactory } from "../game/characters/CharacterFactory";

const appearanceSignature = (appearance: PlayerAppearance) => JSON.stringify(appearance);

export const PRESET_PRESENTATION: Record<string, { description: string; Icon: LucideIcon }> = {
  captain: { description: "Classic arena look", Icon: Shield },
  trailblazer: { description: "Sporty field kit", Icon: Sparkles },
  inventor: { description: "Workshop style", Icon: Wrench },
  scout: { description: "Light explorer kit", Icon: Telescope },
  defender: { description: "Strong silhouette", Icon: ShieldCheck },
  explorer: { description: "Adventure ready", Icon: Compass }
};

const HEAD_STYLE_ICONS: Record<PlayerHeadStyleId, LucideIcon> = {
  human: UserRound,
  fox: Cat,
  panda: Circle,
  bear: Shield,
  rabbit: Rabbit,
  robot: Bot
};

export const HEAD_STYLE_OPTIONS: ReadonlyArray<{
  id: PlayerHeadStyleId;
  label: string;
  description: string;
  Icon: LucideIcon;
}> = HEAD_STYLE_CATALOG.map((style) => ({
  id: style.id,
  label: style.name,
  description: style.description,
  Icon: HEAD_STYLE_ICONS[style.id]
}));

export const BACK_ACCESSORY_OPTIONS: ReadonlyArray<{
  value: PlayerBackAccessoryId;
  label: string;
  detail: string;
  Icon: LucideIcon;
}> = [
  { value: "none", label: "None", detail: "Clean kit", Icon: X },
  { value: "utility_pack", label: "Utility", detail: "Field pack", Icon: Backpack },
  { value: "compact_pack", label: "Compact", detail: "Light pack", Icon: BriefcaseBusiness },
  { value: "tech_pack", label: "Tech", detail: "Signal pack", Icon: Radio },
  { value: "trail_pack", label: "Trail", detail: "Adventure roll", Icon: Package },
  { value: "book_satchel", label: "Satchel", detail: "Study supplies", Icon: BookOpen },
  { value: "rocket_pack", label: "Boost pack", detail: "Cosmetic jets", Icon: Rocket },
  { value: "team_pennant", label: "Pennant", detail: "Team colours", Icon: Flag }
];

export const DETAIL_ACCESSORY_OPTIONS: ReadonlyArray<{
  value: PlayerDetailAccessoryId;
  label: string;
  detail: string;
  Icon: LucideIcon;
}> = [
  { value: "none", label: "None", detail: "Simple uniform", Icon: X },
  { value: "shoulder_badge", label: "Team crest", detail: "Shoulder badge", Icon: Badge },
  { value: "wrist_device", label: "Wrist device", detail: "Match tracker", Icon: Watch },
  { value: "quiz_medal", label: "Quiz medal", detail: "Knowledge award", Icon: Medal },
  { value: "compass_badge", label: "Compass", detail: "Explorer badge", Icon: Compass },
  { value: "champion_star", label: "Champion", detail: "Victory star", Icon: Star }
];

export const VICTORY_POSE_OPTIONS: ReadonlyArray<{
  value: PlayerVictoryPoseId;
  label: string;
  detail: string;
  Icon: LucideIcon;
}> = [
  { value: "champion", label: "Champion", detail: "Two-arm cheer", Icon: Crown },
  { value: "wave", label: "Wave", detail: "Friendly hello", Icon: Waves },
  { value: "salute", label: "Salute", detail: "Team ready", Icon: ShieldCheck },
  { value: "power", label: "Power pose", detail: "Strong finish", Icon: Rotate3d }
];

export function CharacterPreview({
  appearance,
  team,
  loadDecalAsset,
  localDecal,
  resetSignal = 0,
  showVictoryPose = false
}: {
  appearance: PlayerAppearance;
  team: Team;
  loadDecalAsset: (assetId: string) => Promise<Blob>;
  localDecal?: Blob | null;
  resetSignal?: number;
  showVictoryPose?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(loadDecalAsset);
  loadRef.current = loadDecalAsset;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    const compactLandscape = window.innerHeight <= 620 && window.innerWidth >= 901;
    let distance = compactLandscape ? 11.4 : 13.1;
    camera.position.set(0.45, compactLandscape ? 2.65 : 2.5, distance);
    camera.lookAt(0, compactLandscape ? 2.5 : 2.42, 0);
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
    }[previewView ?? ""] ?? Math.PI - 0.78;
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
          distance = Math.max(11.5, Math.min(17, distance - (nextDistance - pinchDistance) * 0.02));
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
      distance = Math.max(11.5, Math.min(17, distance + event.deltaY * 0.011));
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
  }, [appearanceSignature(appearance), team, localDecal, resetSignal, showVictoryPose]);

  return (
    <div
      ref={mountRef}
      className={`character-preview team-${team}`}
      role="img"
      aria-label="Live 3D preview. Drag to rotate and scroll to zoom."
    />
  );
}
