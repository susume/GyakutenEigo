import { useEffect, useRef, useState } from "react";
import { getZeusLight, getZeusChantStartAt, getZeusStopCountdown, shouldPlayZeusChant, type GameSession } from "@quizstrike/shared";
import { gameAudio } from "./GameAudio";

const waitingSignal = { light: "waiting" as ReturnType<typeof getZeusLight>, stopInSeconds: null as number | null, goInSeconds: undefined as number | undefined, restarting: false };
const CHANT_SCHEDULE_AHEAD_MS = 500;

export const useZeusDaruma = (
  session: GameSession | null | undefined,
  enabled: boolean,
  narration = true,
  phaseCues = true,
  restartUntil?: string
) => {
  const [signal, setSignal] = useState(waitingSignal);
  const clockOffset = useRef(0);
  const latest = useRef({ session, restartUntil });
  useEffect(() => { latest.current = { session, restartUntil }; }, [session, restartUntil]);
  useEffect(() => {
    const serverMs = Date.parse(session?.serverTime ?? "");
    clockOffset.current = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
  }, [session?.serverTime]);
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => gameAudio.warm();
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("pointerup", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("pointerup", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [enabled]);
  const previousLight = useRef(waitingSignal.light);
  useEffect(() => {
    if (!enabled) return;
    let preloadedKey: string | undefined;
    const sync = () => {
      const { session: snapshot, restartUntil: deadline } = latest.current;
      const zeus = snapshot?.athletics?.zeus;
      const paused = snapshot?.controlState === "teacher_paused";
      const now = Date.now() + clockOffset.current;
      const pausedAt = paused ? Date.parse(snapshot?.teacherPausedAt ?? "") : NaN;
      const serverNow = Number.isFinite(pausedAt) ? pausedAt : now;
      const light = getZeusLight(zeus, serverNow);
      const active = !paused && snapshot?.status === "active" && snapshot.athletics?.status === "running"
        && document.visibilityState === "visible";
      const previous = previousLight.current;
      previousLight.current = light;
      if (phaseCues) {
        const stopInSeconds = getZeusStopCountdown(zeus, serverNow);
        const phaseEnd = Date.parse(zeus?.phaseEndsAt ?? "");
        const goInSeconds = zeus?.phase === "red" && Number.isFinite(phaseEnd)
          ? Math.max(0, Math.ceil((phaseEnd - serverNow) / 1000)) : undefined;
        const restarting = serverNow < Date.parse(deadline ?? "");
        setSignal((last) => last.light === light && last.stopInSeconds === stopInSeconds
          && last.goInSeconds === goInSeconds && last.restarting === restarting
          ? last : { light, stopInSeconds, goInSeconds, restarting });
        if (active && previous === "green" && light === "red") gameAudio.playEvent("zeus_stop");
        if (active && previous === "red" && light === "green") gameAudio.playEvent("zeus_go");
      }
      if (!active || !narration || light !== "green" || !zeus?.chantId || !shouldPlayZeusChant(zeus.cycleIndex)) {
        gameAudio.stopZeusChant();
        return;
      }
      const key = `${snapshot.id}:${zeus.cycleIndex}:${zeus.phaseStartedAt}`;
      if (preloadedKey !== key) {
        preloadedKey = key;
        gameAudio.preloadZeusChant(zeus.chantId);
      }
      const startsAt = getZeusChantStartAt(zeus);
      if (Number.isFinite(startsAt) && startsAt - serverNow <= CHANT_SCHEDULE_AHEAD_MS) {
        gameAudio.syncZeusChant(key, zeus.chantId, startsAt, serverNow);
      }
    };
    sync();
    const timer = window.setInterval(sync, 100);
    document.addEventListener("visibilitychange", sync);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", sync); gameAudio.stopZeusChant(); };
  }, [enabled, narration, phaseCues]);
  return enabled ? signal : waitingSignal;
};
