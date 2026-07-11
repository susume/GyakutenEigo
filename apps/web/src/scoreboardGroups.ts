import { buildScoreboardRows, type GameMode, type PlayerSession } from "@quizstrike/shared";

export const groupScoreboardRows = (
  players: PlayerSession[],
  gameMode: GameMode,
  localPlayerId?: string
) => {
  const rows = buildScoreboardRows(players, localPlayerId).sort(
    (a, b) => b.tags - a.tags || b.questionsCorrect - a.questionsCorrect
  );

  return gameMode === "zombie"
    ? [
        { id: "human", label: "Humans", rows: rows.filter((row) => row.role !== "zombie") },
        { id: "zombie", label: "Zombies", rows: rows.filter((row) => row.role === "zombie") }
      ]
    : [
        { id: "red", label: "Red Team", rows: rows.filter((row) => row.teamId === "red") },
        { id: "blue", label: "Blue Team", rows: rows.filter((row) => row.teamId === "blue") }
      ];
};
