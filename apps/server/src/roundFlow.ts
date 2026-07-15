import type { Team } from "@quizstrike/shared";

export type RoundConclusion = {
  roundWins: Record<Team, number>;
  eventMessage: string;
  nextRound?: number;
  matchWinner?: Team;
  matchResult?: string;
};

const teamName = (team: Team) => team === "red" ? "Red Team" : "Blue Team";

export const planRoundConclusion = ({
  currentRound,
  roundCount,
  roundWins,
  winner,
  reason
}: {
  currentRound: number;
  roundCount: number;
  roundWins: Record<Team, number>;
  winner?: Team;
  reason: string;
}): RoundConclusion => {
  const nextWins = { ...roundWins };
  if (winner) nextWins[winner] += 1;
  const eventMessage = winner
    ? `${teamName(winner)} wins round ${currentRound}: ${reason}.`
    : `Round ${currentRound} ended in a draw: ${reason}.`;

  if (currentRound < roundCount) {
    return { roundWins: nextWins, eventMessage, nextRound: currentRound + 1 };
  }

  const matchWinner = nextWins.red === nextWins.blue ? undefined : nextWins.red > nextWins.blue ? "red" : "blue";
  const matchResult = !matchWinner
    ? `Match draw ${nextWins.red}-${nextWins.blue}.`
    : matchWinner === "red"
      ? `Red Team wins the match ${nextWins.red}-${nextWins.blue}.`
      : `Blue Team wins the match ${nextWins.blue}-${nextWins.red}.`;
  return { roundWins: nextWins, eventMessage, matchWinner, matchResult };
};
