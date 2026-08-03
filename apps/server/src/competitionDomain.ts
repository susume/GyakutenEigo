import { randomUUID } from "node:crypto";
import type { TeacherUser } from "@quizstrike/shared";

export const COMPETITION_TYPES = ["SPONSORED", "SCHOOL_VS_SCHOOL", "CLAN_VS_CLASS"] as const;
export type CompetitionType = (typeof COMPETITION_TYPES)[number];

export const COMPETITION_STATUSES = [
  "DRAFT",
  "ANNOUNCED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "STUDY_PERIOD",
  "CHECK_IN",
  "LIVE",
  "COMPLETED",
  "CANCELLED"
] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export type CompetitionVisibility = "PUBLIC" | "INVITATION_ONLY";
export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type EligibilityStatus = "PENDING" | "ELIGIBLE" | "INELIGIBLE";
export type CheckInStatus = "NOT_OPEN" | "OPEN" | "CHECKED_IN" | "MISSED";
export type MatchStatus = "SCHEDULED" | "CHECK_IN" | "LIVE" | "CONFIRMED" | "DISPUTED";

export type CompetitionRosterPlayer = {
  id: string;
  displayName: string;
  /** Stable account or school-roster identifier when one exists. */
  playerKey?: string;
};

export type CompetitionTeam = {
  id: string;
  competitionId: string;
  teamName: string;
  affiliation: string;
  logoUrl?: string;
  captainUserId: string;
  captainName: string;
  coachUserId?: string;
  coachName?: string;
  activePlayers: CompetitionRosterPlayer[];
  substitutePlayers: CompetitionRosterPlayer[];
  registrationStatus: RegistrationStatus;
  eligibilityStatus: EligibilityStatus;
  checkInStatus: CheckInStatus;
  seed?: number;
  division: string;
  invitationCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type StudyWord = {
  id: string;
  targetWord: string;
  partOfSpeech: string;
  approvedTranslation: string;
  simpleDefinition: string;
  exampleSentence: string;
  pronunciation?: string;
  audioReference?: string;
  expressions: string[];
  acceptedSpellingVariants: string[];
  difficulty: "FOUNDATION" | "CORE" | "CHALLENGE";
  displayOrder: number;
};

export type StudyPack = {
  id: string;
  version: string;
  releaseAt: string;
  releasedAt?: string;
  correctionVersion: number;
  words: StudyWord[];
  correctionHistory: Array<{ version: number; note: string; publishedAt: string }>;
};

export type CompetitionAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  publishedByName: string;
  pinned?: boolean;
};

export type MatchResult = {
  homeScore: number;
  awayScore: number;
  winnerTeamId?: string;
  mapScore?: string;
  quizAccuracy?: { home: number; away: number };
  confirmedAt?: string;
  confirmedByName?: string;
};

export type CompetitionMatch = {
  id: string;
  competitionId: string;
  roundLabel: string;
  bracketPosition: number;
  homeTeamId?: string;
  awayTeamId?: string;
  scheduledAt: string;
  checkInOpensAt: string;
  map: string;
  gameMode: string;
  status: MatchStatus;
  sessionCode?: string;
  refereeName?: string;
  result?: MatchResult;
};

export type Competition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  sponsorName?: string;
  sponsorArtwork?: string;
  type: CompetitionType;
  organizerId: string;
  organizerName: string;
  status: CompetitionStatus;
  registrationOpensAt: string;
  registrationClosesAt: string;
  rosterDeadline: string;
  studyPackReleaseAt: string;
  matchStartAt: string;
  matchEndAt: string;
  region: string;
  timeZone: string;
  division: string;
  difficulty: string;
  activeTeamSize: number;
  substituteLimit: number;
  maximumTeams: number;
  matchFormat: string;
  mapPool: string[];
  gameMode: string;
  rulesVersion: string;
  prizeDescription: string;
  visibility: CompetitionVisibility;
  registrationRequirements: string[];
  streamingStatus: "OFF" | "APPROVAL_REQUIRED" | "APPROVED";
  rulesSummary: string[];
  studyPack?: StudyPack;
  announcements: CompetitionAnnouncement[];
  teams: CompetitionTeam[];
  matches: CompetitionMatch[];
  createdAt: string;
  updatedAt: string;
};

export type CompetitionNotification = {
  id: string;
  key: string;
  competitionId: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  recipientUserId?: string;
};

export type CompetitionAuditLog = {
  id: string;
  competitionId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type CompetitionState = {
  competitions: Map<string, Competition>;
  notifications: Map<string, CompetitionNotification>;
  auditLogs: CompetitionAuditLog[];
  nextId: () => string;
};

export const isCompetitionType = (value: unknown): value is CompetitionType =>
  typeof value === "string" && (COMPETITION_TYPES as readonly string[]).includes(value);

export const isCompetitionStatus = (value: unknown): value is CompetitionStatus =>
  typeof value === "string" && (COMPETITION_STATUSES as readonly string[]).includes(value);

const asDate = (value: string) => new Date(value).getTime();
const normalizePlayerKey = (player: CompetitionRosterPlayer) =>
  (player.playerKey ?? player.displayName).trim().toLocaleLowerCase();

export const studyPackReleased = (competition: Competition, at = new Date()) =>
  Boolean(competition.studyPack && asDate(competition.studyPack.releaseAt) <= at.getTime());

/** Derive public lifecycle state from server time and configured timestamps. */
export const effectiveCompetitionStatus = (competition: Competition, at = new Date()): CompetitionStatus => {
  if (competition.status === "CANCELLED" || competition.status === "COMPLETED" || competition.status === "DRAFT") {
    return competition.status;
  }
  const timestamp = at.getTime();
  if (timestamp < asDate(competition.registrationOpensAt)) return "ANNOUNCED";
  if (timestamp < asDate(competition.registrationClosesAt)) return "REGISTRATION_OPEN";
  if (timestamp < asDate(competition.studyPackReleaseAt)) return "STUDY_PERIOD";
  if (timestamp < asDate(competition.matchStartAt) - 30 * 60 * 1000) return "STUDY_PERIOD";
  if (timestamp < asDate(competition.matchStartAt)) return "CHECK_IN";
  if (timestamp < asDate(competition.matchEndAt)) return "LIVE";
  return "COMPLETED";
};

export const syncCompetitionStatus = (competition: Competition, at = new Date()) => {
  const next = effectiveCompetitionStatus(competition, at);
  if (competition.status !== next && competition.status !== "DRAFT" && competition.status !== "CANCELLED") {
    competition.status = next;
    competition.updatedAt = at.toISOString();
  }
  return competition.status;
};

export const canManageCompetition = (user: TeacherUser, competition: Competition) =>
  user.role === "admin" || user.id === competition.organizerId;

export const canViewStudyPack = (
  competition: Competition,
  viewer: { userId?: string; role?: TeacherUser["role"] } | undefined,
  at = new Date()
) => {
  if (studyPackReleased(competition, at)) {
    return competition.visibility === "PUBLIC" || Boolean(viewer?.userId);
  }
  return Boolean(viewer?.userId && (viewer.userId === competition.organizerId || viewer.role === "admin"));
};

export const safeTeam = (team: CompetitionTeam) => ({
  id: team.id,
  teamName: team.teamName,
  affiliation: team.affiliation,
  logoUrl: team.logoUrl,
  registrationStatus: team.registrationStatus,
  eligibilityStatus: team.eligibilityStatus,
  checkInStatus: team.checkInStatus,
  seed: team.seed,
  division: team.division,
  activeCount: team.activePlayers.length,
  substituteCount: team.substitutePlayers.length
});

export const publicCompetition = (
  competition: Competition,
  viewer: { userId?: string; role?: TeacherUser["role"] } | undefined,
  at = new Date()
) => {
  const released = canViewStudyPack(competition, viewer, at);
  return {
    ...competition,
    status: effectiveCompetitionStatus(competition, at),
    studyPack: released ? competition.studyPack : undefined,
    teams: competition.teams.map(safeTeam),
    matches: competition.matches.map((match) => ({
      ...match,
      homeTeamName: competition.teams.find((team) => team.id === match.homeTeamId)?.teamName,
      awayTeamName: competition.teams.find((team) => team.id === match.awayTeamId)?.teamName
    }))
  };
};

export const validateTeamRegistration = ({
  competition,
  teamName,
  affiliation,
  activePlayers,
  substitutePlayers,
  invitationCode,
  at = new Date()
}: {
  competition: Competition;
  teamName: string;
  affiliation: string;
  activePlayers: CompetitionRosterPlayer[];
  substitutePlayers: CompetitionRosterPlayer[];
  invitationCode?: string;
  at?: Date;
}) => {
  const status = effectiveCompetitionStatus(competition, at);
  if (status !== "REGISTRATION_OPEN") return { ok: false as const, error: "Team registration is not open." };
  if (competition.teams.length >= competition.maximumTeams) return { ok: false as const, error: "This competition has reached its team limit." };
  if (teamName.trim().length < 2 || teamName.trim().length > 80) return { ok: false as const, error: "Team name must be between 2 and 80 characters." };
  if (affiliation.trim().length < 2 || affiliation.trim().length > 120) return { ok: false as const, error: "Add a school, class, or clan affiliation." };
  if (activePlayers.length < 1 || activePlayers.length > competition.activeTeamSize) return { ok: false as const, error: `Add 1–${competition.activeTeamSize} active players.` };
  if (substitutePlayers.length > competition.substituteLimit) return { ok: false as const, error: `Add no more than ${competition.substituteLimit} substitutes.` };
  if (competition.visibility === "INVITATION_ONLY" && !invitationCode?.trim()) {
    return { ok: false as const, error: "An invitation code is required for this competition." };
  }
  const players = [...activePlayers, ...substitutePlayers];
  if (players.some((player) => !player.displayName.trim())) return { ok: false as const, error: "Every roster entry needs a display name." };
  const keys = players.map(normalizePlayerKey);
  if (new Set(keys).size !== keys.length) return { ok: false as const, error: "A player can only appear once on a team roster." };
  const registeredKeys = new Set(
    competition.teams.flatMap((team) => [...team.activePlayers, ...team.substitutePlayers].map(normalizePlayerKey))
  );
  if (keys.some((key) => registeredKeys.has(key))) return { ok: false as const, error: "One or more players already represent another team in this competition." };
  return { ok: true as const };
};

export const buildEliminationBracket = (competition: Competition, at = new Date()) => {
  const approved = competition.teams.filter((team) => team.registrationStatus === "APPROVED" && team.eligibilityStatus === "ELIGIBLE");
  const sorted = [...approved].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER));
  const matches: CompetitionMatch[] = [];
  for (let index = 0; index < sorted.length; index += 2) {
    const home = sorted[index];
    const away = sorted[index + 1];
    matches.push({
      id: `match-${competition.id}-${index / 2 + 1}`,
      competitionId: competition.id,
      roundLabel: sorted.length <= 2 ? "Final" : "Round 1",
      bracketPosition: index / 2 + 1,
      homeTeamId: home?.id,
      awayTeamId: away?.id,
      scheduledAt: competition.matchStartAt,
      checkInOpensAt: new Date(asDate(competition.matchStartAt) - 30 * 60 * 1000).toISOString(),
      map: competition.mapPool[index / 2 % Math.max(1, competition.mapPool.length)] ?? "Desert Citadel",
      gameMode: competition.gameMode,
      status: "SCHEDULED"
    });
  }
  competition.matches = matches;
  competition.updatedAt = at.toISOString();
  return matches;
};

export const confirmMatchResult = ({
  competition,
  matchId,
  result,
  confirmedByName,
  at = new Date()
}: {
  competition: Competition;
  matchId: string;
  result: Omit<MatchResult, "confirmedAt" | "confirmedByName">;
  confirmedByName: string;
  at?: Date;
}) => {
  const match = competition.matches.find((candidate) => candidate.id === matchId);
  if (!match) return { ok: false as const, error: "Match not found." };
  const teams = new Set([match.homeTeamId, match.awayTeamId]);
  if (!result.winnerTeamId || !teams.has(result.winnerTeamId)) return { ok: false as const, error: "Winner must be one of the scheduled teams." };
  if (result.homeScore < 0 || result.awayScore < 0) return { ok: false as const, error: "Scores cannot be negative." };
  match.result = { ...result, confirmedAt: at.toISOString(), confirmedByName };
  match.status = "CONFIRMED";
  const winner = competition.teams.find((team) => team.id === result.winnerTeamId);
  if (winner) winner.seed = Math.min(winner.seed ?? Number.MAX_SAFE_INTEGER, match.bracketPosition);
  competition.updatedAt = at.toISOString();
  return { ok: true as const, match };
};

export const canAccessMatchRoom = ({
  competition,
  match,
  userId,
  isPlayerTokenAuthorized = false,
  playerDisplayName
}: {
  competition: Competition;
  match: CompetitionMatch;
  userId?: string;
  isPlayerTokenAuthorized?: boolean;
  playerDisplayName?: string;
}) => {
  if (!match.sessionCode) return false;
  if (isPlayerTokenAuthorized) {
    if (!playerDisplayName) return true;
    const participatingTeams = competition.teams.filter((team) => team.id === match.homeTeamId || team.id === match.awayTeamId);
    const rosterNames = new Set(participatingTeams.flatMap((team) => [...team.activePlayers, ...team.substitutePlayers].map((player) => player.displayName.trim().toLocaleLowerCase())));
    return rosterNames.has(playerDisplayName.trim().toLocaleLowerCase());
  }
  if (!userId) return false;
  if (userId === competition.organizerId) return true;
  return competition.teams.some((team) =>
    (team.id === match.homeTeamId || team.id === match.awayTeamId) &&
    (team.captainUserId === userId || team.coachUserId === userId)
  );
};

const addNotification = (state: CompetitionState, notification: CompetitionNotification) => {
  if (!state.notifications.has(notification.key)) state.notifications.set(notification.key, notification);
};

/** Idempotent scheduler: every event is keyed by competition, kind, and trigger time. */
export const scheduleCompetitionNotifications = (state: CompetitionState, now = new Date()) => {
  for (const competition of state.competitions.values()) {
    syncCompetitionStatus(competition, now);
    const nowMs = now.getTime();
    const schedule: Array<{ kind: string; at: string; title: string; body: string }> = [
      { kind: "REGISTRATION_OPEN", at: competition.registrationOpensAt, title: "Registration is open", body: `${competition.name} is ready for team registrations.` },
      { kind: "REGISTRATION_DEADLINE", at: new Date(asDate(competition.registrationClosesAt) - 24 * 60 * 60 * 1000).toISOString(), title: "Registration deadline approaching", body: `Team registration closes tomorrow for ${competition.name}.` },
      { kind: "ROSTER_DEADLINE", at: new Date(asDate(competition.rosterDeadline) - 24 * 60 * 60 * 1000).toISOString(), title: "Roster deadline approaching", body: `Finalize your ${competition.name} roster by tomorrow.` },
      { kind: "STUDY_PACK_RELEASED", at: competition.studyPackReleaseAt, title: "Official study pack released", body: `The official word pack for ${competition.name} is now available.` },
      { kind: "STUDY_REMINDER", at: new Date(asDate(competition.matchStartAt) - 3 * 24 * 60 * 60 * 1000).toISOString(), title: "Study reminder", body: `Keep your team sharp before the ${competition.name} match.` },
      { kind: "FINAL_MATCH_REMINDER", at: new Date(asDate(competition.matchStartAt) - 24 * 60 * 60 * 1000).toISOString(), title: "Final match reminder", body: `Your ${competition.name} match begins tomorrow.` },
      { kind: "CHECK_IN_OPENED", at: new Date(asDate(competition.matchStartAt) - 30 * 60 * 1000).toISOString(), title: "Check-in is open", body: `Official check-in is open for ${competition.name}.` },
      { kind: "OFFICIAL_LOBBY_AVAILABLE", at: new Date(asDate(competition.matchStartAt) - 15 * 60 * 1000).toISOString(), title: "Official lobby available", body: `The official QuizStrike match lobby is ready.` }
    ];
    for (const event of schedule) {
      if (nowMs < asDate(event.at)) continue;
      addNotification(state, {
        id: state.nextId(),
        key: `${competition.id}:${event.kind}:${event.at}`,
        competitionId: competition.id,
        kind: event.kind,
        title: event.title,
        body: event.body,
        createdAt: now.toISOString()
      });
    }
  }
};

export const notificationsForUser = (state: CompetitionState, userId: string) => {
  const teamCompetitionIds = new Set(
    [...state.competitions.values()]
      .filter((competition) => competition.teams.some((team) => team.captainUserId === userId || team.coachUserId === userId))
      .map((competition) => competition.id)
  );
  return [...state.notifications.values()]
    .filter((notification) => notification.recipientUserId === userId || teamCompetitionIds.has(notification.competitionId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const seedCompetitions = (organizer: { id: string; name: string }, now = new Date(), nextId: () => string = () => randomUUID()): Competition[] => {
  const at = now.getTime();
  const days = (count: number) => new Date(at + count * 24 * 60 * 60 * 1000).toISOString();
  const featuredId = nextId();
  const create = (input: Partial<Competition> & Pick<Competition, "id" | "slug" | "name" | "type" | "registrationOpensAt" | "registrationClosesAt" | "rosterDeadline" | "studyPackReleaseAt" | "matchStartAt" | "matchEndAt">): Competition => ({
    description: "Official QuizStrike Classroom competition for teams that want to learn the word pack, play fair, and make every answer count.",
    coverImage: "/assets/quizstrike-classroom-cover.webp",
    sponsorName: undefined,
    sponsorArtwork: undefined,
    organizerId: organizer.id,
    organizerName: organizer.name,
    status: "REGISTRATION_OPEN",
    region: "Japan · Online",
    timeZone: "Asia/Tokyo",
    division: "Middle School · Year 1–3",
    difficulty: "Core",
    activeTeamSize: 4,
    substituteLimit: 1,
    maximumTeams: 16,
    matchFormat: "Single elimination",
    mapPool: ["Desert Citadel", "Iron Junction", "Temple Runoff"],
    gameMode: "Flag",
    rulesVersion: "QS-RULES-2026.1",
    prizeDescription: "Champion banner, classroom trophy, and official QuizStrike certificates.",
    visibility: "PUBLIC",
    registrationRequirements: ["Teacher or coach account", "Approved school, class, or clan affiliation", "Roster acceptance of the official rules"],
    streamingStatus: "APPROVAL_REQUIRED",
    rulesSummary: ["Server-authoritative match results", "Display names only in public standings", "One player may represent one team per competition"],
    studyPack: {
      id: `${input.id}-pack`,
      version: "1.0",
      releaseAt: input.studyPackReleaseAt,
      correctionVersion: 0,
      words: [
        { id: `${input.id}-word-1`, targetWord: "adapt", partOfSpeech: "verb", approvedTranslation: "適応する", simpleDefinition: "to change so you can work in a new situation", exampleSentence: "Teams adapt when the map changes.", pronunciation: "/əˈdæpt/", expressions: ["adapt to change"], acceptedSpellingVariants: [], difficulty: "CORE", displayOrder: 1 },
        { id: `${input.id}-word-2`, targetWord: "evidence", partOfSpeech: "noun", approvedTranslation: "証拠", simpleDefinition: "facts or signs that show something is true", exampleSentence: "The report includes evidence from the match.", pronunciation: "/ˈevɪdəns/", expressions: ["strong evidence"], acceptedSpellingVariants: [], difficulty: "CORE", displayOrder: 2 },
        { id: `${input.id}-word-3`, targetWord: "strategy", partOfSpeech: "noun", approvedTranslation: "戦略", simpleDefinition: "a plan for reaching a goal", exampleSentence: "Our strategy starts with careful study.", pronunciation: "/ˈstrætədʒi/", expressions: ["team strategy"], acceptedSpellingVariants: [], difficulty: "CHALLENGE", displayOrder: 3 }
      ],
      correctionHistory: []
    },
    announcements: [{ id: `${input.id}-welcome`, title: "Welcome to the official arena", body: "Study the published word pack, register your team, and watch this space for match-day notices.", publishedAt: now.toISOString(), publishedByName: organizer.name, pinned: true }],
    teams: [],
    matches: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...input
  });
  const featured = create({
    id: featuredId,
    slug: "classroom-cup-2026",
    name: "QuizStrike Classroom Cup 2026",
    type: "SPONSORED",
    sponsorName: "BrightPath Learning",
    registrationOpensAt: days(-1),
    registrationClosesAt: days(10),
    rosterDeadline: days(12),
    studyPackReleaseAt: days(3),
    matchStartAt: days(14),
    matchEndAt: days(15)
  });
  const school = create({
    id: nextId(),
    slug: "east-vs-west-schools",
    name: "East vs West School Series",
    type: "SCHOOL_VS_SCHOOL",
    description: "A school-to-school series built for teachers who want a friendly official fixture with a clear schedule and accessible results.",
    registrationOpensAt: days(8),
    registrationClosesAt: days(22),
    rosterDeadline: days(24),
    studyPackReleaseAt: days(20),
    matchStartAt: days(28),
    matchEndAt: days(29),
    status: "ANNOUNCED"
  });
  const clan = create({
    id: nextId(),
    slug: "clan-class-spring-series",
    name: "Clan vs Class Spring Series",
    type: "CLAN_VS_CLASS",
    description: "Bring a study clan or classroom squad into a short-format series with rotating maps and confirmed match results.",
    registrationOpensAt: days(-4),
    registrationClosesAt: days(5),
    rosterDeadline: days(7),
    studyPackReleaseAt: days(1),
    matchStartAt: days(9),
    matchEndAt: days(10)
  });
  return [featured, school, clan];
};
