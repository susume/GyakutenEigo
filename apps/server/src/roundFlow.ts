import type { GameMode, RoundTransitionPhase, Team } from "@quizstrike/shared";

export type RoundConclusion = {
  roundWins: Record<Team, number>;
  eventMessage: string;
  nextRound?: number;
  matchWinner?: Team;
  matchResult?: string;
};

export type PendingRoundAction = "open_preparation" | "activate_prepared" | "start_round";

const teamName = (team: Team) => team === "red" ? "Red Team" : "Blue Team";

export const getPausedRoundAction = ({
  gameMode,
  phase
}: {
  gameMode: GameMode;
  phase?: RoundTransitionPhase;
}) => (gameMode === "flag" || gameMode === "classic")
  && phase !== "preparation"
  && phase !== "buy"
  ? "open_preparation"
  : "start_round";

export const resolvePendingRoundAction = ({
  gameMode,
  phase
}: {
  gameMode: GameMode;
  phase?: RoundTransitionPhase;
}): PendingRoundAction => {
  if (getPausedRoundAction({ gameMode, phase }) === "open_preparation") return "open_preparation";
  if (phase === "zombie_selection" || phase === "preparation" || phase === "buy") return "activate_prepared";
  return "start_round";
};

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
