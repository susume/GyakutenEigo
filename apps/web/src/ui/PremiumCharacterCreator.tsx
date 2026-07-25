import { useEffect, useMemo, useRef, useState } from "react";
import {
  APPEARANCE_UPDATE_COOLDOWN_MS,
  DEFAULT_PLAYER_APPEARANCE,
  SCHOOL_APPEARANCE_PRESETS,
  sanitizePlayerAppearance,
  type CharacterCustomizationSettings,
  type PlayerAppearance,
  type Team
} from "@quizstrike/shared";
import { Check, Dice5, RotateCcw, UserRound, X } from "lucide-react";
import {
  ACCESSORY_OPTIONS,
  CharacterPreview,
  HEAD_OPTIONS,
  PRESET_PRESENTATION
} from "./CharacterCreator";

type PremiumCharacterCreatorProps = {
  appearance?: PlayerAppearance;
  team: Team;
  policy: CharacterCustomizationSettings;
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

  const randomize = () => {
    const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)];
    const preset = pick(SCHOOL_APPEARANCE_PRESETS);
    if (policy.presetsOnly) {
      choosePreset(preset);
      return;
    }
    const head = pick(HEAD_OPTIONS);
    const accessory = pick(ACCESSORY_OPTIONS);
    updateDraft((current) => ({
      ...preset.appearance,
      headOption: head.id,
      accessoryId: accessory.value,
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
        />
        <p className="preview-hint"><RotateCcw size={13} />Drag to rotate <span /> Scroll to zoom</p>
      </div>

      <div className="character-creator-controls">
        <div className="customizer-heading">
          <span>Player style</span>
          <h3>Make it yours</h3>
          <p>Choose a look, head option, and one cosmetic accessory.</p>
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
              <fieldset className="creator-option-section compact-options">
                <legend>Head option</legend>
                <div>
                  {HEAD_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={draft.headOption === option.id ? "selected" : ""}
                      onClick={() => updateDraft((current) => ({ ...current, headOption: option.id }))}
                      aria-pressed={draft.headOption === option.id}
                      disabled={disabled}
                    >
                      <option.Icon size={17} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="creator-option-section accessory-options">
                <legend>Choose an accessory</legend>
                <div className="accessory-card-grid">
                  {ACCESSORY_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={draft.accessoryId === option.value ? "selected" : ""}
                      onClick={() => updateDraft((current) => ({ ...current, accessoryId: option.value }))}
                      aria-pressed={draft.accessoryId === option.value}
                      disabled={disabled}
                    >
                      <option.Icon size={17} />
                      <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                    </button>
                  ))}
                </div>
              </fieldset>
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
