import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Copy, Edit3, Globe2, LockKeyhole, Play, Search, Sparkles, Trash2, UsersRound, X } from "lucide-react";
import type { QuizSet, RecognitionSummary, StudySetSummary } from "@quizstrike/shared";
import { ApiError, teacherApi } from "../../../api/client";

type DashboardData = { quizSets: QuizSet[]; recognition?: RecognitionSummary };

type StudySetLibraryProps = {
  data: DashboardData;
  onRefresh: () => Promise<void>;
  onEditQuiz: (quizSetId?: string) => void;
  onPlayLive: (quizSetId: string) => void | Promise<void>;
};

const visibilityLabel = (visibility: QuizSet["visibility"]) => visibility === "PUBLIC" ? "Public" : "Private";

function RecognitionPanel({ recognition }: { recognition?: RecognitionSummary }) {
  if (!recognition) return null;
  const remaining = recognition.nextLevelPoints ? Math.max(0, recognition.nextLevelPoints - recognition.points) : 0;
  return (
    <section className="study-set-recognition" aria-labelledby="study-set-recognition-title">
      <div className="study-set-recognition-copy">
        <span className="teacher-eyebrow">Your QuizStrike contribution</span>
        <h3 id="study-set-recognition-title">{recognition.level}</h3>
        <p>{remaining ? `${remaining} points until ${recognition.nextLevel}.` : "You have reached the highest recognition level."}</p>
      </div>
      <div className="study-set-recognition-stats">
        <strong>{recognition.points}</strong><span>points</span>
        <strong>{recognition.teachersUsingSets}</strong><span>teachers using your sets</span>
      </div>
      <div className="study-set-recognition-meta"><span>{recognition.studySetsCreated} Study Sets</span><span>{recognition.gamesHosted} games hosted</span><span>{recognition.badges.length} achievements</span></div>
    </section>
  );
}

function MyStudySets({ data, onRefresh, onEditQuiz, onPlayLive }: StudySetLibraryProps) {
  const [filter, setFilter] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const items = useMemo(() => data.quizSets.filter((quiz) => filter === "ALL" || (quiz.visibility ?? "PRIVATE") === filter), [data.quizSets, filter]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
      await onRefresh();
    } catch (error) {
      window.alert(error instanceof ApiError || error instanceof Error ? error.message : "Study Set action failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="study-set-library-column">
      <div className="study-set-filter-row" role="tablist" aria-label="My Study Set visibility">
        {(["ALL", "PUBLIC", "PRIVATE"] as const).map((value) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? "All" : value === "PUBLIC" ? "Public" : "Private"}</button>)}
      </div>
      {items.length === 0 ? <div className="study-set-empty"><BookOpen size={28} aria-hidden="true" /><h3>{filter === "ALL" ? "You haven't created a Study Set yet." : `You don't have any ${filter.toLocaleLowerCase()} Study Sets.`}</h3><p>{filter === "ALL" ? "Create one once, then reuse it whenever you run a QuizStrike game." : "Change the visibility filter or update one of your existing sets."}</p><button className="primary" onClick={() => onEditQuiz()}><BookOpen size={16} />Create Study Set</button></div> : (
        <div className="study-set-card-grid">
          {items.map((quiz) => {
            const visibility = quiz.visibility ?? "PRIVATE";
            return <article className="study-set-card" key={quiz.id}>
              <div className="study-set-card-top"><span className={`study-set-visibility ${visibility.toLowerCase()}`}>{visibility === "PUBLIC" ? <Globe2 size={14} /> : <LockKeyhole size={14} />}{visibilityLabel(visibility)}</span><span>{quiz.questions.length} questions</span></div>
              <h3>{quiz.title}</h3>
              <p>{quiz.description || "A reusable set of questions for your next class game."}</p>
              <div className="study-set-card-meta"><span>Updated {new Date(quiz.updatedAt ?? quiz.createdAt).toLocaleDateString()}</span><span>{quiz.usageCount ?? 0} uses</span></div>
              <div className="study-set-card-actions">
                <button className="primary small-button" onClick={() => onPlayLive(quiz.id)} disabled={quiz.questions.length === 0}><Play size={14} />Use Set</button>
                <button className="secondary-button small-button" onClick={() => onEditQuiz(quiz.id)}><Edit3 size={14} />Edit</button>
                <button className="text-button small-button" onClick={() => void run(quiz.id, () => teacherApi.updateStudySet(quiz.id, { visibility: visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" }))} disabled={busyId === quiz.id}>{visibility === "PUBLIC" ? "Make private" : "Publish"}</button>
                <button className="text-button small-button" onClick={() => void run(quiz.id, () => teacherApi.duplicateStudySet(quiz.id))} disabled={busyId === quiz.id}><Copy size={14} />Duplicate</button>
                <button className="text-button danger-text small-button" onClick={() => { if (window.confirm(`Delete “${quiz.title}”? This cannot be undone.`)) void run(quiz.id, () => teacherApi.deleteQuizSet(quiz.id)); }} disabled={busyId === quiz.id}><Trash2 size={14} />Delete</button>
              </div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
}

function PublicStudySets({ onRefresh, onPlayLive }: Pick<StudySetLibraryProps, "onRefresh" | "onPlayLive">) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [sort, setSort] = useState<"relevant" | "used" | "newest">("relevant");
  const [items, setItems] = useState<StudySetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ studySet: QuizSet; creator?: { name: string; recognitionLevel?: string }; attribution?: string } | null>(null);
  const requestSequence = useRef(0);
  const previewCloseRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (nextPage = 1) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await teacherApi.studySets({ scope: "public", query, subject, gradeLevel, sort, page: String(nextPage), pageSize: "12" });
      if (requestId !== requestSequence.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Public Study Sets could not be loaded.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [gradeLevel, query, sort, subject]);

  useEffect(() => { void load(1); }, [load]);

  useEffect(() => {
    if (!preview) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    previewCloseRef.current?.focus();
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [preview]);

  const previewSet = async (id: string) => {
    try {
      const result = await teacherApi.studySet(id) as { studySet: QuizSet; creator?: { name: string; recognitionLevel?: string }; attribution?: string };
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Study Set preview could not be loaded.");
    }
  };

  const duplicate = async (id: string) => {
    try {
      await teacherApi.duplicateStudySet(id);
      await onRefresh();
      window.alert("A private copy was added to My Sets.");
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Study Set could not be copied.");
    }
  };

  return (
    <div className="study-set-library-column">
      <form className="study-set-search-bar" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
        <Search size={18} aria-hidden="true" /><input aria-label="Search public Study Sets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, topic, or teacher" /><button className="primary small-button" type="submit">Search</button>
      </form>
      <div className="study-set-library-filters"><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. English" /></label><label>Grade / level<input value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} placeholder="e.g. Eiken Pre-2" /></label><label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="relevant">Most relevant</option><option value="used">Most used</option><option value="newest">Newest</option></select></label></div>
      {error && <p className="study-set-error" role="alert">{error}</p>}
      {loading ? <div className="study-set-empty"><Sparkles size={24} />Loading public Study Sets…</div> : items.length === 0 ? <div className="study-set-empty"><Search size={28} /><h3>No Study Sets matched your search.</h3><p>Try a broader search or clear the filters.</p><button className="secondary-button" onClick={() => { setQuery(""); setSubject(""); setGradeLevel(""); }}>Clear filters</button></div> : <div className="study-set-card-grid">{items.map((item) => <article className="study-set-card" key={item.id}><div className="study-set-card-top"><span className="study-set-visibility public"><Globe2 size={14} />Public</span><span>{item.questionCount} questions</span></div><h3>{item.title}</h3><p>{item.description || "A Study Set shared by a QuizStrike teacher."}</p><div className="study-set-card-meta"><span>Created by <strong>{item.creator.name}</strong></span><span>{item.creator.recognitionLevel ?? "Teacher"}</span><span><UsersRound size={13} />{item.uniqueTeacherUsageCount} teachers used it</span></div><div className="study-set-card-actions"><button className="secondary-button small-button" onClick={() => void previewSet(item.id)}>Preview</button><button className="primary small-button" onClick={() => void onPlayLive(item.id)}><Play size={14} />Use Set</button><button className="text-button small-button" onClick={() => void duplicate(item.id)}><Copy size={14} />Make a copy</button></div></article>)}</div>}
      {total > 12 && <div className="study-set-pagination"><button className="secondary-button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 12)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 12) || loading} onClick={() => void load(page + 1)}>Next</button></div>}
      {preview && <div className="study-set-preview-backdrop" role="presentation" onClick={() => setPreview(null)}><section className="study-set-preview panel" role="dialog" aria-modal="true" aria-labelledby="study-set-preview-title" onClick={(event) => event.stopPropagation()}><button ref={previewCloseRef} className="study-set-preview-close" onClick={() => setPreview(null)} aria-label="Close Study Set preview"><X size={18} /></button><span className="teacher-eyebrow">Public Study Set preview</span><h2 id="study-set-preview-title">{preview.studySet.title}</h2><p>{preview.studySet.description}</p><div className="study-set-preview-meta"><span>Created by <strong>{preview.creator?.name ?? "QuizStrike teacher"}</strong></span><span>{preview.creator?.recognitionLevel ?? "Teacher"}</span><span>{preview.studySet.questions.length} questions</span>{preview.studySet.subject && <span>{preview.studySet.subject}</span>}{preview.studySet.gradeLevel && <span>{preview.studySet.gradeLevel}</span>}<span>Updated {new Date(preview.studySet.updatedAt ?? preview.studySet.createdAt).toLocaleDateString()}</span><span>{preview.studySet.usageCount ?? 0} uses</span></div>{preview.attribution && <p className="study-set-attribution">{preview.attribution}</p>}<ol className="study-set-preview-questions">{preview.studySet.questions.map((question) => <li key={question.id}><strong>{question.prompt}</strong><span>Answer {question.correctChoice}: {question[`choice${question.correctChoice}` as "choiceA" | "choiceB" | "choiceC" | "choiceD"]}</span></li>)}</ol><div className="study-set-preview-actions"><button className="primary" onClick={() => { void onPlayLive(preview.studySet.id); setPreview(null); }}><Play size={16} />Use This Set</button><button className="secondary-button" onClick={() => void duplicate(preview.studySet.id)}><Copy size={16} />Make a Copy</button></div></section></div>}
    </div>
  );
}

export default function StudySetLibrary(props: StudySetLibraryProps) {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  return <section className="study-set-library-page"><div className="study-set-library-heading"><div><span className="teacher-eyebrow">Reusable teacher content</span><h2>Study Sets</h2><p>Create once, then find and use a set whenever your class is ready to play.</p></div><button className="primary" onClick={() => props.onEditQuiz()}><BookOpen size={16} />Create Study Set</button></div><RecognitionPanel recognition={props.data.recognition} /><div className="study-set-library-tabs" role="tablist" aria-label="Study Set library"><button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>My Sets <span>{props.data.quizSets.length}</span></button><button role="tab" aria-selected={tab === "public"} className={tab === "public" ? "active" : ""} onClick={() => setTab("public")}>Public Library</button></div>{tab === "mine" ? <MyStudySets {...props} /> : <PublicStudySets onRefresh={props.onRefresh} onPlayLive={props.onPlayLive} />}</section>;
}
