import { useSiteTranslation } from "../../../ui/siteTranslation";
import SiteLanguagePicker from "../../../ui/SiteLanguagePicker";
import { useEffect, useState } from "react";
import type { GamePreferences } from "../../../game/gamePreferences";

export default function GamePreferencesPanel({
  preferences,
  onChange,
  audioOnly = false
}: {
  preferences: GamePreferences;
  onChange: (update: Partial<GamePreferences>) => void;
  audioOnly?: boolean;
}) {
  const { t } = useSiteTranslation();
  const [gamepadDetected, setGamepadDetected] = useState(() => Boolean(navigator.getGamepads?.().some((gamepad) => gamepad?.connected)));

  useEffect(() => {
    const sync = () => setGamepadDetected(Boolean(navigator.getGamepads?.().some((gamepad) => gamepad?.connected)));
    window.addEventListener("gamepadconnected", sync);
    window.addEventListener("gamepaddisconnected", sync);
    return () => {
      window.removeEventListener("gamepadconnected", sync);
      window.removeEventListener("gamepaddisconnected", sync);
    };
  }, []);

  return (
    <div className="panel game-preferences-panel">
      <div className="panel-title">
        <h2>{t("Game settings")}</h2>
        <span>{t("Saved on this device")}</span>
      </div>
      <SiteLanguagePicker />
      {!audioOnly && (
        <>
          <label>{t("Graphics detail")}<select value={preferences.arenaQuality} onChange={(event) => onChange({ arenaQuality: event.target.value as GamePreferences["arenaQuality"] })}>
              <option value="auto">{t("Auto (recommended)")}</option>
              <option value="performance">{t("Low — school device")}</option>
              <option value="balanced">{t("Medium — balanced")}</option>
              <option value="high">{t("High — more detail")}</option>
            </select>
            <small>{t("Low uses less power while keeping team colors, objectives, and route landmarks clear.")}</small>
          </label>
          <label>{t("Touch controls")}<select value={preferences.touchControls} onChange={(event) => onChange({ touchControls: event.target.value as GamePreferences["touchControls"] })}><option value="auto">{t("Auto — follow your input")}</option><option value="on">{t("Always show — tablet")}</option><option value="off">{t("Hide — keyboard and mouse")}</option></select><small>{t("Auto hides the joystick when you use a keyboard or mouse, including on touchscreen notebooks.")}</small></label>
          <label className="toggle-row">
            <input type="checkbox" checked={preferences.highContrastHud} onChange={(event) => onChange({ highContrastHud: event.target.checked })} />
            <span>{t("High-contrast game display")}</span>
          </label>
          <p className="settings-help">{t("Makes game borders, text, and focus outlines easier to see.")}</p>
          <label className="toggle-row">
            <input type="checkbox" checked={preferences.contextualHud} onChange={(event) => onChange({ contextualHud: event.target.checked })} />
            <span>{t("Fade full health and energy bars outside combat")}</span>
          </label>
          <p className="settings-help">{t("Combat and low vitals bring them back. High contrast keeps them visible.")}</p>
          <label>{t("Look sensitivity")}<input type="range" min="0.2" max="2.5" step="0.05" value={preferences.lookSensitivity} onChange={(event) => onChange({ lookSensitivity: Number(event.target.value) })} />
            <small>{preferences.lookSensitivity.toFixed(2)}{t("× for mouse, controller, and touch look.")}</small>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={preferences.gamepadEnabled} onChange={(event) => onChange({ gamepadEnabled: event.target.checked })} />
            <span>{t("Use a controller")}{" "}{gamepadDetected ? t("(controller connected)") : t("(connect one to use)")}</span>
          </label>
          <p className="settings-help">{t("Left stick moves, right stick looks, A or the right trigger plays, and X interacts.")}</p>
        </>
      )}
      <label className="toggle-row">
        <input type="checkbox" checked={preferences.soundEnabled} onChange={(event) => onChange({ soundEnabled: event.target.checked })} />
        <span>{t("Game sounds")}</span>
      </label>
      <label>{t("SFX volume")}<input type="range" min="0" max="1" step="0.01" value={preferences.sfxVolume} disabled={!preferences.soundEnabled} onChange={(event) => onChange({ sfxVolume: Number(event.target.value) })} />
        <small>{Math.round(preferences.sfxVolume * 100)}{t("% for game sounds, answer feedback, and interface sounds.")}</small>
      </label>
      <label>{t("BGM volume")}<input type="range" min="0" max="1" step="0.01" value={preferences.musicVolume} disabled={!preferences.soundEnabled} onChange={(event) => onChange({ musicVolume: Number(event.target.value) })} />
        <small>{Math.round(preferences.musicVolume * 100)}{t("% for the game music.")}</small>
      </label>
      <p className="audio-credit">{t("BGM: Music by")}{" "}
        <a href="https://pixabay.com/ja/users/hauntsync-38266323/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=220562" target="_blank" rel="noreferrer">Nicholas Panek</a>
        {" "}{t("from")}{" "}
        <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=220562" target="_blank" rel="noreferrer">Pixabay</a>.
      </p>
      {!audioOnly && (
        <label className="toggle-row">
          <input type="checkbox" checked={preferences.vibrationEnabled} onChange={(event) => onChange({ vibrationEnabled: event.target.checked })} />
          <span>{t("Vibration when available")}</span>
        </label>
      )}
    </div>
  );
}
