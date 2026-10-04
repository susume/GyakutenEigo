import { useEffect, useRef, useState } from "react";
import { getZeusLight, ZEUS_CHANT_LEAD_MS, type GameSession } from "@quizstrike/shared";
import { gameAudio } from "./GameAudio";

export const useZeusDaruma = (session: GameSession | null | undefined, enabled: boolean, narration = true) => {
  const [nowMs, setNowMs] = useState(Date.now);
  const clock = useRef({ offset: 0 });
  const currentSession = useRef(session);
  useEffect(() => { currentSession.current = session; }, [session]);
  useEffect(() => {
    const serverMs = Date.parse(session?.serverTime ?? "");
    clock.current.offset = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
  }, [session?.serverTime]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [enabled]);
  const paused = session?.controlState === "teacher_paused";
  const serverNow = paused ? Date.parse(session?.teacherPausedAt ?? "") : nowMs + clock.current.offset;
  const zeus = session?.athletics?.zeus;
  const light = getZeusLight(zeus, serverNow);
  useEffect(() => {
    const sync = () => {
      const snapshot = currentSession.current;
      const currentZeus = snapshot?.athletics?.zeus;
      const currentNow = Date.now() + clock.current.offset;
      const active = enabled && narration && snapshot?.controlState !== "teacher_paused" && snapshot?.status === "active"
        && snapshot.athletics?.status === "running" && getZeusLight(currentZeus, currentNow) === "green"
        && document.visibilityState === "visible";
      if (!active || !currentZeus?.chantId || !currentZeus.phaseStartedAt) { gameAudio.stopZeusChant(); return; }
      gameAudio.syncZeusChant(`${snapshot.id}:${currentZeus.cycleIndex}:${currentZeus.phaseStartedAt}`, currentZeus.chantId,
        Date.parse(currentZeus.phaseStartedAt) + ZEUS_CHANT_LEAD_MS, currentNow);
    };
    sync();
    const timer = window.setInterval(sync, 100);
    document.addEventListener("visibilitychange", sync);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", sync); gameAudio.stopZeusChant(); };
  }, [enabled, narration]);
  return { light, serverNowMs: serverNow };
};
