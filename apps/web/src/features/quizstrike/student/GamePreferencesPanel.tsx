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
        <h2>Game Settings</h2>
        <span>Saved on this device</span>
      </div>
      {!audioOnly && (
        <>
          <label>
            Graphics quality
            <select value={preferences.arenaQuality} onChange={(event) => onChange({ arenaQuality: event.target.value as GamePreferences["arenaQuality"] })}>
              <option value="auto">Auto (recommended)</option>
              <option value="performance">Low — school device</option>
              <option value="balanced">Medium — balanced</option>
              <option value="high">High — full detail</option>
            </select>
            <small>Low reduces pixel density and decorative detail; team colors, objectives, and route landmarks remain visible.</small>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={preferences.highContrastHud} onChange={(event) => onChange({ highContrastHud: event.target.checked })} />
            <span>High-contrast HUD</span>
          </label>
          <p className="settings-help">Adds stronger HUD borders, text contrast, and focus outlines for busy scenes or low-vision play.</p>
          <label className="toggle-row">
            <input type="checkbox" checked={preferences.gamepadEnabled} onChange={(event) => onChange({ gamepadEnabled: event.target.checked })} />
            <span>Enable standard controller controls {gamepadDetected ? "(controller connected)" : "(connect a controller to use)"}</span>
          </label>
          <p className="settings-help">Controller: left stick moves, right stick looks, A or right trigger fires, and X interacts.</p>
        </>
      )}
      <label className="toggle-row">
        <input type="checkbox" checked={preferences.soundEnabled} onChange={(event) => onChange({ soundEnabled: event.target.checked })} />
        <span>Enable game audio</span>
      </label>
      <label>
        SFX volume
        <input type="range" min="0" max="1" step="0.01" value={preferences.sfxVolume} disabled={!preferences.soundEnabled} onChange={(event) => onChange({ sfxVolume: Number(event.target.value) })} />
        <small>{Math.round(preferences.sfxVolume * 100)}% for weapons, footsteps, quiz feedback, and interface sounds.</small>
      </label>
      <label>
        BGM volume
        <input type="range" min="0" max="1" step="0.01" value={preferences.musicVolume} disabled={!preferences.soundEnabled} onChange={(event) => onChange({ musicVolume: Number(event.target.value) })} />
        <small>{Math.round(preferences.musicVolume * 100)}% for the arena music track.</small>
      </label>
      <p className="audio-credit">
        BGM: Music by{" "}
        <a href="https://pixabay.com/ja/users/hauntsync-38266323/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=220562" target="_blank" rel="noreferrer">Nicholas Panek</a>
        {" "}from{" "}
        <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=220562" target="_blank" rel="noreferrer">Pixabay</a>.
      </p>
      {!audioOnly && (
        <label className="toggle-row">
          <input type="checkbox" checked={preferences.vibrationEnabled} onChange={(event) => onChange({ vibrationEnabled: event.target.checked })} />
          <span>Vibration feedback when available</span>
        </label>
      )}
    </div>
  );
}
