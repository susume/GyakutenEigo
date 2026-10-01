import { useSiteTranslation } from "./siteTranslation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Award, Backpack, Check, Dice5, Footprints, Lock, RotateCcw, Smile, UserRound, X } from "lucide-react";
import {
  BACK_ACCESSORY_OPTIONS,
  CharacterPreview,
  FOOTWEAR_OPTIONS,
  HEAD_STYLE_OPTIONS,
  VICTORY_POSE_OPTIONS
} from "./CharacterCreator";

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

  return (
    <section className="character-creator premium-character-creator" aria-label={t("Player style")}>
      <div className="character-creator-preview-column">
        <div className="preview-heading">
          <div>
            <span className={`team-marker team-${team}`}>{nonCombat ? t("Runner") : team === "blue" ? t("Blue team") : t("Red team")}</span>
            <h3>{t("Your player")}</h3>
          </div>
          <button
            className="icon-action"
            type="button"
            onClick={() => setCameraResetSignal((value) => value + 1)}
            aria-label={t("Reset player preview")}
          >
            <RotateCcw size={16} />{t("Reset preview")}</button>
        </div>
        <CharacterPreview
          appearance={draft}
          team={team}
          loadDecalAsset={loadDecalAsset}
          resetSignal={cameraResetSignal}
          showVictoryPose={activeCategory === "pose"}
          focusBack={activeCategory === "back"}
          focusFootwear={activeCategory === "footwear"}
          showWeapon={!nonCombat}
        />
        <p className="preview-hint"><RotateCcw size={13} />{t("Drag to rotate")}{" "}<span />{" "}{t("Scroll to zoom")}</p>
      </div>

      <div className="character-creator-controls">
        <div className="customizer-heading">
          <div className="customizer-title-row">
            <div><span>{t("Player style")}</span><h3>{t("Make it yours")}</h3></div>
            <div className="cosmetic-level"><Award size={15} /><span>{t("Level")}{" "}{progress.level}</span><strong>{progress.levelName}</strong></div>
          </div>
          <div className="cosmetic-progress" aria-label={t("{value0} cosmetic experience", { value0: progress.xp })}>
            <span style={{ width: `${progress.progressPercent}%` }} />
          </div>
          <p>{progress.nextLevelXp === undefined ? t("Every style is unlocked") : t("{value0} XP to unlock the next style", { value0: progress.nextLevelXp - progress.xp })}</p>
        </div>
        <div className="creator-controls-scroll">
          <div className="cosmetic-category-tabs" role="tablist" aria-label={t("Player style categories")}>
                {([
                  { id: "head", label: "Head", Icon: UserRound },
                  { id: "back", label: "Back", Icon: Backpack },
                  { id: "footwear", label: "Footwear", Icon: Footprints },
                  { id: "pose", label: "Victory pose", Icon: Smile }
                ] as const).map((category) => (
                  <button
                    type="button"
                    role="tab"
                    key={category.id}
                    className={activeCategory === category.id ? "selected" : ""}
                    aria-selected={activeCategory === category.id}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    <category.Icon size={15} />{t(category.label)}
                  </button>
                ))}
          </div>

              {activeCategory === "head" && (
                <fieldset className="creator-option-section accessory-options cosmetic-catalog-grid">
                  <legend>{t("Head style")}</legend>
                  <p className="creator-option-help">{t("Choose the look your player wears in the game.")}</p>
                  <div className="accessory-card-grid">
                    {HEAD_STYLE_OPTIONS.map((option) => {
                      const level = unlockLevel("head", option.id);
                      const locked = level > progress.level;
                      return (
                        <button
                          type="button"
                          key={option.id}
                          className={draft.headStyleId === option.id ? "selected" : ""}
                          onClick={() => updateDraft((current) => ({ ...current, headStyleId: option.id }))}
                          aria-pressed={draft.headStyleId === option.id}
                          disabled={disabled || locked}
                          title={locked ? t("Unlocks at style level {value0}", { value0: level }) : t(option.label)}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview">
                            <option.Icon className="cosmetic-image-fallback" size={21} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{t(option.label)}</strong><small>{locked ? t("Style level {value0}", { value0: level }) : t(option.description)}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
                          {!locked && draft.headStyleId === option.id && <Check className="cosmetic-check" size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {activeCategory === "back" && (
                <fieldset className="creator-option-section accessory-options cosmetic-catalog-grid">
                  <legend>{t("Back gear · choose one")}</legend>
                  <div className="accessory-card-grid">
                    {availableBackAccessories.map((option) => {
                      const level = unlockLevel("back", option.value);
                      const locked = level > progress.level;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={draft.backAccessoryId === option.value ? "selected" : ""}
                          onClick={() => updateDraft((current) => ({ ...current, backAccessoryId: option.value }))}
                          aria-pressed={draft.backAccessoryId === option.value}
                          disabled={disabled || locked}
                          title={locked ? t("Unlocks at style level {value0}", { value0: level }) : t(option.detail)}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview">
                            <option.Icon className="cosmetic-image-fallback" size={21} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{t(option.label)}</strong><small>{locked ? t("Style level {value0}", { value0: level }) : t(option.detail)}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
                          {!locked && draft.backAccessoryId === option.value && <Check className="cosmetic-check" size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {activeCategory === "footwear" && (
                <fieldset className="creator-option-section accessory-options cosmetic-catalog-grid footwear-options">
                  <legend>{t("Footwear · choose one")}</legend>
                  <p className="creator-option-help">{t("Style only · movement and game rules stay the same.")}</p>
                  <div className="accessory-card-grid footwear-card-grid">
                    {FOOTWEAR_OPTIONS.map((option) => {
                      const level = unlockLevel("footwear", option.value);
                      const locked = level > progress.level;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={draft.footwearId === option.value ? "selected" : ""}
                          onClick={() => updateDraft((current) => ({ ...current, footwearId: option.value }))}
                          aria-pressed={draft.footwearId === option.value}
                          disabled={disabled || locked}
                          title={locked ? t("Unlocks at style level {value0}", { value0: level }) : t(option.detail)}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview footwear-card-preview">
                            <option.Icon className="cosmetic-image-fallback" size={28} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{t(option.label)}</strong><small>{locked ? t("Style level {value0}", { value0: level }) : t(option.detail)}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
                          {!locked && draft.footwearId === option.value && <Check className="cosmetic-check" size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {activeCategory === "pose" && (
                <fieldset className="creator-option-section accessory-options cosmetic-catalog-grid">
                  <legend>{t("Victory pose")}</legend>
                  <div className="accessory-card-grid">
                    {VICTORY_POSE_OPTIONS.map((option) => {
                      const level = unlockLevel("pose", option.value);
                      const locked = level > progress.level;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={draft.victoryPoseId === option.value ? "selected" : ""}
                          onClick={() => updateDraft((current) => ({ ...current, victoryPoseId: option.value }))}
                          aria-pressed={draft.victoryPoseId === option.value}
                          disabled={disabled || locked}
                          title={locked ? t("Unlocks at style level {value0}", { value0: level }) : t(option.detail)}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview">
                            <option.Icon className="cosmetic-image-fallback" size={21} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{t(option.label)}</strong><small>{locked ? t("Style level {value0}", { value0: level }) : t(option.detail)}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
                          {!locked && draft.victoryPoseId === option.value && <Check className="cosmetic-check" size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
        </div>
      </div>

      <footer className="creator-footer">
        <div className="creator-actions">
          <button type="button" onClick={randomize} disabled={disabled}><Dice5 size={16} />{t("Surprise me")}</button>
          <button
            type="button"
            onClick={() => updateDraft(() => ({ ...DEFAULT_PLAYER_APPEARANCE }))}
            disabled={disabled}
          >
            <RotateCcw size={16} />{t("Reset player")}</button>
        </div>
        <div className="save-cluster">
          <div className="save-state-copy">
            <div
              className={`appearance-save-state${dirty || saving ? " pending" : ""}${error ? " failed" : ""}`}
              aria-live="polite"
            >
              {error
                ? <><X size={15} />{t("Couldn’t save")}</>
                : saving
                  ? <><span className="saving-dot" />{t("Saving player style…")}</>
                  : dirty
                    ? t("Unsaved changes")
                    : <><Check size={15} />{t("Player style saved")}</>}
            </div>
            {error && <small className="save-error-detail">{t(error)}</small>}
          </div>
          {(dirty || error) && (
            <button
              className="primary save-appearance"
              type="button"
              onClick={() => void save()}
              disabled={disabled || saving}
            >
              {error ? t("Try again") : t("Save style")}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
