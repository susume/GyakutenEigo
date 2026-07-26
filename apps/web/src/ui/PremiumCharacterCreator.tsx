import { useEffect, useMemo, useRef, useState } from "react";
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
  onSave: (appearance: PlayerAppearance) => Promise<void>;
  onUploadDecal: (blob: Blob) => Promise<string>;
  loadDecalAsset: (assetId: string) => Promise<Blob>;
};

const appearanceSignature = (appearance: PlayerAppearance) => JSON.stringify(appearance);

export default function PremiumCharacterCreator({
  appearance,
  team,
  policy,
  progress,
  disabled,
  onSave,
  loadDecalAsset
}: PremiumCharacterCreatorProps) {
  const initial = useMemo(
    () => sanitizePlayerAppearance(appearance),
    [appearanceSignature(sanitizePlayerAppearance(appearance))]
  );
  const [draft, setDraft] = useState<PlayerAppearance>(initial);
  const [savedSignature, setSavedSignature] = useState(appearanceSignature(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const [activeCategory, setActiveCategory] = useState<CosmeticSlot>("head");
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
  }, [appearanceSignature(sanitizePlayerAppearance(appearance))]);

  const dirty = appearanceSignature(draft) !== savedSignature;

  const save = async (next = draft) => {
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

    setError(finalError instanceof Error ? finalError.message : "Appearance could not be saved.");
    setSaving(false);
  };

  useEffect(() => {
    if (!dirty || disabled || saving || error) return;
    const timeout = window.setTimeout(() => void save(draft), 950);
    return () => window.clearTimeout(timeout);
  }, [appearanceSignature(draft), disabled, saving, error]);

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
    const back = pick(BACK_ACCESSORY_OPTIONS.filter((option) => isUnlocked("back", option.value)));
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
        <span>Your teacher has locked character customization. Your safe default is ready.</span>
      </div>
    );
  }

  return (
    <section className="character-creator premium-character-creator" aria-label="Character creator">
      <div className="character-creator-preview-column">
        <div className="preview-heading">
          <div>
            <span className={`team-marker team-${team}`}>{team === "blue" ? "Blue team" : "Red team"}</span>
            <h3>Your player</h3>
          </div>
          <button
            className="icon-action"
            type="button"
            onClick={() => setCameraResetSignal((value) => value + 1)}
            aria-label="Reset preview camera"
          >
            <RotateCcw size={16} />
            Reset view
          </button>
        </div>
        <CharacterPreview
          appearance={draft}
          team={team}
          loadDecalAsset={loadDecalAsset}
          resetSignal={cameraResetSignal}
          showVictoryPose={activeCategory === "pose"}
          focusBack={activeCategory === "back"}
          focusFootwear={activeCategory === "footwear"}
        />
        <p className="preview-hint"><RotateCcw size={13} />Drag to rotate <span /> Scroll to zoom</p>
      </div>

      <div className="character-creator-controls">
        <div className="customizer-heading">
          <div className="customizer-title-row">
            <div><span>Player style</span><h3>Make it yours</h3></div>
            <div className="cosmetic-level"><Award size={15} /><span>Level {progress.level}</span><strong>{progress.levelName}</strong></div>
          </div>
          <div className="cosmetic-progress" aria-label={`${progress.xp} cosmetic experience`}>
            <span style={{ width: `${progress.progressPercent}%` }} />
          </div>
          <p>{progress.nextLevelXp === undefined ? "All cosmetics unlocked" : `${progress.nextLevelXp - progress.xp} XP to the next cosmetic level`}</p>
        </div>
        <div className="creator-controls-scroll">
          <div className="cosmetic-category-tabs" role="tablist" aria-label="Cosmetic categories">
                {([
                  { id: "head", label: "Head", Icon: UserRound },
                  { id: "back", label: "Back", Icon: Backpack },
                  { id: "footwear", label: "Footwear", Icon: Footprints },
                  { id: "pose", label: "Victory", Icon: Smile }
                ] as const).map((category) => (
                  <button
                    type="button"
                    role="tab"
                    key={category.id}
                    className={activeCategory === category.id ? "selected" : ""}
                    aria-selected={activeCategory === category.id}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    <category.Icon size={15} />{category.label}
                  </button>
                ))}
          </div>

              {activeCategory === "head" && (
                <fieldset className="creator-option-section accessory-options cosmetic-catalog-grid">
                  <legend>Head style</legend>
                  <p className="creator-option-help">Choose your character&apos;s complete head.</p>
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
                          title={locked ? `Unlocks at level ${level}` : option.label}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview">
                            <option.Icon className="cosmetic-image-fallback" size={21} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : option.description}</small></span>
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
                  <legend>Back gear · equip one</legend>
                  <div className="accessory-card-grid">
                    {BACK_ACCESSORY_OPTIONS.map((option) => {
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
                          title={locked ? `Unlocks at level ${level}` : option.detail}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview">
                            <option.Icon className="cosmetic-image-fallback" size={21} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : option.detail}</small></span>
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
                  <legend>Footwear · equip one</legend>
                  <p className="creator-option-help">Cosmetic only · movement and hitboxes stay the same.</p>
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
                          title={locked ? `Unlocks at level ${level}` : option.detail}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview footwear-card-preview">
                            <option.Icon className="cosmetic-image-fallback" size={28} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : option.detail}</small></span>
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
                  <legend>Victory animation</legend>
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
                          title={locked ? `Unlocks at level ${level}` : option.detail}
                        >
                          <span className="cosmetic-card-icon cosmetic-image-preview">
                            <option.Icon className="cosmetic-image-fallback" size={21} />
                            <img src={option.thumbnail} alt="" aria-hidden="true" />
                          </span>
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : option.detail}</small></span>
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
          <button type="button" onClick={randomize} disabled={disabled}><Dice5 size={16} />Randomize</button>
          <button
            type="button"
            onClick={() => updateDraft(() => ({ ...DEFAULT_PLAYER_APPEARANCE }))}
            disabled={disabled}
          >
            <RotateCcw size={16} />
            Reset character
          </button>
        </div>
        <div className="save-cluster">
          <div className="save-state-copy">
            <div
              className={`appearance-save-state${dirty || saving ? " pending" : ""}${error ? " failed" : ""}`}
              aria-live="polite"
            >
              {error
                ? <><X size={15} />Couldn’t save</>
                : saving
                  ? <><span className="saving-dot" />Saving appearance…</>
                  : dirty
                    ? "Unsaved changes"
                    : <><Check size={15} />Appearance saved</>}
            </div>
            {error && <small className="save-error-detail">{error}</small>}
          </div>
          {(dirty || error) && (
            <button
              className="primary save-appearance"
              type="button"
              onClick={() => void save()}
              disabled={disabled || saving}
            >
              {error ? "Try again" : "Save now"}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
