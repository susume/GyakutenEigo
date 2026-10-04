import { useSiteTranslation } from "../../../ui/siteTranslation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  Copy,
  Flag,
  Link2,
  LockKeyhole,
  Map as MapIcon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
  UsersRound,
  X
} from "lucide-react";
import type { ArenaMapId, SessionSettings, TeacherUser } from "@quizstrike/shared";
import { ApiError, teacherApi, tournamentApi } from "../../../api/client";

type QuizChoice = { id: string; title: string };
type TournamentRules = Partial<SessionSettings> & {
  teamSize: number;
  preparationDurationSeconds: number;
  botPolicy: "none" | "organizer_only";
  rewardsEnabled: boolean;
};
type StudyItem = { id?: string; term: string; pronunciation?: string; meaning?: string; example?: string; note?: string; sortOrder?: number };
type Team = {
  id: string;
  teamName: string;
  schoolName: string;
  className?: string;
  managerName: string;
  roster: Array<{ id: string; displayName: string }>;
  substitutes: Array<{ id: string; displayName: string }>;
  color: string;
  registrationStatus: string;
  checkedIn: boolean;
};
type Match = {
  id: string;
  roundNumber: number;
  roundLabel: string;
  bracketPosition: number;
  teamAId?: string;
  teamBId?: string;
  teamAName?: string;
  teamBName?: string;
  scheduledAt: string;
  status: string;
  sessionCode?: string;
  settingsLockedAt?: string;
  result?: { teamAScore: number; teamBScore: number; winnerTeamId: string; learning?: { averageAccuracy?: number; missedMaterial?: string[] } };
  winnerTeamId?: string;
};
type Tournament = {
  id: string;
  slug: string;
  title: string;
  description: string;
  ownerName: string;
  status: string;
  level: string;
  tournamentAt: string;
  registrationDeadline: string;
  timeZone: string;
  maximumTeams: number;
  quizSetId: string;
  quizSetName: string;
  gameMode: string;
  arena: string;
  sponsorName?: string;
  sponsorMessage?: string;
  sponsorUrl?: string;
  rules: TournamentRules;
  studyPack?: { id: string; releaseAt: string; items: StudyItem[]; releasedAt?: string; updatedAt?: string };
  teams: Team[];
  matches: Match[];
  championTeamId?: string;
  runnerUpTeamId?: string;
};
type TournamentPayload = { tournaments: Tournament[] };
type DetailPayload = { tournament: Tournament; auditEvents?: Array<{ id: string; action: string; actorName: string; createdAt: string }> };
type WizardForm = {
  title: string;
  description: string;
  sponsorName: string;
  sponsorMessage: string;
  sponsorUrl: string;
  level: string;
  tournamentAt: string;
  registrationDeadline: string;
  studyPackReleaseAt: string;
  maximumTeams: number;
  quizSetId: string;
  gameMode: "zombie" | "classic" | "flag";
  mapId: ArenaMapId;
  roundCount: number;
  roundDurationSeconds: number;
  preparationDurationSeconds: number;
  teamSize: number;
  maxPlayers: number;
  rewardsEnabled: boolean;
  studyItems: StudyItem[];
};

const labels: Record<string, string> = {
  DRAFT: "Draft",
  REGISTRATION_OPEN: "Registration open",
  STUDY_PACK_RELEASED: "Study pack ready",
  CHECK_IN: "Check-in",
  LIVE: "Live",
  COMPLETED: "Complete",
  CANCELLED: "Cancelled"
};
const levelLabels: Record<string, string> = {
  SCHOOL_VS_SCHOOL: "School vs school",
  CLASS_VS_CLASS: "Class vs class",
  IN_SCHOOL: "In-school tournament",
  INVITATIONAL: "Invitational",
  SPONSORED: "Sponsored"
};
const mapLabels: Record<string, string> = { desert_citadel: "Desert Citadel", iron_junction: "The Iron Junction", temple_runoff: "Temple Runoff", lunar_relay: "Lunar Relay" };
const modeLabels: Record<string, string> = { zombie: "Zombie Survival", classic: "Team Tag", flag: "Capture the Flag" };
const formatDate = (value: string | undefined, timeZone = "Asia/Tokyo", withTime = false) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone }).format(date);
};
const formatStatus = (status: string) => labels[status] ?? status.replaceAll("_", " ");
const errorMessage = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : "We couldn’t complete that competition action. Try again.";
const nowInput = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString().slice(0, 16);
};
const asIso = (value: string) => value ? new Date(value).toISOString() : undefined;

const initialForm = (quizSets: QuizChoice[]): WizardForm => ({
  title: "",
  description: "A school-safe QuizStrike tournament for teams to study, play, and learn together.",
  sponsorName: "",
  sponsorMessage: "",
  sponsorUrl: "",
  level: "SCHOOL_VS_SCHOOL",
  tournamentAt: nowInput(7, 10),
  registrationDeadline: nowInput(5, 18),
  studyPackReleaseAt: nowInput(3, 9),
  maximumTeams: 4,
  quizSetId: quizSets[0]?.id ?? "",
  gameMode: "flag",
  mapId: "desert_citadel",
  roundCount: 10,
  roundDurationSeconds: 180,
  preparationDurationSeconds: 30,
  teamSize: 4,
  maxPlayers: 20,
  rewardsEnabled: true,
  studyItems: [
    { term: "adapt", meaning: "change so you can work in a new situation", example: "Teams adapt when the map changes." },
    { term: "bracket", meaning: "the planned path of matches in a tournament", example: "Check the bracket before match day." },
    { term: "accuracy", meaning: "how often an answer is correct", example: "Accuracy improves with careful practice." }
  ]
});

function StatusPill({ status }: { status: string }) {
  return <span className={`tournament-status-pill tournament-status-${status.toLowerCase()}`}><span aria-hidden="true" />{formatStatus(status)}</span>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  const { t } = useSiteTranslation();
  return <div className="tournament-stat"><span className="tournament-stat-icon" aria-hidden="true">{icon}</span><span><small>{t(label)}</small><strong>{value}</strong></span></div>;
}

function Wizard({ quizSets, teacher, onCancel, onCreated }: { quizSets: QuizChoice[]; teacher: TeacherUser; onCancel: () => void; onCreated: (tournament: Tournament) => void }) {
  const { t } = useSiteTranslation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(() => initialForm(quizSets));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const validStep = () => {
    if (step === 1 && form.title.trim().length < 3) return "Add a tournament title.";
    if (step === 2 && !form.quizSetId) return "Choose a quiz set.";
    if (step === 3 && form.studyItems.filter((item) => item.term.trim()).length === 0) return "Add at least one study item.";
    return "";
  };
  const next = () => {
    const message = validStep();
    if (message) { setError(message); return; }
    setError("");
    setStep((current) => Math.min(5, current + 1));
  };
  const create = async () => {
    const message = validStep();
    if (message) { setError(message); return; }
    setBusy(true);
    setError("");
    try {
      const result = await tournamentApi.create({
        title: form.title,
        description: form.description,
        sponsorName: form.sponsorName,
        sponsorMessage: form.sponsorMessage,
        sponsorUrl: form.sponsorUrl,
        level: form.level,
        tournamentAt: asIso(form.tournamentAt),
        registrationDeadline: asIso(form.registrationDeadline),
        studyPackReleaseAt: asIso(form.studyPackReleaseAt),
        maximumTeams: form.maximumTeams,
        quizSetId: form.quizSetId,
        rules: {
          gameMode: form.gameMode,
          mapId: form.mapId,
          roundCount: form.roundCount,
          roundDurationSeconds: form.roundDurationSeconds,
          preparationDurationSeconds: form.preparationDurationSeconds,
          teamSize: form.teamSize,
          maxPlayers: form.maxPlayers,
          rewardsEnabled: form.rewardsEnabled,
          botPolicy: "none"
        },
        studyItems: form.studyItems.map((item, index) => ({ ...item, sortOrder: index }))
      }) as { tournament: Tournament };
      onCreated(result.tournament);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return <section className="tournament-wizard panel">
    <div className="tournament-wizard-header"><div><span className="eyebrow">{t("New tournament")}</span><h2>{t("Set up the official match.")}</h2><p>{t("Organizer:")}{" "}{teacher.name}{" "}{t("· Asia/Tokyo is used for display.")}</p></div><button className="icon-button" aria-label={t("Close tournament setup")} onClick={onCancel}><X size={19} /></button></div>
    <div className="tournament-stepper" aria-label={t("Tournament setup steps")}>{["Details", "Rules", "Study pack", "Teams", "Review"].map((label, index) => <button type="button" key={label} className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} onClick={() => step > index + 1 && setStep(index + 1)}><span>{step > index + 1 ? <Check size={14} /> : index + 1}</span>{t(label)}</button>)}</div>
    {step === 1 && <div className="tournament-form-grid"><label className="wide-field">{t("Tournament name")}<input autoFocus value={form.title} onChange={(event) => update("title", event.target.value)} placeholder={t("e.g. Midori Schools Cup")} /></label><label className="wide-field">{t("Short description")}<textarea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} /></label><label>{t("Competition level")}<select value={form.level} onChange={(event) => update("level", event.target.value)}>{Object.entries(levelLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t("Maximum teams")}<select value={form.maximumTeams} onChange={(event) => update("maximumTeams", Number(event.target.value))}><option value={2}>{t("2 teams")}</option><option value={4}>{t("4 teams")}</option><option value={8}>{t("8 teams")}</option><option value={16}>{t("16 teams")}</option></select></label><label>{t("Tournament date & time")}<input type="datetime-local" value={form.tournamentAt} onChange={(event) => update("tournamentAt", event.target.value)} /></label><label>{t("Registration deadline")}<input type="datetime-local" value={form.registrationDeadline} onChange={(event) => update("registrationDeadline", event.target.value)} /></label><label>{t("Study pack release")}<input type="datetime-local" value={form.studyPackReleaseAt} onChange={(event) => update("studyPackReleaseAt", event.target.value)} /></label><div className="tournament-form-note"><CalendarDays size={17} /><span>{t("Dates are stored as instants and shown in")}{" "}{t("Asia/Tokyo")}{t(". Share links do not expose teacher details.")}</span></div><label>{t("Sponsor name")}{" "}<span className="field-help">{t("optional")}</span><input value={form.sponsorName} onChange={(event) => update("sponsorName", event.target.value)} placeholder={t("Presented by…")} /></label><label>{t("Sponsor message")}{" "}<span className="field-help">{t("optional")}</span><input value={form.sponsorMessage} onChange={(event) => update("sponsorMessage", event.target.value)} placeholder={t("A short school-appropriate message")} /></label><label className="wide-field">{t("Approved destination URL")}{" "}<span className="field-help">{t("https only recommended")}</span><input value={form.sponsorUrl} onChange={(event) => update("sponsorUrl", event.target.value)} placeholder="https://example.edu" /></label></div>}
    {step === 2 && <div className="tournament-form-grid"><label>{t("Quiz set")}<select value={form.quizSetId} onChange={(event) => update("quizSetId", event.target.value)}><option value="">{t("Choose a quiz set")}</option>{quizSets.map((quiz) => <option value={quiz.id} key={quiz.id}>{quiz.title}</option>)}</select></label><label>{t("Game mode")}<select value={form.gameMode} onChange={(event) => update("gameMode", event.target.value as WizardForm["gameMode"])}>{Object.entries(modeLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t("Arena")}<select value={form.mapId} onChange={(event) => update("mapId", event.target.value as WizardForm["mapId"])}>{Object.entries(mapLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t("Rounds")}<input type="number" min={1} max={30} value={form.roundCount} onChange={(event) => update("roundCount", Number(event.target.value))} /></label><label>{t("Round duration (seconds)")}<input type="number" min={60} max={3600} value={form.roundDurationSeconds} onChange={(event) => update("roundDurationSeconds", Number(event.target.value))} /></label><label>{t("Preparation (seconds)")}<input type="number" min={15} max={300} value={form.preparationDurationSeconds} onChange={(event) => update("preparationDurationSeconds", Number(event.target.value))} /></label><label>{t("Team size")}<input type="number" min={1} max={12} value={form.teamSize} onChange={(event) => update("teamSize", Number(event.target.value))} /></label><label>{t("Maximum connected players")}<input type="number" min={2} max={40} value={form.maxPlayers} onChange={(event) => update("maxPlayers", Number(event.target.value))} /></label><label className="toggle-row wide-field"><input type="checkbox" checked={form.rewardsEnabled} onChange={(event) => update("rewardsEnabled", event.target.checked)} />{t("Keep rewards enabled for official matches")}</label><div className="tournament-lock-callout wide-field"><LockKeyhole size={18} /><div><strong>{t("Rules are copied from the existing QuizStrike session system.")}</strong><p>{t("The browser cannot alter the official snapshot after the match room is attached.")}</p></div></div></div>}
    {step === 3 && <div className="tournament-study-editor"><div className="section-heading compact"><div><span className="eyebrow">{t("Sanitized learner material")}</span><h3>{t("Approved study items")}</h3><p>{t("Only these fields are published. Correct choices and private notes never leave the teacher workspace.")}</p></div><button className="secondary-button" type="button" onClick={() => update("studyItems", [...form.studyItems, { term: "" }])}><Plus size={16} />{t("Add item")}</button></div>{form.studyItems.map((item, index) => <div className="study-editor-row" key={`${item.id ?? "draft"}-${index}`}><span className="study-editor-number">{String(index + 1).padStart(2, "0")}</span><input aria-label={t("Study term {value0}", { value0: index + 1 })} value={item.term} onChange={(event) => update("studyItems", form.studyItems.map((current, row) => row === index ? { ...current, term: event.target.value } : current))} placeholder={t("Term or phrase")} /><input aria-label={t("Meaning {value0}", { value0: index + 1 })} value={item.meaning ?? ""} onChange={(event) => update("studyItems", form.studyItems.map((current, row) => row === index ? { ...current, meaning: event.target.value } : current))} placeholder={t("Meaning")} /><input aria-label={t("Example {value0}", { value0: index + 1 })} value={item.example ?? ""} onChange={(event) => update("studyItems", form.studyItems.map((current, row) => row === index ? { ...current, example: event.target.value } : current))} placeholder={t("Example (optional)")} /><button className="icon-button" type="button" aria-label={t("Remove study item {value0}", { value0: index + 1 })} onClick={() => update("studyItems", form.studyItems.filter((_, row) => row !== index))}><X size={15} /></button></div>)}<div className="tournament-study-preview"><BookIcon /><div><strong>{t("Preview behavior")}</strong><p>{t("Before release, students see a countdown. After release, the public page contains only the approved items above.")}</p></div></div></div>}
    {step === 4 && <div className="tournament-setup-preview"><div className="tournament-setup-preview-icon"><UsersRound size={22} /></div><div><span className="eyebrow">{t("Team registration")}</span><h3>{t("Teams can be added after publishing.")}</h3><p>{t("Keep setup focused: create the tournament now, then invite or manually add school and class teams from the dashboard. Approved teams are the only teams that enter the bracket.")}</p><div className="tournament-setup-checks"><span><CheckCircle2 size={15} />{t("Roster display names only")}</span><span><CheckCircle2 size={15} />{t("Teacher-owned approvals")}</span><span><CheckCircle2 size={15} />{t("Automatic byes")}</span></div></div></div>}
    {step === 5 && <div className="tournament-review"><div className="tournament-review-hero"><Trophy size={23} /><div><span className="eyebrow">{t("Ready for review")}</span><h3>{form.title || t("Untitled tournament")}</h3><p>{t(levelLabels[form.level])} · {formatDate(form.tournamentAt, "Asia/Tokyo", true)}</p></div></div><div className="tournament-review-grid"><ReviewRow label={t("Quiz set")} value={quizSets.find((quiz) => quiz.id === form.quizSetId)?.title ?? "Not selected"} /><ReviewRow label={t("Official rules")} value={`${modeLabels[form.gameMode]} · ${mapLabels[form.mapId]} · ${form.roundCount} rounds`} /><ReviewRow label={t("Registration closes")} value={formatDate(asIso(form.registrationDeadline), "Asia/Tokyo", true)} /><ReviewRow label={t("Study pack releases")} value={formatDate(asIso(form.studyPackReleaseAt), "Asia/Tokyo", true)} /><ReviewRow label={t("Teams")} value={`Up to ${form.maximumTeams}`} /><ReviewRow label={t("Study items")} value={`${form.studyItems.filter((item) => item.term.trim()).length} approved items`} /></div><div className="tournament-lock-callout"><ShieldCheck size={18} /><div><strong>{t("Publishing opens registration.")}</strong><p>{t("Publishing is explicit. Match settings remain editable only while this tournament is still a draft.")}</p></div></div></div>}
    {error && <p className="inline-error" role="alert">{t(error)}</p>}
    <div className="tournament-wizard-footer"><button className="text-button" type="button" onClick={step === 1 ? onCancel : () => setStep((current) => current - 1)}><ArrowLeft size={16} />{step === 1 ? t("Cancel") : t("Back")}</button><span>{t("Step")}{" "}{step}{" "}{t("of 5")}</span>{step < 5 ? <button className="primary" type="button" onClick={next}>{t("Continue")}{" "}<ArrowRight size={16} /></button> : <button className="primary" type="button" disabled={busy} onClick={() => void create()}>{busy ? t("Creating…") : t("Create draft tournament")}<ArrowRight size={16} /></button>}</div>
  </section>;
}

function BookIcon() { return <BookOpenIcon />; }
function BookOpenIcon() { return <span className="tournament-inline-mark" aria-hidden="true">QS</span>; }
function ReviewRow({ label, value }: { label: string; value: string }) {
  const { t } = useSiteTranslation(); return <div><small>{t(label)}</small><strong>{value}</strong></div>; }

function TournamentDashboard({ tournament, auditEvents, quizSets, onBack, onReload }: { tournament: Tournament; auditEvents: DetailPayload["auditEvents"]; quizSets: QuizChoice[]; onBack: () => void; onReload: () => Promise<void> }) {
  const { t } = useSiteTranslation();
  const [tab, setTab] = useState<"overview" | "study" | "teams" | "bracket" | "matches" | "results" | "settings">("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState("");
  const [matchCode, setMatchCode] = useState<Record<string, string>>({});
  const [teamDraft, setTeamDraft] = useState({ teamName: "", schoolName: "", className: "", roster: "", substitutes: "" });
  const [studyDraft, setStudyDraft] = useState<StudyItem[]>(tournament.studyPack?.items ?? []);
  const studyItemsRef = useRef<StudyItem[]>(tournament.studyPack?.items ?? []);
  studyItemsRef.current = tournament.studyPack?.items ?? [];
  const teamById = useMemo(() => new Map<string, Team>(tournament.teams.map((team) => [team.id, team])), [tournament.teams]);
  useEffect(() => {
    setTab("overview");
    setMessage("");
    setError("");
    setInvitation("");
    setMatchCode({});
    setTeamDraft({ teamName: "", schoolName: "", className: "", roster: "", substitutes: "" });
    setStudyDraft(studyItemsRef.current);
  }, [tournament.id, tournament.studyPack?.updatedAt]);
  const refresh = async () => { await onReload(); };
  const action = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); setMessage(success); await refresh(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const addTeam = async (event: FormEvent) => {
    event.preventDefault();
    await action(() => tournamentApi.addTeam(tournament.id, { teamName: teamDraft.teamName, schoolName: teamDraft.schoolName, className: teamDraft.className, roster: teamDraft.roster.split(",").map((displayName) => ({ displayName: displayName.trim() })).filter((item) => item.displayName), substitutes: teamDraft.substitutes.split(",").map((displayName) => ({ displayName: displayName.trim() })).filter((item) => item.displayName) }), "Team added and ready for review.");
    setTeamDraft({ teamName: "", schoolName: "", className: "", roster: "", substitutes: "" });
  };
  const saveStudy = async () => action(() => tournamentApi.saveStudyPack(tournament.id, { releaseAt: tournament.studyPack?.releaseAt ?? new Date().toISOString(), items: studyDraft.map((item, index) => ({ ...item, sortOrder: index })) }), "Study pack saved. It’s ready to share.");
  const createRoom = async (match: Match) => {
    const rules = tournament.rules;
    try {
      setBusy(true); setError("");
      let sessionCode = matchCode[match.id]?.trim().toUpperCase();
      if (!sessionCode) {
        const created = await teacherApi.createSession({ quizSetId: tournament.quizSetId, settings: {
          mapId: rules.mapId,
          gameMode: rules.gameMode,
          botDifficulty: rules.botDifficulty,
          roundCount: rules.roundCount,
          flagHoldSeconds: rules.flagHoldSeconds,
          teamAssignment: rules.teamAssignment,
          initialZombieCount: rules.initialZombieCount,
          startingMoney: rules.startingMoney,
          startingSnowballs: rules.startingSnowballs,
          correctAnswerReward: rules.correctAnswerReward,
          fastAnswerBonus: rules.fastAnswerBonus,
          fastAnswerThresholdMs: rules.fastAnswerThresholdMs,
          wrongAnswerPenalty: rules.wrongAnswerPenalty,
          snowballPackPrice: rules.snowballPackPrice,
          snowballsPerPack: rules.snowballsPerPack,
          roundDurationSeconds: rules.roundDurationSeconds,
          maxPlayers: rules.maxPlayers,
          deadPlayersCanPractice: rules.deadPlayersCanPractice,
          deadPlayersEarnMoney: rules.deadPlayersEarnMoney,
          characterCustomization: rules.characterCustomization
        } });
        sessionCode = (created as { session: { sessionCode: string } }).session.sessionCode;
      }
      await tournamentApi.launchMatch(tournament.id, match.id, sessionCode);
      setMessage(`Official game room ${sessionCode} is ready. Settings are locked.`);
      await refresh();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const copy = async (value: string, success = "Copied to clipboard.") => {
    try { await navigator.clipboard.writeText(value); setMessage(success); } catch { setError("We couldn’t copy that here. Select the link and copy it manually."); }
  };
  const studyLink = `${window.location.origin}/tournament-study/${tournament.id}`;
  const champion = tournament.championTeamId ? teamById.get(tournament.championTeamId) : undefined;
  const runnerUp = tournament.runnerUpTeamId ? teamById.get(tournament.runnerUpTeamId) : undefined;
  const tabs = [{ id: "overview", label: "Overview" }, { id: "study", label: "Study pack" }, { id: "teams", label: "Teams" }, { id: "bracket", label: "Bracket" }, { id: "matches", label: "Matches" }, { id: "results", label: "Results" }, { id: "settings", label: "Settings" }] as const;
  return <section className="tournament-dashboard panel">
    <div className="tournament-dashboard-top"><button className="back-link" onClick={onBack}><ArrowLeft size={16} />{t("All competitions")}</button><button className="secondary-button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} />{t("Refresh")}</button></div>
    <div className="tournament-dashboard-hero"><div><div className="tournament-title-line"><StatusPill status={tournament.status} /><span>{t(levelLabels[tournament.level]) ?? tournament.level}</span></div><h2>{tournament.title}</h2><p>{tournament.description}</p>{tournament.sponsorName && <small className="tournament-sponsor-line">{t("Presented by")}{" "}{tournament.sponsorName}{tournament.sponsorMessage ? t(" · {value0}", { value0: tournament.sponsorMessage }) : ""}</small>}</div><div className="tournament-hero-date"><CalendarDays size={18} /><small>{t("Tournament date")}</small><strong>{formatDate(tournament.tournamentAt, tournament.timeZone, true)}</strong></div></div>
    {(message || error) && <div className={`tournament-alert ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error ? <X size={17} /> : <CheckCircle2 size={17} />}{t(error) || t(message)}<button aria-label={t("Dismiss message")} onClick={() => { setError(""); setMessage(""); }}>×</button></div>}
    <nav className="tournament-tabs" aria-label={t("Tournament sections")}>{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{t(item.label)}</button>)}</nav>
    {tab === "overview" && <Overview tournament={tournament} champion={champion} onPublish={() => void action(() => tournamentApi.publish(tournament.id), "Tournament published; registration is open.")} onGenerate={() => void action(() => tournamentApi.generateBracket(tournament.id), "Bracket generated from approved teams.")} onTab={setTab} />}
    {tab === "study" && <section className="tournament-section"><div className="section-heading compact"><div><span className="eyebrow">{t("Student-safe material")}</span><h3>{t("Study pack")}</h3><p>{tournament.studyPack?.releasedAt ? t("Released to the share link.") : t("Scheduled for {value0}.", { value0: formatDate(tournament.studyPack?.releaseAt, tournament.timeZone, true) })}</p></div><div className="button-row"><button className="secondary-button" onClick={() => window.print()}><Clipboard size={15} />{t("Print")}</button><button className="secondary-button" onClick={() => void copy(studyLink)}><Copy size={15} />{t("Copy study link")}</button>{!tournament.studyPack?.releasedAt && <button className="primary small-button" onClick={() => void action(() => tournamentApi.releaseStudyPack(tournament.id), "Study pack released.")}>{t("Release now")}</button>}</div></div><div className="tournament-study-share"><div className="tournament-qr"><QRCodeSVG value={studyLink} size={130} includeMargin bgColor="#ffffff" fgColor="#102544" /></div><div><strong>{t("Shareable study page")}</strong><p>{t("Students see a countdown until the release time. The public projection contains no answer keys or teacher notes.")}</p><div className="tournament-share-url"><Link2 size={15} /><code>{studyLink}</code></div></div></div><div className="tournament-study-list">{studyDraft.map((item, index) => <div className="tournament-study-item" key={item.id ?? index}><span>{String(index + 1).padStart(2, "0")}</span><input aria-label={t("Study term {value0}", { value0: index + 1 })} value={item.term} onChange={(event) => setStudyDraft((items) => items.map((current, row) => row === index ? { ...current, term: event.target.value } : current))} /><input aria-label={t("Study meaning {value0}", { value0: index + 1 })} value={item.meaning ?? ""} onChange={(event) => setStudyDraft((items) => items.map((current, row) => row === index ? { ...current, meaning: event.target.value } : current))} /><button className="icon-button" aria-label={t("Remove study item {value0}", { value0: index + 1 })} onClick={() => setStudyDraft((items) => items.filter((_, row) => row !== index))}><X size={15} /></button></div>)}<button className="secondary-button" onClick={() => setStudyDraft((items) => [...items, { term: "", meaning: "" }])}><Plus size={15} />{t("Add study item")}</button><button className="primary" onClick={() => void saveStudy()} disabled={busy}>{t("Save study pack")}</button></div></section>}
    {tab === "teams" && <section className="tournament-section"><div className="section-heading compact"><div><span className="eyebrow">{t("Registration control")}</span><h3>{t("Teams & rosters")}</h3><p>{tournament.teams.length}{" "}{t("of")}{" "}{tournament.maximumTeams}{" "}{t("team slots used. Add teams manually or invite another signed-in teacher.")}</p></div><button className="secondary-button" onClick={async () => { const result = await tournamentApi.createInvitation(tournament.id) as { code: string; link: string }; setInvitation(`${result.code} · ${window.location.origin}${result.link}`); }}><Link2 size={15} />{t("Create invitation")}</button></div>{invitation && <div className="tournament-invite-callout"><strong>{t("Teacher invitation")}</strong><code>{invitation}</code><button className="text-button" onClick={() => void copy(invitation, "Invitation copied.")}><Copy size={15} />{t("Copy")}</button></div>}<div className="tournament-team-grid">{tournament.teams.map((team) => <article className="tournament-team-card" key={team.id}><div className="tournament-team-card-head"><span className={`team-color-dot ${team.color}`} /><div><strong>{team.teamName}</strong><small>{team.schoolName}{team.className ? t(" · {value0}", { value0: team.className }) : ""}</small></div><span className={`team-registration-status ${team.registrationStatus.toLowerCase()}`}>{team.registrationStatus}</span></div><div className="tournament-team-card-meta"><span><UsersRound size={14} />{team.roster.length}/{tournament.rules.teamSize}{" "}{t("roster")}</span><span>{team.managerName}</span><span>{team.checkedIn ? t("Checked in") : t("Not checked in")}</span></div><div className="tournament-team-card-actions">{team.registrationStatus === "PENDING" && <button className="secondary-button small-button" onClick={() => void action(() => tournamentApi.approveTeam(tournament.id, team.id), `${team.teamName} approved.`)}><Check size={14} />{t("Approve")}</button>}{team.registrationStatus === "APPROVED" && !team.checkedIn && <button className="text-button" onClick={() => void action(() => tournamentApi.checkInTeam(tournament.id, team.id), `${team.teamName} checked in.`)}>{t("Mark checked in")}</button>}</div></article>)}</div><form className="tournament-add-team" onSubmit={(event) => void addTeam(event)}><div><span className="eyebrow">{t("Manual team")}</span><h4>{t("Add an approved team")}</h4></div><input required placeholder={t("Team name")} value={teamDraft.teamName} onChange={(event) => setTeamDraft({ ...teamDraft, teamName: event.target.value })} /><input required placeholder={t("School name")} value={teamDraft.schoolName} onChange={(event) => setTeamDraft({ ...teamDraft, schoolName: event.target.value })} /><input placeholder={t("Class name (optional)")} value={teamDraft.className} onChange={(event) => setTeamDraft({ ...teamDraft, className: event.target.value })} /><input required placeholder={t("Roster display names, comma separated ({value0} max)", { value0: tournament.rules.teamSize })} value={teamDraft.roster} onChange={(event) => setTeamDraft({ ...teamDraft, roster: event.target.value })} /><input placeholder={t("Substitutes, comma separated")} value={teamDraft.substitutes} onChange={(event) => setTeamDraft({ ...teamDraft, substitutes: event.target.value })} /><button className="primary" disabled={busy}><Plus size={16} />{t("Add team")}</button></form></section>}
    {tab === "bracket" && <Bracket tournament={tournament} teamById={teamById} onTab={setTab} />}
    {tab === "matches" && <Matches tournament={tournament} matchCode={matchCode} setMatchCode={setMatchCode} busy={busy} onCreateRoom={(match) => void createRoom(match)} onLinkResult={(match) => void action(() => tournamentApi.linkResult(tournament.id, match.id), "Server result linked and bracket advanced.")} />}
    {tab === "results" && <Results tournament={tournament} champion={champion} runnerUp={runnerUp} />}
    {tab === "settings" && <SettingsTab tournament={tournament} quizSets={quizSets} />}
    <div className="tournament-audit"><span className="eyebrow">{t("Audit trail")}</span>{auditEvents?.slice(0, 5).map((event) => <div key={event.id}><span>{formatDate(event.createdAt, tournament.timeZone, true)}</span><strong>{event.action.replaceAll("_", " ")}</strong><small>{event.actorName}</small></div>)}</div>
  </section>;
}

function Overview({ tournament, champion, onPublish, onGenerate, onTab }: { tournament: Tournament; champion?: Team; onPublish: () => void; onGenerate: () => void; onTab: (tab: "study" | "teams" | "bracket" | "matches") => void }) {
  const { t } = useSiteTranslation();
  const pending = tournament.teams.filter((team) => team.registrationStatus === "PENDING").length;
  const nextMatch = tournament.matches.find((match) => match.status === "SCHEDULED" || match.status === "CHECK_IN" || match.status === "LIVE");
  return <section className="tournament-section"><div className="tournament-stat-grid"><Stat label={t("Registered teams")} value={`${tournament.teams.length}/${tournament.maximumTeams}`} icon={<UsersRound size={17} />} /><Stat label={t("Study pack")} value={tournament.studyPack?.releasedAt ? "Released" : "Scheduled"} icon={<BookOpenIcon />} /><Stat label={t("Next match")} value={nextMatch ? formatDate(nextMatch.scheduledAt, tournament.timeZone) : "Not scheduled"} icon={<Swords size={17} />} /><Stat label={t("Official rules")} value={`${modeLabels[tournament.rules.gameMode ?? ""] ?? tournament.rules.gameMode} · ${mapLabels[tournament.rules.mapId ?? ""] ?? tournament.rules.mapId}`} icon={<Flag size={17} />} /></div><div className="tournament-overview-grid"><article className="tournament-overview-card"><span className="eyebrow">{t("Organizer actions")}</span><h3>{tournament.status === "DRAFT" ? t("Finish the setup, then open registration.") : t("Keep match day moving.")}</h3><p>{pending > 0 ? t("{value0} team{value1} waiting for approval.", { value0: pending, value1: pending === 1 ? " is" : "s are" }) : t("Approved teams can be seeded into a deterministic bracket.")}</p><div className="button-row">{tournament.status === "DRAFT" && <button className="primary" onClick={onPublish}>{t("Publish tournament")}{" "}<ArrowRight size={16} /></button>}<button className="secondary-button" onClick={() => onTab("teams")}><UsersRound size={15} />{t("Manage teams")}</button><button className="secondary-button" onClick={() => onTab("study")}><Link2 size={15} />{t("Study link")}</button></div></article><article className="tournament-overview-card"><span className="eyebrow">{t("Bracket readiness")}</span><h3>{tournament.matches.length ? t("Bracket is ready") : t("Generate the bracket when teams are approved")}</h3><div className="readiness-list"><span className={tournament.studyPack?.items.length ? "done" : ""}><CheckCircle2 size={15} />{t("Study pack")}{" "}{tournament.studyPack?.items.length ? t("ready") : t("missing")}</span><span className={tournament.teams.filter((team) => team.registrationStatus === "APPROVED").length >= 2 ? "done" : ""}><CheckCircle2 size={15} />{t("At least 2 approved teams")}</span><span className={tournament.matches.length ? "done" : ""}><CheckCircle2 size={15} />{t("Bracket generated")}</span></div>{!tournament.matches.length && <button className="text-button" onClick={onGenerate}>{t("Generate bracket")}{" "}<ArrowRight size={15} /></button>}{champion && <div className="champion-banner"><Trophy size={17} />{t("Champion:")}{" "}<strong>{champion.teamName}</strong></div>}</article></div><div className="tournament-date-strip"><span><CalendarDays size={16} />{t("Registration closes")}{" "}<strong>{formatDate(tournament.registrationDeadline, tournament.timeZone, true)}</strong></span><span><ShieldCheck size={16} />{t("Quiz set")}{" "}<strong>{tournament.quizSetName}</strong></span><span><MapIcon size={16} />{t("Arena")}{" "}<strong>{t(mapLabels[tournament.rules.mapId ?? ""]) ?? tournament.rules.mapId}</strong></span></div></section>;
}

function Bracket({ tournament, teamById, onTab }: { tournament: Tournament; teamById: Map<string, Team>; onTab: (tab: "matches") => void }) {
  const { t } = useSiteTranslation();
  const rounds = [...new Set(tournament.matches.map((match) => match.roundNumber))].sort((a, b) => a - b);
  const matchName = (id: string | undefined, fallback: string | undefined) => id ? teamById.get(id)?.teamName ?? fallback ?? "TBD" : fallback ?? "TBD";
  const bracketMatch = (match: Match) => <button className={`tournament-bracket-match ${match.status.toLowerCase()}`} key={match.id} onClick={() => onTab("matches")}>
    <span>{matchName(match.teamAId, match.teamAName)}<strong>{match.result?.teamAScore ?? "-"}</strong></span>
    <span>{matchName(match.teamBId, match.teamBName)}<strong>{match.result?.teamBScore ?? "-"}</strong></span>
    <small>{match.status === "BYE" ? t("Auto bye") : t("{value0} - {value1}", { value0: formatDate(match.scheduledAt, tournament.timeZone, true), value1: formatStatus(match.status) })}</small>
  </button>;
  return <section className="tournament-section"><div className="section-heading compact"><div><span className="eyebrow">{t("Single elimination")}</span><h3>{t("Bracket")}</h3><p>{t("Bye matches advance automatically. Results are linked from completed QuizStrike sessions.")}</p></div><button className="secondary-button" onClick={() => onTab("matches")}><Swords size={15} />{t("Open match control")}</button></div>{!tournament.matches.length ? <EmptyState icon={<Swords size={22} />} title={t("No bracket yet")} body={t("Approve at least two teams, then generate the bracket from the overview.")} /> : <><div className="tournament-bracket" aria-label={t("Tournament bracket")}>{rounds.map((round) => <div className="tournament-bracket-round" key={round}><span className="tournament-round-label">{tournament.matches.find((match) => match.roundNumber === round)?.roundLabel}</span>{tournament.matches.filter((match) => match.roundNumber === round).map(bracketMatch)}</div>)}</div><div className="tournament-bracket-list" aria-label={t("Accessible match list")}>{tournament.matches.map((match) => <div key={match.id}><strong>{match.roundLabel}{" "}{t("- Match")}{" "}{match.bracketPosition}</strong><span>{matchName(match.teamAId, match.teamAName)}{" "}{t("vs")}{" "}{matchName(match.teamBId, match.teamBName)}</span><small>{formatStatus(match.status)} - {formatDate(match.scheduledAt, tournament.timeZone, true)}</small></div>)}</div></>}
  </section>;
}

function Matches({ tournament, matchCode, setMatchCode, busy, onCreateRoom, onLinkResult }: { tournament: Tournament; matchCode: Record<string, string>; setMatchCode: (value: Record<string, string>) => void; busy: boolean; onCreateRoom: (match: Match) => void; onLinkResult: (match: Match) => void }) {
  const { t } = useSiteTranslation();
  const teamName = (id?: string) => tournament.teams.find((team) => team.id === id)?.teamName ?? "TBD";
  return <section className="tournament-section"><div className="section-heading compact"><div><span className="eyebrow">{t("Official match control")}</span><h3>{t("Matches")}</h3><p>{t("Create the private QuizStrike room from the normal teacher workspace flow, then attach it here to lock the snapshot.")}</p></div><span className="tournament-lock-badge"><LockKeyhole size={14} />{t("Server-verified")}</span></div>{!tournament.matches.length ? <EmptyState icon={<Swords size={22} />} title={t("No scheduled matches")} body={t("Generate a bracket after approving teams.")} /> : <div className="tournament-match-list">{tournament.matches.map((match) => <article className="tournament-match-row" key={match.id}><div className="tournament-match-title"><span>{match.roundLabel}{" "}{t("· Match")}{" "}{match.bracketPosition}</span><StatusPill status={match.status} /></div><div className="tournament-match-teams"><strong>{teamName(match.teamAId)}</strong><span>{t("vs")}</span><strong>{teamName(match.teamBId)}</strong></div><div className="tournament-match-meta"><span><CalendarDays size={14} />{formatDate(match.scheduledAt, tournament.timeZone, true)}</span><span>{match.sessionCode ? t("Room {value0}", { value0: match.sessionCode }) : t("Room not created")}</span>{match.settingsLockedAt && <span className="tournament-locked-text"><LockKeyhole size={13} />{t("Official settings locked")}</span>}</div>{match.result && <div className="tournament-result-inline">{t("Verified result ·")}{" "}{match.result.teamAScore} : {match.result.teamBScore}</div>}{match.status !== "BYE" && match.status !== "COMPLETED" && match.status !== "CANCELLED" && <div className="tournament-match-actions">{!match.sessionCode && match.teamAId && match.teamBId && <><input aria-label={t("Session code for {value0} match {value1}", { value0: match.roundLabel, value1: match.bracketPosition })} value={matchCode[match.id] ?? ""} onChange={(event) => setMatchCode({ ...matchCode, [match.id]: event.target.value.toUpperCase() })} placeholder={t("Optional existing room code")} /><button className="primary small-button" disabled={busy} onClick={() => onCreateRoom(match)}><Swords size={14} />{t("Create official room")}</button></>}{match.sessionCode && <button className="secondary-button small-button" onClick={() => onLinkResult(match)}>{t("Link completed result")}</button>}</div>}</article>)}</div>}</section>;
}

function Results({ tournament, champion, runnerUp }: { tournament: Tournament; champion?: Team; runnerUp?: Team }) {
  const { t } = useSiteTranslation();
  const completed = tournament.matches.filter((match) => match.result);
  return <section className="tournament-section"><div className="tournament-results-hero"><Trophy size={29} /><div><span className="eyebrow">{t("Verified results")}</span><h3>{champion ? champion.teamName : t("Champion pending")}</h3><p>{champion ? t("{value0} · tournament champion", { value0: champion.schoolName }) : t("Complete the final verified match to display the champion.")}</p></div></div><div className="tournament-podium"><div><small>{t("Champion")}</small><strong>{champion?.teamName ?? t("TBD")}</strong></div><div><small>{t("Runner-up")}</small><strong>{runnerUp?.teamName ?? t("TBD")}</strong></div></div><div className="tournament-result-table"><div className="tournament-result-table-head"><span>{t("Match")}</span><span>{t("Result")}</span><span>{t("Learning signal")}</span></div>{completed.map((match) => <div key={match.id}><span>{match.roundLabel} · {match.bracketPosition}</span><strong>{match.result?.teamAScore} : {match.result?.teamBScore}</strong><span>{match.result?.learning?.averageAccuracy !== undefined ? t("{value0}% avg accuracy", { value0: Math.round(match.result.learning.averageAccuracy * 100) }) : t("Report pending")}</span></div>)}{!completed.length && <p className="tournament-muted">{t("Verified match results will appear here after completed sessions are linked.")}</p>}</div><p className="tournament-report-note"><ShieldCheck size={15} />{t("Learning detail remains sourced from the existing QuizStrike report system. Tournament results store only the verified match link and safe aggregate summary.")}</p></section>;
}

function SettingsTab({ tournament, quizSets }: { tournament: Tournament; quizSets: QuizChoice[] }) {
  const { t } = useSiteTranslation();
  return <section className="tournament-section"><div className="section-heading compact"><div><span className="eyebrow">{t("Rules & privacy")}</span><h3>{t("Official settings")}</h3><p>{t("These values are copied into each official QuizStrike room and snapshotted at launch.")}</p></div><LockKeyhole size={23} /></div><div className="tournament-settings-grid"><ReviewRow label={t("Quiz set")} value={quizSets.find((quiz) => quiz.id === tournament.quizSetId)?.title ?? tournament.quizSetName} /><ReviewRow label={t("Mode")} value={modeLabels[tournament.rules.gameMode ?? ""] ?? tournament.rules.gameMode ?? "Not set"} /><ReviewRow label={t("Arena")} value={mapLabels[tournament.rules.mapId ?? ""] ?? tournament.rules.mapId ?? "Not set"} /><ReviewRow label={t("Rounds")} value={String(tournament.rules.roundCount ?? "Not set")} /><ReviewRow label={t("Round duration")} value={`${tournament.rules.roundDurationSeconds ?? "Not set"} seconds`} /><ReviewRow label={t("Team size")} value={String(tournament.rules.teamSize)} /><ReviewRow label={t("Connected players")} value={String(tournament.rules.maxPlayers ?? "Not set")} /><ReviewRow label={t("Rewards")} value={tournament.rules.rewardsEnabled ? "Enabled" : "Disabled"} /></div><div className="tournament-lock-callout"><LockKeyhole size={18} /><div><strong>{t("Match settings are locked per official room.")}</strong><p>{t("After both teams check in or a room is attached, the tournament does not allow silent changes to rules or participants.")}</p></div></div></section>;
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  const { t } = useSiteTranslation(); return <div className="tournament-empty-state"><span>{icon}</span><strong>{t(title)}</strong><p>{t(body)}</p></div>; }

export default function TournamentCenter({ teacher, quizSets }: { teacher: TeacherUser; quizSets: QuizChoice[] }) {
  const { t } = useSiteTranslation();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [auditEvents, setAuditEvents] = useState<DetailPayload["auditEvents"]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadList = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const payload = await tournamentApi.list() as TournamentPayload;
      setTournaments(payload.tournaments);
      setSelectedId((current) => current || payload.tournaments[0]?.id || "");
    } catch (err) { setError(errorMessage(err)); } finally { setLoading(false); }
  }, []);
  const loadSelected = useCallback(async () => {
    if (!selectedId) { setSelected(null); return; }
    try {
      const payload = await tournamentApi.detail(selectedId) as DetailPayload;
      setSelected(payload.tournament);
      setAuditEvents(payload.auditEvents ?? []);
    } catch (err) { setError(errorMessage(err)); }
  }, [selectedId]);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadSelected(); }, [loadSelected]);
  const reloadSelected = async () => { await Promise.all([loadList(), loadSelected()]); };
  if (creating) return <Wizard quizSets={quizSets} teacher={teacher} onCancel={() => setCreating(false)} onCreated={(tournament) => { setCreating(false); setSelectedId(tournament.id); setSelected(tournament); }} />;
  return <section className="tournament-center-page"><div className="tournament-center-heading"><div><span className="eyebrow">{t("Teacher workspace · persistent tournament center")}</span><h2>{t("Tournaments")}</h2><p>{t("Build a study-first competition, lock official rules, and run each match through QuizStrike’s existing classroom rooms.")}</p></div><button className="primary" onClick={() => setCreating(true)}><Plus size={17} />{t("Create tournament")}</button></div>{error && <div className="tournament-alert error" role="alert"><X size={17} />{t(error)}<button aria-label={t("Dismiss error")} onClick={() => setError("")}>×</button></div>}{selected ? <TournamentDashboard tournament={selected} auditEvents={auditEvents} quizSets={quizSets} onBack={() => setSelected(null)} onReload={reloadSelected} /> : <>{loading ? <div className="tournament-loading"><RefreshCw size={18} />{t("Loading tournaments…")}</div> : tournaments.length === 0 ? <EmptyState icon={<Trophy size={23} />} title={t("Your tournament calendar is empty")} body={t("Create a draft tournament to plan the study pack, teams, bracket, and official match rooms.")} /> : <div className="tournament-list">{tournaments.map((tournament) => <button className="tournament-list-card" key={tournament.id} onClick={() => setSelectedId(tournament.id)}><div className="tournament-list-card-head"><StatusPill status={tournament.status} /><span>{t(levelLabels[tournament.level]) ?? tournament.level}</span></div><h3>{tournament.title}</h3><p>{tournament.description}</p><div className="tournament-list-meta"><span><CalendarDays size={14} />{formatDate(tournament.tournamentAt, tournament.timeZone)}</span><span><UsersRound size={14} />{tournament.teams.length}/{tournament.maximumTeams}{" "}{t("teams")}</span><span><Flag size={14} />{t(modeLabels[tournament.rules.gameMode ?? ""]) ?? tournament.gameMode} · {t(mapLabels[tournament.rules.mapId ?? tournament.arena]) ?? tournament.arena}</span></div><div className="tournament-list-footer"><span>{tournament.studyPack?.releasedAt ? t("Study pack released") : t("Study pack scheduled")}</span><ArrowRight size={17} /></div></button>)}</div>}</>}</section>;
}
