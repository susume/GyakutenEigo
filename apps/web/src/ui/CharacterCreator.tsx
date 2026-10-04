import { useSiteTranslation } from "./siteTranslation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
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
import { CharacterPreviewScene, type WardrobeView } from "./CharacterPreviewScene";


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
  appearance, team, loadDecalAsset, localDecal, resetSignal = 0,
  showVictoryPose = false, focusBack = false, focusFootwear = false,
  focusHead = false, showWeapon = false, replaySignal = 0, allowCombatAccessories = true
}: {
  appearance: PlayerAppearance; team: Team;
  loadDecalAsset: (assetId: string) => Promise<Blob>; localDecal?: Blob | null;
  resetSignal?: number; showVictoryPose?: boolean; focusBack?: boolean;
  focusFootwear?: boolean; focusHead?: boolean; showWeapon?: boolean; replaySignal?: number; allowCombatAccessories?: boolean;
}) {
  const { t } = useSiteTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const controller = useRef<CharacterPreviewScene | null>(null);
  const loadRef = useRef(loadDecalAsset); loadRef.current = loadDecalAsset;
  const localDecalId = useMemo(() => localDecal ? crypto.randomUUID() : undefined, [localDecal]);
  const localDecalRef = useRef({ blob: localDecal, id: localDecalId });
  localDecalRef.current = { blob: localDecal, id: localDecalId };
  const previewAppearance = useMemo(() => localDecalId ? { ...appearance, decalAssetId: localDecalId } : appearance, [appearance, localDecalId]);
  const [previewError, setPreviewError] = useState("");
  const view: WardrobeView = focusFootwear ? "footwear" : focusBack ? "back" : focusHead ? "portrait" : "outfit";
  const current = useRef({ appearance: previewAppearance, showWeapon, view, showVictoryPose, allowCombatAccessories });
  current.current = { appearance: previewAppearance, showWeapon, view, showVictoryPose, allowCombatAccessories };

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const makeTexture = async (assetId: string) => {
      const local = localDecalRef.current;
      const blob = local.id === assetId && local.blob ? local.blob : await loadRef.current(assetId);
      const url = URL.createObjectURL(blob);
      try { return await new THREE.TextureLoader().loadAsync(url); }
      finally { URL.revokeObjectURL(url); }
    };
    try {
      const preview = new CharacterPreviewScene(mount, team, makeTexture);
      controller.current = preview;
      preview.setAppearance(current.current.appearance, team, current.current.showWeapon, current.current.allowCombatAccessories);
      preview.setView(current.current.view, current.current.showVictoryPose);
      setPreviewError("");
      return () => { preview.dispose(); controller.current = null; };
    } catch {
      setPreviewError("The 3D preview couldn’t load. Your style choices will still save.");
    }
  }, [team]);
  useEffect(() => {
    controller.current?.setAppearance(previewAppearance, team, showWeapon, allowCombatAccessories);
  }, [previewAppearance, team, showWeapon, allowCombatAccessories]);
  useEffect(() => { controller.current?.setView(view, showVictoryPose); }, [view, showVictoryPose]);
  useEffect(() => { if (resetSignal) controller.current?.reset(); }, [resetSignal]);
  useEffect(() => { if (replaySignal) controller.current?.playPose(); }, [replaySignal]);

  return (
    <div className="wardrobe-preview-wrap">
      <div ref={mountRef} className={`character-preview team-${team}`} role="img"
        aria-label={t("Live player preview. Drag to rotate and scroll to zoom.")} />
      {previewError && <p className="wardrobe-preview-error" role="status">{t(previewError)}</p>}
      <div className="wardrobe-camera-controls" role="group" aria-label={t("Preview camera controls")}>
        <button type="button" aria-label={t("Rotate player left")} onClick={() => controller.current?.rotate(-1)}><ArrowLeft size={17} aria-hidden="true" /></button>
        <button type="button" aria-label={t("Rotate player right")} onClick={() => controller.current?.rotate(1)}><ArrowRight size={17} aria-hidden="true" /></button>
        <span />
        <button type="button" aria-label={t("Zoom out")} onClick={() => controller.current?.changeZoom(-1)}><ZoomOut size={17} aria-hidden="true" /></button>
        <button type="button" aria-label={t("Zoom in")} onClick={() => controller.current?.changeZoom(1)}><ZoomIn size={17} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
