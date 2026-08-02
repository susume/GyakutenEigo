import type { Express, Request, RequestHandler, Response } from "express";
import type { TeacherUser } from "@quizstrike/shared";
import {
  buildEliminationBracket,
  canAccessMatchRoom,
  canManageCompetition,
  canViewStudyPack,
  confirmMatchResult,
  effectiveCompetitionStatus,
  isCompetitionStatus,
  isCompetitionType,
  notificationsForUser,
  publicCompetition,
  scheduleCompetitionNotifications,
  safeTeam,
  seedCompetitions,
  syncCompetitionStatus,
  validateTeamRegistration,
  type Competition,
  type CompetitionAnnouncement,
  type CompetitionAuditLog,
  type CompetitionNotification,
  type CompetitionRosterPlayer,
  type CompetitionState,
  type CompetitionType,
  type StudyPack
} from "../competitionDomain.js";

type AuthenticatedRequest = Request & { user?: TeacherUser };

export type CompetitionRouteDependencies = {
  requireTeacher: RequestHandler;
  getBearerUser: (req: Request) => TeacherUser | undefined;
  getSessionByCode?: (code: string) => { sessionCode: string; teacherId: string } | undefined;
  getPlayerToken?: (req: Request) => string;
  canReadOfficialSession?: (code: string, token: string) => string | undefined;
  state: CompetitionState;
  now: () => string;
  schedulePersistence?: () => void;
};

const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const json = (value: unknown) => JSON.stringify(value ?? null);

const safeCompetition = (competition: Competition, viewer: TeacherUser | undefined, now: Date) => {
  syncCompetitionStatus(competition, now);
  return publicCompetition(competition, viewer ? { userId: viewer.id, role: viewer.role } : undefined, now);
};

const audit = (state: CompetitionState, input: Omit<CompetitionAuditLog, "id" | "createdAt">, now: string) => {
  state.auditLogs.push({ ...input, id: state.nextId(), createdAt: now });
};

const ownerOr404 = (req: AuthenticatedRequest, res: Response, competition: Competition | undefined) => {
  if (!competition) {
    res.status(404).json({ error: "Competition not found." });
    return undefined;
  }
  if (!canManageCompetition(req.user!, competition)) {
    res.status(403).json({ error: "Organizer permission is required for this competition." });
    return undefined;
  }
  return competition;
};

const parseRoster = (value: unknown): CompetitionRosterPlayer[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((player, index) => {
    const item = (player ?? {}) as Record<string, unknown>;
    return {
      id: clean(item.id, 80) || `roster-${index + 1}`,
      displayName: clean(item.displayName, 80),
      ...(clean(item.playerKey, 120) ? { playerKey: clean(item.playerKey, 120) } : {})
    };
  });
};

const notificationFor = (notification: CompetitionNotification, competition: Competition) => ({
  ...notification,
  competitionSlug: competition.slug,
  competitionName: competition.name
});

export const registerCompetitionRoutes = (app: Express, deps: CompetitionRouteDependencies) => {
  const { requireTeacher, getBearerUser, state, now, getSessionByCode, getPlayerToken, canReadOfficialSession } = deps;
  const persist = () => deps.schedulePersistence?.();

  const tick = () => {
    const at = new Date(now());
    const notificationCount = state.notifications.size;
    scheduleCompetitionNotifications(state, at);
    for (const competition of state.competitions.values()) syncCompetitionStatus(competition, at);
    if (notificationCount !== state.notifications.size) persist();
    return at;
  };

  app.get("/api/competitions", (req, res) => {
    const at = tick();
    const type = clean(req.query.type, 60);
    const status = clean(req.query.status, 60);
    const division = clean(req.query.division, 120);
    const region = clean(req.query.region, 120);
    const difficulty = clean(req.query.difficulty, 80);
    const viewer = getBearerUser(req);
    const competitions = [...state.competitions.values()]
      .filter((competition) => competition.visibility === "PUBLIC")
      .filter((competition) => !type || competition.type === type)
      .filter((competition) => !status || effectiveCompetitionStatus(competition, at) === status)
      .filter((competition) => !division || competition.division === division)
      .filter((competition) => !region || competition.region === region)
      .filter((competition) => !difficulty || competition.difficulty === difficulty)
      .map((competition) => safeCompetition(competition, viewer, at));
    res.json({ now: at.toISOString(), featured: competitions[0], competitions });
  });

  app.get("/api/competitions/mine", requireTeacher, (req: AuthenticatedRequest, res) => {
    const at = tick();
    const teams = [...state.competitions.values()].flatMap((competition) => competition.teams
      .filter((team) => team.captainUserId === req.user!.id || team.coachUserId === req.user!.id)
      .map((team) => ({
        ...safeTeam(team),
        competitionId: competition.id,
        competitionSlug: competition.slug,
        competitionName: competition.name,
        status: effectiveCompetitionStatus(competition, at),
        studyPackReleased: canViewStudyPack(competition, { userId: req.user!.id, role: req.user!.role }, at),
        nextMatch: competition.matches.find((match) => match.homeTeamId === team.id || match.awayTeamId === team.id),
        unreadAnnouncements: competition.announcements.filter((announcement) => announcement.publishedAt > team.updatedAt).length
      })));
    res.json({ now: at.toISOString(), teams, notifications: notificationsForUser(state, req.user!.id).map((item) => notificationFor(item, state.competitions.get(item.competitionId)!)) });
  });

  app.get("/api/competitions/:slug", (req, res) => {
    const at = tick();
    const competition = [...state.competitions.values()].find((item) => item.slug === routeParam(req.params.slug));
    const viewer = getBearerUser(req);
    if (!competition || (competition.visibility === "INVITATION_ONLY" && !viewer)) {
      res.status(404).json({ error: "Competition not found." });
      return;
    }
    res.json({ now: at.toISOString(), competition: safeCompetition(competition, viewer, at) });
  });

  app.get("/api/competitions/:slug/study-pack", (req, res) => {
    const at = tick();
    const competition = [...state.competitions.values()].find((item) => item.slug === routeParam(req.params.slug));
    const viewer = getBearerUser(req);
    if (!competition || !competition.studyPack) {
      res.status(404).json({ error: "Study pack not found." });
      return;
    }
    if (!canViewStudyPack(competition, viewer ? { userId: viewer.id, role: viewer.role } : undefined, at)) {
      res.status(403).json({ error: "The official study pack is locked until its server-controlled release time.", releaseAt: competition.studyPack.releaseAt });
      return;
    }
    res.json({ now: at.toISOString(), studyPack: competition.studyPack });
  });

  app.get("/api/competitions/:slug/matches", (req, res) => {
    const at = tick();
    const competition = [...state.competitions.values()].find((item) => item.slug === routeParam(req.params.slug));
    if (!competition || (competition.visibility === "INVITATION_ONLY" && !getBearerUser(req))) {
      res.status(404).json({ error: "Competition not found." });
      return;
    }
    res.json({ now: at.toISOString(), matches: competition.matches.map((match) => ({ ...match, homeTeamName: competition.teams.find((team) => team.id === match.homeTeamId)?.teamName, awayTeamName: competition.teams.find((team) => team.id === match.awayTeamId)?.teamName })) });
  });

  app.post("/api/competitions/:slug/teams", requireTeacher, (req: AuthenticatedRequest, res) => {
    const at = tick();
    const competition = [...state.competitions.values()].find((item) => item.slug === routeParam(req.params.slug));
    if (!competition) {
      res.status(404).json({ error: "Competition not found." });
      return;
    }
    if (competition.teams.some((team) => team.captainUserId === req.user!.id || team.coachUserId === req.user!.id)) {
      res.status(409).json({ error: "You already manage a team in this competition." });
      return;
    }
    const activePlayers = parseRoster(req.body?.activePlayers);
    const substitutePlayers = parseRoster(req.body?.substitutePlayers);
    const validation = validateTeamRegistration({ competition, teamName: clean(req.body?.teamName, 80), affiliation: clean(req.body?.affiliation, 120), activePlayers, substitutePlayers, invitationCode: clean(req.body?.invitationCode, 80), at });
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const team = {
      id: state.nextId(),
      competitionId: competition.id,
      teamName: clean(req.body?.teamName, 80),
      affiliation: clean(req.body?.affiliation, 120),
      ...(clean(req.body?.logoUrl, 500) ? { logoUrl: clean(req.body?.logoUrl, 500) } : {}),
      captainUserId: req.user!.id,
      captainName: req.user!.name,
      ...(clean(req.body?.coachUserId, 80) ? { coachUserId: clean(req.body?.coachUserId, 80), coachName: clean(req.body?.coachName, 120) } : {}),
      activePlayers,
      substitutePlayers,
      registrationStatus: "PENDING" as const,
      eligibilityStatus: "PENDING" as const,
      checkInStatus: "NOT_OPEN" as const,
      division: competition.division,
      ...(competition.visibility === "INVITATION_ONLY" ? { invitationCode: clean(req.body?.invitationCode, 80) } : {}),
      createdAt: at.toISOString(),
      updatedAt: at.toISOString()
    };
    competition.teams.push(team);
    competition.updatedAt = at.toISOString();
    persist();
    audit(state, { competitionId: competition.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "TEAM_REGISTERED", detail: json({ teamId: team.id, teamName: team.teamName }) }, at.toISOString());
    res.status(201).json({ team: safeTeam(team), competition: safeCompetition(competition, req.user, at) });
  });

  app.post("/api/competition-teams/:teamId/check-in", requireTeacher, (req: AuthenticatedRequest, res) => {
    const teamId = routeParam(req.params.teamId);
    const competition = [...state.competitions.values()].find((item) => item.teams.some((team) => team.id === teamId));
    const team = competition?.teams.find((item) => item.id === teamId);
    if (!competition || !team) {
      res.status(404).json({ error: "Team not found." });
      return;
    }
    if (team.captainUserId !== req.user!.id && team.coachUserId !== req.user!.id && !canManageCompetition(req.user!, competition)) {
      res.status(403).json({ error: "Only the captain, coach, or organizer can check in this team." });
      return;
    }
    if (effectiveCompetitionStatus(competition, new Date(now())) !== "CHECK_IN" && !canManageCompetition(req.user!, competition)) {
      res.status(409).json({ error: "Official check-in is not open yet." });
      return;
    }
    team.checkInStatus = "CHECKED_IN";
    team.updatedAt = now();
    persist();
    res.json({ team: safeTeam(team) });
  });

  app.get("/api/competition-matches/:matchId/room", (req, res) => {
    const competition = [...state.competitions.values()].find((item) => item.matches.some((match) => match.id === routeParam(req.params.matchId)));
    const match = competition?.matches.find((item) => item.id === routeParam(req.params.matchId));
    const viewer = getBearerUser(req);
    const playerToken = getPlayerToken?.(req) ?? "";
    if (!competition || !match) {
      res.status(403).json({ error: "You are not an approved participant for this official match room." });
      return;
    }
    const officialPlayerDisplayName = match.sessionCode ? canReadOfficialSession?.(match.sessionCode, playerToken) : undefined;
    if (!canAccessMatchRoom({ competition, match, userId: viewer?.id, isPlayerTokenAuthorized: Boolean(officialPlayerDisplayName), playerDisplayName: officialPlayerDisplayName })) {
      res.status(403).json({ error: "You are not an approved participant for this official match room." });
      return;
    }
    res.json({ matchId: match.id, sessionCode: match.sessionCode, joinPath: match.sessionCode ? `/join?code=${encodeURIComponent(match.sessionCode)}` : undefined });
  });

  app.post("/api/competitions", requireTeacher, (req: AuthenticatedRequest, res) => {
    if (req.user!.role !== "admin") {
      res.status(403).json({ error: "Admin permission is required to create an official competition." });
      return;
    }
    const at = new Date(now());
    const name = clean(req.body?.name, 160);
    const type = clean(req.body?.type, 60);
    if (name.length < 3 || !isCompetitionType(type)) {
      res.status(400).json({ error: "Competition name and a supported competition type are required." });
      return;
    }
    const slug = clean(req.body?.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!slug || [...state.competitions.values()].some((item) => item.slug === slug)) {
      res.status(409).json({ error: "Choose a unique URL slug." });
      return;
    }
    const [competition] = seedCompetitions({ id: req.user!.id, name: req.user!.name }, at, state.nextId);
    Object.assign(competition, {
      id: state.nextId(), slug, name, type: type as CompetitionType, status: "DRAFT",
      description: clean(req.body?.description, 1000) || "Official QuizStrike Classroom competition.",
      registrationOpensAt: clean(req.body?.registrationOpensAt, 80) || at.toISOString(),
      registrationClosesAt: clean(req.body?.registrationClosesAt, 80) || at.toISOString(),
      rosterDeadline: clean(req.body?.rosterDeadline, 80) || at.toISOString(),
      studyPackReleaseAt: clean(req.body?.studyPackReleaseAt, 80) || at.toISOString(),
      matchStartAt: clean(req.body?.matchStartAt, 80) || at.toISOString(),
      matchEndAt: clean(req.body?.matchEndAt, 80) || at.toISOString(),
      studyPack: undefined,
      announcements: [], teams: [], matches: [], createdAt: at.toISOString(), updatedAt: at.toISOString()
    });
    state.competitions.set(competition.id, competition);
    persist();
    audit(state, { competitionId: competition.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "COMPETITION_CREATED", detail: json({ slug, type }) }, at.toISOString());
    res.status(201).json({ competition: safeCompetition(competition, req.user, at) });
  });

  app.patch("/api/competitions/:id", requireTeacher, (req: AuthenticatedRequest, res) => {
    const competition = ownerOr404(req, res, state.competitions.get(routeParam(req.params.id)));
    if (!competition) return;
    const at = new Date(now());
    const allowed = ["name", "description", "coverImage", "sponsorName", "sponsorArtwork", "status", "division", "difficulty", "region", "timeZone", "registrationOpensAt", "registrationClosesAt", "rosterDeadline", "studyPackReleaseAt", "matchStartAt", "matchEndAt", "activeTeamSize", "substituteLimit", "maximumTeams", "matchFormat", "gameMode", "rulesVersion", "prizeDescription", "visibility", "streamingStatus"] as const;
    for (const key of allowed) if (req.body?.[key] !== undefined) {
      if (key === "status" && !isCompetitionStatus(req.body[key])) continue;
      (competition as unknown as Record<string, unknown>)[key] = typeof req.body[key] === "string" ? clean(req.body[key], 1000) : req.body[key];
    }
    competition.updatedAt = at.toISOString();
    persist();
    audit(state, { competitionId: competition.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "COMPETITION_UPDATED", detail: json(req.body) }, at.toISOString());
    res.json({ competition: safeCompetition(competition, req.user, at) });
  });

  app.post("/api/competitions/:id/announcements", requireTeacher, (req: AuthenticatedRequest, res) => {
    const competition = ownerOr404(req, res, state.competitions.get(routeParam(req.params.id)));
    if (!competition) return;
    const at = now();
    const announcement: CompetitionAnnouncement = { id: state.nextId(), title: clean(req.body?.title, 160), body: clean(req.body?.body, 1200), publishedAt: at, publishedByName: req.user!.name, pinned: Boolean(req.body?.pinned) };
    if (!announcement.title || !announcement.body) {
      res.status(400).json({ error: "Announcement title and body are required." });
      return;
    }
    competition.announcements.unshift(announcement);
    persist();
    audit(state, { competitionId: competition.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "ANNOUNCEMENT_PUBLISHED", detail: announcement.title }, at);
    res.status(201).json({ announcement });
  });

  app.post("/api/competitions/:id/study-pack", requireTeacher, (req: AuthenticatedRequest, res) => {
    const competition = ownerOr404(req, res, state.competitions.get(routeParam(req.params.id)));
    if (!competition) return;
    const at = new Date(now());
    const words = Array.isArray(req.body?.words) ? req.body.words : [];
    if (!words.length || words.length > 300) {
      res.status(400).json({ error: "Study pack must contain between 1 and 300 words." });
      return;
    }
    const previous = competition.studyPack;
    const pack: StudyPack = {
      id: previous?.id ?? state.nextId(), version: clean(req.body?.version, 30) || "1.0", releaseAt: clean(req.body?.releaseAt, 80) || competition.studyPackReleaseAt, correctionVersion: previous?.correctionVersion ?? 0,
      words: words.map((word: Record<string, unknown>, index: number) => ({ id: clean(word.id, 80) || state.nextId(), targetWord: clean(word.targetWord, 80), partOfSpeech: clean(word.partOfSpeech, 40), approvedTranslation: clean(word.approvedTranslation, 120), simpleDefinition: clean(word.simpleDefinition, 240), exampleSentence: clean(word.exampleSentence, 300), pronunciation: clean(word.pronunciation, 80), audioReference: clean(word.audioReference, 500), expressions: Array.isArray(word.expressions) ? word.expressions.map((item) => clean(item, 120)).filter(Boolean) : [], acceptedSpellingVariants: Array.isArray(word.acceptedSpellingVariants) ? word.acceptedSpellingVariants.map((item) => clean(item, 80)).filter(Boolean) : [], difficulty: word.difficulty === "FOUNDATION" || word.difficulty === "CHALLENGE" ? word.difficulty : "CORE", displayOrder: Number(word.displayOrder) || index + 1 })), correctionHistory: previous?.correctionHistory ?? []
    };
    competition.studyPack = pack;
    competition.studyPackReleaseAt = pack.releaseAt;
    persist();
    audit(state, { competitionId: competition.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "STUDY_PACK_SAVED", detail: json({ version: pack.version, words: pack.words.length }) }, at.toISOString());
    res.status(201).json({ studyPack: pack });
  });

  app.post("/api/competitions/:id/bracket", requireTeacher, (req: AuthenticatedRequest, res) => {
    const competition = ownerOr404(req, res, state.competitions.get(routeParam(req.params.id)));
    if (!competition) return;
    const matches = buildEliminationBracket(competition, new Date(now()));
    persist();
    audit(state, { competitionId: competition.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "BRACKET_GENERATED", detail: json({ matches: matches.length }) }, now());
    res.status(201).json({ matches });
  });

  app.post("/api/competition-matches/:matchId/room", requireTeacher, (req: AuthenticatedRequest, res) => {
    const competition = [...state.competitions.values()].find((item) => item.matches.some((match) => match.id === routeParam(req.params.matchId)));
    if (!ownerOr404(req, res, competition)) return;
    const match = competition!.matches.find((item) => item.id === routeParam(req.params.matchId))!;
    const sessionCode = clean(req.body?.sessionCode, 12).toUpperCase();
    if (!getSessionByCode?.(sessionCode)) {
      res.status(404).json({ error: "Create the private QuizStrike session first, then attach its room code." });
      return;
    }
    match.sessionCode = sessionCode;
    match.status = "CHECK_IN";
    persist();
    audit(state, { competitionId: competition!.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "MATCH_ROOM_OPENED", detail: json({ matchId: match.id, sessionCode }) }, now());
    res.json({ match });
  });

  app.post("/api/competition-matches/:matchId/result", requireTeacher, (req: AuthenticatedRequest, res) => {
    const competition = [...state.competitions.values()].find((item) => item.matches.some((match) => match.id === routeParam(req.params.matchId)));
    if (!ownerOr404(req, res, competition)) return;
    const result = confirmMatchResult({ competition: competition!, matchId: routeParam(req.params.matchId), result: { homeScore: Number(req.body?.homeScore), awayScore: Number(req.body?.awayScore), winnerTeamId: clean(req.body?.winnerTeamId, 80), mapScore: clean(req.body?.mapScore, 80), quizAccuracy: req.body?.quizAccuracy }, confirmedByName: req.user!.name, at: new Date(now()) });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    persist();
    audit(state, { competitionId: competition!.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "RESULT_CONFIRMED", detail: json(result.match.result) }, now());
    res.json({ match: result.match });
  });

  app.get("/api/organizer/competitions", requireTeacher, (req: AuthenticatedRequest, res) => {
    const at = tick();
    const competitions = [...state.competitions.values()].filter((competition) => canManageCompetition(req.user!, competition)).map((competition) => safeCompetition(competition, req.user, at));
    res.json({ now: at.toISOString(), competitions, auditLogs: state.auditLogs.filter((log) => competitions.some((item) => item.id === log.competitionId)).slice(-100).reverse() });
  });
};

export const createCompetitionState = (organizer: { id: string; name: string }, now = new Date()): CompetitionState => {
  let counter = 0;
  const nextId = () => `competition-${Date.now()}-${++counter}`;
  const competitions = new Map(seedCompetitions(organizer, now, nextId).map((competition) => [competition.id, competition]));
  const state: CompetitionState = { competitions, notifications: new Map(), auditLogs: [], nextId };
  scheduleCompetitionNotifications(state, now);
  return state;
};
