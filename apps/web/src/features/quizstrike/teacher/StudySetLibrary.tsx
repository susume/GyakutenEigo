import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Copy, Edit3, Globe2, LockKeyhole, MoreHorizontal, Play, Search, Sparkles, Trash2, UsersRound } from "lucide-react";
import type { QuizSet, RecognitionSummary, StudySetSummary } from "@quizstrike/shared";
import { ApiError, teacherApi } from "../../../api/client";

type DashboardData = { quizSets: QuizSet[]; recognition?: RecognitionSummary };

type StudySetLibraryProps = {
  data: DashboardData;
  onRefresh: () => Promise<void>;
  onEditQuiz: (quizSetId?: string) => void;
  onPlayLive: (quizSetId: string) => void | Promise<void>;
  onOpenStudySet: (quizSetId: string) => void;
  scope?: "mine" | "public";
};

const visibilityLabel = (visibility: QuizSet["visibility"]) => visibility === "PUBLIC" ? "Public" : "Private";

function RecognitionPanel({ recognition }: { recognition?: RecognitionSummary }) {
  if (!recognition) return null;
  const remaining = recognition.nextLevelPoints ? Math.max(0, recognition.nextLevelPoints - recognition.points) : 0;
  return <section className="study-set-recognition" aria-labelledby="study-set-recognition-title"><div className="study-set-recognition-copy"><span className="teacher-eyebrow">Your contribution</span><h3 id="study-set-recognition-title">{recognition.level}</h3><p>{remaining ? `${remaining} points until ${recognition.nextLevel}.` : "Highest recognition level reached."}</p></div><div className="study-set-recognition-stats"><strong>{recognition.points}</strong><span>points</span><strong>{recognition.teachersUsingSets}</strong><span>teachers using your sets</span></div><div className="study-set-recognition-meta"><span>{recognition.studySetsCreated} Study Sets</span><span>{recognition.gamesHosted} games hosted</span><span>{recognition.badges.length} achievements</span></div></section>;
}

function MyStudySets({ data, onRefresh, onEditQuiz, onPlayLive, onOpenStudySet }: StudySetLibraryProps) {
  const [filter, setFilter] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const items = useMemo(() => data.quizSets.filter((quiz) => filter === "ALL" || (quiz.visibility ?? "PRIVATE") === filter), [data.quizSets, filter]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try { await action(); await onRefresh(); } catch (error) { window.alert(error instanceof ApiError || error instanceof Error ? error.message : "Study Set action failed."); } finally { setBusyId(null); }
  };

  return <div className="study-set-library-column">
    <div className="study-set-filter-row" role="tablist" aria-label="Your Study Set filters">{(["ALL", "PUBLIC", "PRIVATE"] as const).map((value) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? "All" : value === "PUBLIC" ? "Public" : "Private"}<span>{value === "ALL" ? data.quizSets.length : data.quizSets.filter((quiz) => (quiz.visibility ?? "PRIVATE") === value).length}</span></button>)}</div>
    {items.length === 0 ? <div className="study-set-empty"><BookOpen size={28} aria-hidden="true" /><h3>{filter === "ALL" ? "Your library is ready for its first set" : `No ${filter.toLocaleLowerCase()} Study Sets yet`}</h3><p>{filter === "ALL" ? "Create your own, or browse Discover to host a set shared by another teacher." : "Change the filter or update one of your existing sets."}</p><div className="button-row"><button className="primary" onClick={() => onEditQuiz()}><BookOpen size={16} />Create Study Set</button></div></div> : <div className="study-set-card-grid">{items.map((quiz) => {
      const visibility = quiz.visibility ?? "PRIVATE";
      return <article className="study-set-card" key={quiz.id}><button className="study-set-card-open" onClick={() => onOpenStudySet(quiz.id)}><div className="study-set-card-top"><span className={`study-set-visibility ${visibility.toLowerCase()}`}>{visibility === "PUBLIC" ? <Globe2 size={14} /> : <LockKeyhole size={14} />}{visibilityLabel(visibility)}</span><span>{quiz.questions.length} questions</span></div><h3>{quiz.title}</h3><p>{quiz.description || "A reusable Study Set for your next class game."}</p><div className="study-set-card-meta"><span>Updated {new Date(quiz.updatedAt ?? quiz.createdAt).toLocaleDateString()}</span><span>{quiz.usageCount ?? 0} uses</span></div></button><div className="study-set-card-actions"><button className="primary small-button" onClick={() => onPlayLive(quiz.id)} disabled={quiz.questions.length === 0}><Play size={14} />Host</button><button className="secondary-button small-button" onClick={() => onOpenStudySet(quiz.id)}>Open</button><details className="study-set-overflow"><summary aria-label={`Manage ${quiz.title}`}><MoreHorizontal size={18} aria-hidden="true" /></summary><div className="study-set-overflow-menu"><button onClick={() => onEditQuiz(quiz.id)}><Edit3 size={14} />Edit</button><button onClick={() => void run(quiz.id, () => teacherApi.updateStudySet(quiz.id, { visibility: visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" }))} disabled={busyId === quiz.id}>{visibility === "PUBLIC" ? <LockKeyhole size={14} /> : <Globe2 size={14} />}{visibility === "PUBLIC" ? "Make private" : "Publish"}</button><button onClick={() => void run(quiz.id, () => teacherApi.duplicateStudySet(quiz.id))} disabled={busyId === quiz.id}><Copy size={14} />Duplicate</button><button className="danger-text" onClick={() => { if (window.confirm(`Delete “${quiz.title}”? This cannot be undone.`)) void run(quiz.id, () => teacherApi.deleteQuizSet(quiz.id)); }} disabled={busyId === quiz.id}><Trash2 size={14} />Delete</button></div></details></div></article>;
    })}</div>}
  </div>;
}

function PublicStudySets({ onRefresh, onPlayLive, onOpenStudySet }: Pick<StudySetLibraryProps, "onRefresh" | "onPlayLive" | "onOpenStudySet">) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [sort, setSort] = useState<"relevant" | "used" | "newest">("relevant");
  const [items, setItems] = useState<StudySetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async (nextPage = 1) => {
    const requestId = ++requestSequence.current;
    setLoading(true); setError("");
    try {
      const result = await teacherApi.studySets({ scope: "public", query, subject, gradeLevel, sort, page: String(nextPage), pageSize: "12" });
      if (requestId !== requestSequence.current) return;
      setItems(result.items); setTotal(result.total); setPage(result.page);
    } catch (err) {
      if (requestId === requestSequence.current) setError(err instanceof ApiError || err instanceof Error ? err.message : "Discover could not be loaded.");
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [gradeLevel, query, sort, subject]);

  useEffect(() => { void load(1); }, [load]);
  const duplicate = async (id: string) => { try { await teacherApi.duplicateStudySet(id); await onRefresh(); window.alert("A private copy was added to your Library."); } catch (err) { setError(err instanceof ApiError || err instanceof Error ? err.message : "Study Set could not be copied."); } };

  return <div className="study-set-library-column">
    <form className="study-set-search-bar discover-search" onSubmit={(event) => { event.preventDefault(); void load(1); }}><Search size={21} aria-hidden="true" /><input aria-label="Search public Study Sets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Study Sets, subjects, or teachers" /><button className="primary small-button" type="submit">Search</button></form>
    <div className="discover-filter-chips" aria-label="Discover filters"><button className={!subject ? "active" : ""} onClick={() => { setSubject(""); void load(1); }}>All</button><button className={subject.toLowerCase() === "english" ? "active" : ""} onClick={() => { setSubject("English"); void load(1); }}>English</button><button className={subject.toLowerCase() === "math" ? "active" : ""} onClick={() => { setSubject("Math"); void load(1); }}>Math</button><button className={subject.toLowerCase() === "science" ? "active" : ""} onClick={() => { setSubject("Science"); void load(1); }}>Science</button><label>Level<input value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} placeholder="e.g. Eiken Pre-2" /></label><select aria-label="Sort public Study Sets" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="relevant">Most relevant</option><option value="used">Popular</option><option value="newest">Recently added</option></select></div>
    {error && <p className="study-set-error" role="alert">{error}</p>}
    {loading ? <div className="study-set-empty"><Sparkles size={24} />Loading Discover…</div> : items.length === 0 ? <div className="study-set-empty"><Search size={28} /><h3>No public Study Sets found</h3><p>Try a broader search, or create the first set for your community.</p><button className="secondary-button" onClick={() => { setQuery(""); setSubject(""); setGradeLevel(""); }}>Clear filters</button></div> : <div className="study-set-card-grid">{items.map((item) => <article className="study-set-card" key={item.id}><button className="study-set-card-open" onClick={() => onOpenStudySet(item.id)}><div className="study-set-card-top"><span className="study-set-visibility public"><Globe2 size={14} />Public</span><span>{item.questionCount} questions</span></div><h3>{item.title}</h3><p>{item.description || "A Study Set shared by a QuizStrike teacher."}</p><div className="study-set-card-meta"><span>By <strong>{item.creator.name}</strong></span><span><UsersRound size={13} />{item.uniqueTeacherUsageCount} teachers</span></div></button><div className="study-set-card-actions"><button className="primary small-button" onClick={() => onPlayLive(item.id)}><Play size={14} />Host</button><button className="secondary-button small-button" onClick={() => onOpenStudySet(item.id)}>Open</button><button className="text-button small-button" onClick={() => void duplicate(item.id)}><Copy size={14} />Make a Copy</button></div></article>)}</div>}
    {total > 12 && <div className="study-set-pagination"><button className="secondary-button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 12)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 12) || loading} onClick={() => void load(page + 1)}>Next</button></div>}
  </div>;
}

export default function StudySetLibrary(props: StudySetLibraryProps) {
  const scope = props.scope ?? "mine";
  return <section className="study-set-library-page"><div className="study-set-library-heading"><div><span className="teacher-eyebrow">{scope === "public" ? "Community content" : "Your content"}</span><h2>{scope === "public" ? "Discover Study Sets" : "Your Library"}</h2><p>{scope === "public" ? "Find a ready-to-host set shared by another teacher." : "Create once, then host the right set whenever your class is ready."}</p></div>{scope === "mine" && <button className="primary" onClick={() => props.onEditQuiz()}><BookOpen size={16} />Create Study Set</button>}</div>{scope === "mine" && <RecognitionPanel recognition={props.data.recognition} />}{scope === "mine" ? <MyStudySets {...props} /> : <PublicStudySets onRefresh={props.onRefresh} onPlayLive={props.onPlayLive} onOpenStudySet={props.onOpenStudySet} />}</section>;
}
