import { useEffect, useState } from "react";
import { speakingReadingCriteria, type SpeakingParticipantResult, type SpeakingReadingReview, type SpeakingReadingReviewInput } from "@quizstrike/shared";
import { speakingApi } from "../../api/client";
import { useSiteTranslation } from "../../ui/siteTranslation";
import { browserTtsProvider } from "./speakingProviders";
import { readBrowserSpeechVoices } from "./speakingVoices";

function useLocalReadingVoice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const update = () => setAvailable(readBrowserSpeechVoices().some((voice) => voice.localService && /^en(?:-|$)/iu.test(voice.lang)));
    update();
    window.speechSynthesis?.addEventListener("voiceschanged", update);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", update);
      browserTtsProvider.cancel();
    };
  }, []);
  return available;
}

export function ReadingModelAudio({ text, label }: { text: string; label: string }) {
  const available = useLocalReadingVoice();
  const { language } = useSiteTranslation();
  const [sentenceIndex, setSentenceIndex] = useState(0);
  if (!available) return null;
  const ja = language === "ja";
  const sentences = (text.match(/[^.!?\n]+[.!?]*/gu) ?? []).map((line) => line.trim()).filter(Boolean);
  return <div className="speaking-reading-submission">
    <button className="speaking-outline-button" type="button" onClick={() => void browserTtsProvider.speak(text, { localOnly: true })}>{label}</button>
    {sentences.length > 1 && <details>
      <summary>{ja ? "1文ずつ聞く" : "Listen one sentence at a time"}</summary>
      <label>{ja ? "聞く文を選ぶ" : "Choose a sentence"}
        <select aria-label={ja ? "聞く文を選ぶ" : "Choose a sentence"} value={sentenceIndex} onChange={(event) => setSentenceIndex(Number(event.target.value))}>
          {sentences.map((sentence, index) => <option key={index} lang="en" value={index}>{sentence}</option>)}
        </select>
      </label>
      <button className="speaking-outline-button" type="button" onClick={() => void browserTtsProvider.speak(sentences[sentenceIndex] ?? sentences[0]!, { localOnly: true })}>
        {ja ? "この文を聞く" : "Listen to this sentence"}
      </button>
    </details>}
  </div>;
}

export function SpeakingReadingResults({ result, teacher = false, onNext }: {
  result: SpeakingParticipantResult; teacher?: boolean; onNext?: () => Promise<void>;
}) {
  const { language } = useSiteTranslation();
  const ja = language === "ja";
  const localVoice = useLocalReadingVoice();
  const assignment = result.session.readingAssignment;
  const evaluation = result.evaluation;
  const reading = evaluation?.assessmentEvidence?.reading;
  const [review, setReview] = useState(result.readingReview);
  const [history, setHistory] = useState<SpeakingReadingReview[]>([]);
  const [scores, setScores] = useState<SpeakingReadingReviewInput["scores"]>(() =>
    Object.fromEntries((assignment?.rubric ?? []).filter(({ weight }) => weight > 0).map(({ id }) => [
      id, result.readingReview?.scores[id] ?? null
    ])));
  const [comment, setComment] = useState(result.readingReview?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!teacher) return;
    const controller = new AbortController();
    void speakingApi.readingReviews(result.participant.id, controller.signal).then((response) => {
      if (!controller.signal.aborted) {
        setHistory(response.reviews);
        setReview(response.reviews.at(-1));
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [teacher, result.participant.id]);
  const currentReview = teacher ? review : result.readingReview;
  if (!assignment || !evaluation || !reading) return null;
  const { passage, rubric } = assignment;
  const Heading = teacher ? "h2" : "h1";
  const { alignment } = reading;
  const confirmed = currentReview?.status === "confirmed";
  const studentTurn = result.turns.find((turn) => turn.speaker === "student");
  const matchesPerMinute = studentTurn && !studentTurn.transcriptionUncertain && reading.durationMs && reading.durationMs >= 15_000
    ? Math.round(alignment.matches * 60_000 / reading.durationMs) : undefined;
  const possible = { match: ja ? "一致" : "Match", substitution: ja ? "別の単語の可能性" : "Possible substitution", omission: ja ? "読み飛ばしの可能性" : "Possible omission", insertion: ja ? "追加の可能性" : "Possible extra word" };
  const save = async (status: "confirmed" | "reopened", next = false) => {
    setBusy(true);
    setError("");
    try {
      const response = await speakingApi.saveReadingReview(result.participant.id, {
        expectedRevision: currentReview?.revision ?? 0, status, scores, comment
      });
      setReview(response.review);
      setHistory((items) => [...items, response.review]);
      if (next) await onNext?.();
    } catch (failure) {
      setError(failure instanceof Error && !ja ? failure.message : ja ? "評価を保存できませんでした。画面を更新して再試行してください。" : "The review could not be saved.");
    } finally { setBusy(false); }
  };
  return <section className="speaking-form-card speaking-reading-card">
    <Heading>{ja ? "音読チェック" : "Read Aloud"}</Heading>
    <p>{passage.textbook} · {ja ? `${passage.grade}年` : `Grade ${passage.grade}`} · Unit {passage.unit} · Part {passage.part} · v{passage.version}</p>
    <p>{ja ? "提出 1" : "Attempt 1"}{reading.durationMs ? ` · ${(reading.durationMs / 1000).toFixed(1)} s` : ""}</p>
    <h3>{confirmed ? (ja ? "評価が確定しました" : "Teacher assessment confirmed") : (ja ? "先生の確認待ち" : "Waiting for teacher review")}</h3>
    {confirmed && currentReview.comment && <p>{currentReview.comment}</p>}
    {!teacher && <button className="speaking-outline-button" type="button" onClick={() => window.location.reload()}>{ja ? "確認状況を更新" : "Refresh review status"}</button>}
    <h3>{passage.title ?? (ja ? "英文" : "Passage")}</h3>
    <p className="speaking-reading-passage" lang="en">{passage.text}</p>
    <ReadingModelAudio text={passage.text} label={ja ? "端末の読み上げ音声を聞く" : "Listen to device-generated speech"} />
    <h3>{ja ? "AIによる仮評価" : "Provisional assessment"}</h3>
    <p>{evaluation.overallMessage}</p>
    <p>{ja ? "一致" : "Matched"} {alignment.matches}/{alignment.referenceWords} · {ja ? "比較できた範囲" : "Coverage"} {Math.round((alignment.coverage ?? 0) * 100)}% · {ja ? "単語誤り率" : "Word error rate"} {Math.round((alignment.wordErrorRate ?? 0) * 100)}%</p>
    {matchesPerMinute !== undefined && <p>{ja ? "1分あたりに一致した語数（概算）" : "Approximate matched words per minute"} {matchesPerMinute}</p>}
    {alignment.possibleIncomplete && <p>{ja ? "最後まで読めたか、録音で確認しましょう。" : "Check the recording to see whether you reached the end."}</p>}
    {evaluation.strengths.concat(evaluation.improvements).map((line) => <p key={line}>{line}</p>)}
    <details open={teacher}>
      <summary>{ja ? "文字起こしと単語の比較" : "Transcript and word comparison"}</summary>
      <p lang="en">{studentTurn?.text}</p>
      <p className="speaking-reading-alignment" aria-label={ja ? "比較用の単語" : "Normalized alignment"}>
        {alignment.words.map((word, index) => <span key={index} className={`speaking-reading-word speaking-reading-word-${word.kind}`}>
          {word.kind !== "match" && <span className="sr-only">{possible[word.kind]} </span>}
          <span lang="en">{word.reference ?? word.recognized}</span>{" "}
        </span>)}
      </p>
      {alignment.words.some((word) => word.kind !== "match") && <ul className="speaking-reading-differences">
        {alignment.words.map((word, index) => word.kind === "match" ? null : <li key={index}>
          <span>{possible[word.kind]} </span><strong lang="en">{word.reference ?? word.recognized}{word.reference && word.recognized ? ` → ${word.recognized}` : ""}</strong>
          {word.possibleRepetition && <span> · {ja ? "繰り返しの可能性" : "Possible repetition"}</span>}
          {localVoice && <button type="button" className="speaking-outline-button" onClick={() =>
            void browserTtsProvider.speak(word.reference ?? word.recognized ?? "", { localOnly: true })
          }>{ja ? "単語を聞く" : "Listen to word"}</button>}
        </li>)}
      </ul>}
    </details>
    <dl className="speaking-reading-scores">{rubric.filter(({ weight }) => weight > 0).map(({ id, weight }) => <div key={id}>
      <dt>{speakingReadingCriteria[id][language]} ({weight}%)</dt>
      <dd>{ja ? "仮評価" : "Provisional"} {evaluation.scores[id] ?? "N/A"}{typeof evaluation.scores[id] === "number" ? "/4" : ""} · {evaluation.evidence[id]}</dd>
      {confirmed && <dd>{ja ? "先生の評価" : "Teacher assessment"} {currentReview.scores[id] ?? "N/A"}</dd>}
    </div>)}</dl>
    {teacher && <fieldset disabled={busy}>
      <legend>{ja ? "先生の評価" : "Teacher assessment"}</legend>
      <p>{ja ? "録音は生徒の端末にあります。音声の評価は、音読を直接聞いた場合に入力してください。" : "The recording stays on the student’s device. Enter acoustic scores when you have observed the reading."}</p>
      {!confirmed && rubric.filter(({ weight }) => weight > 0).map(({ id }) => <label key={id}>{speakingReadingCriteria[id][language]}
        <select aria-label={speakingReadingCriteria[id][language]} value={scores[id] ?? ""} onChange={(event) => setScores({ ...scores, [id]: event.target.value === "" ? null : Number(event.target.value) })}>
          <option value="">N/A</option>{[4, 3, 2, 1, 0].map((score) => <option key={score}>{score}</option>)}
        </select>
      </label>)}
      {!confirmed && <label>{ja ? "コメント" : "Comment"}<textarea rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>}
      <div className="speaking-reading-actions">
        {confirmed
          ? <button type="button" className="speaking-outline-button" onClick={() => void save("reopened")}>{ja ? "評価を修正する" : "Reopen review"}</button>
          : <><button type="button" className="speaking-primary-button" onClick={() => void save("confirmed")}>{ja ? "評価を確定" : "Confirm assessment"}</button>
            {onNext && <button type="button" className="speaking-outline-button" onClick={() => void save("confirmed", true)}>{ja ? "確定して次の生徒へ" : "Confirm and open next student"}</button>}</>}
      </div>
      {history.length > 0 && <details><summary>{ja ? "評価履歴" : "Review history"}</summary><ol>{history.map((item) => <li key={item.revision}>{item.revision} · {item.status === "confirmed" ? (ja ? "確定" : "Confirmed") : (ja ? "再確認" : "Reopened")} · {new Date(item.createdAt).toLocaleString()} {item.comment}</li>)}</ol></details>}
      {error && <p role="alert" className="speaking-error">{error}</p>}
    </fieldset>}
  </section>;
}
