import { useEffect, useState } from "react";
import type { GamePreferences } from "../gamePreferences";

export type ArenaInputMode = "touch" | "keyboard";
export const initialArenaInputMode = (coarse: boolean): ArenaInputMode => coarse ? "touch" : "keyboard";

/** Primary pointer, then actual activity: touchscreen Chromebooks can still play with a keyboard. */
export function useArenaInputMode(preference: GamePreferences["touchControls"] = "auto") {
  const [automatic, setAutomatic] = useState<ArenaInputMode>(() => initialArenaInputMode(
    typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches)
  ));
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const change = () => setAutomatic(initialArenaInputMode(media.matches));
    const pointer = (event: PointerEvent) => setAutomatic(event.pointerType === "touch" ? "touch" : "keyboard");
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
      if (/^(Key[WASDFQBCEM]|Arrow\w+|Space|ShiftLeft|ShiftRight|Tab)$/.test(event.code)) setAutomatic("keyboard");
    };
    media.addEventListener("change", change);
    window.addEventListener("pointerdown", pointer, { passive: true });
    window.addEventListener("keydown", keyboard);
    return () => { media.removeEventListener("change", change); window.removeEventListener("pointerdown", pointer); window.removeEventListener("keydown", keyboard); };
  }, []);
  return preference === "on" ? "touch" : preference === "off" ? "keyboard" : automatic;
}
