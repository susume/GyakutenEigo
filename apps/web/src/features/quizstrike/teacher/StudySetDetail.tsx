import { ArrowLeft, Copy, Edit3, Globe2, LockKeyhole, Play, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { QuizSet } from "@quizstrike/shared";
import { ApiError, teacherApi } from "../../../api/client";

type StudySetDetailProps = {
  studySetId: string;
  isOwner: boolean;
  onBack: () => void;
  onHost: (studySetId: string) => void;
  onEdit: (studySetId: string) => void;
  onCopy: (studySetId: string) => void;
};

type DetailPayload = { studySet: QuizSet; creator?: { id?: string; name: string; recognitionLevel?: string }; attribution?: string };

export default function StudySetDetail({ studySetId, isOwner, onBack, onHost, onEdit, onCopy }: StudySetDetailProps) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void teacherApi.studySet(studySetId)
      .then((result) => { if (!cancelled) setPayload(result as DetailPayload); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : "Study Set could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studySetId]);

  if (loading) return <section className="study-set-detail-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back</button><div className="study-set-detail-loading" role="status">Loading Study Set…</div></section>;
  if (error || !payload) return <section className="study-set-detail-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back</button><div className="study-set-detail-error" role="alert"><h2>Study Set unavailable</h2><p>{error || "This set may have been removed or is no longer public."}</p><button className="secondary-button" onClick={onBack}>Return to library</button></div></section>;

  const { studySet, creator, attribution } = payload;
  const isPublic = studySet.visibility === "PUBLIC";

  return (
    <section className="study-set-detail-page" aria-labelledby="study-set-detail-title">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back</button>
      <header className="study-set-detail-header">
        <div className="study-set-detail-copy">
          <span className="study-set-detail-visibility">{isPublic ? <Globe2 size={15} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}{isPublic ? "Public Study Set" : "Private Study Set"}</span>
          <h2 id="study-set-detail-title">{studySet.title}</h2>
          <p>{studySet.description || "A reusable Study Set for your next class game."}</p>
          <div className="study-set-detail-meta"><span>{studySet.questions.length} questions</span>{studySet.subject && <span>{studySet.subject}</span>}{studySet.gradeLevel && <span>{studySet.gradeLevel}</span>}{creator && <span>Created by <strong>{creator.name}</strong></span>}</div>
          {attribution && <p className="study-set-attribution">{attribution}</p>}
        </div>
        <div className="study-set-detail-actions"><button className="primary" onClick={() => onHost(studySet.id)} disabled={studySet.questions.length === 0}><Play size={18} aria-hidden="true" />Host</button>{isOwner ? <button className="secondary-button" onClick={() => onEdit(studySet.id)}><Edit3 size={17} aria-hidden="true" />Edit</button> : <button className="secondary-button" onClick={() => onCopy(studySet.id)}><Copy size={17} aria-hidden="true" />Make a Copy</button>}</div>
      </header>

      <div className="study-set-detail-usage"><UsersRound size={17} aria-hidden="true" /><span><strong>{studySet.uniqueTeacherUsageCount ?? 0}</strong> teachers have hosted this set</span><span>Updated {new Date(studySet.updatedAt ?? studySet.createdAt).toLocaleDateString()}</span></div>
      <section className="study-set-question-section" aria-labelledby="study-set-questions-title"><div className="study-set-section-heading"><div><span className="teacher-eyebrow">Set contents</span><h3 id="study-set-questions-title">Questions</h3></div><span>{studySet.questions.length}</span></div><ol className="study-set-detail-question-list">{studySet.questions.map((question, index) => <li key={question.id}><span className="study-set-question-number">{index + 1}</span><div><strong>{question.prompt}</strong><small>Correct answer: {question[`choice${question.correctChoice}` as "choiceA" | "choiceB" | "choiceC" | "choiceD"]}</small></div></li>)}</ol></section>
    </section>
  );
}
