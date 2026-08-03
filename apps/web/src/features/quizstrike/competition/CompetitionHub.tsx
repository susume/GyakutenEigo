import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Filter,
  GraduationCap,
  Info,
  LockKeyhole,
  Map,
  Medal,
  Megaphone,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UsersRound,
  X
} from "lucide-react";
import type { TeacherUser } from "@quizstrike/shared";
import { ApiError, competitionApi } from "../../../api/client";
import QuizStrikeLogo from "../../../ui/QuizStrikeLogo";

type CompetitionStatus = "DRAFT" | "ANNOUNCED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "STUDY_PERIOD" | "CHECK_IN" | "LIVE" | "COMPLETED" | "CANCELLED";
type CompetitionCardData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  sponsorName?: string;
  type: "SPONSORED" | "SCHOOL_VS_SCHOOL" | "CLAN_VS_CLASS";
  status: CompetitionStatus;
  registrationClosesAt: string;
  studyPackReleaseAt: string;
  matchStartAt: string;
  matchEndAt?: string;
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
  visibility: "PUBLIC" | "INVITATION_ONLY";
  registrationRequirements: string[];
  rulesSummary: string[];
  streamingStatus: string;
  announcements: Array<{ id: string; title: string; body: string; publishedAt: string; pinned?: boolean }>;
  teams: Array<{ id: string; teamName: string; affiliation: string; activeCount: number; substituteCount: number; registrationStatus: string; eligibilityStatus: string; checkInStatus: string; seed?: number }>;
  matches: Array<{ id: string; roundLabel: string; bracketPosition: number; homeTeamId?: string; awayTeamId?: string; homeTeamName?: string; awayTeamName?: string; scheduledAt: string; checkInOpensAt: string; map: string; gameMode: string; status: string; sessionCode?: string; result?: { homeScore: number; awayScore: number; winnerTeamId?: string; mapScore?: string; quizAccuracy?: { home: number; away: number } } }>;
  studyPack?: { id: string; version: string; releaseAt: string; correctionVersion: number; words: Array<{ id: string; targetWord: string; partOfSpeech: string; approvedTranslation: string; simpleDefinition: string; exampleSentence: string; pronunciation?: string; expressions: string[]; difficulty: string; displayOrder: number }>; correctionHistory: Array<{ version: number; note: string; publishedAt: string }> };
};

type MineTeam = CompetitionCardData["teams"][number] & {
  competitionId: string;
  competitionSlug: string;
  competitionName: string;
  status: CompetitionStatus;
  studyPackReleased: boolean;
  nextMatch?: CompetitionCardData["matches"][number];
  unreadAnnouncements: number;
};

type CompetitionHubProps = {
  teacher?: TeacherUser | null;
  slug?: string;
  onNavigate: (path: string, mode?: "quizStrike" | "teacher") => void;
  onTeacherLogin: () => void;
};

const asCompetition = (value: unknown) => value as { now: string; featured?: CompetitionCardData; competitions: CompetitionCardData[] };
const asDetail = (value: unknown) => value as { now: string; competition: CompetitionCardData };
const asMine = (value: unknown) => value as { teams: MineTeam[]; notifications: Array<{ id: string; title: string; body: string; competitionName: string; createdAt: string }> };

const statusLabel: Record<CompetitionStatus, string> = {
  DRAFT: "Draft", ANNOUNCED: "Announced", REGISTRATION_OPEN: "Registration open", REGISTRATION_CLOSED: "Registration closed", STUDY_PERIOD: "Study period", CHECK_IN: "Check-in", LIVE: "Live now", COMPLETED: "Completed", CANCELLED: "Cancelled"
};

const typeLabel: Record<CompetitionCardData["type"], string> = { SPONSORED: "Sponsored", SCHOOL_VS_SCHOOL: "School vs School", CLAN_VS_CLASS: "Clan vs Class" };
const typeInitial: Record<CompetitionCardData["type"], string> = { SPONSORED: "SP", SCHOOL_VS_SCHOOL: "SV", CLAN_VS_CLASS: "CC" };

const formatDate = (value: string | undefined, timeZone?: string, withTime = false) => {
  if (!value) return "TBA";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "TBA";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone }).format(parsed);
};

const countdown = (value: string | undefined, nowMs: number) => {
  if (!value) return "TBA";
  const distance = Math.max(0, new Date(value).getTime() - nowMs);
  const days = Math.floor(distance / 86_400_000);
  const hours = Math.floor((distance % 86_400_000) / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const requestError = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : "Competition data could not be loaded.";

function StatusChip({ status }: { status: CompetitionStatus }) {
  return <span className={`competition-status-chip status-${status.toLowerCase()}`}><span aria-hidden="true" />{statusLabel[status]}</span>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="competition-metric"><span className="competition-metric-icon" aria-hidden="true">{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function CompetitionCard({ competition, featured = false, onOpen, onRegister }: { competition: CompetitionCardData; featured?: boolean; onOpen: () => void; onRegister: () => void }) {
  const now = Date.now();
  return <article className={`competition-card${featured ? " competition-card-featured" : ""}`}>
    <div className="competition-card-art">
      <img src={competition.coverImage} alt="" />
      <div className="competition-card-art-shade" />
      <span className="competition-type-mark" aria-label={typeLabel[competition.type]}>{typeInitial[competition.type]}</span>
      <span className="competition-card-type">{typeLabel[competition.type]}</span>
      {competition.sponsorName && <span className="competition-card-sponsor">Presented by {competition.sponsorName}</span>}
    </div>
    <div className="competition-card-body">
      <div className="competition-card-topline"><StatusChip status={competition.status} /><span>{competition.region}</span></div>
      <h3>{competition.name}</h3>
      <p>{competition.description}</p>
      <div className="competition-card-grid">
        <Metric icon={<CalendarDays size={16} />} label="Match day" value={formatDate(competition.matchStartAt, competition.timeZone)} />
        <Metric icon={<Clock3 size={16} />} label="Registration" value={competition.status === "REGISTRATION_OPEN" ? countdown(competition.registrationClosesAt, now) : formatDate(competition.registrationClosesAt, competition.timeZone)} />
        <Metric icon={<UsersRound size={16} />} label="Team size" value={`${competition.activeTeamSize} + ${competition.substituteLimit}`} />
        <Metric icon={<BookOpenCheck size={16} />} label="Study pack" value={competition.studyPack && new Date(competition.studyPack.releaseAt).getTime() <= now ? "Released" : formatDate(competition.studyPackReleaseAt, competition.timeZone)} />
      </div>
      <div className="competition-card-footer"><span>{competition.division} · {competition.difficulty}</span><div className="button-row"><button className="text-button" onClick={onOpen}>View event <ArrowRight size={15} aria-hidden="true" /></button>{competition.status === "REGISTRATION_OPEN" && <button className="primary small-button" onClick={onRegister}>Register team</button>}</div></div>
    </div>
  </article>;
}

function RegistrationPanel({ competition, onClose, onTeacherLogin, onRegistered }: { competition: CompetitionCardData; onClose: () => void; onTeacherLogin: () => void; onRegistered: () => void }) {
  const [teamName, setTeamName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [players, setPlayers] = useState("");
  const [substitutes, setSubstitutes] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const loggedIn = Boolean(localStorage.getItem("quizstrike_token"));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!loggedIn) {
      onTeacherLogin();
      return;
    }
    if (!acceptedRules) {
      setError("Accept the official rules before submitting your roster.");
      return;
    }
    const roster = (value: string) => value.split(",").map((name) => name.trim()).filter(Boolean).map((displayName, index) => ({ id: `${index}-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, displayName }));
    setSubmitting(true);
    try {
      await competitionApi.registerTeam(competition.slug, { teamName, affiliation, activePlayers: roster(players), substitutePlayers: roster(substitutes) });
      onRegistered();
    } catch (err) {
      setError(requestError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="competition-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="competition-drawer" role="dialog" aria-modal="true" aria-labelledby="register-team-title">
    <div className="competition-drawer-heading"><div><span className="eyebrow">Team registration</span><h2 id="register-team-title">Enter the arena together.</h2><p>{competition.name}</p></div><button className="icon-button" aria-label="Close registration" onClick={onClose}><X size={20} /></button></div>
    {!loggedIn ? <div className="registration-login-card"><LockKeyhole size={20} /><div><strong>Teacher or coach access required</strong><p>Sign in to submit a roster and keep your official competition updates in one place.</p><button className="primary" onClick={onTeacherLogin}>Teacher login <ArrowRight size={16} /></button></div></div> : <form className="competition-registration-form" onSubmit={submit}>
      <label>Team name<input required value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="e.g. North Stars" /></label>
      <label>School, class, or clan affiliation<input required value={affiliation} onChange={(event) => setAffiliation(event.target.value)} placeholder="e.g. Midori Middle School" /></label>
      <label>Active players <span className="field-help">{competition.activeTeamSize} max · separate names with commas</span><textarea required rows={3} value={players} onChange={(event) => setPlayers(event.target.value)} placeholder="Mika, Ren, Aoi, Kai" /></label>
      <label>Substitutes <span className="field-help">{competition.substituteLimit} max · optional</span><input value={substitutes} onChange={(event) => setSubstitutes(event.target.value)} placeholder="Yuna" /></label>
      <label className="checkbox-row"><input type="checkbox" checked={acceptedRules} onChange={(event) => setAcceptedRules(event.target.checked)} /><span>I have read and accept <button type="button" className="inline-link">the official rules</button> for this competition.</span></label>
      {error && <p className="inline-error" role="alert"><CircleAlert size={16} />{error}</p>}
      <button className="primary registration-submit" disabled={submitting}>{submitting ? "Submitting roster…" : "Submit team registration"}<ArrowRight size={17} /></button>
    </form>}
    <div className="drawer-note"><ShieldCheck size={17} /><span>Only display names appear in public standings. Student account details stay private to authorized staff.</span></div>
  </aside></div>;
}

function StudyPanel({ competition, nowMs }: { competition: CompetitionCardData; nowMs: number }) {
  const released = Boolean(competition.studyPack && new Date(competition.studyPack.releaseAt).getTime() <= nowMs);
  return <section className="competition-study-panel" aria-labelledby="study-panel-title"><div className="section-heading compact"><div><span className="eyebrow">Official study area</span><h2 id="study-panel-title">Learn the play before match day.</h2></div><BookOpenCheck size={26} aria-hidden="true" /></div>
    {!released ? <div className="study-lock-state"><div className="study-lock-icon"><LockKeyhole size={23} /></div><div><strong>Study pack unlocks in {countdown(competition.studyPackReleaseAt, nowMs)}</strong><p>Everyone receives access at the same server-controlled time: {formatDate(competition.studyPackReleaseAt, competition.timeZone, true)} <span>({competition.timeZone})</span>.</p></div><span className="study-release-badge">Not released</span></div> : <div className="study-active-state"><div className="study-active-head"><div><span className="released-kicker"><CheckCircle2 size={15} /> Released · v{competition.studyPack?.version}</span><p>{competition.studyPack?.words.length ?? 0} approved words · public pack does not include the tournament question bank.</p></div><button className="secondary-button">Practice quiz <ArrowRight size={16} /></button></div><div className="study-word-preview">{competition.studyPack?.words.slice(0, 3).map((word) => <div className="study-word" key={word.id}><strong>{word.targetWord}</strong><span>{word.partOfSpeech} · {word.approvedTranslation}</span><p>{word.simpleDefinition}</p></div>)}</div></div>}
  </section>;
}

function Bracket({ competition }: { competition: CompetitionCardData }) {
  const matches = competition.matches;
  return <section className="competition-bracket-panel" aria-labelledby="bracket-title"><div className="section-heading compact"><div><span className="eyebrow">Live structure</span><h2 id="bracket-title">Bracket & standings</h2></div><span className="section-heading-note">{competition.matchFormat}</span></div>{matches.length === 0 ? <div className="empty-bracket"><Swords size={22} /><p>Bracket will appear after approved teams are seeded.</p></div> : <div className="bracket-layout"><div className="bracket-column"><span className="bracket-round-label">{matches[0]?.roundLabel ?? "Round 1"}</span>{matches.slice(0, 4).map((match) => <div className="bracket-match" key={match.id}><div><span>{match.homeTeamName ?? "TBD"}</span><strong>{match.result?.homeScore ?? "–"}</strong></div><div><span>{match.awayTeamName ?? "TBD"}</span><strong>{match.result?.awayScore ?? "–"}</strong></div><small>{formatDate(match.scheduledAt, competition.timeZone, true)} · {match.map}</small></div>)}</div><div className="standings-card"><div className="standings-heading"><Trophy size={18} /><span>Standings</span><small>Public view</small></div>{competition.teams.length === 0 ? <p>No approved teams yet.</p> : <ol>{competition.teams.slice(0, 6).map((team) => <li key={team.id}><span className="standings-rank">{team.seed ?? "—"}</span><span><strong>{team.teamName}</strong><small>{team.affiliation}</small></span><span className="standings-record">{team.registrationStatus === "APPROVED" ? "Ready" : "Pending"}</span></li>)}</ol>}</div></div>}</section>;
}

function CompetitionDetail({ competition, nowIso, onBack, onRegister }: { competition: CompetitionCardData; nowIso: string; onBack: () => void; onRegister: () => void }) {
  const [nowMs, setNowMs] = useState(() => Date.parse(nowIso) || Date.now());
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "study" | "teams" | "rules">("overview");
  useEffect(() => { const timer = window.setInterval(() => setNowMs(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const tabs = [{ id: "overview", label: "Overview" }, { id: "schedule", label: "Schedule" }, { id: "study", label: "Study pack" }, { id: "teams", label: "Teams" }, { id: "rules", label: "Rules" }] as const;
  return <div className="competition-detail-page"><div className="competition-detail-wrap"><button className="back-link" onClick={onBack}><ArrowLeft size={16} />All competitions</button><section className="competition-detail-hero"><div className="competition-detail-hero-art"><img src={competition.coverImage} alt="" /><div className="competition-card-art-shade" /><div className="competition-detail-hero-badge"><span>OFFICIAL</span><strong>{typeInitial[competition.type]}</strong></div></div><div className="competition-detail-hero-copy"><div className="competition-card-topline"><StatusChip status={competition.status} /><span>{typeLabel[competition.type]} · {competition.region}</span></div><h1>{competition.name}</h1><p>{competition.description}</p><div className="detail-hero-actions">{competition.status === "REGISTRATION_OPEN" && <button className="primary" onClick={onRegister}>Register a team <ArrowRight size={17} /></button>}<button className="secondary-button" onClick={() => setActiveTab("rules")}>Official rules <ShieldCheck size={16} /></button></div><div className="detail-hero-meta"><span><Clock3 size={15} />Registration closes {formatDate(competition.registrationClosesAt, competition.timeZone)}</span><span><CalendarDays size={15} />Match day {formatDate(competition.matchStartAt, competition.timeZone, true)}</span></div></div></section><nav className="competition-detail-tabs" aria-label="Competition sections">{tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
    {activeTab === "overview" && <><div className="detail-overview-grid"><div className="detail-overview-main"><section className="detail-panel"><div className="section-heading compact"><div><span className="eyebrow">Competition brief</span><h2>Every answer moves the match.</h2></div><Sparkles size={23} /></div><p className="detail-lede">Represent your class, school, or clan in an official QuizStrike arena. Build a permitted roster, prepare with the released word pack, and check in before the lobby opens.</p><div className="detail-metric-grid"><Metric icon={<UsersRound size={17} />} label="Active team" value={`${competition.activeTeamSize} players`} /><Metric icon={<Map size={17} />} label="Map pool" value={`${competition.mapPool.length} maps`} /><Metric icon={<Medal size={17} />} label="Division" value={competition.division} /><Metric icon={<NotebookPen size={17} />} label="Rules" value={competition.rulesVersion} /></div></section><StudyPanel competition={competition} nowMs={nowMs} /></div><aside className="detail-overview-side"><section className="detail-panel next-event-panel"><span className="eyebrow">Next key date</span><strong>{competition.status === "REGISTRATION_OPEN" ? "Registration deadline" : "Match start"}</strong><div className="next-event-time">{countdown(competition.status === "REGISTRATION_OPEN" ? competition.registrationClosesAt : competition.matchStartAt, nowMs)}</div><p>{formatDate(competition.status === "REGISTRATION_OPEN" ? competition.registrationClosesAt : competition.matchStartAt, competition.timeZone, true)} <span>{competition.timeZone}</span></p><div className="timeline-mini"><span className="done" /><span className="done" /><span className="current" /><span /></div><div className="timeline-labels"><span>Announced</span><span>Study</span><span>Match day</span></div></section><section className="detail-panel announcements-panel"><div className="section-heading compact"><h3><Megaphone size={17} />Announcements</h3><span>{competition.announcements.length}</span></div>{competition.announcements.slice(0, 3).map((announcement) => <div className="announcement-item" key={announcement.id}><strong>{announcement.title}</strong><span>{formatDate(announcement.publishedAt, competition.timeZone)}</span><p>{announcement.body}</p></div>)}</section></aside></div><Bracket competition={competition} /></>}
    {activeTab === "schedule" && <section className="detail-panel detail-tab-panel"><div className="section-heading compact"><div><span className="eyebrow">Official schedule</span><h2>Matches, check-in, and rooms.</h2></div><CalendarDays size={24} /></div><div className="schedule-list">{competition.matches.length ? competition.matches.map((match) => <div className="schedule-row" key={match.id}><span className="schedule-round">{match.roundLabel}<small>Match {match.bracketPosition}</small></span><div className="schedule-teams"><strong>{match.homeTeamName ?? "TBD"}</strong><span>vs</span><strong>{match.awayTeamName ?? "TBD"}</strong></div><div className="schedule-time"><strong>{formatDate(match.scheduledAt, competition.timeZone, true)}</strong><span>{match.map} · {match.gameMode}</span></div><span className="schedule-status">{match.status}</span></div>) : <div className="empty-bracket"><CalendarDays size={22} /><p>Matches will be posted after the organizer generates the bracket.</p></div>}</div></section>}
    {activeTab === "study" && <div className="detail-tab-stack"><StudyPanel competition={competition} nowMs={nowMs} /><section className="detail-panel correction-panel"><div className="section-heading compact"><div><span className="eyebrow">Version history</span><h2>Corrections stay visible.</h2></div><Info size={22} /></div>{competition.studyPack?.correctionHistory.length ? competition.studyPack.correctionHistory.map((correction) => <div className="correction-row" key={correction.version}><strong>v{correction.version}</strong><span>{correction.note}</span><small>{formatDate(correction.publishedAt, competition.timeZone)}</small></div>) : <p>No corrections have been published for this pack.</p>}</section></div>}
    {activeTab === "teams" && <section className="detail-panel detail-tab-panel"><div className="section-heading compact"><div><span className="eyebrow">Approved roster view</span><h2>Teams in the arena.</h2></div><UsersRound size={24} /></div><div className="team-directory">{competition.teams.length ? competition.teams.map((team) => <div className="directory-team" key={team.id}><span className="directory-seed">{team.seed ?? "—"}</span><div><strong>{team.teamName}</strong><span>{team.affiliation}</span></div><span className="directory-count">{team.activeCount}/{competition.activeTeamSize}<small>active</small></span><span className={`directory-status directory-${team.eligibilityStatus.toLowerCase()}`}>{team.eligibilityStatus}</span></div>) : <div className="empty-bracket"><UsersRound size={22} /><p>Registered teams will appear here after organizer approval.</p></div>}</div></section>}
    {activeTab === "rules" && <section className="detail-panel detail-tab-panel"><div className="section-heading compact"><div><span className="eyebrow">Published ruleset</span><h2>Official rules {competition.rulesVersion}</h2></div><ShieldCheck size={24} /></div><p className="detail-lede">The global QuizStrike rules apply to every event. The competition-specific additions below are the source of truth for this arena.</p><div className="rules-list">{competition.rulesSummary.map((rule, index) => <div key={rule}><span>{String(index + 1).padStart(2, "0")}</span><p>{rule}</p></div>)}</div><div className="rules-callout"><Info size={18} /><p>Teams accept this published rules version during registration. Organizer corrections and appeal decisions are recorded in the event announcement log.</p></div></section>}
  </div></div>;
}

export function OrganizerWorkspace({ teacher, onNavigate }: { teacher?: TeacherUser | null; onNavigate: (path: string, mode?: "quizStrike" | "teacher") => void }) {
  const [competitions, setCompetitions] = useState<CompetitionCardData[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; competitionId: string; action: string; detail: string; actorName: string; createdAt: string }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [announcement, setAnnouncement] = useState({ title: "", body: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!teacher) return;
    setLoading(true);
    try {
      const result = await competitionApi.organizer() as { competitions: CompetitionCardData[]; auditLogs: typeof auditLogs };
      setCompetitions(result.competitions);
      setAuditLogs(result.auditLogs);
      setSelectedId((current) => current || result.competitions[0]?.id || "");
    } catch (err) {
      setError(requestError(err));
    } finally {
      setLoading(false);
    }
  }, [teacher]);

  useEffect(() => { void load(); }, [load]);
  const selected = competitions.find((competition) => competition.id === selectedId);
  const announce = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try {
      await competitionApi.publishAnnouncement(selected.id, announcement);
      setAnnouncement({ title: "", body: "" });
      setMessage("Announcement published to the official event page.");
      await load();
    } catch (err) { setError(requestError(err)); }
  };
  const generate = async () => {
    if (!selected) return;
    try {
      await competitionApi.generateBracket(selected.id);
      setMessage("Bracket generated from approved and eligible teams.");
      await load();
    } catch (err) { setError(requestError(err)); }
  };
  const openRegistration = async () => {
    if (!selected) return;
    try {
      await competitionApi.update(selected.id, { status: "REGISTRATION_OPEN" });
      setMessage("Registration is now open. The server will continue to derive lifecycle status from the configured timestamps.");
      await load();
    } catch (err) { setError(requestError(err)); }
  };

  if (!teacher) return <section className="organizer-page"><div className="organizer-gate"><LockKeyhole size={28} /><span className="eyebrow">Organizer workspace</span><h1>Official staff access required.</h1><p>Sign in with an authorized QuizStrike organizer account to manage registrations, study packs, brackets, announcements, and results.</p></div></section>;
  return <section className="organizer-page"><div className="organizer-wrap"><button className="back-link" onClick={() => onNavigate("/quiz-strike", "quizStrike")}><ArrowLeft size={16} />Competition hub</button><div className="organizer-heading"><div><span className="eyebrow">Official operations</span><h1>Organizer workspace</h1><p>Manage the event lifecycle with an audit trail and server-authoritative match state.</p></div><span className="organizer-role"><ShieldCheck size={16} />{teacher.role === "admin" ? "Administrator" : "Organizer"}</span></div>{message && <div className="competition-notice" role="status"><CheckCircle2 size={18} />{message}<button aria-label="Dismiss" onClick={() => setMessage("")}><X size={16} /></button></div>}{error && <div className="competition-notice error" role="alert"><CircleAlert size={18} />{error}<button aria-label="Dismiss" onClick={() => setError("")}><X size={16} /></button></div>}<div className="organizer-layout"><aside className="organizer-event-list"><div className="organizer-list-heading"><span>Managed events</span><strong>{competitions.length}</strong></div>{loading && <p className="organizer-muted">Loading events…</p>}{!loading && !competitions.length && <p className="organizer-muted">No organizer events are assigned to this account.</p>}{competitions.map((competition) => <button key={competition.id} className={selectedId === competition.id ? "active" : ""} onClick={() => setSelectedId(competition.id)}><span className="mini-event-mark">QS</span><span><strong>{competition.name}</strong><small>{statusLabel[competition.status]} · {competition.teams.length} teams</small></span><ChevronRight size={16} /></button>)}</aside><main className="organizer-main">{selected ? <><div className="organizer-event-head"><div><StatusChip status={selected.status} /><h2>{selected.name}</h2><p>{selected.division} · {selected.region} · {selected.rulesVersion}</p></div><button className="secondary-button" onClick={() => onNavigate(`/quiz-strike/competitions/${selected.slug}`, "quizStrike")}>View public page <ArrowRight size={16} /></button></div><div className="organizer-metrics"><div><span>Teams</span><strong>{selected.teams.length}/{selected.maximumTeams}</strong></div><div><span>Pending review</span><strong>{selected.teams.filter((team) => team.registrationStatus === "PENDING").length}</strong></div><div><span>Bracket matches</span><strong>{selected.matches.length}</strong></div><div><span>Pack version</span><strong>{selected.studyPack?.version ?? "—"}</strong></div></div><div className="organizer-action-grid"><article><div className="organizer-action-icon"><Megaphone size={18} /></div><h3>Publish announcement</h3><p>Keep teachers and coaches aligned on schedule changes, corrections, and match-day notices.</p><form onSubmit={announce}><input required value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} placeholder="Announcement title" /><textarea required rows={3} value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} placeholder="What should teams know?" /><button className="primary small-button">Publish update <ArrowRight size={15} /></button></form></article><article><div className="organizer-action-icon"><Swords size={18} /></div><h3>Bracket & match rooms</h3><p>Generate matches from eligible rosters, then attach an existing private QuizStrike room before lobby time.</p><div className="organizer-action-buttons"><button className="secondary-button" onClick={() => void generate()}>Generate bracket</button><button className="text-button" onClick={() => setMessage("Attach a private session code from the Teacher Dashboard when the official lobby is ready.")}>Open room checklist <Info size={15} /></button></div></article><article><div className="organizer-action-icon"><UsersRound size={18} /></div><h3>Registration control</h3><p>Review team submissions and keep eligibility, roster, and check-in status visible to staff.</p><div className="organizer-action-buttons"><button className="secondary-button" onClick={openRegistration}>Open registration</button><button className="text-button" onClick={() => setMessage("Destructive team rejection and roster correction flows require a confirmation step in the next operations release.")}>Review policy <ShieldCheck size={15} /></button></div></article></div><section className="organizer-audit"><div className="section-heading compact"><div><span className="eyebrow">Audit trail</span><h3>Recent organizer actions</h3></div><span className="section-heading-note">Last 100 actions</span></div>{auditLogs.filter((log) => log.competitionId === selected.id).slice(0, 8).map((log) => <div className="audit-row" key={log.id}><span>{formatDate(log.createdAt, selected.timeZone, true)}</span><strong>{log.action.replaceAll("_", " ")}</strong><p>{log.detail}</p><small>{log.actorName}</small></div>)}{!auditLogs.filter((log) => log.competitionId === selected.id).length && <p className="organizer-muted">No actions recorded yet.</p>}</section></> : <div className="organizer-gate"><Info size={26} /><h2>Select an event to manage.</h2></div>}</main></div></div></section>;
}

export default function CompetitionHub({ teacher, slug, onNavigate, onTeacherLogin }: CompetitionHubProps) {
  const [payload, setPayload] = useState<{ now: string; featured?: CompetitionCardData; competitions: CompetitionCardData[] } | null>(null);
  const [mine, setMine] = useState<{ teams: MineTeam[]; notifications: Array<{ id: string; title: string; body: string; competitionName: string; createdAt: string }> }>({ teams: [], notifications: [] });
  const [detail, setDetail] = useState<CompetitionCardData | null>(null);
  const [detailNow, setDetailNow] = useState("");
  const [filters, setFilters] = useState({ type: "", status: "", division: "", region: "", difficulty: "" });
  const [registrationCompetition, setRegistrationCompetition] = useState<CompetitionCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = asCompetition(await competitionApi.list(filters));
      setPayload(result);
      if (teacher) {
        try { setMine(asMine(await competitionApi.mine())); } catch { setMine({ teams: [], notifications: [] }); }
      }
    } catch (err) {
      setError(requestError(err));
    } finally {
      setLoading(false);
    }
  }, [filters, teacher]);

  useEffect(() => { void loadHub(); }, [loadHub]);
  useEffect(() => {
    if (!slug) { setDetail(null); return; }
    void competitionApi.detail(slug).then((result) => { const item = asDetail(result); setDetail(item.competition); setDetailNow(item.now); }).catch((err) => setError(requestError(err)));
  }, [slug]);

  const openDetail = (item: CompetitionCardData) => onNavigate(`/quiz-strike/competitions/${item.slug}`, "quizStrike");
  const openRegister = (item: CompetitionCardData) => setRegistrationCompetition(item);
  const filteredCount = payload?.competitions.length ?? 0;
  const firstCompetition = payload?.featured ?? payload?.competitions[0];

  if (slug && detail) return <><CompetitionDetail competition={detail} nowIso={detailNow} onBack={() => onNavigate("/quiz-strike", "quizStrike")} onRegister={() => openRegister(detail)} />{registrationCompetition && <RegistrationPanel competition={registrationCompetition} onClose={() => setRegistrationCompetition(null)} onTeacherLogin={onTeacherLogin} onRegistered={() => { setRegistrationCompetition(null); setNotice("Team registration submitted. The organizer will review your roster before publishing the bracket."); void loadHub(); }} />}</>;

  return <div className="competition-hub-page"><section className="competition-hub-hero"><div className="competition-hub-hero-copy"><div className="competition-hub-kicker"><span className="kicker-line" />Official Classroom Competition Platform</div><QuizStrikeLogo size="auth" /><h1>Enter the QuizStrike Arena</h1><p>Represent your class, school, or clan in official QuizStrike competitions. Learn the official word pack, prepare your team, and compete in a live classroom arena.</p><div className="competition-hero-actions"><button className="primary" onClick={() => document.getElementById("competition-browser")?.scrollIntoView({ behavior: "smooth" })}>View competitions <ArrowRight size={17} /></button><button className="secondary-button" onClick={() => firstCompetition && openRegister(firstCompetition)}><UsersRound size={17} />Register a team</button><button className="hero-rules-link" onClick={() => firstCompetition && openDetail(firstCompetition)}><ShieldCheck size={17} />Official rules</button>{teacher?.role === "admin" && <button className="hero-rules-link" onClick={() => onNavigate("/quiz-strike/organizer", "quizStrike")}><NotebookPen size={17} />Organizer workspace</button>}</div><div className="competition-proof-row"><span><CheckCircle2 size={16} />Server-authoritative results</span><span><LockKeyhole size={16} />Student-safe by design</span><span><GraduationCap size={16} />Built for classrooms</span></div></div><div className="competition-hub-hero-art"><img src="/assets/quizstrike-classroom-hero.png" alt="QuizStrike Classroom teams preparing in a live arena." /><div className="hero-art-overlay" /><div className="hero-art-caption"><span className="eyebrow">The official arena</span><strong>Study together.<br />Play with purpose.</strong><div><span>01</span><span>03</span></div></div></div></section>
    {notice && <div className="competition-notice" role="status"><CheckCircle2 size={18} />{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X size={16} /></button></div>}
    {error && <div className="competition-notice error" role="alert"><CircleAlert size={18} />{error}<button aria-label="Dismiss" onClick={() => setError("")}><X size={16} /></button></div>}
    <main className="competition-hub-content"><section className="featured-competition-section" aria-labelledby="featured-competition-title"><div className="section-heading"><div><span className="eyebrow">Featured competition</span><h2 id="featured-competition-title">The next official showdown.</h2></div><button className="text-button" onClick={() => document.getElementById("competition-browser")?.scrollIntoView({ behavior: "smooth" })}>Browse all events <ChevronRight size={16} /></button></div>{loading && <div className="competition-loading">Loading official events…</div>}{!loading && firstCompetition && <div className="featured-competition-card"><div className="featured-art"><img src={firstCompetition.coverImage} alt="" /><div className="competition-card-art-shade" /><div className="featured-art-stamp"><span>QS</span><small>{typeLabel[firstCompetition.type]}</small></div></div><div className="featured-copy"><div className="competition-card-topline"><StatusChip status={firstCompetition.status} /><span>{firstCompetition.sponsorName ? `Presented by ${firstCompetition.sponsorName}` : firstCompetition.region}</span></div><h3>{firstCompetition.name}</h3><p>{firstCompetition.description}</p><div className="featured-details"><div><small>Division</small><strong>{firstCompetition.division}</strong></div><div><small>Registration closes</small><strong>{formatDate(firstCompetition.registrationClosesAt, firstCompetition.timeZone)}</strong></div><div><small>Study pack release</small><strong>{formatDate(firstCompetition.studyPackReleaseAt, firstCompetition.timeZone)}</strong></div><div><small>Match date</small><strong>{formatDate(firstCompetition.matchStartAt, firstCompetition.timeZone)}</strong></div></div><div className="featured-bottom"><div className="featured-countdown"><span>Next milestone</span><strong>{countdown(firstCompetition.status === "REGISTRATION_OPEN" ? firstCompetition.registrationClosesAt : firstCompetition.matchStartAt, Date.now())}</strong><small>{firstCompetition.status === "REGISTRATION_OPEN" ? "until registration closes" : "until match day"}</small></div><div className="button-row"><button className="secondary-button" onClick={() => openDetail(firstCompetition)}>View competition <ArrowRight size={16} /></button>{firstCompetition.status === "REGISTRATION_OPEN" && <button className="primary" onClick={() => openRegister(firstCompetition)}>Register team</button>}</div></div></div></div>}</section>
      {teacher && <section className="my-competitions-section" aria-labelledby="my-competitions-title"><div className="section-heading"><div><span className="eyebrow">Your command center</span><h2 id="my-competitions-title">My competitions</h2></div><span className="unread-pill">{mine.notifications.length} updates</span></div>{mine.teams.length ? <div className="my-competition-grid">{mine.teams.map((team) => <button className="my-competition-card" key={team.id} onClick={() => onNavigate(`/quiz-strike/competitions/${team.competitionSlug}`, "quizStrike")}><div className="my-card-title"><span className="mini-event-mark">QS</span><span><strong>{team.competitionName}</strong><small>{team.teamName} · {team.affiliation}</small></span><ChevronRight size={18} /></div><div className="my-card-stats"><span><StatusChip status={team.status} /></span><span><BookOpenCheck size={15} />{team.studyPackReleased ? "Study pack ready" : "Study pack locked"}</span><span><CalendarDays size={15} />{team.nextMatch ? formatDate(team.nextMatch.scheduledAt) : "Next match TBA"}</span></div><div className="my-card-footer"><span>Roster {team.eligibilityStatus.toLowerCase()}</span><span>Check-in {team.checkInStatus.toLowerCase().replace("_", " ")}</span></div></button>)}</div> : <div className="my-empty-state"><GraduationCap size={24} /><div><strong>Your official events will appear here.</strong><p>Register a team to keep rosters, study status, reminders, and match rooms together.</p></div><button className="text-button" onClick={() => firstCompetition && openRegister(firstCompetition)}>Register team <ArrowRight size={16} /></button></div>}</section>}
      <section id="competition-browser" className="competition-browser-section" aria-labelledby="competition-browser-title"><div className="section-heading"><div><span className="eyebrow">Competition browser</span><h2 id="competition-browser-title">Find your next arena.</h2><p>Official events with the dates, division, and difficulty visible at a glance.</p></div><span className="result-count">{filteredCount} events</span></div><div className="competition-filter-bar"><div className="filter-label"><Filter size={16} />Filter by</div><label><span className="sr-only">Competition type</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All types</option><option value="SPONSORED">Sponsored</option><option value="SCHOOL_VS_SCHOOL">School vs School</option><option value="CLAN_VS_CLASS">Clan vs Class</option></select></label><label><span className="sr-only">Status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span className="sr-only">Difficulty</span><select value={filters.difficulty} onChange={(event) => setFilters({ ...filters, difficulty: event.target.value })}><option value="">All difficulty</option><option value="Foundation">Foundation</option><option value="Core">Core</option><option value="Challenge">Challenge</option></select></label><label><span className="sr-only">Region</span><select value={filters.region} onChange={(event) => setFilters({ ...filters, region: event.target.value })}><option value="">All regions</option><option value="Japan · Online">Japan · Online</option></select></label></div>{!loading && <div className="competition-card-grid-list">{payload?.competitions.map((competition) => <CompetitionCard key={competition.id} competition={competition} onOpen={() => openDetail(competition)} onRegister={() => openRegister(competition)} />)}</div>}{!loading && !payload?.competitions.length && <div className="empty-browser"><Filter size={22} /><strong>No competitions match these filters.</strong><button className="text-button" onClick={() => setFilters({ type: "", status: "", division: "", region: "", difficulty: "" })}>Clear filters</button></div>}</section>
      <section className="competition-guidance-grid"><article><span className="guidance-icon"><BookOpenCheck size={20} /></span><span className="eyebrow">Study area</span><h3>Official content. Fair play.</h3><p>Study packs release at one server-controlled time. Tournament questions may reference the published pack, never the private question bank.</p></article><article><span className="guidance-icon"><ShieldCheck size={20} /></span><span className="eyebrow">Rules & safety</span><h3>Clear rules. Safer classrooms.</h3><p>Public standings show team information only. Authorized teachers manage rosters, check-in, results, appeals, and moderated event updates.</p></article><article><span className="guidance-icon"><Trophy size={20} /></span><span className="eyebrow">Match day</span><h3>From bracket to result.</h3><p>Approved teams use the existing private QuizStrike room system, with referee permissions and server-recorded results.</p></article></section>
    </main>{registrationCompetition && <RegistrationPanel competition={registrationCompetition} onClose={() => setRegistrationCompetition(null)} onTeacherLogin={onTeacherLogin} onRegistered={() => { setRegistrationCompetition(null); setNotice("Team registration submitted. The organizer will review your roster before publishing the bracket."); void loadHub(); }} />}</div>;
}
