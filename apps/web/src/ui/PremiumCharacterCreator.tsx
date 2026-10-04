import { useSiteTranslation } from "./siteTranslation";
import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import {
  APPEARANCE_UPDATE_COOLDOWN_MS,
  COSMETIC_CATALOG,
  DEFAULT_PLAYER_APPEARANCE,
  sanitizePlayerAppearance,
  type CharacterCustomizationSettings,
  type CosmeticProgress,
  type CosmeticSlot,
  type PlayerAppearance,
  type Team
} from "@quizstrike/shared";
import { Award, Backpack, Check, Dice5, Footprints, Lock, RotateCcw, Smile, UserRound, X, Play, Shirt, ScanFace, Sparkles, Pencil } from "lucide-react";
import WardrobeBadgeEditor from "./WardrobeBadgeEditor";
import {
  BACK_ACCESSORY_OPTIONS,
  CharacterPreview,
  FOOTWEAR_OPTIONS,
  HEAD_STYLE_OPTIONS,
  VICTORY_POSE_OPTIONS
} from "./CharacterCreator";

import "./wardrobeStudio.css";

type PremiumCharacterCreatorProps = {
  appearance?: PlayerAppearance;
  team: Team;
  policy: CharacterCustomizationSettings;
  progress: CosmeticProgress;
  disabled?: boolean;
  nonCombat?: boolean;
  onSave: (appearance: PlayerAppearance) => Promise<void>;
  onUploadDecal: (blob: Blob) => Promise<string>;
  loadDecalAsset: (assetId: string) => Promise<Blob>;
};

const appearanceSignature = (appearance: PlayerAppearance) => JSON.stringify(appearance);

export default function PremiumCharacterCreator({
  appearance,
  team,
  policy,
  nonCombat = false,
  progress,
  disabled,
  onSave,
  onUploadDecal,
  loadDecalAsset
}: PremiumCharacterCreatorProps) {
  const { t } = useSiteTranslation();
  const initial = useMemo(() => sanitizePlayerAppearance(appearance), [appearance]);
  const [draft, setDraft] = useState<PlayerAppearance>(initial);
  const [savedSignature, setSavedSignature] = useState(appearanceSignature(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const [activeCategory, setActiveCategory] = useState<CosmeticSlot>("head");
  const availableBackAccessories = useMemo(
    () => nonCombat
      ? BACK_ACCESSORY_OPTIONS.filter((option) => option.value !== "samurai_sword" && option.value !== "twin_swords")
      : BACK_ACCESSORY_OPTIONS,
    [nonCombat]
  );
  const [portrait, setPortrait] = useState(false);
  const [fullOutfit, setFullOutfit] = useState(false);
  const [arenaGear, setArenaGear] = useState(false);
  const [replaySignal, setReplaySignal] = useState(0);
  const [localBadge, setLocalBadge] = useState<Blob | null>(null);
  const panelId = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSubmittedSignature = useRef("");

  useEffect(() => {
    const next = sanitizePlayerAppearance(appearance);
    const nextSignature = appearanceSignature(next);
    setSavedSignature(nextSignature);
    setDraft((current) => {
      const currentSignature = appearanceSignature(current);
      return currentSignature === savedSignature || currentSignature === lastSubmittedSignature.current
        ? next
        : current;
    });
  }, [appearance, savedSignature]);

  const dirty = appearanceSignature(draft) !== savedSignature;

  const save = useCallback(async (next = draft) => {
    if (saving || disabled) return;
    const safeNext = sanitizePlayerAppearance(next);
    lastSubmittedSignature.current = appearanceSignature(safeNext);
    setSaving(true);
    setError("");
    let finalError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await onSave(safeNext);
        setSavedSignature(lastSubmittedSignature.current);
        setSaving(false);
        return;
      } catch (reason) {
        finalError = reason;
        const message = reason instanceof Error ? reason.message : "";
        const canRetryCooldown = attempt === 0 && /wait a moment/i.test(message);
        if (!canRetryCooldown) break;
        await new Promise((resolve) =>
          window.setTimeout(resolve, APPEARANCE_UPDATE_COOLDOWN_MS + 150)
        );
      }
    }

    setError(finalError instanceof Error ? finalError.message : "We couldn’t save your player style. Try again.");
    setSaving(false);
  }, [disabled, draft, onSave, saving]);

  useEffect(() => {
    if (!dirty || disabled || saving || error) return;
    const timeout = window.setTimeout(() => void save(draft), 950);
    return () => window.clearTimeout(timeout);
  }, [dirty, draft, disabled, saving, error, save]);

  const updateDraft = (makeNext: (current: PlayerAppearance) => PlayerAppearance) => {
    setError("");
    setDraft((current) => sanitizePlayerAppearance(makeNext(current)));
  };

  const unlockLevel = (slot: CosmeticSlot, id: string) =>
    COSMETIC_CATALOG.find((item) => item.slot === slot && item.id === id)?.unlockLevel ?? 1;
  const isUnlocked = (slot: CosmeticSlot, id: string) => unlockLevel(slot, id) <= progress.level;

  const randomize = () => {
    const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)];
    const head = pick(HEAD_STYLE_OPTIONS.filter((option) => isUnlocked("head", option.id)));
    const back = pick(availableBackAccessories.filter((option) => isUnlocked("back", option.value)));
    const footwear = pick(FOOTWEAR_OPTIONS.filter((option) => isUnlocked("footwear", option.value)));
    const pose = pick(VICTORY_POSE_OPTIONS.filter((option) => isUnlocked("pose", option.value)));
    updateDraft((current) => ({
      ...current,
      headStyleId: head.id,
      backAccessoryId: back.value,
      footwearId: footwear.value,
      victoryPoseId: pose.value,
      decalAssetId: current.decalAssetId
    }));
  };

  if (!policy.enabled) {
    return (
      <div className="customization-locked">
        <Check size={20} />
        <span>{t("Your teacher has turned off player styling. Your default player is ready.")}</span>
      </div>
    );
  }

  const categories = [
    { id: "head", label: "Head", title: "Find your character", detail: "A little personality. A whole new look.", Icon: UserRound },
    { id: "back", label: "Back", title: "Make an entrance", detail: "Wings, packs and a little extra flair.", Icon: Backpack },
    { id: "footwear", label: "Footwear", title: "Finish your fit", detail: "From the first step to the victory lap.", Icon: Footprints },
    { id: "pose", label: "Victory pose", title: "Own the celebration", detail: "Pick your signature victory moment.", Icon: Smile }
  ] as const;
  const category = categories.find(item => item.id === activeCategory)!;
  const catalogs = {
    head: HEAD_STYLE_OPTIONS.map(item => ({ ...item, description: item.description })),
    back: availableBackAccessories.map(item => ({ ...item, id: item.value, description: item.detail })),
    footwear: FOOTWEAR_OPTIONS.map(item => ({ ...item, id: item.value, description: item.detail })),
    pose: VICTORY_POSE_OPTIONS.map(item => ({ ...item, id: item.value, description: item.detail }))
  };
  const items = catalogs[activeCategory];
  const selectedId = { head: draft.headStyleId, back: draft.backAccessoryId, footwear: draft.footwearId, pose: draft.victoryPoseId }[activeCategory];
  const selected = items.find(item => item.id === selectedId);
  const selectedHead = HEAD_STYLE_OPTIONS.find(item => item.id === draft.headStyleId)!;
  const selectCategory = (id: CosmeticSlot) => {
    setActiveCategory(id); setPortrait(false); setFullOutfit(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const recipes = [
    { name: "Fresh start", head: "boy_short_hair", back: "utility_pack", footwear: "runners", pose: "wave" },
    { name: "Foxfire", head: "fox", back: "devil_tail", footwear: "basketball_shoes", pose: "power" },
    { name: "Sky angel", head: "girl_mid_hair", back: "angel_wings", footwear: "runners", pose: "champion" },
    { name: "Shadow runner", head: "ninja", back: "arena_cape", footwear: "skate_shoes", pose: "salute" },
    { name: "Arcade bot", head: "robot", back: "boost_pack", footwear: "army_boots", pose: "wave" }
  ] as const;

  return (
    <section className={`character-creator premium-character-creator wardrobe-studio team-${team}`} aria-label={t("Player style")}>
      <div className="character-creator-preview-column">
        <div className="preview-heading">
          <div><span className={`team-marker team-${team}`}>{nonCombat ? t("Runner") : team === "blue" ? t("Blue team") : t("Red team")}</span><h3>{t("Your player")}</h3></div>
          <button className="icon-action" type="button" onClick={() => setCameraResetSignal(value => value + 1)} aria-label={t("Reset player preview")}>
            <RotateCcw size={16} aria-hidden="true" />{t("Reset preview")}
          </button>
        </div>
        <div className="wardrobe-stage">
          <span className="wardrobe-live"><span />{t("Live preview")}</span>
          <div className="wardrobe-view-switch" role="group" aria-label={t("Preview view")}>
            <button type="button" aria-pressed={activeCategory === "head" ? !portrait : fullOutfit || activeCategory === "pose"} onClick={() => { setPortrait(false); setFullOutfit(true); }} title={t("Full outfit")}><Shirt size={16} aria-hidden="true" /><span>{t("Full outfit")}</span></button>
            {activeCategory === "head" && <button type="button" aria-pressed={portrait} onClick={() => setPortrait(true)} title={t("Close-up")}><ScanFace size={16} aria-hidden="true" /><span>{t("Close-up")}</span></button>}
            {(activeCategory === "back" || activeCategory === "footwear") && <button type="button" aria-pressed={!fullOutfit} onClick={() => setFullOutfit(false)} title={t("Item detail")}><ScanFace size={16} aria-hidden="true" /><span>{t("Item detail")}</span></button>}
          </div>
          <CharacterPreview appearance={draft} team={team} loadDecalAsset={loadDecalAsset} localDecal={localBadge} resetSignal={cameraResetSignal}
            showVictoryPose={activeCategory === "pose"} focusBack={activeCategory === "back" && !fullOutfit} focusFootwear={activeCategory === "footwear" && !fullOutfit}
            focusHead={portrait} showWeapon={arenaGear && !nonCombat && activeCategory !== "pose"} replaySignal={replaySignal} allowCombatAccessories={!nonCombat} />
          <div className="wardrobe-stage-caption"><span>{t(activeCategory === "pose" ? "Signature move" : "Your look")}</span><strong>{t(activeCategory === "head" ? selectedHead.label : selected?.label)}</strong></div>
          {activeCategory === "pose" ? <button type="button" className="wardrobe-replay" onClick={() => setReplaySignal(value => value + 1)}><Play size={15} aria-hidden="true" />{t("Replay pose")}</button>
            : !nonCombat && <label className="wardrobe-gear-toggle"><input type="checkbox" checked={arenaGear} onChange={event => setArenaGear(event.target.checked)} />{t("Arena gear")}</label>}
        </div>
        <p className="preview-hint"><RotateCcw size={13} aria-hidden="true" />{t("Drag to rotate")}<span />{t("Scroll to zoom")}</p>
      </div>

      <div className="character-creator-controls">
        <div className="customizer-heading">
          <div className="customizer-title-row">
            <div><span className="wardrobe-eyebrow">{t("Player locker")}</span><h3>{t("Make it yours")}</h3></div>
            <div className="cosmetic-level"><Award size={18} aria-hidden="true" /><span>{t("Level")} {progress.level}</span><strong>{t(progress.levelName)}</strong></div>
          </div>
          <div className="cosmetic-progress" role="progressbar" aria-label={t("Style level progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progressPercent}><span style={{ width: `${progress.progressPercent}%` }} /></div>
          <p>{progress.nextLevelXp === undefined ? t("Every style is unlocked") : t("{value0} XP to unlock the next style", { value0: progress.nextLevelXp - progress.xp })}</p>
        </div>
        <div className="cosmetic-category-tabs" ref={tabsRef} role="tablist" aria-label={t("Player style categories")} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const focusedIndex = Array.from(event.currentTarget.querySelectorAll('[role="tab"]')).indexOf(document.activeElement as Element);
          const index = focusedIndex >= 0 ? focusedIndex : categories.findIndex(item => item.id === activeCategory);
          const next = event.key === "Home" ? 0 : event.key === "End" ? categories.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + categories.length) % categories.length;
          selectCategory(categories[next].id);
          (tabsRef.current?.children[next] as HTMLButtonElement | undefined)?.focus();
        }}>
          {categories.map(item => <button type="button" role="tab" key={item.id} id={`${panelId}-${item.id}`} aria-controls={`${panelId}-panel`} tabIndex={activeCategory === item.id ? 0 : -1}
            className={activeCategory === item.id ? "selected" : ""} aria-selected={activeCategory === item.id} onClick={() => selectCategory(item.id)}>
            <item.Icon size={18} aria-hidden="true" /><span>{t(item.label)}</span>
          </button>)}
        </div>
        <div className="creator-controls-scroll" ref={scrollRef} role="tabpanel" id={`${panelId}-panel`} aria-labelledby={`${panelId}-${activeCategory}`} tabIndex={0}>
          <div className="wardrobe-category-heading"><div><h4>{t(category.title)}</h4><p>{t(category.detail)}</p></div><span>{items.length} {t("styles")}</span></div>
          <fieldset className="creator-option-section accessory-options cosmetic-catalog-grid">
            <legend className="wardrobe-sr-only">{t(category.label)}</legend>
            <div className="accessory-card-grid wardrobe-item-grid">
              {items.map(item => {
                const level = unlockLevel(activeCategory, item.id), locked = level > progress.level;
                const equipped = item.id === selectedId;
                return <button type="button" key={item.id} className={equipped ? "selected" : ""} aria-pressed={equipped} disabled={disabled || locked}
                  aria-label={`${t(item.label)}${locked ? ` · ${t("Style level {value0}", { value0: level })}` : ""}`}
                  title={t(item.description)} onClick={() => {
                    const field = { head: "headStyleId", back: "backAccessoryId", footwear: "footwearId", pose: "victoryPoseId" }[activeCategory];
                    updateDraft(current => ({ ...current, [field]: item.id }));
                  }}>
                  <span className="cosmetic-card-icon cosmetic-image-preview">
                    <item.Icon className="cosmetic-image-fallback" size={32} aria-hidden="true" />
                    <img src={item.thumbnail} alt="" aria-hidden="true" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} />
                  </span>
                  <span className="wardrobe-item-copy"><strong>{t(item.label)}</strong><small>{locked ? t("Style level {value0}", { value0: level }) : equipped ? t("Equipped") : t(item.description)}</small></span>
                  {locked ? <Lock className="cosmetic-lock" size={15} aria-hidden="true" /> : equipped && <Check className="cosmetic-check" size={15} aria-hidden="true" />}
                </button>;
              })}
            </div>
          </fieldset>
          <details className="wardrobe-recipes"><summary><Sparkles size={15} aria-hidden="true" />{t("Quick looks")}<span>{t("Try a complete outfit")}</span></summary>
            <div>{recipes.map(recipe => {
              const locked = !isUnlocked("head", recipe.head) || !isUnlocked("back", recipe.back) || !isUnlocked("footwear", recipe.footwear) || !isUnlocked("pose", recipe.pose);
              return <button type="button" key={recipe.name} disabled={disabled || locked} onClick={() => updateDraft(current => ({ ...current, headStyleId: recipe.head, backAccessoryId: recipe.back, footwearId: recipe.footwear, victoryPoseId: recipe.pose }))}>
                <img src={HEAD_STYLE_OPTIONS.find(item => item.id === recipe.head)?.thumbnail} alt="" />{t(recipe.name)}{locked && <Lock size={12} aria-hidden="true" />}
              </button>;
            })}</div>
          </details>
          {policy.uploadsEnabled && <details className="wardrobe-recipes"><summary><Pencil size={15} aria-hidden="true" />{t("Your signature badge")}<span>{t("Draw it. Wear it.")}</span></summary>
            <WardrobeBadgeEditor disabled={disabled} onPreview={setLocalBadge} onApply={async blob => {
              const assetId = await onUploadDecal(blob);
              updateDraft(current => ({ ...current, decalAssetId: assetId }));
              setLocalBadge(null);
            }} />
          </details>}
          {(localBadge || draft.decalAssetId) && <button type="button" className="wardrobe-remove-badge" disabled={disabled} onClick={() => {
            if (localBadge) setLocalBadge(null);
            else updateDraft(current => ({ ...current, decalAssetId: undefined }));
          }}><X size={14} aria-hidden="true" />{t(localBadge ? "Discard badge preview" : "Remove badge")}</button>}
        </div>
      </div>
      <footer className="creator-footer">
        <div className="creator-actions"><button type="button" onClick={randomize} disabled={disabled}><Dice5 size={17} aria-hidden="true" />{t("Surprise me")}</button>
          <button type="button" onClick={() => updateDraft(() => ({ ...DEFAULT_PLAYER_APPEARANCE }))} disabled={disabled}><RotateCcw size={16} aria-hidden="true" />{t("Reset player")}</button></div>
        <div className="save-cluster"><div className="save-state-copy"><div className={`appearance-save-state${dirty || saving ? " pending" : ""}${error ? " failed" : ""}`} role="status" aria-live="polite">
          {error ? <><X size={15} aria-hidden="true" />{t("Couldn’t save")}</> : saving ? <><span className="saving-dot" />{t("Saving player style…")}</> : dirty ? t("Unsaved changes") : localBadge ? t("Badge preview · choose Use badge to save") : <><Check size={15} aria-hidden="true" />{t("Player style saved")}</>}
        </div>{error && <small className="save-error-detail">{t(error)}</small>}</div>
          {(dirty || error) && <button className="primary save-appearance" type="button" onClick={() => void save()} disabled={disabled || saving}>{error ? t("Try again") : t("Save style")}</button>}
        </div>
      </footer>
    </section>
  );
}
