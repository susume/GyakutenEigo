import { useSiteTranslation } from "../../../ui/siteTranslation";
import { Trash2 } from "lucide-react";
import { resolveAthleticsStandings, ZEUS_SUMMIT_PROGRESS, type PlayerSession, type SessionSettings, type Team } from "@quizstrike/shared";
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
  athleticsMode,
  onRemovePlayer,
  removingPlayerId
}: {
  players: PlayerSession[];
  localPlayerId?: string;
  gameMode: SessionSettings["gameMode"];
  athleticsRequiredLaps?: number;
  athleticsMode?: SessionSettings["athleticsMode"];
  onRemovePlayer?: (playerId: string) => void;
  removingPlayerId?: string | null;
}) {
  const { t } = useSiteTranslation();
  if (gameMode === "athletics") {
    const hunters = players.filter((racer) => racer.athletics?.role === "hunter");
    const standings = resolveAthleticsStandings(players.filter((racer) => racer.athletics?.role !== "hunter"));
    return (
      <div className="scoreboard athletics-scoreboard">
        <div className="panel-title">
          <h2>{t("Race standings")}</h2>
          <span>{players.length} {players.length === 1 ? t("racer") : t("racers")}</span>
        </div>
        <p className="scoreboard-mode-note">{t(athleticsMode === "zeus" ? "First to the summit wins" : "Finish order leads. Progress breaks ties until the tape.")}{hunters.length > 0 ? t(" Hunters earn hits at their stations.") : ""}</p>
        <div className="scoreboard-table-wrap">
          <table className="scoreboard-table">
            <caption>{t("Athletics Race standings")}</caption>
            <thead>
              <tr className="scoreboard-row scoreboard-head">
                <th scope="col">{t("Place")}</th>
                <th scope="col">{t("Racer")}</th>
                {athleticsMode !== "zeus" && <th scope="col">{t("Laps")}</th>}
                <th scope="col">{t("Checkpoint")}</th>
                <th scope="col">{t(athleticsMode === "zeus" ? "Summit" : "Progress")}</th>
                <th scope="col">{t("Falls")}</th>
                <th scope="col">{t("Status")}</th>
                {onRemovePlayer && <th scope="col" className="scoreboard-actions-heading">{t("Actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {standings.map((standing) => {
                const racer = players.find((player) => player.id === standing.playerId);
                if (!racer) return null;
                const athletics = racer.athletics;
                return (
                  <tr className="scoreboard-row athletics-scoreboard-row" key={racer.id}>
                    <th scope="row">{standing.status === "finished" ? t("#{value0}", { value0: standing.rank }) : standing.rank}</th>
                    <td>{racer.nickname}{racer.isBot ? t(" · test player") : ""}{racer.id === localPlayerId ? t(" · you") : ""}</td>
                    {athleticsMode !== "zeus" && <td>{standing.completedLaps}/{athleticsRequiredLaps}</td>}
                    <td>{standing.checkpointIndex}</td>
                    <td>{Math.min(100, Math.round(standing.routeProgress / (athleticsMode === "zeus" ? ZEUS_SUMMIT_PROGRESS : 1) * 100))}%</td>
                    <td>{athletics?.falls ?? 0}</td>
                    <td>{standing.status === "finished" ? t("Finished") : standing.status === "dnf" ? t("DNF") : t("Racing")}</td>
                    {onRemovePlayer && (
                      <td className="scoreboard-actions">
                        <button type="button" className="scoreboard-remove-player" onClick={() => onRemovePlayer(racer.id)} disabled={Boolean(removingPlayerId)} aria-label={t("Remove {value0} from the game", { value0: racer.nickname })}>
                          <Trash2 size={15} aria-hidden="true" />
                          {removingPlayerId === racer.id ? t("Removing...") : t("Remove")}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {hunters.map((hunter) => <tr className="scoreboard-row athletics-scoreboard-row" key={hunter.id}>
                <th scope="row">{t("Hunter")}</th>
                <td>{hunter.nickname}{hunter.id === localPlayerId ? t(" · you") : ""}</td>
                <td colSpan={5}>{t("Station")}{" "}{(hunter.athletics?.stationIndex ?? 0) + 1} · {hunter.athletics?.hunterHits ?? 0}{" "}{t("hits ·")}{" "}{hunter.score}{" "}{t("points")}</td>
                {onRemovePlayer && <td className="scoreboard-actions"><button type="button" className="scoreboard-remove-player" onClick={() => onRemovePlayer(hunter.id)} disabled={Boolean(removingPlayerId)} aria-label={t("Remove {value0} from the game", { value0: hunter.nickname })}><Trash2 size={15} aria-hidden="true" />{t("Remove")}</button></td>}
              </tr>)}
              {standings.length === 0 && <tr><td colSpan={(athleticsMode === "zeus" ? 6 : 7) + (onRemovePlayer ? 1 : 0)}>{t("No racers here yet.")}</td></tr>}
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
        <h2>{t("Scoreboard")}</h2>
        <span>{players.length} {players.length === 1 ? t("player") : t("players")}</span>
      </div>
      <div className="team-score-row">
        {gameMode === "zombie" ? (
          <>
          <span className="team-score blue-team">{t("Humans ·")}{" "}{zombieCounts.humans}</span>
          <span className="team-score red-team">{t("Zombies ·")}{" "}{zombieCounts.zombies}</span>
          </>
        ) : (
          <>
          <span className="team-score blue-team">{t("Blue ·")}{" "}{totals.blue}</span>
          <span className="team-score red-team">{t("Red ·")}{" "}{totals.red}</span>
          </>
        )}
      </div>
      <div className="scoreboard-table-wrap">
        {grouped.map((group) => (
          <div className="scoreboard-group" key={group.id}>
            <h3>{t(group.label)} <span>{group.rows.length}</span></h3>
            <table className="scoreboard-table">
              <caption>{t(group.label)}{" "}{t("scoreboard")}</caption>
              <thead>
                <tr className="scoreboard-row scoreboard-head">
                  <th scope="col">{t("Player")}</th>
                  <th scope="col">{t("Tags")}</th>
                  <th scope="col">{t("Respawns")}</th>
                  <th scope="col">{t("Answer accuracy")}</th>
                  {onRemovePlayer && <th scope="col" className="scoreboard-actions-heading">{t("Actions")}</th>}
                </tr>
              </thead>
              <tbody>
              {group.rows.map((row) => (
                <tr className={`scoreboard-row ${row.teamId}-team`} key={row.playerId}>
                  <th scope="row" title={row.displayName}>
                    {row.displayName}
                    {row.isBot ? t(" · test player") : ""}
                    {row.isLocalPlayer ? t(" · you") : ""}
                    {row.connectionState === "disconnected" ? t(" · away") : ""}
                    <small>{gameMode === "zombie" ? (row.role === "zombie" ? t("Zombie") : t("Human")) : t(teamLabel(row.teamId))}</small>
                  </th>
                  <td>{row.tags}</td>
                  <td>{row.respawns}</td>
                  <td>{row.questionAccuracy}</td>
                  {onRemovePlayer && (
                    <td className="scoreboard-actions">
                      <button type="button" className="scoreboard-remove-player" onClick={() => onRemovePlayer(row.playerId)} disabled={Boolean(removingPlayerId)} aria-label={t("Remove {value0} from the game", { value0: row.displayName })}>
                        <Trash2 size={15} aria-hidden="true" />
                        {removingPlayerId === row.playerId ? t("Removing...") : t("Remove")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {group.rows.length === 0 && <tr><td colSpan={onRemovePlayer ? 5 : 4}>{t("No players here yet.")}</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
