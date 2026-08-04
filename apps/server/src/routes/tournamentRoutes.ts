import type { Application, Request, Response } from "express";
import { sanitizeSessionSettings, type GameSession, type SessionReport, type SessionSettings, type TeacherUser } from "@quizstrike/shared";
import {
  advanceMatchWinner,
  canManageTeam,
  canManageTournament,
  createTournamentState,
  generateSingleEliminationBracket,
  isTournamentLevel,
  publicStudyPack,
  publicTournament,
  sanitizeSponsorUrl,
  sanitizeStudyItems,
  secureInvitationCode,
  tournamentSettingsSnapshot,
  validStatusTransition,
  verifySessionResult,
  type OfficialMatchSettings,
  type Tournament,
  type TournamentAuditEvent,
  type TournamentRosterMember,
  type TournamentState,
  type TournamentTeam
} from "../tournamentDomain.js";

type AuthedRequest = Request & { user?: TeacherUser };

export type TournamentRouteDependencies = {
  requireTeacher: (req: AuthedRequest, res: Response, next: () => void) => void;
  getBearerUser: (req: Request) => TeacherUser | undefined;
  state: TournamentState;
  now: () => string;
  id: () => string;
  schedulePersistence: () => void;
  assertTeacherOwnsQuiz: (userId: string, quizSetId: string) => { id: string; title: string; questions: unknown[] } | undefined;
  getSessionByCode: (code: string) => GameSession | undefined;
  getStoredSessionReport?: (session: GameSession, teacherId?: string) => Promise<{ metadata: { id: string }; report: SessionReport } | undefined>;
};

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

const asOfficialSettings = (value: unknown): OfficialMatchSettings => {
  const input = value && typeof value === "object" ? value as Partial<OfficialMatchSettings> : {};
  const base: SessionSettings = sanitizeSessionSettings(input);
  return {
    ...base,
    teamSize: Math.min(12, Math.max(1, Number(input.teamSize) || 4)),
    preparationDurationSeconds: Math.min(300, Math.max(15, Number(input.preparationDurationSeconds) || 30)),
    botPolicy: input.botPolicy === "organizer_only" ? "organizer_only" : "none",
    rewardsEnabled: input.rewardsEnabled !== false
  };
};

const audit = (state: TournamentState, input: Omit<TournamentAuditEvent, "id" | "createdAt">, at: string) => {
  state.auditEvents.unshift({ ...input, id: state.nextId(), createdAt: at });
};

const internalTournament = (tournament: Tournament) => ({
  ...tournament,
  rules: tournamentSettingsSnapshot(tournament.rules),
  studyPack: tournament.studyPack ? {
    ...tournament.studyPack,
    items: [...tournament.studyPack.items].sort((a, b) => a.sortOrder - b.sortOrder)
  } : undefined,
  teams: tournament.teams.map((team) => ({ ...team, roster: [...team.roster], substitutes: [...team.substitutes] })),
  matches: tournament.matches.map((match) => ({ ...match, checkedInTeamIds: [...match.checkedInTeamIds], settingsSnapshot: match.settingsSnapshot ? tournamentSettingsSnapshot(match.settingsSnapshot) : undefined }))
});

const getTournament = (deps: TournamentRouteDependencies, id: string) => deps.state.tournaments.get(id);

const requireOwner = (deps: TournamentRouteDependencies, req: AuthedRequest, res: Response, id: string) => {
  const tournament = getTournament(deps, id);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found." });
    return undefined;
  }
  if (!canManageTournament(req.user!, tournament)) {
    res.status(403).json({ error: "Only the tournament owner or an approved organizer can manage this tournament." });
    return undefined;
  }
  return tournament;
};

const parseRoster = (value: unknown, nextId: () => string): TournamentRosterMember[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((entry) => {
    if (typeof entry === "string") return { id: nextId(), displayName: clean(entry, 48) };
    const source = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { id: clean(source.id, 80) || nextId(), displayName: clean(source.displayName, 48) };
  }).filter((member) => member.displayName.length > 0);
};

const safeOwnerView = (tournament: Tournament, at: Date) => ({
  ...internalTournament(tournament),
  public: publicTournament(tournament, at),
  studyPack: tournament.studyPack ? {
    ...tournament.studyPack,
    items: [...tournament.studyPack.items].sort((a, b) => a.sortOrder - b.sortOrder)
  } : undefined
});

const matchFor = (tournament: Tournament, matchId: string) => tournament.matches.find((match) => match.id === matchId);

const compareOfficialSettings = (session: GameSession, tournament: Tournament) => {
  const rules = tournament.rules;
  const settings = session.settings;
  return session.quizSetId === tournament.quizSetId &&
    settings.gameMode === rules.gameMode &&
    settings.mapId === rules.mapId &&
    settings.roundCount === rules.roundCount &&
    settings.roundDurationSeconds === rules.roundDurationSeconds &&
    settings.maxPlayers === rules.maxPlayers;
};

export const registerTournamentRoutes = (app: Application, deps: TournamentRouteDependencies) => {
  const persist = () => deps.schedulePersistence();
  const timestamp = () => new Date(deps.now());

  app.get("/api/tournaments", deps.requireTeacher, (req: AuthedRequest, res) => {
    const at = timestamp();
    const tournaments = [...deps.state.tournaments.values()]
      .filter((tournament) => canManageTournament(req.user!, tournament))
      .sort((left, right) => right.tournamentAt.localeCompare(left.tournamentAt))
      .map((tournament) => safeOwnerView(tournament, at));
    res.json({ now: at.toISOString(), tournaments });
  });

  app.get("/api/tournaments/:id", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    res.json({ now: deps.now(), tournament: safeOwnerView(tournament, timestamp()), auditEvents: deps.state.auditEvents.filter((event) => event.tournamentId === tournament.id).slice(0, 50) });
  });

  app.get("/api/tournament-study/:id", (req, res) => {
    const tournament = getTournament(deps, routeParam(req.params.id));
    const pack = publicStudyPack(tournament?.studyPack, timestamp());
    if (!tournament || !pack) {
      res.status(403).json({ error: "This study pack is not released yet." });
      return;
    }
    res.json({ tournament: { title: tournament.title, sponsorName: tournament.sponsorName, sponsorMessage: tournament.sponsorMessage }, studyPack: pack });
  });

  app.post("/api/tournaments", deps.requireTeacher, (req: AuthedRequest, res) => {
    const title = clean(req.body?.title, 160);
    const quizSetId = clean(req.body?.quizSetId, 80);
    const quiz = deps.assertTeacherOwnsQuiz(req.user!.id, quizSetId);
    const level = clean(req.body?.level, 40);
    const maximumTeams = Number(req.body?.maximumTeams);
    if (title.length < 3 || !quiz || !isTournamentLevel(level) || ![2, 4, 8, 16].includes(maximumTeams)) {
      res.status(400).json({ error: "Add a tournament title, an owned quiz set, supported competition level, and a 2/4/8/16 team limit." });
      return;
    }
    const at = timestamp();
    const slugBase = clean(req.body?.slug, 80) || title;
    let slug = slugBase.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || `tournament-${Date.now()}`;
    let suffix = 1;
    while ([...deps.state.tournaments.values()].some((candidate) => candidate.slug === slug)) slug = `${slugBase}-${suffix++}`.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    const tournament: Tournament = {
      id: deps.id(),
      slug,
      ownerId: req.user!.id,
      ownerName: req.user!.name,
      title,
      description: clean(req.body?.description, 800),
      ...(clean(req.body?.sponsorName, 120) ? { sponsorName: clean(req.body?.sponsorName, 120) } : {}),
      ...(clean(req.body?.sponsorMessage, 240) ? { sponsorMessage: clean(req.body?.sponsorMessage, 240) } : {}),
      ...(sanitizeSponsorUrl(req.body?.sponsorUrl) ? { sponsorUrl: sanitizeSponsorUrl(req.body?.sponsorUrl) } : {}),
      level,
      status: "DRAFT",
      tournamentAt: clean(req.body?.tournamentAt, 80) || new Date(at.getTime() + 7 * 86_400_000).toISOString(),
      registrationDeadline: clean(req.body?.registrationDeadline, 80) || new Date(at.getTime() + 5 * 86_400_000).toISOString(),
      timeZone: clean(req.body?.timeZone, 80) || "Asia/Tokyo",
      maximumTeams: maximumTeams as Tournament["maximumTeams"],
      quizSetId: quiz.id,
      quizSetName: quiz.title,
      rules: asOfficialSettings(req.body?.rules),
      teams: [],
      matches: [],
      createdAt: at.toISOString(),
      updatedAt: at.toISOString()
    };
    const items = sanitizeStudyItems(req.body?.studyItems, deps.id);
    if (items.length > 0) tournament.studyPack = { id: deps.id(), releaseAt: clean(req.body?.studyPackReleaseAt, 80) || at.toISOString(), items, updatedAt: at.toISOString() };
    deps.state.tournaments.set(tournament.id, tournament);
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "TOURNAMENT_CREATED" }, at.toISOString());
    persist();
    res.status(201).json({ tournament: safeOwnerView(tournament, at) });
  });

  app.patch("/api/tournaments/:id", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    if (tournament.status !== "DRAFT" && (req.body?.rules || req.body?.quizSetId || req.body?.maximumTeams)) {
      res.status(409).json({ error: "Official tournament settings can only be changed while the tournament is a draft." });
      return;
    }
    const at = timestamp();
    const editable = ["title", "description", "sponsorName", "sponsorMessage", "tournamentAt", "registrationDeadline", "timeZone"] as const;
    for (const key of editable) if (req.body?.[key] !== undefined) (tournament as unknown as Record<string, unknown>)[key] = clean(req.body[key], key === "description" ? 800 : 240);
    if (req.body?.sponsorUrl !== undefined) tournament.sponsorUrl = sanitizeSponsorUrl(req.body.sponsorUrl);
    if (req.body?.rules) tournament.rules = asOfficialSettings(req.body.rules);
    if (req.body?.quizSetId) {
      const quiz = deps.assertTeacherOwnsQuiz(req.user!.id, clean(req.body.quizSetId, 80));
      if (!quiz) { res.status(400).json({ error: "Choose one of your quiz sets." }); return; }
      tournament.quizSetId = quiz.id;
      tournament.quizSetName = quiz.title;
    }
    tournament.updatedAt = at.toISOString();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "TOURNAMENT_UPDATED" }, at.toISOString());
    persist();
    res.json({ tournament: safeOwnerView(tournament, at) });
  });

  app.post("/api/tournaments/:id/publish", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    if (tournament.status !== "DRAFT") { res.status(409).json({ error: "Only a draft tournament can be published." }); return; }
    if (!tournament.studyPack?.items.length) { res.status(400).json({ error: "Add at least one approved study item before publishing." }); return; }
    const at = timestamp();
    tournament.status = "REGISTRATION_OPEN";
    tournament.publishedAt = at.toISOString();
    tournament.updatedAt = at.toISOString();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "TOURNAMENT_PUBLISHED" }, at.toISOString());
    persist();
    res.json({ tournament: safeOwnerView(tournament, at) });
  });

  app.post("/api/tournaments/:id/study-pack", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    if (tournament.status !== "DRAFT" && tournament.status !== "REGISTRATION_OPEN") { res.status(409).json({ error: "The study pack can no longer be edited after release." }); return; }
    const items = sanitizeStudyItems(req.body?.items, deps.id);
    if (items.length === 0) { res.status(400).json({ error: "Add at least one study item." }); return; }
    const at = timestamp();
    tournament.studyPack = {
      id: tournament.studyPack?.id ?? deps.id(),
      releaseAt: clean(req.body?.releaseAt, 80) || tournament.studyPack?.releaseAt || at.toISOString(),
      items,
      ...(tournament.studyPack?.releasedAt ? { releasedAt: tournament.studyPack.releasedAt } : {}),
      updatedAt: at.toISOString()
    };
    tournament.updatedAt = at.toISOString();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "STUDY_PACK_SAVED" }, at.toISOString());
    persist();
    res.json({ tournament: safeOwnerView(tournament, at) });
  });

  app.post("/api/tournaments/:id/study-pack/release", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    if (!tournament.studyPack?.items.length) { res.status(400).json({ error: "Create the study pack before releasing it." }); return; }
    const at = timestamp();
    tournament.studyPack.releaseAt = at.toISOString();
    tournament.studyPack.releasedAt = at.toISOString();
    if (tournament.status === "REGISTRATION_OPEN") tournament.status = "STUDY_PACK_RELEASED";
    tournament.updatedAt = at.toISOString();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "STUDY_PACK_RELEASED" }, at.toISOString());
    persist();
    res.json({ tournament: safeOwnerView(tournament, at) });
  });

  app.post("/api/tournaments/:id/invitations", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    const code = secureInvitationCode();
    const invitationCodes = (tournament as Tournament & { invitationCodes?: string[] }).invitationCodes ?? [];
    invitationCodes.push(code);
    (tournament as Tournament & { invitationCodes?: string[] }).invitationCodes = invitationCodes.slice(-32);
    persist();
    res.status(201).json({ code, link: `/quiz-strike/tournaments/${tournament.id}/register?code=${encodeURIComponent(code)}` });
  });

  app.post("/api/tournaments/:id/teams", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = getTournament(deps, routeParam(req.params.id));
    if (!tournament) { res.status(404).json({ error: "Tournament not found." }); return; }
    const invitationCode = clean(req.body?.invitationCode, 24).toUpperCase();
    const isOwner = canManageTournament(req.user!, tournament);
    if (!isOwner) {
      const codes = (tournament as Tournament & { invitationCodes?: string[] }).invitationCodes ?? [];
      if (!invitationCode || !codes.includes(invitationCode)) { res.status(403).json({ error: "A valid tournament invitation code is required." }); return; }
    }
    if (tournament.status !== "REGISTRATION_OPEN" && tournament.status !== "STUDY_PACK_RELEASED") { res.status(409).json({ error: "Team registration is not open." }); return; }
    if (tournament.teams.length >= tournament.maximumTeams) { res.status(409).json({ error: "This tournament has reached its team limit." }); return; }
    const teamName = clean(req.body?.teamName, 80);
    const schoolName = clean(req.body?.schoolName, 120);
    const roster = parseRoster(req.body?.roster, deps.id);
    const substitutes = parseRoster(req.body?.substitutes, deps.id);
    if (teamName.length < 2 || schoolName.length < 2 || roster.length < 1 || roster.length > tournament.rules.teamSize || substitutes.length > 8) {
      res.status(400).json({ error: `Add a team name, school, ${tournament.rules.teamSize} or fewer roster members, and no more than 8 substitutes.` });
      return;
    }
    const at = timestamp();
    const team: TournamentTeam = {
      id: deps.id(),
      tournamentId: tournament.id,
      teamName,
      schoolName,
      ...(clean(req.body?.className, 100) ? { className: clean(req.body.className, 100) } : {}),
      managerUserId: req.user!.id,
      managerName: req.user!.name,
      ...(clean(req.body?.schoolLocation, 120) ? { schoolLocation: clean(req.body.schoolLocation, 120) } : {}),
      roster,
      substitutes,
      color: req.body?.color === "red" || req.body?.color === "gold" || req.body?.color === "green" ? req.body.color : "blue",
      registrationStatus: isOwner ? "APPROVED" : "PENDING",
      checkedIn: false,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString()
    };
    tournament.teams.push(team);
    if (!isOwner) {
      const codes = (tournament as Tournament & { invitationCodes?: string[] }).invitationCodes ?? [];
      (tournament as Tournament & { invitationCodes?: string[] }).invitationCodes = codes.filter((code) => code !== invitationCode);
    }
    tournament.updatedAt = at.toISOString();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "TEAM_REGISTERED" }, at.toISOString());
    persist();
    res.status(201).json({ team, tournament: safeOwnerView(tournament, at) });
  });

  app.post("/api/tournaments/:id/teams/:teamId/approve", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    const team = tournament.teams.find((candidate) => candidate.id === routeParam(req.params.teamId));
    if (!team) { res.status(404).json({ error: "Team not found." }); return; }
    team.registrationStatus = "APPROVED";
    team.updatedAt = deps.now();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "TEAM_APPROVED" }, deps.now());
    persist();
    res.json({ tournament: safeOwnerView(tournament, timestamp()) });
  });

  app.post("/api/tournaments/:id/teams/:teamId/check-in", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = getTournament(deps, routeParam(req.params.id));
    const team = tournament?.teams.find((candidate) => candidate.id === routeParam(req.params.teamId));
    if (!tournament || !team) { res.status(404).json({ error: "Team not found." }); return; }
    if (!canManageTeam(req.user!, tournament, team)) { res.status(403).json({ error: "You cannot check in another teacher's team." }); return; }
    if (team.registrationStatus !== "APPROVED") { res.status(409).json({ error: "Only approved teams can check in." }); return; }
    team.checkedIn = true;
    team.updatedAt = deps.now();
    persist();
    res.json({ team: { ...team, roster: undefined, substitutes: undefined } });
  });

  app.post("/api/tournaments/:id/bracket", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    const at = timestamp();
    try {
      const matches = generateSingleEliminationBracket(tournament, at);
      audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "BRACKET_GENERATED" }, at.toISOString());
      persist();
      res.status(201).json({ matches, tournament: safeOwnerView(tournament, at) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "The bracket could not be generated." });
    }
  });

  app.post("/api/tournaments/:id/matches/:matchId/launch", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    const match = matchFor(tournament, routeParam(req.params.matchId));
    const sessionCode = clean(req.body?.sessionCode, 12).toUpperCase();
    const session = deps.getSessionByCode(sessionCode);
    if (!match || !session) { res.status(404).json({ error: "Match or QuizStrike room not found." }); return; }
    if (!match.teamAId || !match.teamBId) { res.status(409).json({ error: "Both match participants must be confirmed before launch." }); return; }
    if (match.status === "COMPLETED" || match.result) { res.status(409).json({ error: "A verified match cannot be launched again." }); return; }
    if (session.teacherId !== req.user!.id || session.quizSetId !== tournament.quizSetId) { res.status(403).json({ error: "The official room must belong to this tournament owner and quiz set." }); return; }
    if (session.status !== "waiting") { res.status(409).json({ error: "Attach the official room before the QuizStrike session starts." }); return; }
    if (!compareOfficialSettings(session, tournament)) { res.status(409).json({ error: "The room settings do not match the official tournament settings." }); return; }
    const at = timestamp();
    match.gameSessionId = session.id;
    match.sessionCode = session.sessionCode;
    match.settingsSnapshot = tournamentSettingsSnapshot(tournament.rules);
    match.settingsLockedAt = at.toISOString();
    match.status = "CHECK_IN";
    match.updatedAt = at.toISOString();
    tournament.status = validStatusTransition(tournament.status, "LIVE") ? "LIVE" : tournament.status;
    tournament.updatedAt = at.toISOString();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "MATCH_SETTINGS_LOCKED" }, at.toISOString());
    persist();
    const report = deps.getStoredSessionReport ? await deps.getStoredSessionReport(session, req.user!.id) : undefined;
    res.json({ match, session: { id: session.id, sessionCode: session.sessionCode, status: session.status }, reportId: report?.metadata.id });
  });

  app.post("/api/tournaments/:id/matches/:matchId/link-result", deps.requireTeacher, async (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    const match = matchFor(tournament, routeParam(req.params.matchId));
    if (!match?.sessionCode) { res.status(409).json({ error: "Launch the official room before linking a result." }); return; }
    const session = deps.getSessionByCode(match.sessionCode);
    if (!session || session.teacherId !== req.user!.id) { res.status(404).json({ error: "The official session could not be found." }); return; }
    const stored = deps.getStoredSessionReport ? await deps.getStoredSessionReport(session, req.user!.id) : undefined;
    const verified = verifySessionResult({ tournament, match, session, report: stored?.report, at: timestamp() });
    if (!verified.ok) { res.status(409).json({ error: verified.error }); return; }
    match.result = { ...verified.result, ...(stored ? { reportId: stored.metadata.id } : {}) };
    const advancement = advanceMatchWinner(tournament, match, verified.result.winnerTeamId, timestamp());
    if (!advancement.ok) { res.status(409).json({ error: advancement.error }); return; }
    if (!advancement.nextMatch) tournament.runnerUpTeamId = verified.result.runnerUpTeamId;
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "MATCH_RESULT_VERIFIED" }, verified.result.verifiedAt);
    persist();
    res.json({ tournament: safeOwnerView(tournament, timestamp()), match });
  });

  app.post("/api/tournaments/:id/matches/:matchId/cancel", deps.requireTeacher, (req: AuthedRequest, res) => {
    const tournament = requireOwner(deps, req, res, routeParam(req.params.id));
    if (!tournament) return;
    const match = matchFor(tournament, routeParam(req.params.matchId));
    const reason = clean(req.body?.reason, 300);
    if (!match || !reason) { res.status(400).json({ error: "A match and a cancellation reason are required." }); return; }
    if (match.result) { res.status(409).json({ error: "A verified result cannot be cancelled." }); return; }
    match.status = "CANCELLED";
    match.updatedAt = deps.now();
    audit(deps.state, { tournamentId: tournament.id, actorUserId: req.user!.id, actorName: req.user!.name, action: "MATCH_CANCELLED", reason }, deps.now());
    persist();
    res.json({ match });
  });
};

export { createTournamentState };
