import { Trash2 } from "lucide-react";
import type { PlayerSession, SessionSettings, Team } from "@quizstrike/shared";
import { groupScoreboardRows } from "../../../scoreboardGroups";
import { getZombieCounts } from "../../../sessionPresentation";

const teamLabel = (team: Team) => (team === "blue" ? "Blue Team" : "Red Team");
const getTeamTotals = (players: PlayerSession[]) => ({
  blue: players.filter((player) => player.team === "blue").reduce((total, player) => total + player.score, 0),
  red: players.filter((player) => player.team === "red").reduce((total, player) => total + player.score, 0)
});

export default function Scoreboard({
  players,
  localPlayerId,
  gameMode,
  onRemovePlayer,
  removingPlayerId
}: {
  players: PlayerSession[];
  localPlayerId?: string;
  gameMode: SessionSettings["gameMode"];
  onRemovePlayer?: (playerId: string) => void;
  removingPlayerId?: string | null;
}) {
  const grouped = groupScoreboardRows(players, gameMode, localPlayerId);
  const totals = getTeamTotals(players);
  const zombieCounts = getZombieCounts(players);
  return (
    <div className="scoreboard">
      <div className="panel-title">
        <h2>Scoreboard</h2>
        <span>{players.length} players</span>
      </div>
      <div className="team-score-row">
        {gameMode === "zombie" ? (
          <>
            <span className="team-score blue-team">Humans {zombieCounts.humans}</span>
            <span className="team-score red-team">Zombies {zombieCounts.zombies}</span>
          </>
        ) : (
          <>
            <span className="team-score blue-team">Blue {totals.blue}</span>
            <span className="team-score red-team">Red {totals.red}</span>
          </>
        )}
      </div>
      <div className="scoreboard-table-wrap">
        {grouped.map((group) => (
          <div className="scoreboard-group" key={group.id}>
            <h3>{group.label} <span>{group.rows.length}</span></h3>
            <table className="scoreboard-table">
              <caption>{group.label} scoreboard</caption>
              <thead>
                <tr className="scoreboard-row scoreboard-head">
                  <th scope="col">Player Name</th>
                  <th scope="col">Tags</th>
                  <th scope="col">Respawns</th>
                  <th scope="col">Question Accuracy</th>
                  {onRemovePlayer && <th scope="col" className="scoreboard-actions-heading">Actions</th>}
                </tr>
              </thead>
              <tbody>
              {group.rows.map((row) => (
                <tr className={`scoreboard-row ${row.teamId}-team`} key={row.playerId}>
                  <th scope="row" title={row.displayName}>
                    {row.displayName}
                    {row.isBot ? " Bot" : ""}
                    {row.isLocalPlayer ? " You" : ""}
                    {row.connectionState === "disconnected" ? " Offline" : ""}
                    <small>{gameMode === "zombie" ? (row.role === "zombie" ? "Zombie" : "Human") : teamLabel(row.teamId)}</small>
                  </th>
                  <td>{row.tags}</td>
                  <td>{row.respawns}</td>
                  <td>{row.questionAccuracy}</td>
                  {onRemovePlayer && (
                    <td className="scoreboard-actions">
                      <button type="button" className="scoreboard-remove-player" onClick={() => onRemovePlayer(row.playerId)} disabled={Boolean(removingPlayerId)} aria-label={`Remove ${row.displayName} from the game`}>
                        <Trash2 size={15} aria-hidden="true" />
                        {removingPlayerId === row.playerId ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {group.rows.length === 0 && <tr><td colSpan={onRemovePlayer ? 5 : 4}>No players in this group.</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
