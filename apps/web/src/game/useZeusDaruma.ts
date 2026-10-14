import { useEffect, useRef, useState } from "react";
import { getZeusLight, getZeusChantStartAt, getZeusStopCountdown, shouldPlayZeusChant, type GameSession } from "@quizstrike/shared";
import { gameAudio } from "./GameAudio";

export const useZeusDaruma = (session: GameSession | null | undefined, enabled: boolean, narration = true, phaseCues = true) => {
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
  const previousLight = useRef(light);
  useEffect(() => {
    const previous = previousLight.current;
    previousLight.current = light;
    if (!enabled || !phaseCues || paused || session?.status !== "active" || session.athletics?.status !== "running" || document.visibilityState !== "visible") return;
    if (previous === "green" && light === "red") gameAudio.playEvent("zeus_stop");
    if (previous === "red" && light === "green") gameAudio.playEvent("zeus_go");
  }, [enabled, phaseCues, paused, light, session?.status, session?.athletics?.status]);
  useEffect(() => {
    const sync = () => {
      const snapshot = currentSession.current;
      const currentZeus = snapshot?.athletics?.zeus;
      const currentNow = Date.now() + clock.current.offset;
      const active = enabled && narration && snapshot?.controlState !== "teacher_paused" && snapshot?.status === "active"
        && snapshot.athletics?.status === "running" && getZeusLight(currentZeus, currentNow) === "green"
        && document.visibilityState === "visible";
      if (!active || !currentZeus?.chantId || !currentZeus.phaseStartedAt || !shouldPlayZeusChant(currentZeus.cycleIndex)) { gameAudio.stopZeusChant(); return; }
      const startsAt = getZeusChantStartAt(currentZeus);
      // Do not load or schedule a voice during the quiet climbing stretch.
      if (!Number.isFinite(startsAt) || currentNow < startsAt) { gameAudio.stopZeusChant(); return; }
      gameAudio.syncZeusChant(`${snapshot.id}:${currentZeus.cycleIndex}:${currentZeus.phaseStartedAt}`, currentZeus.chantId,
        startsAt, currentNow);
    };
    sync();
    const timer = window.setInterval(sync, 100);
    document.addEventListener("visibilitychange", sync);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", sync); gameAudio.stopZeusChant(); };
  }, [enabled, narration]);
  const stopInSeconds = getZeusStopCountdown(zeus, serverNow);
  const goInSeconds = zeus?.phase === "red" && Number.isFinite(Date.parse(zeus.phaseEndsAt ?? ""))
    ? Math.max(0, Math.ceil((Date.parse(zeus.phaseEndsAt!) - serverNow) / 1000)) : undefined;
  return { light, stopInSeconds, goInSeconds, serverNowMs: serverNow };
};
