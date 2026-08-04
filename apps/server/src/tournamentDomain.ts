import { randomBytes } from "node:crypto";
import type { SessionReport, SessionSettings, TeacherUser } from "@quizstrike/shared";

export const TOURNAMENT_STATUSES = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "STUDY_PACK_RELEASED",
  "CHECK_IN",
  "LIVE",
  "COMPLETED",
  "CANCELLED"
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TOURNAMENT_LEVELS = [
  "SCHOOL_VS_SCHOOL",
  "CLASS_VS_CLASS",
  "IN_SCHOOL",
  "INVITATIONAL",
  "SPONSORED"
] as const;
export type TournamentLevel = (typeof TOURNAMENT_LEVELS)[number];

export const TEAM_REGISTRATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type TeamRegistrationStatus = (typeof TEAM_REGISTRATION_STATUSES)[number];

export const MATCH_STATUSES = [
  "SCHEDULED",
  "CHECK_IN",
  "LIVE",
  "COMPLETED",
  "BYE",
  "FORFEIT",
  "CANCELLED"
] as const;
export type TournamentMatchStatus = (typeof MATCH_STATUSES)[number];

export type TournamentRosterMember = {
  id: string;
  displayName: string;
  isSubstitute?: boolean;
};

export type TournamentTeam = {
  id: string;
  tournamentId: string;
  teamName: string;
  schoolName: string;
  className?: string;
  managerUserId: string;
  managerName: string;
  schoolLocation?: string;
  roster: TournamentRosterMember[];
  substitutes: TournamentRosterMember[];
  color: "blue" | "red" | "gold" | "green";
  registrationStatus: TeamRegistrationStatus;
  checkedIn: boolean;
  invitationCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type TournamentStudyItem = {
  id: string;
  term: string;
  pronunciation?: string;
  meaning?: string;
  example?: string;
  note?: string;
  sortOrder: number;
};

export type TournamentStudyPack = {
  id: string;
  releaseAt: string;
  items: TournamentStudyItem[];
  releasedAt?: string;
  updatedAt: string;
};

export type OfficialMatchSettings = SessionSettings & {
  teamSize: number;
  preparationDurationSeconds: number;
  botPolicy: "none" | "organizer_only";
  rewardsEnabled: boolean;
};

export type TournamentMatchResult = {
  teamAScore: number;
  teamBScore: number;
  winnerTeamId: string;
  runnerUpTeamId?: string;
  verifiedAt: string;
  sourceSessionId: string;
  reportId?: string;
  learning?: {
    averageAccuracy?: number;
    missedMaterial?: string[];
  };
};

export type TournamentMatch = {
  id: string;
  tournamentId: string;
  roundNumber: number;
  roundLabel: string;
  bracketPosition: number;
  teamAId?: string;
  teamBId?: string;
  scheduledAt: string;
  status: TournamentMatchStatus;
  checkedInTeamIds: string[];
  gameSessionId?: string;
  sessionCode?: string;
  settingsSnapshot?: OfficialMatchSettings;
  settingsLockedAt?: string;
  result?: TournamentMatchResult;
  winnerTeamId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TournamentAuditEvent = {
  id: string;
  tournamentId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  reason?: string;
  createdAt: string;
};

export type Tournament = {
  id: string;
  slug: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  sponsorName?: string;
  sponsorMessage?: string;
  sponsorUrl?: string;
  level: TournamentLevel;
  status: TournamentStatus;
  tournamentAt: string;
  registrationDeadline: string;
  timeZone: string;
  maximumTeams: 2 | 4 | 8 | 16;
  quizSetId: string;
  quizSetName: string;
  rules: OfficialMatchSettings;
  invitationCodes?: string[];
  studyPack?: TournamentStudyPack;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  championTeamId?: string;
  runnerUpTeamId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type TournamentState = {
  tournaments: Map<string, Tournament>;
  auditEvents: TournamentAuditEvent[];
  nextId: () => string;
};

export const isTournamentStatus = (value: unknown): value is TournamentStatus =>
  typeof value === "string" && (TOURNAMENT_STATUSES as readonly string[]).includes(value);

export const isTournamentLevel = (value: unknown): value is TournamentLevel =>
  typeof value === "string" && (TOURNAMENT_LEVELS as readonly string[]).includes(value);

export const isMatchStatus = (value: unknown): value is TournamentMatchStatus =>
  typeof value === "string" && (MATCH_STATUSES as readonly string[]).includes(value);

export const tournamentStatusLabel = (status: TournamentStatus) => status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const slugifyTournamentTitle = (value: string) => {
  const slug = value.trim().toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 72) || "quizstrike-tournament";
};

export const secureInvitationCode = () => randomBytes(9).toString("base64url").slice(0, 12).toUpperCase();

export const sanitizeSponsorUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const candidate = value.trim();
  if (candidate.length > 320) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export const sanitizeStudyItems = (value: unknown, nextId: () => string): TournamentStudyItem[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).map((item, index) => {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const text = (key: string, max: number) => typeof source[key] === "string" ? source[key]!.trim().slice(0, max) : "";
    const term = text("term", 120);
    return {
      id: text("id", 80) || nextId(),
      term,
      ...(text("pronunciation", 120) ? { pronunciation: text("pronunciation", 120) } : {}),
      ...(text("meaning", 240) ? { meaning: text("meaning", 240) } : {}),
      ...(text("example", 320) ? { example: text("example", 320) } : {}),
      ...(text("note", 240) ? { note: text("note", 240) } : {}),
      sortOrder: Number.isFinite(Number(source.sortOrder)) ? Math.max(0, Math.floor(Number(source.sortOrder))) : index
    };
  }).filter((item) => item.term.length > 0);
};

export const publicStudyPack = (pack: TournamentStudyPack | undefined, at = new Date()) => {
  const releaseAt = pack ? new Date(pack.releaseAt).getTime() : Number.NaN;
  if (!pack || !Number.isFinite(releaseAt) || releaseAt > at.getTime()) return undefined;
  return {
    releaseAt: pack.releaseAt,
    releasedAt: pack.releasedAt,
    items: [...pack.items].sort((a, b) => a.sortOrder - b.sortOrder).map(({ id, term, pronunciation, meaning, example, note, sortOrder }) => ({
      id, term, pronunciation, meaning, example, note, sortOrder
    }))
  };
};

export const isStudyPackReleased = (tournament: Pick<Tournament, "status" | "studyPack">, at = new Date()) => {
  const pack = tournament.studyPack;
  if (!pack || tournament.status === "DRAFT" || tournament.status === "CANCELLED") return false;
  if (pack.releasedAt) return true;
  const releaseAt = new Date(pack.releaseAt).getTime();
  return Number.isFinite(releaseAt) && releaseAt <= at.getTime();
};

export const publicTeam = (team: TournamentTeam) => ({
  id: team.id,
  teamName: team.teamName,
  schoolName: team.schoolName,
  className: team.className,
  color: team.color,
  registrationStatus: team.registrationStatus,
  checkedIn: team.checkedIn,
  rosterSize: team.roster.length,
  substituteCount: team.substitutes.length
});

export const publicTournament = (tournament: Tournament, at = new Date()) => ({
  id: tournament.id,
  slug: tournament.slug,
  title: tournament.title,
  description: tournament.description,
  sponsorName: tournament.sponsorName,
  sponsorMessage: tournament.sponsorMessage,
  sponsorUrl: tournament.sponsorUrl,
  level: tournament.level,
  status: tournament.status,
  tournamentAt: tournament.tournamentAt,
  registrationDeadline: tournament.registrationDeadline,
  timeZone: tournament.timeZone,
  maximumTeams: tournament.maximumTeams,
  quizSetName: tournament.quizSetName,
  gameMode: tournament.rules.gameMode,
  arena: tournament.rules.mapId,
  studyPack: publicStudyPack(tournament.studyPack, at),
  studyPackReleaseAt: tournament.studyPack?.releaseAt,
  teams: tournament.teams.map(publicTeam),
  matches: tournament.matches.map((match) => ({
    id: match.id,
    roundNumber: match.roundNumber,
    roundLabel: match.roundLabel,
    bracketPosition: match.bracketPosition,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    teamAName: tournament.teams.find((team) => team.id === match.teamAId)?.teamName,
    teamBName: tournament.teams.find((team) => team.id === match.teamBId)?.teamName,
    scheduledAt: match.scheduledAt,
    status: match.status,
    result: match.result ? {
      teamAScore: match.result.teamAScore,
      teamBScore: match.result.teamBScore,
      winnerTeamId: match.result.winnerTeamId,
      learning: match.result.learning
    } : undefined,
    winnerTeamId: match.winnerTeamId
  })),
  championTeamId: tournament.championTeamId,
  runnerUpTeamId: tournament.runnerUpTeamId
});

export const tournamentSettingsSnapshot = (settings: OfficialMatchSettings): OfficialMatchSettings =>
  JSON.parse(JSON.stringify(settings)) as OfficialMatchSettings;

export const nextBracketSize = (teamCount: number): 2 | 4 | 8 | 16 => {
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 16) throw new Error("A tournament needs between 2 and 16 teams.");
  if (teamCount <= 2) return 2;
  if (teamCount <= 4) return 4;
  if (teamCount <= 8) return 8;
  return 16;
};

const roundLabel = (roundNumber: number, totalRounds: number) => {
  if (roundNumber === totalRounds) return "Final";
  if (roundNumber === totalRounds - 1) return "Semifinal";
  if (roundNumber === totalRounds - 2) return "Quarterfinal";
  return `Round ${roundNumber}`;
};

const matchTime = (tournamentAt: string, roundNumber: number, position: number) => {
  const base = new Date(tournamentAt).getTime();
  const offset = ((roundNumber - 1) * 90 + (position - 1) * 20) * 60_000;
  return new Date(base + offset).toISOString();
};

const sourceMatch = (matches: TournamentMatch[], round: number, position: number) =>
  matches.find((match) => match.roundNumber === round && match.bracketPosition === position);

const isResolved = (match: TournamentMatch) => Boolean(match.winnerTeamId) && (match.status === "BYE" || match.status === "COMPLETED" || match.status === "FORFEIT");

const propagateKnownWinners = (tournament: Tournament) => {
  const checkedIn = (teamId: string) => tournament.teams.some((team) => team.id === teamId && team.checkedIn);
  const maxRound = Math.max(...tournament.matches.map((match) => match.roundNumber));
  for (let round = 2; round <= maxRound; round += 1) {
    const matchesInRound = tournament.matches.filter((match) => match.roundNumber === round);
    for (const match of matchesInRound) {
      const left = sourceMatch(tournament.matches, round - 1, (match.bracketPosition * 2) - 1);
      const right = sourceMatch(tournament.matches, round - 1, match.bracketPosition * 2);
      const leftWinner = left && isResolved(left) ? left.winnerTeamId : undefined;
      const rightWinner = right && isResolved(right) ? right.winnerTeamId : undefined;
      if (leftWinner) {
        match.teamAId = leftWinner;
        if (checkedIn(leftWinner) && !match.checkedInTeamIds.includes(leftWinner)) match.checkedInTeamIds.push(leftWinner);
      }
      if (rightWinner) {
        match.teamBId = rightWinner;
        if (checkedIn(rightWinner) && !match.checkedInTeamIds.includes(rightWinner)) match.checkedInTeamIds.push(rightWinner);
      }
      if (match.teamAId && !match.teamBId && right && !right.teamAId && !right.teamBId && isResolved(left ?? { status: "SCHEDULED" } as TournamentMatch)) {
        match.status = "BYE";
        match.winnerTeamId = match.teamAId;
      } else if (match.teamBId && !match.teamAId && left && !left.teamAId && !left.teamBId && isResolved(right ?? { status: "SCHEDULED" } as TournamentMatch)) {
        match.status = "BYE";
        match.winnerTeamId = match.teamBId;
      } else if (match.teamAId && match.teamBId && match.status === "BYE") {
        match.status = "SCHEDULED";
        match.winnerTeamId = undefined;
      }
    }
  }
};

export const generateSingleEliminationBracket = (tournament: Tournament, at = new Date()) => {
  const approved = tournament.teams.filter((team) => team.registrationStatus === "APPROVED");
  const bracketSize = nextBracketSize(approved.length);
  const sortedTeams = [...approved].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const totalRounds = Math.log2(bracketSize);
  const matches: TournamentMatch[] = [];
  let counter = 0;
  for (let round = 1; round <= totalRounds; round += 1) {
    const matchesInRound = bracketSize / (2 ** round);
    for (let position = 1; position <= matchesInRound; position += 1) {
      const match: TournamentMatch = {
        id: `${tournament.id}-match-${++counter}`,
        tournamentId: tournament.id,
        roundNumber: round,
        roundLabel: roundLabel(round, totalRounds),
        bracketPosition: position,
        scheduledAt: matchTime(tournament.tournamentAt, round, position),
        status: "SCHEDULED",
        checkedInTeamIds: [],
        createdAt: at.toISOString(),
        updatedAt: at.toISOString()
      };
      if (round === 1) {
        match.teamAId = sortedTeams[(position - 1) * 2]?.id;
        match.teamBId = sortedTeams[(position - 1) * 2 + 1]?.id;
        match.checkedInTeamIds = [match.teamAId, match.teamBId].filter((teamId): teamId is string => Boolean(teamId && tournament.teams.find((team) => team.id === teamId)?.checkedIn));
        if (match.teamAId && !match.teamBId) {
          match.status = "BYE";
          match.winnerTeamId = match.teamAId;
        } else if (!match.teamAId && match.teamBId) {
          match.status = "BYE";
          match.winnerTeamId = match.teamBId;
        }
      }
      matches.push(match);
    }
  }
  tournament.matches = matches;
  propagateKnownWinners(tournament);
  tournament.updatedAt = at.toISOString();
  return matches;
};

export const advanceMatchWinner = (tournament: Tournament, match: TournamentMatch, winnerTeamId: string, at = new Date()) => {
  if (!match.teamAId || !match.teamBId || ![match.teamAId, match.teamBId].includes(winnerTeamId)) return { ok: false as const, error: "Winner must be one of the participating teams." };
  if (match.status === "COMPLETED" || match.status === "FORFEIT") return { ok: false as const, error: "This match already has a verified result." };
  if (match.status === "BYE" || match.status === "CANCELLED") return { ok: false as const, error: "This match is not available for a played result." };
  match.winnerTeamId = winnerTeamId;
  match.status = "COMPLETED";
  match.updatedAt = at.toISOString();
  const next = tournament.matches.find((candidate) => candidate.roundNumber === match.roundNumber + 1 && candidate.bracketPosition === Math.ceil(match.bracketPosition / 2));
  if (next) {
    if (match.bracketPosition % 2 === 1) next.teamAId = winnerTeamId;
    else next.teamBId = winnerTeamId;
    next.updatedAt = at.toISOString();
  } else {
    tournament.championTeamId = winnerTeamId;
    tournament.status = "COMPLETED";
  }
  propagateKnownWinners(tournament);
  tournament.updatedAt = at.toISOString();
  return { ok: true as const, nextMatch: next };
};

export const verifySessionResult = ({
  tournament: _tournament,
  match,
  session,
  report,
  at = new Date()
}: {
  tournament: Tournament;
  match: TournamentMatch;
  session: { id: string; status: string; roundWins?: { blue: number; red: number }; players?: Array<{ team: "blue" | "red"; score: number; correctAnswers: number; wrongAnswers: number }> };
  report?: SessionReport;
  at?: Date;
}) => {
  if (session.status !== "ended") return { ok: false as const, error: "The official QuizStrike session has not ended yet." };
  if (!match.teamAId || !match.teamBId) return { ok: false as const, error: "Both match participants must be known before linking a result." };
  const playerScoreA = session.players?.filter((player) => player.team === "blue").reduce((sum, player) => sum + player.score, 0) ?? 0;
  const playerScoreB = session.players?.filter((player) => player.team === "red").reduce((sum, player) => sum + player.score, 0) ?? 0;
  const hasDecisiveRoundWins = session.roundWins !== undefined && session.roundWins.blue !== session.roundWins.red;
  const teamAScore = hasDecisiveRoundWins ? session.roundWins!.blue : playerScoreA;
  const teamBScore = hasDecisiveRoundWins ? session.roundWins!.red : playerScoreB;
  if (teamAScore === teamBScore) return { ok: false as const, error: "The server result is tied; resolve the match through a supported game outcome before advancing." };
  const winnerTeamId = teamAScore > teamBScore ? match.teamAId : match.teamBId;
  const runnerUpTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
  const accuracyRows = report?.rows ?? [];
  const attempted = accuracyRows.reduce((sum, row) => sum + row.correctAnswers + row.wrongAnswers, 0);
  const correct = accuracyRows.reduce((sum, row) => sum + row.correctAnswers, 0);
  const result: TournamentMatchResult = {
    teamAScore,
    teamBScore,
    winnerTeamId,
    runnerUpTeamId,
    verifiedAt: at.toISOString(),
    sourceSessionId: session.id,
    ...(report ? {
      learning: {
        averageAccuracy: attempted > 0 ? correct / attempted : undefined,
        missedMaterial: report.missedQuestions.slice(0, 8).map((item) => item.prompt)
      }
    } : {})
  };
  return { ok: true as const, result };
};

export const canManageTournament = (user: TeacherUser, tournament: Tournament) => user.id === tournament.ownerId || user.role === "admin";

export const canManageTeam = (user: TeacherUser, tournament: Tournament, team: TournamentTeam) =>
  canManageTournament(user, tournament) || user.id === team.managerUserId;

export const validStatusTransition = (from: TournamentStatus, to: TournamentStatus) => {
  if (from === to) return true;
  const transitions: Record<TournamentStatus, TournamentStatus[]> = {
    DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
    REGISTRATION_OPEN: ["STUDY_PACK_RELEASED", "CHECK_IN", "CANCELLED"],
    STUDY_PACK_RELEASED: ["CHECK_IN", "CANCELLED"],
    CHECK_IN: ["LIVE", "CANCELLED"],
    LIVE: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: []
  };
  return transitions[from].includes(to);
};

export const createTournamentState = () => {
  let counter = 0;
  const state: TournamentState = {
    tournaments: new Map<string, Tournament>(),
    auditEvents: [] as TournamentAuditEvent[],
    nextId: () => `tournament-${Date.now()}-${++counter}`
  };
  return state;
};
