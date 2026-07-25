import { useEffect, useMemo, useRef, useState } from "react";
import {
  APPEARANCE_UPDATE_COOLDOWN_MS,
  COSMETIC_CATALOG,
  DEFAULT_PLAYER_APPEARANCE,
  SCHOOL_APPEARANCE_PRESETS,
  sanitizePlayerAppearance,
  type CharacterCustomizationSettings,
  type CosmeticProgress,
  type CosmeticSlot,
  type PlayerAppearance,
  type Team
} from "@quizstrike/shared";
import { Award, Backpack, Check, Dice5, Lock, RotateCcw, Smile, UserRound, X } from "lucide-react";
import {
  BACK_ACCESSORY_OPTIONS,
  CharacterPreview,
  DETAIL_ACCESSORY_OPTIONS,
  HEAD_OPTIONS,
  PRESET_PRESENTATION,
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

  const choosePreset = (preset: (typeof SCHOOL_APPEARANCE_PRESETS)[number]) => {
    updateDraft((current) => ({ ...preset.appearance, decalAssetId: current.decalAssetId }));
  };

  const unlockLevel = (slot: CosmeticSlot, id: string) =>
    COSMETIC_CATALOG.find((item) => item.slot === slot && item.id === id)?.unlockLevel ?? 1;
  const isUnlocked = (slot: CosmeticSlot, id: string) => unlockLevel(slot, id) <= progress.level;

  const randomize = () => {
    const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)];
    const preset = pick(SCHOOL_APPEARANCE_PRESETS);
    if (policy.presetsOnly) {
      choosePreset(preset);
      return;
    }
    const head = pick(HEAD_OPTIONS.filter((option) => isUnlocked("head", option.id)));
    const back = pick(BACK_ACCESSORY_OPTIONS.filter((option) => isUnlocked("back", option.value)));
    const detail = pick(DETAIL_ACCESSORY_OPTIONS.filter((option) => isUnlocked("detail", option.value)));
    const pose = pick(VICTORY_POSE_OPTIONS.filter((option) => isUnlocked("pose", option.value)));
    updateDraft((current) => ({
      ...preset.appearance,
      headOption: head.id,
      backAccessoryId: back.value,
      detailAccessoryId: detail.value,
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
          <fieldset className="creator-option-section preset-section">
            <legend>Character preset</legend>
            <div className="appearance-presets" aria-label="Approved presets">
              {SCHOOL_APPEARANCE_PRESETS.map((preset) => {
                const presentation = PRESET_PRESENTATION[preset.id] ?? {
                  description: "Arena style",
                  Icon: UserRound
                };
                const selected = draft.characterPreset === preset.appearance.characterPreset;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    className={selected ? "selected" : ""}
                    onClick={() => choosePreset(preset)}
                    aria-pressed={selected}
                    disabled={disabled}
                  >
                    <span className="preset-icon"><presentation.Icon size={19} /></span>
                    <span><strong>{preset.name}</strong><small>{presentation.description}</small></span>
                    {selected && <Check className="preset-check" size={14} />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {!policy.presetsOnly && (
            <>
              <div className="cosmetic-category-tabs" role="tablist" aria-label="Cosmetic categories">
                {([
                  { id: "head", label: "Head", Icon: UserRound },
                  { id: "back", label: "Back", Icon: Backpack },
                  { id: "detail", label: "Badges", Icon: Award },
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
                  <legend>Head gear</legend>
                  <div className="accessory-card-grid">
                    {HEAD_OPTIONS.map((option) => {
                      const level = unlockLevel("head", option.id);
                      const locked = level > progress.level;
                      return (
                        <button
                          type="button"
                          key={option.id}
                          className={draft.headOption === option.id ? "selected" : ""}
                          onClick={() => updateDraft((current) => ({ ...current, headOption: option.id }))}
                          aria-pressed={draft.headOption === option.id}
                          disabled={disabled || locked}
                          title={locked ? `Unlocks at level ${level}` : option.label}
                        >
                          <option.Icon size={17} />
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : "Head style"}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
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
                          <option.Icon size={17} />
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : option.detail}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {activeCategory === "detail" && (
                <fieldset className="creator-option-section accessory-options cosmetic-catalog-grid">
                  <legend>Badge or device · equip one</legend>
                  <div className="accessory-card-grid">
                    {DETAIL_ACCESSORY_OPTIONS.map((option) => {
                      const level = unlockLevel("detail", option.value);
                      const locked = level > progress.level;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={draft.detailAccessoryId === option.value ? "selected" : ""}
                          onClick={() => updateDraft((current) => ({ ...current, detailAccessoryId: option.value }))}
                          aria-pressed={draft.detailAccessoryId === option.value}
                          disabled={disabled || locked}
                          title={locked ? `Unlocks at level ${level}` : option.detail}
                        >
                          <option.Icon size={17} />
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : option.detail}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
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
                          <option.Icon size={17} />
                          <span><strong>{option.label}</strong><small>{locked ? `Level ${level}` : option.detail}</small></span>
                          {locked && <Lock className="cosmetic-lock" size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </>
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
