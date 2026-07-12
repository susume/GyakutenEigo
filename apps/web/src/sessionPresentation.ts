import type { GameSession, PlayerSession } from "@quizstrike/shared";

export const getZombieCounts = (players: PlayerSession[]) => ({
  humans: players.filter((player) => player.role !== "zombie").length,
  zombies: players.filter((player) => player.role === "zombie").length
});

const getTeamTotals = (players: PlayerSession[]) => ({
  blue: players.filter((player) => player.team === "blue").reduce((total, player) => total + player.score, 0),
  red: players.filter((player) => player.team === "red").reduce((total, player) => total + player.score, 0)
});

export const getModeScoreSummary = (session: GameSession) => {
  if (session.settings.gameMode === "zombie") {
    const { humans, zombies } = getZombieCounts(session.players);
    return `Humans ${humans} – Zombies ${zombies}`;
  }
  const totals = getTeamTotals(session.players);
  return `Blue ${totals.blue} – Red ${totals.red}`;
};

export const getSessionResultText = (session: GameSession) => {
  if (session.settings.gameMode === "zombie") {
    const authoritativeEndMessage = session.events?.find((event) => event.type === "end")?.message;
    if (authoritativeEndMessage) return authoritativeEndMessage;
    return getZombieCounts(session.players).humans > 0
      ? "Humans survived until time expired."
      : "Zombies converted everyone.";
  }
  const totals = getTeamTotals(session.players);
  return totals.blue === totals.red
    ? "The teams finished tied."
    : `${totals.blue > totals.red ? "Blue" : "Red"} Team won the round.`;
};

export const getReadyRoomTitle = (session: GameSession, player: PlayerSession) =>
  session.settings.gameMode === "zombie"
    ? "Zombie Mode Ready Room"
    : `${player.team === "blue" ? "Blue Team" : "Red Team"} Ready Room`;
