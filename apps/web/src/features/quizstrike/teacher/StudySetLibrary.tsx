import { useSiteTranslation } from "../../../ui/siteTranslation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Copy, Edit3, Globe2, LockKeyhole, MoreHorizontal, Play, RefreshCw, Search, Sparkles, Trash2, UsersRound } from "lucide-react";
import type { QuizSet, RecognitionSummary, StudySetSummary } from "@quizstrike/shared";
import { ApiError, teacherApi } from "../../../api/client";

type DashboardData = { quizSets: QuizSet[]; recognition?: RecognitionSummary };
type StudySetLibraryProps = {
  data: DashboardData;
  dashboardLoading?: boolean;
  dashboardError?: string;
  onRefresh: () => Promise<void>;
  onEditQuiz: (quizSetId?: string) => void;
  onPlayLive: (quizSetId: string) => void | Promise<void>;
  onOpenStudySet: (quizSetId: string) => void;
  scope?: "mine" | "public";
};

const visibilityLabel = (visibility: QuizSet["visibility"]) => visibility === "PUBLIC" ? "Public" : "Private";

function LoadFailure({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useSiteTranslation();
  return <div className="study-set-empty study-set-load-error" role="alert"><RefreshCw size={27} aria-hidden="true" /><h3>{t(title)}</h3><p>{t("Your Study Sets are safe. Check your connection, then try again.")}</p><button className="secondary-button" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" />{t("Retry")}</button></div>;
}

function RecognitionPanel({ recognition }: { recognition?: RecognitionSummary }) {
  const { t } = useSiteTranslation();
  if (!recognition) return null;
  const remaining = recognition.nextLevelPoints ? Math.max(0, recognition.nextLevelPoints - recognition.points) : 0;
  return <section className="study-set-recognition" aria-labelledby="study-set-recognition-title"><div className="study-set-recognition-copy"><span className="teacher-eyebrow">{t("Your contribution")}</span><h3 id="study-set-recognition-title">{recognition.level}</h3><p>{remaining ? t("{value0} points until {value1}.", { value0: remaining, value1: recognition.nextLevel }) : t("Highest recognition level reached.")}</p></div><div className="study-set-recognition-stats"><strong>{recognition.points}</strong><span>{t("points")}</span><strong>{recognition.teachersUsingSets}</strong><span>{t("teachers using your sets")}</span></div><div className="study-set-recognition-meta"><span>{recognition.studySetsCreated}{" "}{t("Study Sets")}</span><span>{recognition.gamesHosted}{" "}{t("games hosted")}</span><span>{recognition.badges.length}{" "}{t("achievements")}</span></div></section>;
}

function MyStudySets({ data, dashboardLoading, dashboardError, onRefresh, onEditQuiz, onPlayLive, onOpenStudySet }: StudySetLibraryProps) {
  const { t, locale } = useSiteTranslation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const items = useMemo(() => data.quizSets.filter((quiz) => (filter === "ALL" || (quiz.visibility ?? "PRIVATE") === filter) && [quiz.title, quiz.description, quiz.subject, quiz.gradeLevel].filter(Boolean).join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((left, right) => (right.updatedAt ?? right.createdAt).localeCompare(left.updatedAt ?? left.createdAt)), [data.quizSets, filter, query]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(id);
    setActionError("");
    try { await action(); await onRefresh(); }
    catch (error) {
      if (import.meta.env.DEV) console.error("Study Set library action failed.", error);
      setActionError(error instanceof Error ? error.message : "We couldn't update that Study Set. Try again.");
    } finally { setBusyId(null); }
  };

  if (dashboardLoading) return <div className="study-set-empty" role="status"><Sparkles size={24} aria-hidden="true" /><h3>{t("Loading your Study Sets…")}</h3></div>;
  if (dashboardError) return <LoadFailure title={t("We couldn't load your Study Sets.")} onRetry={() => void onRefresh()} />;

  return <div className="study-set-library-column">
    <div className="study-set-search-bar"><Search size={21} aria-hidden="true" /><input aria-label={t("Search your Study Sets")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search your Study Sets")} />{query && <button type="button" onClick={() => setQuery("")}>{t("Clear")}</button>}</div>
    <p className="library-result-count" role="status">{items.length}{" "}{t("of")}{" "}{data.quizSets.length}{" "}{t("Study Sets")}</p>
    <div className="study-set-filter-row" role="tablist" aria-label={t("Your Study Set filters")}>{(["ALL", "PUBLIC", "PRIVATE"] as const).map((value) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? t("All") : value === "PUBLIC" ? t("Public") : t("Private")}<span>{value === "ALL" ? data.quizSets.length : data.quizSets.filter((quiz) => (quiz.visibility ?? "PRIVATE") === value).length}</span></button>)}</div>
    {actionError && <div className="study-set-action-error" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError("")}>{t("Dismiss")}</button></div>}
    {items.length === 0 ? <div className="study-set-empty"><BookOpen size={28} aria-hidden="true" /><h3>{query.trim() ? t("No Study Sets match your search") : filter === "ALL" ? t("Your library is ready for its first Study Set") : t("No {value0} Study Sets yet", { value0: filter.toLocaleLowerCase() })}</h3><p>{query.trim() ? t("Try another word or clear your search.") : filter === "ALL" ? t("Create your own, or browse Discover to host a set shared by another teacher.") : t("Change the filter or update one of your existing sets.")}</p><div className="button-row">{query.trim() && <button className="secondary-button" onClick={() => setQuery("")}>{t("Clear search")}</button>}<button className="primary" onClick={() => onEditQuiz()}><BookOpen size={16} />{t("Create Study Set")}</button></div></div> : <div className="study-set-card-grid">{items.map((quiz) => {
      const visibility = quiz.visibility ?? "PRIVATE";
      return <article className="study-set-card" key={quiz.id}><button className="study-set-card-open" onClick={() => onOpenStudySet(quiz.id)}><div className="study-set-card-top"><span className={`study-set-visibility ${visibility.toLowerCase()}`}>{visibility === "PUBLIC" ? <Globe2 size={14} /> : <LockKeyhole size={14} />}{t(visibilityLabel(visibility))}</span><span>{quiz.questions.length}{" "}{t("questions")}</span></div><h3>{quiz.title}</h3><p>{quiz.description || t("A reusable Study Set for your next class game.")}</p><div className="study-set-card-meta"><span>{[quiz.subject, quiz.gradeLevel].filter(Boolean).join(" · ") || t("General")}</span><span>{t("Updated")}{" "}{new Date(quiz.updatedAt ?? quiz.createdAt).toLocaleDateString(locale)}</span></div></button><div className="study-set-card-actions"><button className="primary small-button" onClick={() => onPlayLive(quiz.id)} disabled={quiz.questions.length === 0} title={quiz.questions.length === 0 ? t("Add a question before hosting") : undefined}><Play size={14} />{t("Host")}</button><button className="secondary-button small-button" onClick={() => onOpenStudySet(quiz.id)}>{t("Open")}</button><details className="study-set-overflow"><summary aria-label={t("Manage {value0}", { value0: quiz.title })}><MoreHorizontal size={18} aria-hidden="true" /></summary><div className="study-set-overflow-menu"><button onClick={() => onEditQuiz(quiz.id)}><Edit3 size={14} />{t("Edit")}</button><button onClick={() => void run(quiz.id, () => teacherApi.updateStudySet(quiz.id, { visibility: visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" }))} disabled={busyId === quiz.id}>{visibility === "PUBLIC" ? <LockKeyhole size={14} /> : <Globe2 size={14} />}{visibility === "PUBLIC" ? t("Make private") : t("Publish")}</button><button onClick={() => void run(quiz.id, () => teacherApi.duplicateStudySet(quiz.id))} disabled={busyId === quiz.id}><Copy size={14} />{t("Duplicate")}</button><button className="danger-text" onClick={() => { if (window.confirm(`Delete “${quiz.title}”? This cannot be undone.`)) void run(quiz.id, () => teacherApi.deleteQuizSet(quiz.id)); }} disabled={busyId === quiz.id}><Trash2 size={14} />{t("Delete")}</button></div></details></div></article>;
    })}</div>}
  </div>;
}

function PublicStudySets({ onRefresh, onPlayLive, onOpenStudySet }: Pick<StudySetLibraryProps, "onRefresh" | "onPlayLive" | "onOpenStudySet">) {
  const { t } = useSiteTranslation();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [appliedGradeLevel, setAppliedGradeLevel] = useState("");
  const [sort, setSort] = useState<"relevant" | "used" | "newest">("relevant");
  const [items, setItems] = useState<StudySetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async (nextPage = 1) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(false);
    try {
      const result = await teacherApi.studySets({ scope: "public", query: appliedQuery, subject, gradeLevel: appliedGradeLevel, sort, page: String(nextPage), pageSize: "12" });
      if (requestId !== requestSequence.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (loadError) {
      if (import.meta.env.DEV) console.error("Discover Study Sets could not be loaded.", loadError);
      if (requestId === requestSequence.current) {
        setItems([]);
        setTotal(0);
        setError(true);
      }
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [appliedGradeLevel, appliedQuery, sort, subject]);

  useEffect(() => { void load(1); }, [load]);

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedQuery(query.trim());
    setAppliedGradeLevel(gradeLevel.trim());
  };
  const clearFilters = () => {
    setQuery("");
    setAppliedQuery("");
    setSubject("");
    setGradeLevel("");
    setAppliedGradeLevel("");
  };
  const duplicate = async (id: string) => {
    if (copyingId) return;
    setCopyingId(id);
    setActionError("");
    setCopyMessage("");
    try { await teacherApi.duplicateStudySet(id); setCopyMessage("A private copy was added to your Library."); await onRefresh(); }
    catch (duplicateError) {
      if (import.meta.env.DEV) console.error("Study Set copy failed.", duplicateError);
      setActionError(duplicateError instanceof ApiError ? duplicateError.message : "We couldn't copy this Study Set. Try again.");
    } finally { setCopyingId(null); }
  };

  return <div className="study-set-library-column">
    <form className="study-set-search-bar discover-search" onSubmit={applySearch}><Search size={21} aria-hidden="true" /><input aria-label={t("Search public Study Sets")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search Study Sets, subjects, or teachers")} /><button className="primary small-button" type="submit">{t("Search")}</button></form>
    <div className="discover-filter-chips" aria-label={t("Discover filters")}><button className={!subject ? "active" : ""} onClick={() => setSubject("")}>{t("All")}</button><button className={subject === "English" ? "active" : ""} onClick={() => setSubject("English")}>{t("English")}</button><button className={subject === "Math" ? "active" : ""} onClick={() => setSubject("Math")}>{t("Math")}</button><button className={subject === "Science" ? "active" : ""} onClick={() => setSubject("Science")}>{t("Science")}</button><label>{t("Level")}<input value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} placeholder={t("e.g. Eiken Pre-2")} /></label><select aria-label={t("Sort public Study Sets")} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="relevant">{t("Most relevant")}</option><option value="used">{t("Most used")}</option><option value="newest">{t("Recently added")}</option></select></div>
    {actionError && <div className="study-set-action-error" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError("")}>{t("Dismiss")}</button></div>}
    {copyMessage && <p className="library-copy-success" role="status">{t(copyMessage)}<button type="button" onClick={() => setCopyMessage("")}>{t("Dismiss")}</button></p>}
    {loading ? <div className="study-set-empty" role="status"><Sparkles size={24} aria-hidden="true" /><h3>{t("Loading public Study Sets…")}</h3></div>
      : error ? <LoadFailure title={t("We couldn't load public Study Sets.")} onRetry={() => void load(page)} />
        : items.length === 0 ? <div className="study-set-empty"><Search size={28} aria-hidden="true" /><h3>{t("No public Study Sets found")}</h3><p>{t("Try a broader search or clear your filters.")}</p><button className="secondary-button" onClick={clearFilters}>{t("Clear filters")}</button></div>
          : <div className="study-set-card-grid">{items.map((item) => <article className="study-set-card" key={item.id}><button className="study-set-card-open" onClick={() => onOpenStudySet(item.id)}><div className="study-set-card-top"><span className="study-set-visibility public"><Globe2 size={14} />{t("Public")}</span><span>{item.questionCount}{" "}{t("questions")}</span></div><h3>{item.title}</h3><p>{item.description || t("A Study Set shared by a QuizStrike teacher.")}</p><div className="study-set-card-meta"><span>{t("By")}{" "}<strong>{item.creator.name}</strong></span>{(item.subject || item.gradeLevel) && <span>{[item.subject, item.gradeLevel].filter(Boolean).join(" · ")}</span>}<span><UsersRound size={13} />{t("Used by")}{" "}{item.uniqueTeacherUsageCount} {item.uniqueTeacherUsageCount === 1 ? t("teacher") : t("teachers")}</span></div></button><div className="study-set-card-actions"><button className="primary small-button" onClick={() => onPlayLive(item.id)}><Play size={14} />{t("Host")}</button><button className="secondary-button small-button" onClick={() => onOpenStudySet(item.id)}>{t("Preview")}</button><button className="text-button small-button" disabled={Boolean(copyingId)} onClick={() => void duplicate(item.id)}><Copy size={14} />{copyingId === item.id ? t("Copying…") : t("Save a copy")}</button></div></article>)}</div>}
    {!loading && !error && total > 12 && <div className="study-set-pagination"><button className="secondary-button" disabled={page <= 1} onClick={() => void load(page - 1)}>{t("Previous")}</button><span>{t("Page")}{" "}{page}{" "}{t("of")}{" "}{Math.ceil(total / 12)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 12)} onClick={() => void load(page + 1)}>{t("Next")}</button></div>}
  </div>;
}

export default function StudySetLibrary(props: StudySetLibraryProps) {
  const { t } = useSiteTranslation();
  const scope = props.scope ?? "mine";
  return <section className="study-set-library-page"><div className="study-set-library-heading"><div><span className="teacher-eyebrow">{scope === "public" ? t("Community content") : t("Your content")}</span><h2>{scope === "public" ? t("Discover Study Sets") : t("Your Library")}</h2><p>{scope === "public" ? t("Find a ready-to-host set shared by another teacher.") : t("Create once, then host the right set whenever your class is ready.")}</p></div>{scope === "mine" && <button className="primary" onClick={() => props.onEditQuiz()}><BookOpen size={16} />{t("Create Study Set")}</button>}</div>{scope === "mine" && !props.dashboardLoading && !props.dashboardError && <RecognitionPanel recognition={props.data.recognition} />}{scope === "mine" ? <MyStudySets {...props} /> : <PublicStudySets onRefresh={props.onRefresh} onPlayLive={props.onPlayLive} onOpenStudySet={props.onOpenStudySet} />}</section>;
}
