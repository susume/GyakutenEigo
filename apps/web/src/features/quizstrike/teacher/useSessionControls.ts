import { useState } from "react";
import {
  DEFAULT_SESSION_SETTINGS,
  type BotDifficulty,
  type SessionSettings
} from "@quizstrike/shared";

type SessionNumberField = "maxPlayers" | "roundCount" | "flagHoldSeconds" | "initialZombieCount" | "startingMoney" | "correctAnswerReward" | "startingSnowballs" | "snowballPackPrice" | "snowballsPerPack" | "wrongAnswerPenalty" | "roundDurationSeconds";

/** Keeps live-session control state together while SessionManager remains the layout/composition layer. */
export function useSessionControls({ initialQuizSetId, firstQuizSetId }: { initialQuizSetId?: string; firstQuizSetId?: string }) {
  const [quizSetId, setQuizSetId] = useState(initialQuizSetId || firstQuizSetId || "");
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SESSION_SETTINGS);
  const [settingInputs, setSettingInputs] = useState<Record<SessionNumberField, string>>(() => {
    const fields: SessionNumberField[] = [
      "maxPlayers", "roundCount", "flagHoldSeconds", "initialZombieCount", "startingMoney",
      "correctAnswerReward", "startingSnowballs", "snowballPackPrice", "snowballsPerPack",
      "wrongAnswerPenalty", "roundDurationSeconds"
    ];
    return fields.reduce((inputs, field) => ({ ...inputs, [field]: String(DEFAULT_SESSION_SETTINGS[field] ?? "") }), {} as Record<SessionNumberField, string>);
  });
  const [invalidSettings, setInvalidSettings] = useState<Partial<Record<SessionNumberField, boolean>>>({});
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingRound, setIsEndingRound] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
  const [botCount, setBotCount] = useState(4);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>(DEFAULT_SESSION_SETTINGS.botDifficulty);
  const [isJoinLinkCopied, setIsJoinLinkCopied] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  const [isProjectorOpen, setIsProjectorOpen] = useState(false);

  return {
    quizSetId, setQuizSetId,
    settings, setSettings,
    settingInputs, setSettingInputs,
    invalidSettings, setInvalidSettings,
    isCreatingSession, setIsCreatingSession,
    isStartingSession, setIsStartingSession,
    isEndingRound, setIsEndingRound,
    isEndingSession, setIsEndingSession,
    isAddingBot, setIsAddingBot,
    removingPlayerId, setRemovingPlayerId,
    botCount, setBotCount,
    botDifficulty, setBotDifficulty,
    isJoinLinkCopied, setIsJoinLinkCopied,
    isEndConfirmOpen, setIsEndConfirmOpen,
    isProjectorOpen, setIsProjectorOpen
  };
}
