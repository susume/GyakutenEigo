import { useCallback, useState } from "react";
import type { Choice } from "@quizstrike/shared";
import type { IncomingHitDirection } from "../../../studentCombatFeedback";
import { readGamePreferences, type GamePreferences } from "../../../game/gamePreferences";

/** Stateful student-session UI values kept together without touching high-frequency arena state. */
export function useStudentGameState() {
  const [quizOpen, setQuizOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gamePreferences, setGamePreferences] = useState<GamePreferences>(() => readGamePreferences());
  const [feedback, setFeedback] = useState("");
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [answeringChoice, setAnsweringChoice] = useState<Choice | null>(null);
  const [buyingGearId, setBuyingGearId] = useState<string | null>(null);
  const [isBuyingSnowballs, setIsBuyingSnowballs] = useState(false);
  const [isSwitchingTeam, setIsSwitchingTeam] = useState(false);
  const [isRestoringStudentSession, setIsRestoringStudentSession] = useState(true);
  const [rewardPulse, setRewardPulse] = useState("");
  const [spectatorPlayerId, setSpectatorPlayerId] = useState("");
  const [incomingHitCue, setIncomingHitCue] = useState<{
    id: number;
    direction: IncomingHitDirection;
    eliminated: boolean;
    attackerName: string;
  } | null>(null);

  const openRespawnPractice = useCallback(() => {
    setQuizOpen(true);
    setBuyOpen(false);
    setScoreboardOpen(false);
  }, []);

  return {
    quizOpen, setQuizOpen,
    buyOpen, setBuyOpen,
    scoreboardOpen, setScoreboardOpen,
    settingsOpen, setSettingsOpen,
    gamePreferences, setGamePreferences,
    feedback, setFeedback,
    isSocketReconnecting, setIsSocketReconnecting,
    isJoining, setIsJoining,
    answeringChoice, setAnsweringChoice,
    buyingGearId, setBuyingGearId,
    isBuyingSnowballs, setIsBuyingSnowballs,
    isSwitchingTeam, setIsSwitchingTeam,
    isRestoringStudentSession, setIsRestoringStudentSession,
    rewardPulse, setRewardPulse,
    spectatorPlayerId, setSpectatorPlayerId,
    incomingHitCue, setIncomingHitCue,
    openRespawnPractice
  };
}
