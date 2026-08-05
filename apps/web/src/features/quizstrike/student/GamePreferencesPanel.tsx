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
        <h2>Game settings</h2>
        <span>Saved on this device</span>
      </div>
      {!audioOnly && (
        <>
          <label>
            Graphics detail
            <select value={preferences.arenaQuality} onChange={(event) => onChange({ arenaQuality: event.target.value as GamePreferences["arenaQuality"] })}>
              <option value="auto">Auto (recommended)</option>
              <option value="performance">Low — school device</option>
              <option value="balanced">Medium — balanced</option>
              <option value="high">High — more detail</option>
            </select>
            <small>Low uses less power while keeping team colors, objectives, and route landmarks clear.</small>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={preferences.highContrastHud} onChange={(event) => onChange({ highContrastHud: event.target.checked })} />
            <span>High-contrast game display</span>
          </label>
          <p className="settings-help">Makes game borders, text, and focus outlines easier to see.</p>
          <label className="toggle-row">
            <input type="checkbox" checked={preferences.gamepadEnabled} onChange={(event) => onChange({ gamepadEnabled: event.target.checked })} />
            <span>Use a controller {gamepadDetected ? "(controller connected)" : "(connect one to use)"}</span>
          </label>
          <p className="settings-help">Left stick moves, right stick looks, A or the right trigger plays, and X interacts.</p>
        </>
      )}
      <label className="toggle-row">
        <input type="checkbox" checked={preferences.soundEnabled} onChange={(event) => onChange({ soundEnabled: event.target.checked })} />
        <span>Game sounds</span>
      </label>
      <label>
        SFX volume
        <input type="range" min="0" max="1" step="0.01" value={preferences.sfxVolume} disabled={!preferences.soundEnabled} onChange={(event) => onChange({ sfxVolume: Number(event.target.value) })} />
        <small>{Math.round(preferences.sfxVolume * 100)}% for game sounds, answer feedback, and interface sounds.</small>
      </label>
      <label>
        BGM volume
        <input type="range" min="0" max="1" step="0.01" value={preferences.musicVolume} disabled={!preferences.soundEnabled} onChange={(event) => onChange({ musicVolume: Number(event.target.value) })} />
        <small>{Math.round(preferences.musicVolume * 100)}% for the game music.</small>
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
          <span>Vibration when available</span>
        </label>
      )}
    </div>
  );
}
