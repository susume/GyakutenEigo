import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Monitor,
  AlertCircle,
  Clock3,
  Mic,
  ClipboardCheck,
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  Edit3,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  DEFAULT_SPEAKING_RUBRIC,
  SPEAKING_CATEGORIES,
  SPEAKING_COMMUNICATION_SKILLS,
  SPEAKING_CONTEXT_TYPES,
  SPEAKING_IDENTIFIER_MODE_LABELS,
  SPEAKING_IDENTIFIER_MODES,
  SPEAKING_NATIVE_LANGUAGE_LABELS,
  SPEAKING_NATIVE_LANGUAGES,
  speakingScenarioResources,
  type SpeakingActivity,
  type SpeakingCreateActivityInput,
  type SpeakingContext,
  type SpeakingEvaluation,
  type SpeakingLibraryItem,
  type SpeakingIdentifierMode,
  type SpeakingNativeLanguage,
  type SpeakingParticipant,
  type SpeakingRubricCriterion,
  type SpeakingScenarioResources,
  type SpeakingSession,
  type SpeakingSetSummary,
  type SpeakingTurn,
} from "@quizstrike/shared";
import { ApiError, speakingApi } from "../../../api/client";
import { buildTeacherSpeakingPath } from "../../../navigation";
import GyakutenEigoBrand from "../../../ui/GyakutenEigoBrand";
import { formatDuration } from "../speakingData";
import { ResultPanel, scoreFor } from "../SpeakingResultPanel";
import { SpeakingSetDetailPage, SpeakingSetsPage } from "./SpeakingSetsPage";
import SpeakingReportsPanel from "./SpeakingReportsPanel";
import { coreFallbackActivities, isCompatibleCoreLibraryResponse } from "./speakingLibrary";
import "../speaking.css";
import "../speaking-layout.css";
import "./speaking-dashboard.css";

type Navigate = (nextPath: string) => void;
type SpeakingEvaluationStatus = "queued" | "running" | "retrying" | "completed" | "failed";
type ResultResponse = {
  result: {
    activity: Pick<
      SpeakingActivity,
      | "id"
      | "title"
      | "scenario"
      | "targetExpressions"
      | "nativeLanguage"
      | "rubric"
    >;
    session: SpeakingSession;
    participant: SpeakingParticipant;
    turns: SpeakingTurn[];
    evaluation?: SpeakingEvaluation;
  };
  evaluationStatus?: SpeakingEvaluationStatus;
  evaluationRetryable?: boolean;
  nextRetryAt?: string;
};
type SessionResultsResponse = {
  activity: SpeakingActivity;
  session: SpeakingSession;
  items: Array<{
    participant: SpeakingParticipant;
    status: SpeakingParticipant["status"];
    durationSeconds: number;
    overallScore?: number;
    helpCount: number;
    evaluation?: SpeakingEvaluation;
    evaluationStatus?: SpeakingEvaluationStatus;
    evaluationRetryable?: boolean;
    nextRetryAt?: string;
  }>;
};

type SpeakingRosterStatus = "joined" | "ready" | "practicing" | "processing" | "evaluating" | "retrying" | "finished" | "error";
type SpeakingRosterResponse = {
  session: SpeakingSession;
  counts: Partial<Record<SpeakingRosterStatus, number>>;
  items: Array<{
    participant: SpeakingParticipant;
    status: SpeakingRosterStatus;
    latestActivityAt?: string;
    latestTurnSpeaker?: "ai" | "student";
    evaluationStatus?: SpeakingEvaluationStatus;
    evaluationRetryable?: boolean;
  }>;
};

const ROSTER_STATUS_LABELS: Record<SpeakingRosterStatus, string> = {
  joined: "Joined",
  ready: "Ready",
  practicing: "Practicing",
  processing: "Processing",
  evaluating: "Evaluating",
  retrying: "Evaluation retrying",
  finished: "Finished",
  error: "Needs attention"
};

const rosterStatusOrder: SpeakingRosterStatus[] = ["joined", "ready", "practicing", "processing", "evaluating", "retrying", "finished", "error"];

const formatRosterActivity = (value?: string) => {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const normalizePath = (path: string) =>
  path === "/" ? path : path.replace(/\/+$/u, "");
const decodeRouteSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
const parseTeacherRoute = (path: string) => {
  const segments = normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map(decodeRouteSegment);
  if (segments[1] === "teacher" && segments[2] === "create")
    return { kind: "create" as const };
  if (segments[1] === "teacher" && segments[2] === "sets")
    return { kind: "sets" as const };
  if (segments[1] === "teacher" && segments[2] === "reports")
    return { kind: "speaking-reports" as const };
  if (segments[1] === "teacher" && segments[2] === "set" && segments[3])
    return { kind: "set" as const, id: segments[3] };
  if (segments[1] === "teacher" && segments[2] === "activity" && segments[3])
    return {
      kind: "activity" as const,
      id: segments[3],
      results: segments[4] === "results",
      edit: segments[4] === "edit",
    };
  if (segments[1] === "teacher" && segments[2] === "result" && segments[3])
    return { kind: "teacher-result" as const, id: segments[3] };
  return { kind: "teacher" as const, tab: segments[2] === "core" ? "core" as const : "tests" as const };
};

const toSpeakingTeacherPath = (path: string) => {
  const normalized = normalizePath(path);
  const canonicalPrefix = "/quiz-strike/teacher/speaking";
  if (
    normalized === canonicalPrefix ||
    normalized.startsWith(`${canonicalPrefix}/`)
  ) {
    return `/speak/teacher${normalized.slice(canonicalPrefix.length)}`;
  }
  return normalized.startsWith("/speak/teacher")
    ? normalized
    : "/speak/teacher";
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

function MissingSpeakingSession({
  navigate,
  message = "This teacher activity may have ended or no longer exists.",
}: {
  navigate: Navigate;
  message?: string;
}) {
  return (
    <div className="speaking-empty-page">
      <CircleCheck size={38} aria-hidden="true" />
      <h1>Activity not found</h1>
      <p>{message}</p>
      <button
        className="speaking-primary-button"
        type="button"
        onClick={() => navigate("/speak/teacher")}
      >
        Back to Speaking Practice
      </button>
    </div>
  );
}

function ShieldIcon() {
  return (
    <span className="speaking-privacy-dot" aria-hidden="true">
      <CircleCheck size={14} />
    </span>
  );
}

/**
 * Teacher-only Speaking Practice surface embedded in the unified QuizStrike
 * workspace. Student routes continue to use SpeakingPracticeApp directly.
 */
export function SpeakingTeacherWorkspace({
  initialPath,
  onNavigate,
}: {
  initialPath: string;
  onNavigate: Navigate;
}) {
  const [path, setPath] = useState(() => toSpeakingTeacherPath(initialPath));

  useEffect(() => {
    setPath(toSpeakingTeacherPath(initialPath));
  }, [initialPath]);

  const navigate = useCallback<Navigate>(
    (nextPath) => {
      const target = new URL(nextPath, window.location.origin);
      const nextPathname = normalizePath(target.pathname);
      setPath(nextPathname);
      const canonicalPath = buildTeacherSpeakingPath(nextPathname);
      onNavigate(`${canonicalPath}${target.search}${target.hash}`);
    },
    [onNavigate],
  );

  const route = parseTeacherRoute(path);
  return (
    <div
      className="speaking-app speaking-embedded-teacher"
      aria-label="Speaking Practice teacher tools"
    >
      {route.kind === "teacher" && (
        <SpeakingTeacherDashboard navigate={navigate} initialTab={route.tab} />
      )}
      {route.kind === "create" && <SpeakingCreatePage navigate={navigate} />}
      {route.kind === "sets" && <SpeakingSetsPage navigate={navigate} />}
      {route.kind === "speaking-reports" && <SpeakingReportsPanel navigate={navigate} />}
      {route.kind === "set" && <SpeakingSetDetailPage navigate={navigate} setId={route.id} />}
      {route.kind === "activity" && (
        <SpeakingActivityPage
          navigate={navigate}
          activityId={route.id}
          results={route.results === true}
          edit={route.edit === true}
        />
      )}
      {route.kind === "teacher-result" && (
        <SpeakingTeacherResultPage
          navigate={navigate}
          participantId={route.id}
        />
      )}
    </div>
  );
}

type DashboardTab = "tests" | "core";

const speakingCategory = (activity: Pick<SpeakingActivity, "scenarioResources">) =>
  speakingScenarioResources(activity.scenarioResources).category ?? "Everyday Communication";

const speakingSkills = (activity: Pick<SpeakingActivity, "scenarioResources">) =>
  speakingScenarioResources(activity.scenarioResources).communicationSkills;

const speakingMinutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;

function SpeakingTeacherDashboard({ navigate, initialTab = "tests" }: { navigate: Navigate; initialTab?: DashboardTab }) {
  const [library, setLibrary] = useState<SpeakingLibraryItem[]>([]);
  const [coreLibrary, setCoreLibrary] = useState<SpeakingActivity[]>(() => coreFallbackActivities());
  const [sets, setSets] = useState<SpeakingSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [skill, setSkill] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("recent");
  const [previewTemplate, setPreviewTemplate] = useState<SpeakingActivity | null>(null);
  const [workingTemplateId, setWorkingTemplateId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [libraryResult, setsResult, templatesResult] = await Promise.allSettled([
      speakingApi.library(),
      speakingApi.sets(),
      speakingApi.templates()
    ]);
    const failures: string[] = [];
    if (libraryResult.status === "fulfilled") {
      setLibrary((libraryResult.value as { items: SpeakingLibraryItem[] }).items ?? []);
    } else {
      setLibrary([]);
      failures.push("My Tests");
    }
    if (setsResult.status === "fulfilled") {
      setSets((setsResult.value as { items: SpeakingSetSummary[] }).items ?? []);
    } else {
      setSets([]);
      failures.push("My Sets");
    }
    if (templatesResult.status === "fulfilled") {
      const items = (templatesResult.value as { items?: unknown }).items;
      setCoreLibrary(isCompatibleCoreLibraryResponse(items) ? items : coreFallbackActivities());
    } else {
      setCoreLibrary(coreFallbackActivities());
    }
    setError(failures.length ? `Could not load ${failures.join(" or ")}. Built-in scenarios are still available.` : "");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => {
    if (!previewTemplate) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewTemplate(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewTemplate]);

  const query = search.trim().toLocaleLowerCase();
  const matchesMetadata = (activity: SpeakingActivity) => {
    const resources = speakingScenarioResources(activity.scenarioResources);
    const haystack = [
      activity.title,
      activity.scenario,
      activity.aiRole,
      activity.studentRole,
      resources.category ?? "",
      resources.communicationSkills.join(" "),
      resources.studentGoal,
      resources.aiContext ?? ""
    ].join(" ").toLocaleLowerCase();
    const isBuiltIn = resources.builtIn === true || activity.teacherId === "speaking-template";
    const sourceMatches = activeTab === "core"
      ? isBuiltIn
      : source === "all" || (source === "built-in" ? isBuiltIn : !isBuiltIn);
    return (!query || haystack.includes(query))
      && (category === "all" || speakingCategory(activity) === category)
      && (skill === "all" || resources.communicationSkills.includes(skill))
      && sourceMatches;
  };
  const visibleItems = [...library]
    .filter((item) => matchesMetadata(item.activity))
    .sort((left, right) => sort === "az"
      ? left.activity.title.localeCompare(right.activity.title)
      : sort === "za"
        ? right.activity.title.localeCompare(left.activity.title)
        : Date.parse(right.lastSessionAt ?? right.activity.updatedAt) - Date.parse(left.lastSessionAt ?? left.activity.updatedAt));
  const lastCoreUse = (templateId: string) => Math.max(0, ...library
    .filter((item) => item.activity.scenarioResources?.sourceTemplateId === templateId)
    .map((item) => Date.parse(item.lastSessionAt ?? "") || 0));
  const visibleCore = [...coreLibrary]
    .filter(matchesMetadata)
    .sort((left, right) => sort === "az"
      ? left.title.localeCompare(right.title)
      : sort === "za"
        ? right.title.localeCompare(left.title)
        : lastCoreUse(right.id) - lastCoreUse(left.id) || left.title.localeCompare(right.title));
  const openSessions = library.flatMap((item) => item.activeSession ? [{ activity: item.activity, session: item.activeSession }] : []);
  const completedItems = [...library]
    .filter((item) => !item.activeSession && (item.latestSessionStatus === "ended" || item.latestSessionStatus === "expired"))
    .sort((left, right) => Date.parse(right.lastSessionAt ?? "") - Date.parse(left.lastSessionAt ?? ""))
    .slice(0, 4);

  const addCoreTemplate = async (template: SpeakingActivity) => {
    setWorkingTemplateId(template.id);
    try {
      const { id: _templateId, teacherId: _teacherId, createdAt: _createdAt, updatedAt: _updatedAt, status: _status, ...input } = template;
      const resources = speakingScenarioResources(template.scenarioResources);
      const payload = {
        ...input,
        scenarioResources: {
          ...resources,
          builtIn: false,
          sourceTemplateId: template.id,
          communicationSkills: [...resources.communicationSkills],
          successConditions: [...resources.successConditions],
          suggestedSteps: [...resources.suggestedSteps],
          usefulVocabulary: [...resources.usefulVocabulary],
          referenceItems: resources.referenceItems.map((item) => ({ ...item }))
        }
      } satisfies SpeakingCreateActivityInput;
      const result = await speakingApi.createActivity(payload) as { activity: SpeakingActivity };
      setPreviewTemplate(null);
      navigate(`/speak/teacher/activity/${result.activity.id}`);
    } catch (useError) {
      window.alert(getErrorMessage(useError, "This built-in scenario could not be added to My Tests."));
    } finally {
      setWorkingTemplateId("");
    }
  };

  const customizeTemplate = (template: SpeakingActivity) => {
    setPreviewTemplate(null);
    navigate(`/speak/teacher/create?templateId=${encodeURIComponent(template.id)}`);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setSkill("all");
    setSource("all");
  };

  if (loading) return <TeacherLoading />;
  return (
    <div className="speaking-page-shell speaking-teacher-shell speaking-dashboard-shell">
      <main className="speaking-teacher-layout speaking-dashboard-layout">
        <section className="speaking-teacher-content speaking-library-page speaking-dashboard-page">
          <div className="speaking-dashboard-heading">
            <div>
              <span className="speaking-eyebrow"><Mic size={15} aria-hidden="true" /> Teacher workspace</span>
              <h1>Speaking Practice</h1>
              <p>Create, customise and run real-world English performance tests.</p>
            </div>
            <button className="speaking-primary-button speaking-new-test-button" type="button" onClick={() => navigate("/speak/teacher/create")}>
              <Plus size={18} aria-hidden="true" /> New Performance Test
            </button>
          </div>
          {error && <p className="speaking-error speaking-dashboard-error" role="status">{error}</p>}
          <div className="speaking-library-tabs speaking-dashboard-tabs" role="tablist" aria-label="Speaking Practice library">
            <button type="button" role="tab" aria-selected={activeTab === "tests"} className={activeTab === "tests" ? "is-active" : ""} onClick={() => setActiveTab("tests")}>
              My Tests <span>{library.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "core"} className={activeTab === "core" ? "is-active" : ""} onClick={() => setActiveTab("core")}>
              Core Library <span>{coreLibrary.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={false} onClick={() => navigate("/speak/teacher/sets")}>
              My Sets <span>{sets.length}</span>
            </button>
          </div>
          {activeTab === "tests" ? (
            <>
              {openSessions.length > 0 && <section className="speaking-session-strip speaking-dashboard-live" aria-label="Active classroom sessions"><div className="speaking-section-title"><div><span className="speaking-card-kicker">Live now</span><h2>Active classroom sessions</h2></div><span>{openSessions.length} open</span></div>{openSessions.map(({ activity, session }) => <button className="speaking-session-row" key={session.id} type="button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}?sessionId=${encodeURIComponent(session.id)}`)}><span className={`speaking-status-pill speaking-status-${session.status}`}>{session.status === "ready" ? "Students joining" : session.status === "paused" ? "Paused" : "Running"}</span><strong>{activity.title}</strong><code>{session.joinCode}</code><span>Open classroom <ArrowRight size={16} aria-hidden="true" /></span></button>)}</section>}
              <div className="speaking-section-title speaking-library-section-heading"><div><span className="speaking-card-kicker">Your workspace</span><h2>My Tests</h2><p>Launch a saved test, edit its conversation, or add it to a Set.</p></div><button type="button" className="speaking-text-button" onClick={() => setActiveTab("core")}>Browse core library <ArrowRight size={15} aria-hidden="true" /></button></div>
              <SpeakingLibraryToolbar search={search} setSearch={setSearch} category={category} setCategory={setCategory} skill={skill} setSkill={setSkill} source={source} setSource={setSource} sort={sort} setSort={setSort} clearFilters={clearFilters} />
              {library.length ? visibleItems.length ? <div className="speaking-activity-list speaking-dashboard-activity-list">{visibleItems.map((item) => <TeacherActivityRow key={item.activity.id} item={item} sets={sets} navigate={navigate} onRefresh={load} />)}</div> : <SpeakingNoMatches onClear={clearFilters} /> : <div className="speaking-empty-card"><img className="speaking-empty-art" src="/assets/speaking/empty-performance-tests.webp" alt="" width={132} height={132} /><h2>Create your first Performance Test</h2><p>Start with a core scenario or build an open-ended conversation from scratch.</p><button type="button" className="speaking-primary-button" onClick={() => setActiveTab("core")}>Browse Core Library</button></div>}
              {completedItems.length > 0 && <section className="speaking-recent-sessions" aria-labelledby="recent-completed-sessions"><div className="speaking-section-title"><div><span className="speaking-card-kicker">Classroom history</span><h2 id="recent-completed-sessions">Recent completed sessions</h2></div><button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher/reports")}>View reports <ArrowRight size={15} aria-hidden="true" /></button></div><div className="speaking-recent-session-list">{completedItems.map((item) => <div className="speaking-recent-session" key={item.activity.id}><div><strong>{item.activity.title}</strong><span>{item.sessionCount} session{item.sessionCount === 1 ? "" : "s"} · {item.lastSessionAt ? `Completed ${new Date(item.lastSessionAt).toLocaleDateString()}` : "Completed recently"}</span></div><span className="speaking-status-pill speaking-status-ended">Completed</span></div>)}</div></section>}
            </>
          ) : (
            <section className="speaking-core-library" aria-labelledby="core-library-heading">
              <div className="speaking-section-title speaking-library-section-heading"><div><span className="speaking-card-kicker">Built-in scenarios</span><h2 id="core-library-heading">Core Library</h2><p>30 complete, editable conversations for real-world junior-high English.</p></div><span className="speaking-core-count">{visibleCore.length} shown</span></div>
              <SpeakingLibraryToolbar search={search} setSearch={setSearch} category={category} setCategory={setCategory} skill={skill} setSkill={setSkill} source="built-in" setSource={() => undefined} sort={sort} setSort={setSort} clearFilters={clearFilters} coreOnly />
              {visibleCore.length ? <div className="speaking-core-grid">{visibleCore.map((template) => <SpeakingCoreCard key={template.id} template={template} working={workingTemplateId === template.id} onPreview={() => setPreviewTemplate(template)} onUse={() => void addCoreTemplate(template)} onCustomize={() => customizeTemplate(template)} />)}</div> : <SpeakingNoMatches onClear={clearFilters} />}
            </section>
          )}
        </section>
      </main>
      {previewTemplate && <SpeakingCorePreview template={previewTemplate} working={workingTemplateId === previewTemplate.id} onClose={() => setPreviewTemplate(null)} onUse={() => void addCoreTemplate(previewTemplate)} onCustomize={() => customizeTemplate(previewTemplate)} />}
    </div>
  );
}

function SpeakingLibraryToolbar({
  search,
  setSearch,
  category,
  setCategory,
  skill,
  setSkill,
  source,
  setSource,
  sort,
  setSort,
  clearFilters,
  coreOnly = false
}: {
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  skill: string;
  setSkill: (value: string) => void;
  source: string;
  setSource: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  clearFilters: () => void;
  coreOnly?: boolean;
}) {
  return <div className="speaking-library-toolbar speaking-dashboard-toolbar">
    <label className="speaking-task-search"><span className="sr-only">Search scenarios</span><input aria-label="Search scenarios" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={coreOnly ? "Search scenarios" : "Search tests, roles or scenarios"} /></label>
    <label><span className="sr-only">Filter by category</span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{SPEAKING_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label><span className="sr-only">Filter by communication skill</span><select aria-label="Filter by communication skill" value={skill} onChange={(event) => setSkill(event.target.value)}><option value="all">All skills</option>{SPEAKING_COMMUNICATION_SKILLS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    {!coreOnly && <label><span className="sr-only">Filter by source</span><select aria-label="Filter by source" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">Built-in & My versions</option><option value="built-in">Built-in</option><option value="mine">My versions</option></select></label>}
    <label><span className="sr-only">Sort My Tests</span><select aria-label="Sort My Tests" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently used</option><option value="az">A–Z</option><option value="za">Z–A</option></select></label>
    <button type="button" className="speaking-filter-icon" aria-label="Clear filters" onClick={clearFilters}><SlidersHorizontal size={17} aria-hidden="true" /></button>
  </div>;
}

function SpeakingNoMatches({ onClear }: { onClear: () => void }) {
  return <div className="speaking-empty-card speaking-no-matches"><h2>No scenarios match</h2><p>Try a different search or filter.</p><button type="button" className="speaking-outline-button" onClick={onClear}>Clear filters</button></div>;
}

function SpeakingCoreCard({ template, working, onPreview, onUse, onCustomize }: { template: SpeakingActivity; working: boolean; onPreview: () => void; onUse: () => void; onCustomize: () => void }) {
  const resources = speakingScenarioResources(template.scenarioResources);
  return <article className="speaking-core-card">
    <div className="speaking-core-card-image"><img src={resources.imageSrc ?? "/assets/speaking/scenario-introduction.webp"} alt={resources.imageAlt ?? ""} loading="lazy" /><span>Built-in</span></div>
    <div className="speaking-core-card-body"><div className="speaking-core-card-heading"><div><span className="speaking-category-chip">{speakingCategory(template)}</span><h3>{template.title}</h3></div><span className="speaking-core-duration"><Clock3 size={14} aria-hidden="true" /> {speakingMinutes(template.durationSeconds)}</span></div><p>{template.scenario}</p><div className="speaking-skill-tags" aria-label={`Communication skills for ${template.title}`}>{speakingSkills(template).slice(0, 4).map((item) => <span key={item}>{item}</span>)}</div><div className="speaking-core-card-footer"><span><UserRound size={14} aria-hidden="true" /> AI: {template.aiRole}</span><div><button type="button" className="speaking-outline-button" onClick={onPreview}>Preview</button><button type="button" className="speaking-text-button" onClick={onCustomize}>Customize</button><button type="button" className="speaking-row-launch" onClick={onUse} disabled={working}>{working ? "Adding…" : "Use as-is"}</button></div></div></div>
  </article>;
}

function SpeakingCorePreview({ template, working, onClose, onUse, onCustomize }: { template: SpeakingActivity; working: boolean; onClose: () => void; onUse: () => void; onCustomize: () => void }) {
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const preview = previewRef.current;
    if (!preview) return;
    const focusable = () => Array.from(preview.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex="0"]'));
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === preview)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    const contain = (event: FocusEvent) => {
      if (event.target instanceof Node && !preview.contains(event.target)) (focusable()[0] ?? preview).focus();
    };
    preview.addEventListener("keydown", trap);
    document.addEventListener("focusin", contain);
    return () => {
      preview.removeEventListener("keydown", trap);
      document.removeEventListener("focusin", contain);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const resources = speakingScenarioResources(template.scenarioResources);
  return <div className="speaking-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section ref={previewRef} tabIndex={-1} className="speaking-core-preview" role="dialog" aria-modal="true" aria-labelledby="speaking-preview-title"><button type="button" className="speaking-preview-close" onClick={onClose} aria-label="Close preview"><X size={19} aria-hidden="true" /></button><div className="speaking-preview-top"><img src={resources.imageSrc ?? "/assets/speaking/scenario-introduction.webp"} alt={resources.imageAlt ?? ""} /><div><span className="speaking-category-chip">{speakingCategory(template)}</span><h2 id="speaking-preview-title">{template.title}</h2><p>{template.scenario}</p></div></div><div className="speaking-preview-grid"><div><span className="speaking-preview-label">Student goal</span><p>{resources.studentGoal}</p></div><div><span className="speaking-preview-label">AI context</span><p>{resources.aiContext ?? `Act as ${template.aiRole} in this situation.`}</p></div><div><span className="speaking-preview-label">Possible complication</span><p>{resources.possibleComplication ?? "Respond naturally if the student takes a different direction."}</p></div><div><span className="speaking-preview-label">Success conditions</span><ul>{(resources.successConditions.length ? resources.successConditions : ["Communicate the main idea.", "Respond and keep the conversation moving."]).map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="speaking-preview-skills"><span className="speaking-preview-label">AI role</span><p>{template.aiRole}</p><span className="speaking-preview-label">Assessment</span><ul>{template.rubric.filter((criterion) => criterion.enabled).map((criterion) => <li key={criterion.id}><strong>{criterion.name}</strong>: {criterion.description}</li>)}</ul></div><div className="speaking-preview-skills"><span className="speaking-preview-label">Communication skills</span><div className="speaking-skill-tags">{speakingSkills(template).map((item) => <span key={item}>{item}</span>)}</div></div><div className="speaking-preview-actions"><button type="button" className="speaking-outline-button" onClick={onClose}>Close</button><button type="button" className="speaking-text-button" onClick={onCustomize}>Customize</button><button type="button" className="speaking-primary-button" onClick={onUse} disabled={working}>{working ? "Adding…" : "Use as-is"}</button></div></section></div>;
}

function TeacherLoading() {
  return (
    <div className="speaking-empty-page">
      <LoaderCircle size={34} className="speaking-spin" aria-hidden="true" />
      <h1>Loading teacher workspace</h1>
      <p>Getting your real Speaking Practice activities…</p>
    </div>
  );
}

function TeacherActivityRow({
  item,
  sets,
  navigate,
  onRefresh,
}: {
  item: SpeakingLibraryItem;
  sets: SpeakingSetSummary[];
  navigate: Navigate;
  onRefresh: () => Promise<void>;
}) {
  const activity = item.activity;
  const imageSrc = activity.scenarioResources?.imageSrc ?? "/assets/speaking/scenario-introduction.webp";
  const duplicate = async () => { try { await speakingApi.duplicateActivity(activity.id); await onRefresh(); } catch (error) { window.alert(getErrorMessage(error, "The Performance Test could not be duplicated.")); } };
  const remove = async () => { if (!window.confirm(`Delete “${activity.title}”?\n\nExisting historical reports will remain available.`)) return; try { await speakingApi.deleteActivity(activity.id); await onRefresh(); } catch (error) { window.alert(getErrorMessage(error, "The Performance Test could not be deleted.")); } };
  const addToSet = async (setId: string) => { if (!setId) return; try { await speakingApi.addToSet(setId, activity.id); await onRefresh(); } catch (error) { window.alert(getErrorMessage(error, "The Performance Test could not be added to that Set.")); } };
  const resources = speakingScenarioResources(activity.scenarioResources);
  const isBuiltIn = resources.builtIn === true || activity.teacherId === "speaking-template";
  return <article className="speaking-activity-row"><img className="speaking-activity-thumbnail" src={imageSrc} alt="" loading="lazy" /><div className="speaking-activity-row-main"><div><strong>{activity.title}</strong><span>{activity.studentRole} · {speakingCategory(activity)}</span></div><p>{activity.scenario}</p><small>{speakingMinutes(activity.durationSeconds)} · {activity.rubric.filter((criterion) => criterion.enabled).length} criteria · {item.sessionCount} session{item.sessionCount === 1 ? "" : "s"}{item.lastSessionAt ? ` · Last used ${new Date(item.lastSessionAt).toLocaleDateString()}` : ""}</small><div className="speaking-row-context-tags"><span>{isBuiltIn ? "Built-in" : "My version"}</span>{speakingSkills(activity).slice(0, 2).map((item) => <span key={item}>{item}</span>)}{item.setMemberships.map((set) => <span key={set.id}>{set.name}</span>)}</div></div><div className="speaking-activity-row-meta">{item.activeSession ? <span className={`speaking-status-pill speaking-status-${item.activeSession.status}`}>{item.activeSession.status === "ready" ? "Students joining" : item.activeSession.status === "paused" ? "Paused" : "Live"}</span> : <span className="speaking-status-pill speaking-status-ready">Ready to launch</span>}<span>{activity.aiRole}</span></div><div className="speaking-activity-row-actions"><button type="button" className="speaking-row-launch" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}>{item.activeSession ? "Open" : "Launch"}</button><button type="button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)} aria-label={`Open ${activity.title}`}><ChevronRight size={18} aria-hidden="true" /></button><details><summary aria-label={`More actions for ${activity.title}`}><MoreHorizontal size={18} aria-hidden="true" /></summary><div className="speaking-overflow-menu"><button type="button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}/edit`)}>Edit</button><button type="button" onClick={() => void duplicate()}>Duplicate</button><label>Add to Set<select aria-label={`Add ${activity.title} to a Set`} defaultValue="" onChange={(event) => void addToSet(event.target.value)}><option value="">Choose a Set…</option>{sets.filter((set) => !item.setMemberships.some((membership) => membership.id === set.id)).map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label><button type="button" className="is-danger" onClick={() => void remove()}><Trash2 size={15} aria-hidden="true" />Delete</button></div></details></div></article>;
}

const draftFromTemplate = (
  template: SpeakingActivity,
): SpeakingCreateActivityInput => ({
  title: template.title,
  scenario: template.scenario,
  aiRole: template.aiRole,
  studentRole: template.studentRole,
  level: template.level,
  difficulty: template.difficulty,
  nativeLanguage: template.nativeLanguage,
  durationSeconds: template.durationSeconds,
  identifierMode: template.identifierMode,
  targetExpressions: [...template.targetExpressions],
  rubric: template.rubric.map((criterion) => ({ ...criterion })),
  ...((template.context ?? template.scenarioResources?.context) ? { context: { ...(template.context ?? template.scenarioResources?.context) } } : {}),
  scenarioResources: (() => {
    const resources = speakingScenarioResources(template.scenarioResources);
    return {
      ...(resources.category ? { category: resources.category } : {}),
      ...(resources.teacherFocus ? { teacherFocus: resources.teacherFocus } : {}),
      communicationSkills: [...resources.communicationSkills],
      ...(resources.aiContext ? { aiContext: resources.aiContext } : {}),
      ...(resources.possibleComplication ? { possibleComplication: resources.possibleComplication } : {}),
      successConditions: [...resources.successConditions],
      builtIn: false,
      ...((resources.builtIn || template.teacherId === "speaking-template") ? { sourceTemplateId: template.id } : resources.sourceTemplateId ? { sourceTemplateId: resources.sourceTemplateId } : {}),
      openingLine: resources.openingLine,
      studentGoal: resources.studentGoal,
      suggestedSteps: [...resources.suggestedSteps],
      usefulVocabulary: [...resources.usefulVocabulary],
      referenceItems: resources.referenceItems.map((item) => ({ ...item })),
      ...(resources.imageSrc ? { imageSrc: resources.imageSrc } : {}),
      ...(resources.imageAlt ? { imageAlt: resources.imageAlt } : {})
    };
  })(),
});

const blankSpeakingDraft = (): SpeakingCreateActivityInput => ({
  title: "",
  scenario: "",
  aiRole: "",
  studentRole: "",
  // These fields stay populated for the existing API contract while the
  // teacher-facing workflow is organized around scenarios and skills.
  level: "elementary",
  difficulty: "normal",
  nativeLanguage: "ja",
  durationSeconds: 180,
  identifierMode: "nickname",
  targetExpressions: [],
  rubric: DEFAULT_SPEAKING_RUBRIC.map((criterion) => ({ ...criterion })),
  scenarioResources: {
    category: SPEAKING_CATEGORIES[0],
    communicationSkills: ["Asking questions", "Sharing information"]
  }
});

function SpeakingCreateChoice({
  onBrowseCore,
  onStartScratch,
  onBack
}: {
  onBrowseCore: () => void;
  onStartScratch: () => void;
  onBack: () => void;
}) {
  return (
    <div className="speaking-page-shell speaking-teacher-shell speaking-dashboard-shell">
      <main className="speaking-teacher-layout speaking-dashboard-layout">
        <section className="speaking-teacher-content speaking-create-choice" aria-labelledby="speaking-create-choice-title">
          <button type="button" className="speaking-text-button speaking-create-back" onClick={onBack}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to Speaking Practice
          </button>
          <span className="speaking-eyebrow"><Plus size={15} aria-hidden="true" /> New Performance Test</span>
          <h1 id="speaking-create-choice-title">How would you like to start?</h1>
          <p className="speaking-create-choice-intro">Choose a complete real-world scenario to customise, or build an open-ended conversation for your class.</p>
          <div className="speaking-choice-grid">
            <button type="button" className="speaking-choice-card is-featured" onClick={onBrowseCore}>
              <span className="speaking-choice-icon"><ClipboardCheck size={22} aria-hidden="true" /></span>
              <span className="speaking-choice-card-copy"><strong>Use the Core Library</strong><span>Start with one of 30 complete junior-high performance tests, then adjust the task, support, or rubric.</span></span>
              <span className="speaking-choice-action">Browse Core Library <ArrowRight size={16} aria-hidden="true" /></span>
            </button>
            <button type="button" className="speaking-choice-card" onClick={onStartScratch}>
              <span className="speaking-choice-icon"><Pencil size={22} aria-hidden="true" /></span>
              <span className="speaking-choice-card-copy"><strong>Start from scratch</strong><span>Write your own situation, choose the communication skills, and shape the rubric step by step.</span></span>
              <span className="speaking-choice-action">Build a new test <ArrowRight size={16} aria-hidden="true" /></span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

const SPEAKING_DURATION_PRESETS = [120, 180, 300, 420] as const;

function SpeakingDurationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const isCustom = !SPEAKING_DURATION_PRESETS.includes(
    value as (typeof SPEAKING_DURATION_PRESETS)[number],
  );
  return (
    <label>
      Speaking time
      <select
        value={isCustom ? "custom" : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === "custom"
              ? isCustom
                ? value
                : 240
              : Number(event.target.value),
          )
        }
      >
        <option value={120}>2 minutes</option>
        <option value={180}>3 minutes</option>
        <option value={300}>5 minutes</option>
        <option value={420}>7 minutes</option>
        <option value="custom">Custom</option>
      </select>
      {isCustom && (
        <div className="speaking-custom-duration">
          <input
            type="number"
            min={2}
            max={7}
            step={1}
            value={Math.round(value / 60)}
            onChange={(event) => {
              const minutes = Number(event.target.value);
              onChange(
                (Number.isFinite(minutes)
                  ? Math.min(7, Math.max(2, Math.round(minutes)))
                  : 2) * 60,
              );
            }}
            aria-label="Custom speaking time in minutes"
          />
          <span>minutes</span>
        </div>
      )}
    </label>
  );
}

function SpeakingCreatePage({
  navigate,
  activityId,
}: {
  navigate: Navigate;
  activityId?: string;
}) {
  const editing = Boolean(activityId);
  const templateId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("templateId") ?? "";
  const initialTemplate = coreFallbackActivities().find((template) => template.id === templateId) ?? coreFallbackActivities()[9]!;
  const [draft, setDraft] = useState<SpeakingCreateActivityInput>(() => draftFromTemplate(initialTemplate));
  const [createMode, setCreateMode] = useState(() => editing || Boolean(templateId));
  const expressionIds = useRef<string[]>([]);
  const isDirtyRef = useRef(false);
  const expressionId = (index: number) => expressionIds.current[index] ?? (expressionIds.current[index] = crypto.randomUUID());
  const [newExpression, setNewExpression] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(editing);
  const [activityLoadFailed, setActivityLoadFailed] = useState(false);
  const [activeBuilderStep, setActiveBuilderStep] = useState("template");
  const builderSteps = [
    { id: "template", label: "Template", target: "speaking-template" },
    { id: "task", label: "Task", target: "speaking-situation" },
    { id: "support", label: "Student support", target: "speaking-language" },
    { id: "settings", label: "Settings", target: "speaking-settings" },
    { id: "rubric", label: "Rubric", target: "speaking-rubric" },
    { id: "review", label: "Review", target: "speaking-review" }
  ] as const;
  const builderStepComplete: Record<(typeof builderSteps)[number]["id"], boolean> = {
    template: Boolean(draft.title.trim()),
    task: Boolean(draft.title.trim() && draft.scenario.trim() && draft.aiRole.trim() && draft.studentRole.trim()),
    support: Boolean(draft.scenarioResources?.studentGoal?.trim()),
    settings: Boolean(draft.durationSeconds && draft.identifierMode),
    rubric: draft.rubric.some((criterion) => criterion.enabled && criterion.name.trim()),
    review: Boolean(draft.title.trim() && draft.scenario.trim() && draft.rubric.some((criterion) => criterion.enabled))
  };
  const focusBuilderStep = (step: (typeof builderSteps)[number]["id"]) => {
    setActiveBuilderStep(step);
    const target = builderSteps.find((candidate) => candidate.id === step)?.target;
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const leaveBuilder = (nextPath: string) => {
    if (isDirtyRef.current && !window.confirm("Leave this Performance Test? Unsaved changes will be lost.")) return;
    navigate(nextPath);
  };
  const update = <K extends keyof SpeakingCreateActivityInput>(
    key: K,
    value: SpeakingCreateActivityInput[K],
  ) => {
    isDirtyRef.current = true;
    setFormError("");
    setDraft((current) => ({ ...current, [key]: value }));
  };
  // Keep spaces, blank lines and empty fields intact until the save boundary.
  const resourceDraft = { ...speakingScenarioResources(), ...draft.scenarioResources };
  const contextDraft = draft.context;
  const updateResources = (patch: SpeakingScenarioResources) =>
    update("scenarioResources", { ...resourceDraft, ...patch });
  const updateContext = (patch: Partial<SpeakingContext>) =>
    update("context", { ...(draft.context ?? {}), ...patch });
  const removeContext = () => update("context", undefined);
  const toggleSkill = (candidate: string) => {
    const next = resourceDraft.communicationSkills.includes(candidate)
      ? resourceDraft.communicationSkills.filter((item) => item !== candidate)
      : [...resourceDraft.communicationSkills, candidate];
    updateResources({ communicationSkills: next });
  };
  const updateCriterion = (
    index: number,
    patch: Partial<SpeakingRubricCriterion>,
  ) =>
    update(
      "rubric",
      draft.rubric.map((criterion, candidateIndex) =>
        candidateIndex === index ? { ...criterion, ...patch } : criterion,
      ),
    );
  const addExpression = () => {
    if (!newExpression.trim() || draft.targetExpressions.length >= 12) return;
    update("targetExpressions", [
      ...draft.targetExpressions,
      newExpression.trim(),
    ]);
    setNewExpression("");
  };
  useEffect(() => {
    if (activityId || !templateId) return;
    let cancelled = false;
    void speakingApi
      .templates()
      .then((payload) => {
        if (cancelled || isDirtyRef.current) return;
        const template = ((payload as { items?: SpeakingActivity[] }).items ?? []).find((item) => item.id === templateId);
        if (template) {
          setDraft(draftFromTemplate(template));
          isDirtyRef.current = false;
        }
      })
      .catch(() => {
        // The complete built-in fallback is already in the initial draft.
      });
    return () => {
      cancelled = true;
    };
  }, [activityId, templateId]);
  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    void speakingApi
      .activity(activityId)
      .then((payload) => {
        if (cancelled) return;
        const activity = (payload as { activity: SpeakingActivity }).activity;
        setDraft(draftFromTemplate(activity));
        isDirtyRef.current = false;
        setLoadingActivity(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setFormError(
          getErrorMessage(loadError, "This activity could not be loaded."),
        );
        setActivityLoadFailed(true);
        setLoadingActivity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);
  useEffect(() => {
    if (!createMode) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [createMode, saving]);
  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || activityLoadFailed) return;
    if (!draft.title.trim() || !draft.scenario.trim()) {
      setFormError("Activity name and speaking situation are required.");
      return;
    }
    if (!draft.rubric.some((criterion) => criterion.enabled)) {
      setFormError("Choose at least one rubric skill.");
      return;
    }
    setSaving(true);
    try {
      const payload = (
        editing && activityId
          ? await speakingApi.updateActivity(activityId, { ...draft, scenarioResources: speakingScenarioResources(draft.scenarioResources) })
          : await speakingApi.createActivity({ ...draft, scenarioResources: speakingScenarioResources(draft.scenarioResources) })
      ) as { activity: SpeakingActivity };
      isDirtyRef.current = false;
      navigate(`/speak/teacher/activity/${payload.activity.id}`);
    } catch (createError) {
      setFormError(
        getErrorMessage(
          createError,
          editing
            ? "The activity could not be updated. Please try again."
            : "The activity could not be saved. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  if (loadingActivity) return <TeacherLoading />;
  if (activityLoadFailed) return <MissingSpeakingSession navigate={navigate} message={formError} />;
  if (!editing && !templateId && !createMode) {
    return <SpeakingCreateChoice onBrowseCore={() => navigate("/speak/teacher/core")} onStartScratch={() => { setDraft(blankSpeakingDraft()); setCreateMode(true); }} onBack={() => navigate("/speak/teacher")} />;
  }
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <form className="speaking-builder" onSubmit={handleCreate}>
          <div className="speaking-builder-header">
            <div>
              <span className="speaking-eyebrow">
                <Edit3 size={15} aria-hidden="true" /> Activity builder
              </span>
              <h1>{editing ? "Edit Performance Test" : "Create a Performance Test"}</h1>
              <p>
                {editing
                  ? "Update the reusable activity. Existing classroom sessions keep their original setup."
                  : "Adapt a conversation from your textbook. Save the task, then launch it for your class."}
              </p>
            </div>
            <div className="speaking-builder-header-actions">
              <button
                type="button"
                className="speaking-text-button"
                onClick={() =>
                  leaveBuilder(
                    editing && activityId
                      ? `/speak/teacher/activity/${activityId}`
                      : "/speak/teacher",
                  )
                }
              >
                <ArrowLeft size={15} aria-hidden="true" />
                Back
              </button>
              <button
                type="submit"
                className="speaking-primary-button"
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="speaking-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Check size={17} aria-hidden="true" />
                )}
                {editing ? "Save changes" : "Create Performance Test"}
              </button>
            </div>
          </div>
          <nav className="speaking-builder-jump" aria-label="Performance Test setup steps">
            {builderSteps.map((step, index) => <button type="button" key={step.id} className={`${activeBuilderStep === step.id ? "is-active " : ""}${builderStepComplete[step.id] ? "is-complete" : ""}`} aria-current={activeBuilderStep === step.id ? "step" : undefined} onClick={() => focusBuilderStep(step.id)}><span>{index === 0 ? "" : index}</span><strong>{step.label}</strong>{builderStepComplete[step.id] && <Check size={14} aria-hidden="true" />}</button>)}
          </nav>
          <section id="speaking-template" className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">
                  Start with a template
                </span>
                <h2>Pick a familiar conversation</h2>
              </div>
              <span className="speaking-builder-step">Template</span>
            </div>
            <div className="speaking-template-grid">
              {coreFallbackActivities().map((template) => (
                <button
                  type="button"
                  className={`speaking-template-card${draft.title === template.title ? " is-selected" : ""}`}
                  key={template.id}
                  onClick={() => {
                    if (isDirtyRef.current && !window.confirm("Replace your unsaved changes with this template?")) return;
                    isDirtyRef.current = true;
                    setFormError("");
                    setDraft(draftFromTemplate(template));
                  }}
                >
                  <img className="speaking-template-image" src={template.scenarioResources?.imageSrc ?? "/assets/speaking/scenario-introduction.webp"} alt="" width={52} height={52} loading="lazy" />
                  <span className="speaking-template-copy">
                    <strong>{template.title}</strong>
                    <small>{template.scenario}</small>
                    <small>{speakingCategory(template)} · {speakingSkills(template).slice(0, 2).join(" · ")}</small>
                  </span>
                  {draft.title === template.title && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </section>
          <section id="speaking-situation" className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">The conversation</span>
                <h2>Give students a clear situation</h2>
              </div>
              <span className="speaking-builder-step">01 / 05</span>
            </div>
            <div className="speaking-builder-form-grid">
              <label>
                Activity name
                <input
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </label>
              <label>
                AI role
                <input
                  value={draft.aiRole}
                  onChange={(event) => update("aiRole", event.target.value)}
                />
              </label>
              <label>
                Student role
                <input
                  value={draft.studentRole}
                  onChange={(event) =>
                    update("studentRole", event.target.value)
                  }
                />
              </label>
              <label className="speaking-span-2">
                Speaking situation
                <textarea
                  value={draft.scenario}
                  onChange={(event) => update("scenario", event.target.value)}
                  rows={3}
                />
              </label>

            </div>
          </section>
          <section id="speaking-language" className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">Target English</span>
                <h2>Help students prepare</h2>
              </div>
              <span className="speaking-builder-step">02 / 05</span>
            </div>
              <div className="speaking-span-2 speaking-resource-editor">
                <div className="speaking-resource-editor-heading">
                  <div>
                    <span className="speaking-card-kicker">Scenario support</span>
                    <p>These resources are saved with the activity and shown to students as optional guidance.</p>
                  </div>
                </div>
                <div className="speaking-resource-grid">
                  <label>
                    Opening line
                    <input
                      value={resourceDraft.openingLine}
                      onChange={(event) => updateResources({ openingLine: event.target.value })}
                    />
                  </label>
                  <label>
                    Student goal
                    <textarea
                      rows={2}
                      value={resourceDraft.studentGoal}
                      onChange={(event) => updateResources({ studentGoal: event.target.value })}
                    />
                  </label>
                  <label>
                    AI context
                    <textarea
                      rows={2}
                      value={resourceDraft.aiContext ?? ""}
                      onChange={(event) => updateResources({ aiContext: event.target.value || undefined })}
                      placeholder="What the AI knows, wants, or can offer in this situation"
                    />
                  </label>
                  <label>
                    Possible complication
                    <textarea
                      rows={2}
                      value={resourceDraft.possibleComplication ?? ""}
                      onChange={(event) => updateResources({ possibleComplication: event.target.value || undefined })}
                      placeholder="A natural change or problem the AI may introduce"
                    />
                  </label>
                  <label className="speaking-span-2">
                    Success conditions <small>(one per line)</small>
                    <textarea
                      rows={3}
                      value={resourceDraft.successConditions.join("\n")}
                      onChange={(event) => updateResources({ successConditions: event.target.value.split(/\r?\n/u) })}
                      placeholder="What a successful conversation should demonstrate"
                    />
                  </label>
                  <details className="speaking-span-2 speaking-support-details"><summary>Optional steps, vocabulary & reference material</summary><div className="speaking-resource-grid">
                  <label>
                    Suggested steps <small>(one per line)</small>
                    <textarea
                      rows={5}
                      value={resourceDraft.suggestedSteps.join("\n")}
                      onChange={(event) => updateResources({ suggestedSteps: event.target.value.split(/\r?\n/u) })}
                    />
                  </label>
                  <label>
                    Useful vocabulary <small>(one per line)</small>
                    <textarea
                      rows={5}
                      value={resourceDraft.usefulVocabulary.join("\n")}
                      onChange={(event) => updateResources({ usefulVocabulary: event.target.value.split(/\r?\n/u) })}
                    />
                  </label>
                  <label className="speaking-span-2">
                    Reference material <small>(one item per line: label | detail)</small>
                    <textarea
                      rows={3}
                      value={resourceDraft.referenceItems.map((item) => item.detail !== undefined ? `${item.label}|${item.detail}` : item.label).join("\n")}
                      onChange={(event) => updateResources({ referenceItems: event.target.value.split(/\r?\n/u).map((line) => { const [label, ...detail] = line.split("|"); return { label: label ?? "", ...(detail.length ? { detail: detail.join("|") } : {}) }; }) })}
                    />
                  </label>
                </div></details>
                </div>
              </div>
            <section className="speaking-context-editor speaking-span-2" aria-labelledby="speaking-context-editor-title">
              <div className="speaking-resource-editor-heading">
                <div>
                  <span className="speaking-card-kicker">Optional visual support</span>
                  <h3 id="speaking-context-editor-title">Context</h3>
                  <p>Keep the image, title and description aligned with the situation students will speak about.</p>
                </div>
                {contextDraft && <button type="button" className="speaking-text-button speaking-context-remove" onClick={removeContext}>Remove Context</button>}
              </div>
              {contextDraft ? (
                <>
                  <div className="speaking-context-editor-preview">
                    {contextDraft.imageUrl ? <img src={contextDraft.imageUrl} alt={contextDraft.alt ?? "Current context preview"} loading="lazy" /> : <div className="speaking-context-editor-empty">Add an image URL below to show a preview.</div>}
                    <div><strong>{contextDraft.title || "Untitled context"}</strong><span>{contextDraft.description || "No description yet."}</span><small>{contextDraft.type ?? "photo"} · Read-only student support</small></div>
                  </div>
                  <div className="speaking-context-editor-fields">
                    <label>
                      Context title
                      <input value={contextDraft.title ?? ""} onChange={(event) => updateContext({ title: event.target.value || undefined })} placeholder="Museum map" />
                    </label>
                    <label>
                      Context type
                      <select value={contextDraft.type ?? "photo"} onChange={(event) => updateContext({ type: event.target.value as SpeakingContext["type"] })}>
                        {SPEAKING_CONTEXT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="speaking-span-2">
                      Image URL
                      <input value={contextDraft.imageUrl ?? ""} onChange={(event) => updateContext({ imageUrl: event.target.value || undefined })} placeholder="/assets/speaking/context-map.webp" inputMode="url" />
                    </label>
                    <label>
                      Description
                      <textarea rows={2} value={contextDraft.description ?? ""} onChange={(event) => updateContext({ description: event.target.value || undefined })} placeholder="Use this visual to help your answer." />
                    </label>
                    <label>
                      Alt text
                      <textarea rows={2} value={contextDraft.alt ?? ""} onChange={(event) => updateContext({ alt: event.target.value || undefined })} placeholder="A simple map showing the nearby museum" />
                    </label>
                  </div>
                </>
              ) : (
                <div className="speaking-context-editor-empty-state">
                  <p>No Context is saved for this activity. Add one only when it matches the scenario.</p>
                  <button type="button" className="speaking-outline-button" onClick={() => update("context", { title: "Context", description: "Use this visual to help your answer.", type: "photo" })}>Add Context</button>
                </div>
              )}
            </section>
            <div className="speaking-expression-editor">
              {draft.targetExpressions.map((expression, index) => (
                <div
                  className="speaking-expression-chip"
                  key={expressionId(index)}
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  <input
                    value={expression}
                    aria-label={`Target expression ${index + 1}`}
                    onChange={(event) =>
                      update(
                        "targetExpressions",
                        draft.targetExpressions.map((item, candidateIndex) =>
                          candidateIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      expressionIds.current.splice(index, 1);
                      update("targetExpressions", draft.targetExpressions.filter((_, candidateIndex) => candidateIndex !== index));
                    }}
                    aria-label={`Remove ${expression}`}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <div className="speaking-add-expression">
                <input
                  value={newExpression}
                  aria-label="New target expression"
                  onChange={(event) => setNewExpression(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addExpression();
                    }
                  }}
                  placeholder="Add an expression"
                />
                <button
                  type="button"
                  className="speaking-outline-button"
                  onClick={addExpression}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add
                </button>
              </div>
            </div>
          </section>
          <section id="speaking-settings" className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">Activity settings</span>
                <h2>Set the right amount of support</h2>
              </div>
              <span className="speaking-builder-step">03 / 05</span>
            </div>
            <div className="speaking-settings-grid">
              <label>
                Category
                <select
                  value={resourceDraft.category ?? SPEAKING_CATEGORIES[0]}
                  onChange={(event) => updateResources({ category: event.target.value })}
                >
                  {SPEAKING_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <SpeakingDurationField
                value={draft.durationSeconds}
                onChange={(value) => update("durationSeconds", value)}
              />
              <label>
                Feedback language
                <select
                  value={draft.nativeLanguage}
                  onChange={(event) =>
                    update(
                      "nativeLanguage",
                      event.target.value as SpeakingNativeLanguage,
                    )
                  }
                >
                  {SPEAKING_NATIVE_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {SPEAKING_NATIVE_LANGUAGE_LABELS[language]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Student identification
                <select
                  value={draft.identifierMode}
                  onChange={(event) =>
                    update(
                      "identifierMode",
                      event.target.value as SpeakingIdentifierMode,
                    )
                  }
                >
                  {SPEAKING_IDENTIFIER_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {SPEAKING_IDENTIFIER_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="speaking-skill-picker speaking-span-2">
                <legend>Communication skills</legend>
                <p>Select the skills you want the AI and rubric to foreground. Students can still use any English that helps them communicate.</p>
                <div>{SPEAKING_COMMUNICATION_SKILLS.map((item) => <label key={item}><input type="checkbox" checked={resourceDraft.communicationSkills.includes(item)} onChange={() => toggleSkill(item)} />{item}</label>)}</div>
              </fieldset>
              <label className="speaking-span-2">Additional focus or class content
                <textarea value={resourceDraft.teacherFocus ?? ""} onChange={(event) => updateResources({ teacherFocus: event.target.value })} maxLength={500} rows={3} placeholder="Vocabulary from this week's unit, or asking follow-up questions." />
                <small>Optional. The assessment will pay particular attention to this area. Students are still free to use any English they know.</small>
              </label>
            </div>
          </section>
          <section id="speaking-rubric" className="speaking-builder-card">
            <div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Evaluation rubric</span><h2>What will students be evaluated on?</h2></div><span className="speaking-builder-step">04 / 05</span></div>
            <p className="speaking-rubric-intro">Each enabled criterion is scored from 0 to 4, with conversation evidence. Insufficient speech is left unscored.</p>
            <div className="speaking-rubric-editor-heading">
              <div>
                <span className="speaking-card-kicker">Editable rubric</span>
                <p>
                  Keep the skills that matter for this activity. Pronunciation
                  scoring is not included.
                </p>
              </div>
              <button
                type="button"
                className="speaking-outline-button"
                disabled={draft.rubric.length >= 10}
                onClick={() =>
                  update("rubric", [
                    ...draft.rubric,
                    {
                      id: `custom-${Date.now()}`,
                      name: "New skill",
                      description: "What should students show?",
                      enabled: true,
                    },
                  ])
                }
              >
                <Plus size={16} aria-hidden="true" />
                Add criterion
              </button>
            </div>
            <div className="speaking-rubric-editor">
              {draft.rubric.map((criterion, index) => (
                <div
                  className={`speaking-rubric-row${criterion.enabled ? " is-enabled" : ""}`}
                  key={criterion.id}
                >
                  <label className="speaking-rubric-toggle">
                    <input
                      type="checkbox"
                      aria-label={`Evaluate ${criterion.name}`}
                      checked={criterion.enabled}
                      onChange={(event) =>
                        updateCriterion(index, {
                          enabled: event.target.checked,
                        })
                      }
                    />
                    <span>{criterion.enabled ? "On" : "Off"}</span>
                  </label>
                  <div>
                    <input
                      aria-label={`${criterion.name} name`}
                      value={criterion.name}
                      onChange={(event) =>
                        updateCriterion(index, { name: event.target.value })
                      }
                    />
                    <textarea
                      aria-label={`${criterion.name} description`}
                      rows={2}
                      value={criterion.description}
                      onChange={(event) =>
                        updateCriterion(index, {
                          description: event.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="speaking-icon-button speaking-danger-icon"
                    onClick={() =>
                      update(
                        "rubric",
                        draft.rubric.filter(
                          (_, candidateIndex) => candidateIndex !== index,
                        ),
                      )
                    }
                    aria-label={`Remove ${criterion.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section id="speaking-review" className="speaking-builder-card speaking-review-card">
            <div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Review & launch</span><h2>{draft.title || "Your Performance Test"}</h2></div><span className="speaking-builder-step">05 / 05</span></div>
            <p>{draft.scenario}</p><dl className="speaking-review-facts"><div><dt>Speaking time</dt><dd>{formatDuration(draft.durationSeconds)}</dd></div><div><dt>Student identification</dt><dd>{SPEAKING_IDENTIFIER_MODE_LABELS[draft.identifierMode]}</dd></div><div><dt>Evaluation</dt><dd>{draft.rubric.filter((criterion) => criterion.enabled).length} criteria · 4 points each</dd></div></dl>
            <p>Save this reusable task. On the next screen, launch a session to get your class code.</p>
          </section>
          {formError && (
            <p className="speaking-error speaking-builder-error" role="alert">
              {formError}
            </p>
          )}
          <div className="speaking-builder-footer">
            <p>
              <ShieldIcon />
              <span>
                Activities are saved to your teacher workspace. Classroom join
                codes are created only when you launch a session.
              </span>
            </p>
            <button
              type="submit"
              className="speaking-primary-button"
              disabled={saving}
            >
              <Check size={17} aria-hidden="true" />
              {editing ? "Save changes" : "Create Performance Test"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function SpeakingActivityPage({
  navigate,
  activityId,
  results,
  edit,
}: {
  navigate: Navigate;
  activityId: string;
  results: boolean;
  edit: boolean;
}) {
  if (results)
    return <SpeakingResultsPage navigate={navigate} activityId={activityId} />;
  if (edit)
    return <SpeakingCreatePage navigate={navigate} activityId={activityId} />;
  return (
    <SpeakingActivityDetailPage navigate={navigate} activityId={activityId} />
  );
}

function SpeakingActivityDetailPage({
  navigate,
  activityId,
}: {
  navigate: Navigate;
  activityId: string;
}) {
  const [activity, setActivity] = useState<SpeakingActivity>();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState<SpeakingRosterResponse>();
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState<SpeakingRosterStatus | "all">("all");
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const load = useCallback(async () => {
    try {
      const [activityPayload, sessionPayload] = await Promise.all([
        speakingApi.activity(activityId),
        speakingApi.sessions(activityId),
      ]);
      setActivity((activityPayload as { activity: SpeakingActivity }).activity);
      const nextSessions = (sessionPayload as { sessions: SpeakingSession[] }).sessions;
      const selectedId = new URLSearchParams(window.location.search).get("sessionId");
      setSessions(selectedId ? [...nextSessions].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId)) : nextSessions);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, "This activity could not be loaded."),
      );
    }
  }, [activityId]);
  useEffect(() => {
    void load();
  }, [load]);
  const [copied, setCopied] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [working, setWorking] = useState(false);
  const latestSessionId = sessions[0]?.id;
  const loadRoster = useCallback(async (sessionId: string, signal?: AbortSignal) => {
    try {
      const next = await speakingApi.roster(sessionId, signal) as SpeakingRosterResponse;
      if (signal?.aborted) return;
      setRoster(next);
      setRosterError("");
    } catch (loadError) {
      if (signal?.aborted) return;
      setRosterError(getErrorMessage(loadError, "The live roster could not be loaded."));
    } finally {
      if (!signal?.aborted) setRosterLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!latestSessionId) {
      setRoster(undefined);
      setRosterLoading(false);
      setRosterError("");
      return;
    }
    const controller = new AbortController();
    let inFlight = false;
    setRosterLoading(true);
    const poll = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        await loadRoster(latestSessionId, controller.signal);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timerId = window.setInterval(() => void poll(), 5_000);
    return () => {
      controller.abort();
      window.clearInterval(timerId);
    };
  }, [latestSessionId, loadRoster]);
  if (!activity)
    return error ? (
      <MissingSpeakingSession navigate={navigate} message={error} />
  ) : (
      <TeacherLoading />
    );
  const resourceDetails = speakingScenarioResources(activity.scenarioResources);
  const latest = roster && roster.session.id === sessions[0]?.id && (roster.session.revision ?? 0) >= (sessions[0]?.revision ?? 0) ? roster.session : sessions[0];
  const shareable = Boolean(
    latest && ["ready", "active", "paused"].includes(latest.status),
  );
  const shareUrl = shareable
    ? `${window.location.origin}/speak/join/${latest!.joinCode}`
    : "";
  const run = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setError("");
    try {
      await action();
      await load();
      if (latest) await loadRoster(latest.id);
    } catch (actionError) {
      setError(
        getErrorMessage(
          actionError,
          "The classroom session could not be updated.",
        ),
      );
    } finally {
      setWorking(false);
    }
  };
  const endLatestSession = () => {
    if (
      !latest ||
      !window.confirm(
        `End speaking session ${latest.joinCode}? Students will not be able to continue this classroom run.`,
      )
    )
      return;
    void run(() => speakingApi.endSession(latest.id));
  };
  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyError("");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopyError("Copy did not work. Select and copy the join link below.");
      setCopied(false);
    }
  };
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <section className="speaking-share-page">
          <button
            type="button"
            className="speaking-text-button"
            onClick={() => navigate("/speak/teacher")}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            All activities
          </button>
          <div className="speaking-share-header">
            <div>
              <span className="speaking-eyebrow">
                <Check size={15} aria-hidden="true" />{" "}
                {latest ? "Classroom session" : "Reusable activity"}
              </span>
              <h1>{activity.title}</h1>
              <p>{activity.scenario}</p>
            </div>
            <span
              className={`speaking-status-pill speaking-status-${latest?.status ?? "ready"}`}
            >
              {latest ? latest.status : "Ready to launch"}
            </span>
          </div>
          {error && (
            <p className="speaking-error" role="alert">
              {error}
            </p>
          )}
          {projecting && shareable && latest && <SpeakingProjector activity={activity} session={latest} shareUrl={shareUrl} roster={roster} stale={Boolean(rosterError)} onClose={() => setProjecting(false)} />}
          <div className="speaking-share-actions">
            {shareable && <button type="button" className="speaking-outline-button" onClick={() => setProjecting(true)}><Monitor size={17} aria-hidden="true" />Project join screen</button>}

            {latest && latest.status === "ready" && (
              <button
                type="button"
                className="speaking-primary-button"
                disabled={working}
                onClick={() =>
                  void run(() => speakingApi.startSession(latest.id))
                }
              >
                Start session
              </button>
            )}
            {latest && latest.status === "active" && (
              <button
                type="button"
                className="speaking-outline-button"
                disabled={working}
                onClick={() =>
                  void run(() => speakingApi.pauseSession(latest.id))
                }
              >
                Pause session
              </button>
            )}
            {latest && latest.status === "paused" && (
              <button
                type="button"
                className="speaking-primary-button"
                disabled={working}
                onClick={() =>
                  void run(() => speakingApi.resumeSession(latest.id))
                }
              >
                Resume session
              </button>
            )}
            {latest &&
              ["ready", "active", "paused"].includes(latest.status) && (
                <button
                  type="button"
                  className="speaking-outline-button"
                  disabled={working}
                  onClick={endLatestSession}
                >
                  End session
                </button>
              )}
            {latest && (
              <button
                type="button"
                className="speaking-outline-button"
                onClick={() =>
                  navigate(
                    `/speak/teacher/activity/${activity.id}/results?sessionId=${encodeURIComponent(latest.id)}`,
                  )
                }
              >
                <Trophy size={17} aria-hidden="true" />
                View results
              </button>
            )}
          </div>
          <details className="speaking-session-instructions" open={!shareable || latest?.status === "ready"}>
          <summary>{shareable ? `Join instructions · ${latest!.joinCode}` : "Launch a classroom session"}</summary>
          <div className="speaking-share-grid">
            <section className="speaking-share-card speaking-share-code-card">
              {shareable ? (
                <>
                  <div>
                    <span className="speaking-card-kicker">
                      参加コード / QRコード
                    </span>
                    <h2>
                      {latest!.status === "ready"
                        ? "Students are joining"
                        : latest!.status === "paused" ? "Performance Test paused" : "Performance Test running"}
                    </h2>
                    <p>
                      Scan the QR code or enter this short code at{" "}
                      <strong>/speak/join</strong>.
                    </p>
                  </div>
                  <div className="speaking-share-visual">
                    <QRCodeSVG
                      value={shareUrl}
                      size={172}
                      bgColor="#ffffff"
                      fgColor="#12214b"
                      level="M"
                    />
                    <div className="speaking-join-code-block">
                      <small>Session code</small>
                      <strong>{latest!.joinCode}</strong>
                      <button
                        type="button"
                        onClick={copyShareUrl}
                        aria-label="Copy join URL"
                      >
                        {copied ? (
                          <Check size={18} aria-hidden="true" />
                        ) : (
                          <Copy size={18} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  {copyError && <p className="speaking-error" role="alert">{copyError}</p>}
                  <div className="speaking-share-link">
                    <input aria-label="Student join link" value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
                    <button
                      className="speaking-outline-button"
                      type="button"
                      onClick={copyShareUrl}
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="speaking-card-kicker">
                      {latest
                        ? "Launch a new classroom run"
                        : "Launch a classroom run"}
                    </span>
                    <h2>
                      {latest
                        ? "Ready for another class?"
                        : "Ready when you are"}
                    </h2>
                    <p>
                      Launching creates a new secure session code. This activity
                      itself stays reusable.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="speaking-primary-button"
                    disabled={working}
                    onClick={() =>
                      void run(async () => {
                        await speakingApi.launchSession(activity.id);
                        // A new classroom run must replace any historical session selection.
                        const url = new URL(window.location.href);
                        url.searchParams.delete("sessionId");
                        window.history.replaceState({}, "", url);
                      })
                    }
                  >
                    <Play size={17} aria-hidden="true" />
                    Launch session
                  </button>
                </>
              )}
            </section>
          </div>
          </details>
          {latest && (
            <SpeakingRosterCard
              roster={roster}
              loading={rosterLoading}
              error={rosterError}
              search={rosterSearch}
              filter={rosterFilter}
              onSearch={setRosterSearch}
              onFilter={setRosterFilter}
            />
          )}
            {!latest && <section className="speaking-share-card"><span className="speaking-card-kicker">Your next steps</span><h2>Bring your class together</h2><ol className="speaking-launch-steps"><li>Launch a session to get a join code.</li><li>Share the code and wait for students to join.</li><li>Start the session when everyone is ready.</li></ol></section>}

          <details className="speaking-setup-details">
            <summary>Activity setup <span>Roles, target English and settings</span></summary>
            <section className="speaking-share-card">
              <div className="speaking-share-card-heading">
                <span className="speaking-card-kicker">Activity setup</span>
                <button
                  type="button"
                  className="speaking-icon-button"
                  onClick={() =>
                    navigate(`/speak/teacher/activity/${activity.id}/edit`)
                  }
                  aria-label="Edit activity"
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <span className="speaking-edit-label">Edit Activity</span>
              </div>
              <dl className="speaking-activity-facts">
                <div>
                  <dt>AI role</dt>
                  <dd>{activity.aiRole}</dd>
                </div>
                <div>
                  <dt>Student role</dt>
                  <dd>{activity.studentRole}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{resourceDetails.category ?? "Everyday Communication"}</dd>
                </div>
                <div>
                  <dt>Communication skills</dt>
                  <dd>{resourceDetails.communicationSkills.length ? resourceDetails.communicationSkills.join(", ") : "Conversation skills"}</dd>
                </div>
                <div>
                  <dt>Speaking time</dt>
                  <dd>{formatDuration(activity.durationSeconds)}</dd>
                </div>
                <div>
                  <dt>Feedback</dt>
                  <dd>
                    {SPEAKING_NATIVE_LANGUAGE_LABELS[activity.nativeLanguage]}
                  </dd>
                </div>
              </dl>
              <div className="speaking-share-targets">
                <span>Target English</span>
                <div>
                  {activity.targetExpressions.map((expression) => (
                    <span key={expression}>{expression}</span>
                  ))}
                </div>
              </div>
            </section>
          </details>
          {sessions.length > 1 && (
            <section className="speaking-share-card speaking-previous-sessions">
              <div className="speaking-share-card-heading">
                <span className="speaking-card-kicker">Other sessions</span>
              </div>
              {sessions.slice(1).map((session) => (
                <button
                  className="speaking-results-table-row"
                  type="button"
                  key={session.id}
                  onClick={() =>
                    navigate(
                      `/speak/teacher/activity/${activity.id}/results?sessionId=${encodeURIComponent(session.id)}`,
                    )
                  }
                >
                  <span>{new Date(session.createdAt).toLocaleString()}</span>
                  <code>{session.joinCode}</code>
                  <span
                    className={`speaking-status-pill speaking-status-${session.status}`}
                  >
                    {session.status}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              ))}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

function RosterIcon({ status }: { status: SpeakingRosterStatus }) {
  const Icon = status === "error" ? AlertCircle : status === "finished" ? ClipboardCheck : status === "ready" ? CircleCheck : status === "practicing" ? Mic : status === "joined" ? UserRound : Clock3;
  return <Icon className={`speaking-roster-icon status-${status}`} size={17} aria-hidden="true" />;
}

function SpeakingProjector({ activity, session, shareUrl, roster, stale, onClose }: { activity: SpeakingActivity; session: SpeakingSession; shareUrl: string; roster?: SpeakingRosterResponse; stale: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); returnFocus?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="speaking-projector speaking-app" aria-labelledby="speaking-projector-title" onCancel={onClose}>
    <header><div className="speaking-projector-brand-lockup"><GyakutenEigoBrand className="speaking-projector-brand" /><span>Performance Test</span></div><button type="button" onClick={onClose}>Close projection</button></header>
    <main><span className={`speaking-status-pill speaking-status-${session.status}`}>{session.status === "ready" ? "Students are joining" : session.status === "paused" ? "Performance Test paused" : "Performance Test running"}</span><h1 id="speaking-projector-title">{activity.title}</h1><p>Scan the QR code or enter the code below.</p><p lang="ja">QRコードを読み取るか、参加コードを入力してください。</p>
    <div className="speaking-projector-join"><QRCodeSVG value={shareUrl} size={240} marginSize={3} level="M" /><div><span>Session code</span><strong>{session.joinCode}</strong><p>{window.location.origin}/speak/join</p></div></div>
    <div className="speaking-projector-counts" role="status"><span><strong>{roster?.items.length ?? "—"}</strong> joined</span><span><strong>{roster?.counts.ready ?? "—"}</strong> ready</span><span><strong>{roster?.counts.error ?? "—"}</strong> need attention</span></div>
    {stale && <p role="alert">Class counts may be out of date. Updates are retrying.</p>}
    <p>{session.status === "ready" ? "Check your microphone, then wait for your teacher." : session.status === "paused" ? "Please wait for your teacher to resume." : "Work on your own device. Use Help if you need a hint."}</p></main>
  </dialog>, document.body);
}

function SpeakingRosterCard({
  roster,
  loading,
  error,
  search,
  filter,
  onSearch,
  onFilter,
}: {
  roster?: SpeakingRosterResponse;
  loading: boolean;
  error: string;
  search: string;
  filter: SpeakingRosterStatus | "all";
  onSearch: (value: string) => void;
  onFilter: (value: SpeakingRosterStatus | "all") => void;
}) {
  const query = search.trim().toLocaleLowerCase();
  const items = (roster?.items ?? []).filter((item) => {
    const display = item.participant.displayIdentifier ?? `Student ${item.participant.id.slice(0, 6)}`;
    return (filter === "all" || item.status === filter) &&
      (!query || display.toLocaleLowerCase().includes(query));
  }).sort((a, b) => Number(b.status === "error") - Number(a.status === "error") || (a.participant.displayIdentifier ?? a.participant.id).localeCompare(b.participant.displayIdentifier ?? b.participant.id, undefined, { numeric: true }));
  return (
    <section className="speaking-roster-card" aria-labelledby="speaking-roster-title">
      <div className="speaking-roster-heading">
        <div>
          <span className="speaking-card-kicker">Live classroom</span>
          <h2 id="speaking-roster-title">Class monitor</h2>
          <p>{roster ? `${roster.items.length} students joined · Private teacher view` : "The roster will update as students join."}</p>
        </div>
        <span className={`speaking-status-pill speaking-status-${roster?.session.status ?? "ready"}`}>
          {roster?.session.status ?? "loading"}
        </span>
      </div>
      <div className="speaking-roster-counts" aria-label="Roster counts">
        {rosterStatusOrder.map((status) => (
          <button type="button" className={`speaking-roster-count status-${status}`} key={status} aria-pressed={filter === status} onClick={() => onFilter(filter === status ? "all" : status)}>
            <strong>{roster?.counts[status] ?? 0}</strong>
            <span>{ROSTER_STATUS_LABELS[status]}</span>
          </button>
        ))}
      </div>
      <div className="speaking-roster-toolbar">
        <label>
          <span className="sr-only">Search classroom roster</span>
          <input
            aria-label="Search classroom roster"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search students"
          />
        </label>
        <label>
          <span className="sr-only">Filter classroom roster</span>
          <select
            aria-label="Filter classroom roster"
            value={filter}
            onChange={(event) => onFilter(event.target.value as SpeakingRosterStatus | "all")}
          >
            <option value="all">All statuses</option>
            {rosterStatusOrder.map((status) => <option key={status} value={status}>{ROSTER_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <span className="speaking-roster-refreshing" role="status">{loading ? "Updating…" : error ? "Updates interrupted" : "Refreshes every 5 seconds"}</span>
      </div>
      {error && <p className="speaking-error" role="alert">{error} {roster ? "Showing the last received roster; updates will retry automatically." : "Retrying automatically."}</p>}
      {!roster && error ? null : !roster && loading ? (
        <p className="speaking-roster-empty">Loading live roster…</p>
      ) : items.length ? (
        <div className="speaking-roster-list" role="list">
          {items.map((item) => {
            const display = item.participant.displayIdentifier ?? `Student ${item.participant.id.slice(0, 6)}`;
            return (
              <div className="speaking-roster-row" role="listitem" key={item.participant.id}>
                <RosterIcon status={item.status} />
                <strong>{display}</strong>
                <span className={`speaking-roster-status status-${item.status}`}>{ROSTER_STATUS_LABELS[item.status]}</span>
                <time dateTime={item.latestActivityAt}>{formatRosterActivity(item.latestActivityAt)}</time>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="speaking-roster-empty">{roster?.items.length ? "No students match this view. Clear the search or select All statuses." : "Waiting for your class. Share the QR or code to invite students."}</p>
      )}
    </section>
  );
}

function SpeakingResultsPage({
  navigate,
  activityId,
}: {
  navigate: Navigate;
  activityId: string;
}) {
  const [activity, setActivity] = useState<SpeakingActivity>();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [sessionId, setSessionId] = useState(
    () => new URLSearchParams(window.location.search).get("sessionId") ?? "",
  );
  const [payload, setPayload] = useState<SessionResultsResponse>();
  const [error, setError] = useState("");
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsSearch, setResultsSearch] = useState("");
  const [resultsFilter, setResultsFilter] = useState<SpeakingParticipant["status"] | "retrying" | "all" | "review">("all");
  const [sort, setSort] = useState("name");
  const [refreshNonce, setRefreshNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    setPayload(undefined);
    void Promise.all([
      speakingApi.activity(activityId),
      speakingApi.sessions(activityId),
    ])
      .then(([activityPayload, sessionsPayload]) => {
        if (cancelled) return;
        const nextActivity = (activityPayload as { activity: SpeakingActivity })
          .activity;
        const nextSessions = (
          sessionsPayload as { sessions: SpeakingSession[] }
        ).sessions;
        setActivity(nextActivity);
        setSessions(nextSessions);
        setSessionId((current) =>
          nextSessions.some((session) => session.id === current)
            ? current
            : nextSessions[0]?.id || "",
        );
      })
      .catch((loadError) => {
        if (!cancelled)
          setError(getErrorMessage(loadError, "Results could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);
  const loadResults = useCallback(async (id: string, signal: AbortSignal) => {
    try {
      const next = await speakingApi.sessionResults(id, signal);
      if (signal.aborted) return;
      setPayload(next as SessionResultsResponse);
      setError("");
    } catch (loadError) {
      if (!signal.aborted)
        setError(getErrorMessage(loadError, "Results could not be loaded."));
    } finally {
      if (!signal.aborted) setLoadingResults(false);
    }
  }, []);
  useEffect(() => {
    if (!sessionId) {
      setPayload(undefined);
      setLoadingResults(false);
      return;
    }
    const controller = new AbortController();
    let inFlight = false;
    setError("");
    setPayload(undefined);
    setLoadingResults(true);
    const poll = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        await loadResults(sessionId, controller.signal);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timerId = window.setInterval(() => void poll(), 5_000);
    return () => {
      controller.abort();
      window.clearInterval(timerId);
    };
  }, [loadResults, refreshNonce, sessionId]);
  const resultQuery = resultsSearch.trim().toLocaleLowerCase();
  const filteredResults = (payload?.items ?? []).filter((item) => {
    const display = item.participant.displayIdentifier ?? "Anonymous student";
    return (resultsFilter === "all" || (resultsFilter === "review" ? item.status === "error" || item.evaluationStatus === "failed" || item.evaluation?.assessmentStatus === "insufficient_evidence" : resultsFilter === "retrying" ? item.evaluationStatus === "retrying" : item.status === resultsFilter)) &&
      (!resultQuery || display.toLocaleLowerCase().includes(resultQuery));
  });
  filteredResults.sort((a, b) => sort === "score" ? (a.overallScore ?? -1) - (b.overallScore ?? -1) : sort === "help" ? b.helpCount - a.helpCount : (a.participant.displayIdentifier ?? a.participant.id).localeCompare(b.participant.displayIdentifier ?? b.participant.id, undefined, { numeric: true }));
  const completed = payload?.items.filter((item) => item.status === "completed").length ?? 0;
  const needsReview = payload?.items.filter((item) => item.status === "error" || item.evaluationStatus === "failed" || item.evaluation?.assessmentStatus === "insufficient_evidence").length ?? 0;
  const criteria = payload?.activity.rubric.filter((criterion) => criterion.enabled) ?? [];
  if (error && !activity)
    return <MissingSpeakingSession navigate={navigate} message={error} />;
  if (!activity || (sessionId && loadingResults)) return <TeacherLoading />;
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <section className="speaking-teacher-content">
          <button
            type="button"
            className="speaking-text-button"
            onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {activity.title}
          </button>
          <div className="speaking-teacher-heading speaking-results-heading">
            <div>
              <span className="speaking-eyebrow">
                <Trophy size={15} aria-hidden="true" /> Learning results
              </span>
              <h1>Class results</h1>
              <p>{activity.title} · Review completion, rubric scores and conversation evidence.</p>
            </div>
            {sessions.length > 0 && (
              <select
                aria-label="Select classroom session"
                value={sessionId}
                onChange={(event) => {
                  setPayload(undefined);
                  setError("");
                  setSessionId(event.target.value);
                  window.history.replaceState(
                    null,
                    "",
                    `${buildTeacherSpeakingPath(`/speak/teacher/activity/${activity.id}/results`)}?sessionId=${encodeURIComponent(event.target.value)}`,
                  );
                }}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {new Date(session.createdAt).toLocaleString()} ·{" "}
                    {session.joinCode}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && (
            <p className="speaking-error" role="alert">
              {error}
            </p>
          )}
          {payload && <div className="speaking-class-summary" aria-label="Class result summary"><span><strong>{completed} / {payload.items.length}</strong> completed</span><span><strong>{payload.items.length - completed}</strong> not completed</span><span><strong>{needsReview}</strong> need review</span></div>}
          {payload && sessions.length > 0 && (
            <div className="speaking-results-toolbar">
              <label>
                <span className="sr-only">Search learning results</span>
                <input
                  aria-label="Search learning results"
                  value={resultsSearch}
                  onChange={(event) => setResultsSearch(event.target.value)}
                  placeholder="Search students"
                />
              </label>
              <label>
                <span className="sr-only">Filter learning results</span>
                <select
                  aria-label="Filter learning results"
                  value={resultsFilter}
                  onChange={(event) => setResultsFilter(event.target.value as SpeakingParticipant["status"] | "retrying" | "all" | "review")}
                >
                  <option value="all">All statuses</option>
                  <option value="review">Needs review / unscored</option>
                  <option value="joined">Joined</option>
                  <option value="in_progress">Practicing</option>
                  <option value="evaluating">Evaluating</option>
                  <option value="retrying">Evaluation retrying</option>
                  <option value="completed">Completed</option>
                  <option value="error">Needs attention</option>
                </select>
              </label>
              <label><span className="sr-only">Sort class results</span><select aria-label="Sort class results" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Student order</option><option value="score">Score: low to high</option><option value="help">Help: most used</option></select></label>
              <button type="button" className="speaking-outline-button" onClick={() => setRefreshNonce((current) => current + 1)}>
                Refresh
              </button>
            </div>
          )}
          {sessions.length === 0 ? (
            <div className="speaking-empty-card">
              <Trophy size={32} aria-hidden="true" />
              <h2>No classroom sessions yet</h2>
              <p>Launch this activity before opening its learning results.</p>
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() =>
                  navigate(`/speak/teacher/activity/${activity.id}`)
                }
              >
                Open activity
              </button>
            </div>
          ) : error && !payload ? (
            <div className="speaking-empty-card">
              <Trophy size={32} aria-hidden="true" />
              <h2>Results unavailable</h2>
              <p>Please return to the activity and try opening the results again.</p>
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() =>
                  navigate(`/speak/teacher/activity/${activity.id}`)
                }
              >
                Open activity
              </button>
            </div>
          ) : payload?.items.length ? filteredResults.length ? (
            <div className="speaking-results-table" role="region" aria-label="Class results table" tabIndex={0}>
              <table><caption>Rubric scores from 0 to 4 · AI evaluation for teacher review</caption><thead><tr>
                <th scope="col">Student</th><th scope="col">Status</th><th scope="col">Overall</th>
                {criteria.map((criterion) => <th scope="col" key={criterion.id} title={criterion.description}>{criterion.name}</th>)}
                <th scope="col">Elapsed</th><th scope="col">Help</th>
              </tr></thead><tbody>
              {filteredResults.map((item) => <tr className="speaking-results-table-row" key={item.participant.id}>
                <th scope="row"><button type="button" className="speaking-result-student-link" onClick={() => navigate(`/speak/teacher/result/${item.participant.id}`)}>{item.participant.displayIdentifier ?? `Student ${item.participant.id.slice(0, 6)}`}<ChevronRight size={16} aria-hidden="true" /></button></th>
                <td><span className={`speaking-status-pill speaking-status-${item.evaluationStatus === "retrying" ? "retrying" : item.status}`}>{item.evaluation?.assessmentStatus === "insufficient_evidence" ? "Not scored" : item.evaluationStatus === "retrying" ? "Evaluation retrying" : item.evaluationStatus === "failed" ? "Needs attention" : item.status === "completed" ? "Completed" : item.status === "error" ? "Needs attention" : item.status === "joined" ? "Not started" : item.status === "evaluating" ? "Evaluating" : "Practicing"}</span></td>
                <td className="speaking-table-score">{item.overallScore === undefined ? "—" : <>{item.overallScore}<small>/100</small></>}</td>
                {criteria.map((criterion) => <td key={criterion.id}>{item.evaluation?.scores[criterion.id] ?? "—"}</td>)}
                <td>{formatDuration(item.durationSeconds)}</td><td>{item.helpCount}</td>
              </tr>)}
              </tbody></table>
            </div>
          ) : (
            <div className="speaking-empty-card">
              <Users size={32} aria-hidden="true" />
              <h2>No students match this view</h2>
              <p>Try clearing the search or choosing another status.</p>
            </div>
          ) : (
            <div className="speaking-empty-card">
              <Users size={32} aria-hidden="true" />
              <h2>No students yet</h2>
              <p>
                Share {payload?.session.joinCode} to invite the first practice
                session.
              </p>
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() =>
                  navigate(`/speak/teacher/activity/${activity.id}`)
                }
              >
                Show session code
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SpeakingTeacherResultPage({
  navigate,
  participantId,
}: {
  navigate: Navigate;
  participantId: string;
}) {
  const [result, setResult] = useState<ResultResponse["result"]>();
  const [evaluationStatus, setEvaluationStatus] = useState<ResultResponse["evaluationStatus"]>();
  const [evaluationRetryable, setEvaluationRetryable] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    setResult(undefined);
    setEvaluationStatus(undefined);
    setEvaluationRetryable(false);
    setError("");
    const poll = async () => {
      try {
        const payload = await speakingApi.result(participantId, undefined, controller.signal);
        if (cancelled) return;
        const next = payload as ResultResponse;
        setResult(next.result);
        setEvaluationStatus(next.evaluationStatus);
        setEvaluationRetryable(next.evaluationRetryable === true);
        setError("");
        if (!next.result.evaluation && next.evaluationStatus !== "failed" && next.result.participant.status !== "error") timer = setTimeout(() => { void poll(); }, 3_000);
      } catch (loadError) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "This student result could not be loaded."));
        if (!(loadError instanceof ApiError && [401, 403, 404].includes(loadError.status))) timer = setTimeout(() => { void poll(); }, 3_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [participantId]);
  if (!result && !error) return <TeacherLoading />;
  if (!result)
    return <MissingSpeakingSession navigate={navigate} message={error} />;
  const evaluation = result.evaluation;
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <section className="speaking-teacher-content">
          <button
            type="button"
            className="speaking-text-button"
            onClick={() =>
              navigate(
                `/speak/teacher/activity/${result.activity.id}/results?sessionId=${encodeURIComponent(result.session.id)}`,
              )
            }
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to results
          </button>
          <div className="speaking-teacher-heading speaking-detail-heading">
            <div>
              <span className="speaking-eyebrow">
                <UserRound size={15} aria-hidden="true" /> Student detail
              </span>
              <h1>
                {result.participant.displayIdentifier ?? "Anonymous student"}
              </h1>
              <p>
                {result.activity.title} ·{" "}
                {
                  result.turns.filter((turn) => turn.speaker === "student")
                    .length
                }{" "}
                speaking turns · {result.participant.helpCount} Help uses
              </p>
            </div>
            <span className="speaking-detail-score">
              <strong>
                {evaluation ? (scoreFor(evaluation) ?? "—") : "—"}
              </strong>
              {evaluation && scoreFor(evaluation) !== undefined && (
                <small>/100</small>
              )}
            </span>
          </div>
          {evaluation ? (
            <ResultPanel
              activity={result.activity}
              turns={result.turns}
              evaluation={evaluation}
              teacherView
            />
          ) : (
            <div className="speaking-empty-card">
              <h2>{evaluationStatus === "retrying" || evaluationStatus === "queued" || evaluationStatus === "running" ? "Evaluation in progress" : "Evaluation needs attention"}</h2>
              <p>
                {evaluationStatus === "retrying" || evaluationStatus === "queued" || evaluationStatus === "running"
                  ? "The transcript is safely saved. The evaluation service is still preparing feedback."
                  : evaluationRetryable
                    ? "The transcript remains available. A retry can use the saved turns without asking the student to retake the test."
                    : "The participant’s transcript remains available. Evaluation needs technical attention; the student does not need to retake the test."}
              </p>
              <div className="speaking-transcript-detail">
                {result.turns.map((turn) => (
                  <p key={turn.id}>
                    <strong>{turn.speaker === "ai" ? "AI" : "Student"}</strong>
                    <span>{turn.text}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
