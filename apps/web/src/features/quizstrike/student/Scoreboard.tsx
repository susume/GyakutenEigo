import { Trash2 } from "lucide-react";
import { resolveAthleticsStandings, type PlayerSession, type SessionSettings, type Team } from "@quizstrike/shared";
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
  athleticsRequiredLaps = 1,
  onRemovePlayer,
  removingPlayerId
}: {
  players: PlayerSession[];
  localPlayerId?: string;
  gameMode: SessionSettings["gameMode"];
  athleticsRequiredLaps?: number;
  onRemovePlayer?: (playerId: string) => void;
  removingPlayerId?: string | null;
}) {
  if (gameMode === "athletics") {
    const standings = resolveAthleticsStandings(players);
    return (
      <div className="scoreboard athletics-scoreboard">
        <div className="panel-title">
          <h2>Race standings</h2>
          <span>{players.length} {players.length === 1 ? "racer" : "racers"}</span>
        </div>
        <p className="scoreboard-mode-note">Finish order leads. Progress breaks ties until the tape.</p>
        <div className="scoreboard-table-wrap">
          <table className="scoreboard-table">
            <caption>Athletics Race standings</caption>
            <thead>
              <tr className="scoreboard-row scoreboard-head">
                <th scope="col">Place</th>
                <th scope="col">Racer</th>
                <th scope="col">Laps</th>
                <th scope="col">Checkpoint</th>
                <th scope="col">Progress</th>
                <th scope="col">Falls</th>
                <th scope="col">Status</th>
                {onRemovePlayer && <th scope="col" className="scoreboard-actions-heading">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {standings.map((standing) => {
                const racer = players.find((player) => player.id === standing.playerId);
                if (!racer) return null;
                const athletics = racer.athletics;
                return (
                  <tr className="scoreboard-row athletics-scoreboard-row" key={racer.id}>
                    <th scope="row">{standing.status === "finished" ? `#${standing.rank}` : standing.rank}</th>
                    <td>{racer.nickname}{racer.isBot ? " · test player" : ""}{racer.id === localPlayerId ? " · you" : ""}</td>
                    <td>{standing.completedLaps}/{athleticsRequiredLaps}</td>
                    <td>{standing.checkpointIndex}</td>
                    <td>{Math.round(standing.routeProgress * 100)}%</td>
                    <td>{athletics?.falls ?? 0}</td>
                    <td>{standing.status === "finished" ? "Finished" : standing.status === "dnf" ? "DNF" : "Racing"}</td>
                    {onRemovePlayer && (
                      <td className="scoreboard-actions">
                        <button type="button" className="scoreboard-remove-player" onClick={() => onRemovePlayer(racer.id)} disabled={Boolean(removingPlayerId)} aria-label={`Remove ${racer.nickname} from the game`}>
                          <Trash2 size={15} aria-hidden="true" />
                          {removingPlayerId === racer.id ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {standings.length === 0 && <tr><td colSpan={onRemovePlayer ? 8 : 7}>No racers here yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const grouped = groupScoreboardRows(players, gameMode, localPlayerId);
  const totals = getTeamTotals(players);
  const zombieCounts = getZombieCounts(players);
  return (
    <div className="scoreboard">
      <div className="panel-title">
        <h2>Scoreboard</h2>
        <span>{players.length} {players.length === 1 ? "player" : "players"}</span>
      </div>
      <div className="team-score-row">
        {gameMode === "zombie" ? (
          <>
          <span className="team-score blue-team">Humans · {zombieCounts.humans}</span>
          <span className="team-score red-team">Zombies · {zombieCounts.zombies}</span>
          </>
        ) : (
          <>
          <span className="team-score blue-team">Blue · {totals.blue}</span>
          <span className="team-score red-team">Red · {totals.red}</span>
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
                  <th scope="col">Player</th>
                  <th scope="col">Tags</th>
                  <th scope="col">Respawns</th>
                  <th scope="col">Answer accuracy</th>
                  {onRemovePlayer && <th scope="col" className="scoreboard-actions-heading">Actions</th>}
                </tr>
              </thead>
              <tbody>
              {group.rows.map((row) => (
                <tr className={`scoreboard-row ${row.teamId}-team`} key={row.playerId}>
                  <th scope="row" title={row.displayName}>
                    {row.displayName}
                    {row.isBot ? " · test player" : ""}
                    {row.isLocalPlayer ? " · you" : ""}
                    {row.connectionState === "disconnected" ? " · away" : ""}
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
              {group.rows.length === 0 && <tr><td colSpan={onRemovePlayer ? 5 : 4}>No players here yet.</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
