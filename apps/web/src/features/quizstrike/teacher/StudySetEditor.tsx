import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Eye, FileUp, Globe2, LockKeyhole, Mic, Plus, Save, Square, Trash2, X } from "lucide-react";
import type { Choice, QuizSet } from "@quizstrike/shared";
import { ApiError, teacherApi } from "../../../api/client";
import {
  editorQuestionFromQuestion,
  emptyEditorQuestion,
  isBlankEditorQuestion,
  questionsFromStudyList,
  reconcileEditorQuestions,
  validateEditorQuestions,
  type EditorQuestion
} from "./studySetEditorModel";

type DashboardData = { quizSets: QuizSet[] };
type Metadata = {
  title: string;
  description: string;
  subject: string;
  topic: string;
  gradeLevel: string;
  language: string;
  visibility: "PRIVATE" | "PUBLIC";
};
type PendingAudio = { blob: Blob; previewUrl: string };

const blankMetadata = (): Metadata => ({
  title: "",
  description: "",
  subject: "English",
  topic: "",
  gradeLevel: "",
  language: "English",
  visibility: "PRIVATE"
});

const metadataFromQuiz = (quiz?: QuizSet): Metadata => quiz ? {
  title: quiz.title,
  description: quiz.description ?? "",
  subject: quiz.subject ?? "",
  topic: quiz.topic ?? "",
  gradeLevel: quiz.gradeLevel ?? "",
  language: quiz.language ?? "English",
  visibility: quiz.visibility ?? "PRIVATE"
} : blankMetadata();

const choices: Choice[] = ["A", "B", "C", "D"];
const choiceField = (choice: Choice) => `choice${choice}` as "choiceA" | "choiceB" | "choiceC" | "choiceD";

function QuestionAudioRecorder({ audio, disabled, onChange }: {
  audio?: PendingAudio;
  disabled: boolean;
  onChange: (audio: PendingAudio | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const intervalRef = useRef<number | null>(null);
  const limitRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearTimers = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (limitRef.current !== null) window.clearTimeout(limitRef.current);
    intervalRef.current = null;
    limitRef.current = null;
  };

  const stop = () => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  };

  useEffect(() => () => {
    mountedRef.current = false;
    clearTimers();
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const toggleRecording = async () => {
    if (recording) {
      stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported by this browser.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
        .find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => mountedRef.current && setError("The browser could not finish this recording. Try again.");
      recorder.onstop = () => {
        clearTimers();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size) onChange({ blob, previewUrl: URL.createObjectURL(blob) });
      };
      recorder.start();
      setSeconds(0);
      setRecording(true);
      intervalRef.current = window.setInterval(() => setSeconds((current) => current + 1), 1_000);
      limitRef.current = window.setTimeout(stop, 60_000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setError("Microphone access was denied or unavailable. Check the browser permission and try again.");
    }
  };

  return <div className="study-set-audio-recorder wide">
    <div className="study-set-audio-actions">
      <button type="button" className={recording ? "recording-button" : "secondary-button"} onClick={() => void toggleRecording()} disabled={disabled || Boolean(audio)}>
        {recording ? <Square size={15} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {recording ? `Stop (${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")})` : "Record question audio"}
      </button>
      {audio && <button type="button" className="text-button danger-text" onClick={() => onChange(null)} disabled={disabled}><Trash2 size={15} aria-hidden="true" />Remove recording</button>}
    </div>
    <small>Optional · up to 60 seconds. The recording uploads when you save.</small>
    {audio && <audio controls preload="metadata" src={audio.previewUrl} aria-label="Recorded question audio preview" />}
    {error && <span className="field-error" role="alert">{error}</span>}
  </div>;
}

export default function StudySetEditor({ data, onRefresh, initialQuizSetId, startInCreateMode = false }: {
  data: DashboardData;
  onRefresh: () => Promise<void>;
  initialQuizSetId?: string;
  startInCreateMode?: boolean;
}) {
  const initialQuiz = startInCreateMode ? undefined : data.quizSets.find((quiz) => quiz.id === initialQuizSetId) ?? data.quizSets[0];
  const [persistedId, setPersistedId] = useState(initialQuiz?.id ?? "");
  const [metadata, setMetadata] = useState<Metadata>(() => metadataFromQuiz(initialQuiz));
  const [questions, setQuestions] = useState<EditorQuestion[]>(() => initialQuiz?.questions.length
    ? initialQuiz.questions.map(editorQuestionFromQuestion)
    : [emptyEditorQuestion()]);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [titleError, setTitleError] = useState("");
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [pendingQuestionAudio, setPendingQuestionAudio] = useState<Record<string, PendingAudio>>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const pendingAudioRef = useRef(pendingQuestionAudio);

  const currentQuiz = useMemo(() => data.quizSets.find((quiz) => quiz.id === persistedId), [data.quizSets, persistedId]);
  const completeQuestions = questions.filter((question) => !isBlankEditorQuestion(question));

  const markChanged = () => {
    setDirty(true);
    setSaveState("idle");
    setMessage("");
  };

  useEffect(() => {
    pendingAudioRef.current = pendingQuestionAudio;
  }, [pendingQuestionAudio]);

  useEffect(() => () => {
    Object.values(pendingAudioRef.current).forEach((audio) => URL.revokeObjectURL(audio.previewUrl));
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const guardWorkspaceNavigation = (event: MouseEvent) => {
      if (!dirty) return;
      const target = event.target instanceof Element ? event.target.closest(".workspace .sidebar button") : null;
      if (!target) return;
      if (!window.confirm("You have unsaved Study Set changes. Leave without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", guardWorkspaceNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", guardWorkspaceNavigation, true);
    };
  }, [dirty]);

  const updateMetadata = <K extends keyof Metadata>(field: K, value: Metadata[K]) => {
    setMetadata((current) => ({ ...current, [field]: value }));
    if (field === "title") setTitleError("");
    markChanged();
  };

  const updateQuestion = <K extends keyof EditorQuestion>(key: string, field: K, value: EditorQuestion[K]) => {
    setQuestions((current) => current.map((question) => question.key === key ? { ...question, [field]: value } : question));
    setQuestionErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    markChanged();
  };

  const focusQuestion = (key: string) => window.setTimeout(() => {
    document.querySelector<HTMLInputElement>(`[data-question-key="${key}"] input[data-question-prompt]`)?.focus();
  });

  const addQuestion = () => {
    const question = emptyEditorQuestion();
    setQuestions((current) => [...current, question]);
    markChanged();
    focusQuestion(question.key);
  };

  const duplicateQuestion = (index: number) => {
    const source = questions[index];
    const copy = { ...source, key: emptyEditorQuestion().key, id: undefined };
    setQuestions((current) => [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]);
    markChanged();
    focusQuestion(copy.key);
  };

  const removeQuestion = (index: number) => {
    const question = questions[index];
    if (question.id) setDeletedQuestionIds((current) => [...new Set([...current, question.id!])]);
    setPendingQuestionAudio((current) => {
      const audio = current[question.key];
      if (!audio) return current;
      URL.revokeObjectURL(audio.previewUrl);
      const next = { ...current };
      delete next[question.key];
      return next;
    });
    setQuestions((current) => {
      const next = current.filter((_, questionIndex) => questionIndex !== index);
      return next.length ? next : [emptyEditorQuestion()];
    });
    markChanged();
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markChanged();
  };

  const importQuestions = () => {
    const imported = questionsFromStudyList(importText);
    if (!imported.length) {
      setMessage("Paste at least two term–definition lines, such as environment - 環境.");
      setSaveState("error");
      return;
    }
    setQuestions((current) => current.length === 1 && isBlankEditorQuestion(current[0]) ? imported : [...current, ...imported]);
    setImportText("");
    setShowImport(false);
    setMessage(`${imported.length} questions imported. Review them before saving.`);
    setSaveState("idle");
    markChanged();
  };

  const updateDetails = async (quizSetId: string, visibility: Metadata["visibility"]) => {
    try {
      await teacherApi.updateStudySet(quizSetId, { ...metadata, visibility });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && visibility === "PRIVATE") {
        await teacherApi.renameQuizSet(quizSetId, metadata.title.trim());
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        throw new Error("Your Study Set was saved privately, but publishing needs the latest QuizStrike server. Try again shortly.");
      }
      throw error;
    }
  };

  const setQuestionRecording = (questionKey: string, audio: PendingAudio | null) => {
    setPendingQuestionAudio((current) => {
      if (current[questionKey] && current[questionKey] !== audio) URL.revokeObjectURL(current[questionKey].previewUrl);
      const next = { ...current };
      if (audio) next[questionKey] = audio;
      else delete next[questionKey];
      return next;
    });
    markChanged();
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const trimmedTitle = metadata.title.trim();
    const activeQuestions = questions.filter((question) => !isBlankEditorQuestion(question));
    const errors = validateEditorQuestions(activeQuestions);
    setTitleError(trimmedTitle.length < 2 ? "Study Set title is required." : "");
    setQuestionErrors(errors);
    if (trimmedTitle.length < 2) {
      titleRef.current?.focus();
      return;
    }
    if (Object.keys(errors).length) {
      document.querySelector<HTMLInputElement>(`[data-question-key="${Object.keys(errors)[0]}"] input[data-question-prompt]`)?.focus();
      return;
    }
    if (metadata.visibility === "PUBLIC" && activeQuestions.length < 2) {
      setMessage("Add at least two complete questions before publishing this Study Set.");
      setSaveState("error");
      return;
    }

    setSaving(true);
    setMessage("");
    setSaveState("idle");
    let quizSetId = persistedId;
    try {
      if (!quizSetId) {
        const payload = await teacherApi.createQuizSet({ ...metadata, title: trimmedTitle, visibility: "PRIVATE" }) as { quizSet: QuizSet };
        quizSetId = payload.quizSet.id;
        setPersistedId(quizSetId);
      } else if ((currentQuiz?.visibility ?? "PRIVATE") === "PUBLIC" && metadata.visibility === "PRIVATE") {
        await updateDetails(quizSetId, "PRIVATE");
      }

      const savedQuestions: EditorQuestion[] = [];
      for (const [position, question] of activeQuestions.entries()) {
        const body = {
          prompt: question.prompt.trim(),
          choiceA: question.choiceA.trim(),
          choiceB: question.choiceB.trim(),
          choiceC: question.choiceC.trim(),
          choiceD: question.choiceD.trim(),
          correctChoice: question.correctChoice,
          explanation: question.explanation.trim(),
          difficulty: question.difficulty.trim(),
          audioUrl: question.audioUrl.trim(),
          position
        };
        const audioDraft = pendingQuestionAudio[question.key];
        const payload = question.id
          ? await teacherApi.updateQuestion(question.id, body)
          : await teacherApi.addQuestion(quizSetId, body);
        let saved = (payload as { question: QuizSet["questions"][number] }).question;
        let savedEditor = editorQuestionFromQuestion(saved);
        savedQuestions.push(savedEditor);
        setQuestions((current) => current.map((item) => item.key === question.key ? savedEditor : item));
        if (audioDraft) {
          setPendingQuestionAudio((current) => {
            const next = { ...current, [saved.id]: audioDraft };
            delete next[question.key];
            return next;
          });
          const audioPayload = await teacherApi.uploadQuestionAudio(saved.id, audioDraft.blob) as { question: QuizSet["questions"][number] };
          saved = audioPayload.question;
          savedEditor = editorQuestionFromQuestion(saved);
          savedQuestions[savedQuestions.length - 1] = savedEditor;
          setQuestions((current) => current.map((item) => item.id === saved.id ? savedEditor : item));
          setPendingQuestionAudio((current) => {
            URL.revokeObjectURL(audioDraft.previewUrl);
            const next = { ...current };
            delete next[question.key];
            delete next[saved.id];
            return next;
          });
        }
      }
      for (const questionId of deletedQuestionIds) {
        try {
          await teacherApi.deleteQuestion(questionId);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
        setDeletedQuestionIds((current) => current.filter((id) => id !== questionId));
      }

      if (persistedId || metadata.visibility === "PUBLIC") await updateDetails(quizSetId, metadata.visibility);
      setQuestions(savedQuestions.length ? savedQuestions : [emptyEditorQuestion()]);
      setDeletedQuestionIds([]);
      setDirty(false);
      setSaveState("saved");
      setMessage(metadata.visibility === "PUBLIC" ? "Saved and published to Discover." : "Saved privately to your Library.");
      await onRefresh();
    } catch (error) {
      if (quizSetId) {
        setPersistedId(quizSetId);
        try {
          const payload = await teacherApi.getQuizSet(quizSetId) as { quizSet: QuizSet };
          setQuestions((current) => reconcileEditorQuestions(current, payload.quizSet.questions));
          setDeletedQuestionIds((current) => current.filter((id) => payload.quizSet.questions.some((question) => question.id === id)));
        } catch {
          // Keep every local edit when the recovery read is unavailable.
        }
        await onRefresh().catch(() => undefined);
      }
      if (import.meta.env.DEV) console.error("Study Set save failed.", error);
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "We couldn't save this Study Set. Your edits are still here. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return <form className="study-set-editor" onSubmit={save} onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      addQuestion();
    }
  }}>
    <header className="study-set-editor-header">
      <div><span className="teacher-eyebrow">Study Set editor</span><h2>{persistedId ? "Edit Study Set" : "Create Study Set"}</h2><p>Build a set once, then use it in any QuizStrike game.</p></div>
      <div className="study-set-editor-actions">
        <button type="button" className="secondary-button" onClick={() => setShowImport((open) => !open)}><FileUp size={16} aria-hidden="true" />Import questions</button>
        <button type="button" className="secondary-button" onClick={() => setShowPreview(true)} disabled={!completeQuestions.length}><Eye size={16} aria-hidden="true" />Preview</button>
        <button type="submit" className="primary" disabled={saving}><Save size={17} aria-hidden="true" />{saving ? "Saving…" : "Save Study Set"}</button>
      </div>
    </header>

    <div className={`study-set-save-banner ${saveState}`} role={saveState === "error" ? "alert" : "status"} aria-live="polite">
      {saving ? "Saving your Study Set…" : saveState === "saved" ? <><Check size={16} aria-hidden="true" />{message}</> : saveState === "error" ? message : dirty ? "Unsaved changes" : persistedId ? "All changes saved" : "New Study Set · Private by default"}
    </div>

    {showImport && <section className="study-set-import-panel" aria-labelledby="study-set-import-title">
      <div><h3 id="study-set-import-title">Import a term and definition list</h3><p>Paste one pair per line. You can review every generated question before saving.</p></div>
      <textarea className="bulk-textarea" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'environment - 環境\ngovernment - 政府\nincrease - 増加する'} aria-label="Term and definition list" />
      <div className="study-set-import-actions"><button type="button" className="primary" onClick={importQuestions}>Add imported questions</button><button type="button" className="text-button" onClick={() => setShowImport(false)}>Cancel</button></div>
    </section>}

    <section className="study-set-info-card" aria-labelledby="study-set-info-title">
      <div className="study-set-card-heading"><div><span className="teacher-eyebrow">Set information</span><h3 id="study-set-info-title">Name your Study Set</h3></div><span>{completeQuestions.length} {completeQuestions.length === 1 ? "question" : "questions"}</span></div>
      <label className="study-set-title-field">Study Set title<input ref={titleRef} value={metadata.title} onChange={(event) => updateMetadata("title", event.target.value)} placeholder="Eiken Pre-2 Vocabulary — Unit 3" aria-invalid={Boolean(titleError)} aria-describedby={titleError ? "study-set-title-error" : undefined} />{titleError && <span className="field-error" id="study-set-title-error">{titleError}</span>}</label>
      <label className="study-set-description-field">Description <small>(optional)</small><textarea value={metadata.description} onChange={(event) => updateMetadata("description", event.target.value)} placeholder="What will students review?" /></label>
      <details className="study-set-details-disclosure">
        <summary><span><strong>Details and visibility</strong><small>{metadata.visibility === "PUBLIC" ? "Public · other teachers can discover it" : "Private · only you can use it"}</small></span></summary>
        <div className="study-set-details-body">
          <div className="study-set-metadata-grid">
            <label>Subject<input value={metadata.subject} onChange={(event) => updateMetadata("subject", event.target.value)} placeholder="English" /></label>
            <label>Level<input value={metadata.gradeLevel} onChange={(event) => updateMetadata("gradeLevel", event.target.value)} placeholder="Eiken Pre-2" /></label>
            <label>Topic<input value={metadata.topic} onChange={(event) => updateMetadata("topic", event.target.value)} placeholder="Vocabulary" /></label>
            <label>Language<input value={metadata.language} onChange={(event) => updateMetadata("language", event.target.value)} placeholder="English" /></label>
          </div>
          <fieldset className="study-set-visibility-selector"><legend>Who can use this set?</legend>
            <label className={metadata.visibility === "PRIVATE" ? "selected" : ""}><input type="radio" name="study-set-visibility" checked={metadata.visibility === "PRIVATE"} onChange={() => updateMetadata("visibility", "PRIVATE")} /><LockKeyhole size={19} aria-hidden="true" /><span><strong>Private</strong><small>Only you can see and use this Study Set.</small></span></label>
            <label className={metadata.visibility === "PUBLIC" ? "selected" : ""}><input type="radio" name="study-set-visibility" checked={metadata.visibility === "PUBLIC"} onChange={() => updateMetadata("visibility", "PUBLIC")} /><Globe2 size={19} aria-hidden="true" /><span><strong>Public</strong><small>Other QuizStrike teachers can discover and use it.</small></span></label>
          </fieldset>
        </div>
      </details>
    </section>

    <section className="study-set-question-stack" aria-labelledby="study-set-questions-heading">
      <div className="study-set-questions-heading"><div><span className="teacher-eyebrow">Questions</span><h3 id="study-set-questions-heading">Add questions and answers</h3></div><small>Ctrl/Cmd + Enter adds another</small></div>
      {questions.map((question, index) => <article className="study-set-question-card" key={question.key} data-question-key={question.key}>
        <header><div className="study-set-question-number"><span>Question {index + 1}</span></div><div className="study-set-question-tools"><button type="button" onClick={() => moveQuestion(index, -1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`} title="Move up"><ArrowUp size={16} /></button><button type="button" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1} aria-label={`Move question ${index + 1} down`} title="Move down"><ArrowDown size={16} /></button><button type="button" onClick={() => duplicateQuestion(index)}><Copy size={15} aria-hidden="true" />Duplicate</button><button type="button" className="danger-text" onClick={() => removeQuestion(index)} aria-label={`Delete question ${index + 1}`} title="Delete question"><Trash2 size={16} /></button></div></header>
        <label>Question<input data-question-prompt value={question.prompt} onChange={(event) => updateQuestion(question.key, "prompt", event.target.value)} placeholder="What does “environment” mean?" aria-invalid={Boolean(questionErrors[question.key])} /></label>
        <fieldset className="study-set-answer-list"><legend>Answers</legend>{choices.map((choice) => {
          const field = choiceField(choice);
          const correct = question.correctChoice === choice;
          const radioId = `correct-${question.key}-${choice}`;
          return <div className={correct ? "correct" : ""} key={choice}><input id={radioId} type="radio" name={`correct-${question.key}`} checked={correct} onChange={() => updateQuestion(question.key, "correctChoice", choice)} aria-label={`Mark answer ${choice} correct`} /><label htmlFor={radioId} className="answer-letter">{choice}</label><input aria-label={`Answer ${choice}`} value={question[field]} onChange={(event) => updateQuestion(question.key, field, event.target.value)} placeholder={`Answer ${choice}`} /><label htmlFor={radioId} className="correct-label">{correct ? <><Check size={15} aria-hidden="true" />Correct</> : "Mark correct"}</label></div>;
        })}</fieldset>
        {questionErrors[question.key] && <p className="field-error" role="alert">{questionErrors[question.key]}</p>}
        <details className="study-set-more-options"><summary>More options</summary><div className="study-set-advanced-grid"><label>Explanation<textarea value={question.explanation} onChange={(event) => updateQuestion(question.key, "explanation", event.target.value)} placeholder="Shown during review" /></label><label>Difficulty<input value={question.difficulty} onChange={(event) => updateQuestion(question.key, "difficulty", event.target.value)} placeholder="Standard" /></label><label className="wide">Question audio URL<input inputMode="url" value={question.audioUrl} onChange={(event) => updateQuestion(question.key, "audioUrl", event.target.value)} placeholder="https://…" /></label><QuestionAudioRecorder audio={pendingQuestionAudio[question.key]} disabled={saving} onChange={(audio) => setQuestionRecording(question.key, audio)} /></div></details>
      </article>)}
      <button type="button" className="study-set-add-question" onClick={addQuestion}><Plus size={19} aria-hidden="true" />Add Question</button>
    </section>

    <footer className="study-set-editor-footer"><div><strong>{completeQuestions.length} questions</strong><span>{dirty ? "Unsaved changes" : "All changes saved"}</span></div><button type="submit" className="primary" disabled={saving}><Save size={17} aria-hidden="true" />{saving ? "Saving…" : "Save Study Set"}</button></footer>

    {showPreview && <div className="study-set-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="study-set-preview-title"><section className="study-set-preview"><button type="button" className="study-set-preview-close" onClick={() => setShowPreview(false)} aria-label="Close preview"><X size={20} /></button><span className={`study-set-visibility ${metadata.visibility.toLowerCase()}`}>{metadata.visibility === "PUBLIC" ? <Globe2 size={14} /> : <LockKeyhole size={14} />}{metadata.visibility === "PUBLIC" ? "Public" : "Private"}</span><h2 id="study-set-preview-title">{metadata.title || "Untitled Study Set"}</h2><p>{metadata.description || "No description yet."}</p><ol className="study-set-preview-questions">{completeQuestions.map((question) => <li key={question.key}><strong>{question.prompt}</strong><span>Correct answer: {question[choiceField(question.correctChoice)]}</span></li>)}</ol></section></div>}
  </form>;
}
