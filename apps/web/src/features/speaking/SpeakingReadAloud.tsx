import { useEffect, useRef, useState } from "react";
import { alignSpeakingReading, SpeakingReadingTranscriptSchema, type SpeakingPassage, type SpeakingSession } from "@quizstrike/shared";
import sampleCatalog from "../../../../../docs/examples/speakcheck-read-aloud.original.json";
import { speakingApi } from "../../api/client";
import { useSiteTranslation } from "../../ui/siteTranslation";
import ReadingPassagePicker, { emptyReadingSelection } from "./ReadingPassagePicker";
import { ReadingModelAudio } from "./SpeakingReadingResults";
import { LocalSpeechError, MAX_READING_FILE_BYTES } from "./localSpeech/audio";
import { BrowserSpeechRecognizer } from "./localSpeech/browserSpeech";
import type { LocalTranscript } from "./localSpeech/protocol";

export const originalReadingPassages: SpeakingPassage[] = sampleCatalog.passages.map((item, index) => ({ ...item, id: `original-${index + 1}`, version: 1 }));
type Classroom = { session: SpeakingSession; token: string; submitted: boolean; onFinish: () => void };

export default function SpeakingReadAloud({ classroom, onJoin }: { classroom?: Classroom; onJoin: () => void }) {
  const { language } = useSiteTranslation();
  const ja = language === "ja";
  const [selection, setSelection] = useState(emptyReadingSelection);
  const [confirmed, setConfirmed] = useState(false);
  const assignment = classroom?.session.readingAssignment;
  const passage = assignment?.passage ?? originalReadingPassages.find((item) => item.id === selection.passageId);
  return <main className="speaking-form-card speaking-reading-card speaking-reading-page">
    <h1>{ja ? "音読チェック" : "Read Aloud"}</h1>
    {!classroom && <>
      <p>{ja ? "練習用のオリジナル英文を選んでください。先生の課題には参加コードを使います。" : "Choose an original practice passage. Use your class code to open a teacher assignment."}</p>
      <button type="button" className="speaking-outline-button" onClick={onJoin}>{ja ? "コードで課題に参加" : "Join an assignment"}</button>
      <ReadingPassagePicker passages={originalReadingPassages} selection={selection} setSelection={(next) => { setSelection(next); setConfirmed(false); }} />
    </>}
    {passage && <><p>{passage.textbook} · {ja ? `${passage.grade}年` : `Grade ${passage.grade}`} · Unit {passage.unit} · Part {passage.part}</p>
      <h2>{passage.title ?? (ja ? "英文" : "Passage")}</h2>
      <p lang="en" className="speaking-reading-passage">{passage.text}</p>
      <ReadingModelAudio text={passage.text} label={ja ? "端末の読み上げ音声を聞く" : "Listen to device-generated speech"} />
      {classroom || confirmed
        ? <ReadingSubmission key={passage.id} passage={passage} classroom={classroom} />
        : <button type="button" className="speaking-primary-button" onClick={() => setConfirmed(true)}>{ja ? "この英文で練習する" : "Practice this passage"}</button>}
    </>}
    {classroom && !assignment && <p role="alert">{ja ? "課題の英文を開けません。先生に確認してください。" : "The assigned passage could not be opened. Ask your teacher."}</p>}
  </main>;
}

function ReadingSubmission({ passage, classroom }: { passage: SpeakingPassage; classroom?: Classroom }) {
  const { language } = useSiteTranslation();
  const ja = language === "ja";
  const [engine] = useState(() => new BrowserSpeechRecognizer());
  const request = useRef<AbortController | undefined>(undefined);
  const requestId = useRef("");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [transcript, setTranscript] = useState<LocalTranscript>();
  const [submitted, setSubmitted] = useState(classroom?.submitted ?? false);
  const [sessionStatus, setSessionStatus] = useState(classroom?.session.status);
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sessionId = classroom?.session.id;
  const token = classroom?.token;
  useEffect(() => () => { request.current?.abort(); engine.dispose(); }, [engine]);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!sessionId || !token) return;
    const controller = new AbortController();
    let timer: number;
    const poll = async () => {
      try {
        const result = await speakingApi.status(sessionId, token, controller.signal) as { session: SpeakingSession };
        if (!controller.signal.aborted) setSessionStatus(result.session.status);
      } catch { /* A temporary connection error is checked on the next poll. */ }
      if (!controller.signal.aborted) timer = window.setTimeout(() => void poll(), 4_000);
    };
    void poll();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [sessionId, token]);

  const report = async (status: "preparing" | "issue" | "ready", signal: AbortSignal) => {
    if (sessionId && token) await speakingApi.localReadiness(sessionId, token, status, signal);
  };
  const finish = async () => {
    if (!classroom || !token || !sessionId) return;
    await speakingApi.finish(sessionId, token);
    classroom.onFinish();
  };

  const process = async () => {
    if (busy || !file && !submitted) return;
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setBusy(true);
    try {
      if (submitted) {
        await finish();
        return;
      }
      let recognized = transcript;
      if (!recognized) {
        if (!file || file.size > MAX_READING_FILE_BYTES) throw new LocalSpeechError("too-large");
        setStage(ja ? "音声モデルを準備中…" : "Preparing speech recognition…");
        await report("preparing", controller.signal);
        try {
          await engine.prepare({ backend: "wasm", cachedOnly: true, signal: controller.signal });
        } catch (failure) {
          if (!(failure instanceof LocalSpeechError) || failure.code !== "prepare") throw failure;
          await engine.prepare({ backend: "wasm", signal: controller.signal });
        }
        setStage(ja ? "文字起こし中…" : "Transcribing on this device…");
        recognized = await engine.transcribeReading(file, {
          signal: controller.signal,
          onChunk: (done, count) => setStage(ja ? `文字起こし中… ${done}/${count}` : `Transcribing… ${done}/${count}`)
        });
        if (recognized.status === "no-speech") {
          await report("issue", controller.signal);
          setError(ja ? "声を確認できません。録音を聞いて、声が入っているファイルを選んでください。" : "We could not detect speech. Play your recording and choose a file with audible speech.");
          return;
        }
        setTranscript(recognized);
      }
      if (sessionId && token) {
        const payload = SpeakingReadingTranscriptSchema.safeParse({ text: recognized.text, uncertain: recognized.status === "uncertain", durationMs: recognized.durationMs });
        if (!payload.success) {
          setError(ja ? "文字起こしを提出できません。別の録音を選んでください。" : "This transcript could not be submitted. Try another recording.");
          return;
        }
        await report("ready", controller.signal);
        if (sessionStatus === "active") {
          requestId.current ||= crypto.randomUUID();
          setStage(ja ? "提出中…" : "Submitting the transcript…");
          await speakingApi.localTurn(sessionId, token, requestId.current, payload.data, controller.signal);
          setSubmitted(true);
          await finish();
        }
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (!transcript && !submitted && failure instanceof LocalSpeechError) void report("issue", controller.signal).catch(() => {});
      const code = failure instanceof LocalSpeechError ? failure.code : "";
      if (code === "too-long" || code === "too-large") setError(ja ? "90秒以内・20 MB以下の音声を選んでください。" : "Choose an audio file up to 90 seconds and 20 MB.");
      else if (code === "decode") setError(ja ? "この音声を開けません。別のファイルを選ぶか、WAV 形式で保存し直してください。" : "This browser could not open the audio. Choose a different file or try exporting it as WAV.");
      else if (code) setError(ja ? "音声処理を完了できません。ネット接続を確認して再試行してください。" : "Speech processing did not finish. Check your connection and try again.");
      else setError(ja ? "まだ提出を完了できません。先生が課題を開始したか確認して、再試行してください。" : "The submission could not finish. Check that your teacher has opened the assignment and retry.");
    } finally {
      if (!controller.signal.aborted) { setBusy(false); setStage(""); }
    }
  };

  const alignment = !classroom && transcript ? alignSpeakingReading(passage.text, transcript.text) : undefined;
  const closed = sessionStatus === "ended" || sessionStatus === "expired";
  return <section aria-label={ja ? "音声ファイル" : "Recording"} className="speaking-reading-submission">
    <p>{classroom
      ? (ja ? "録音は端末に残ります。先生には文字起こしと仮評価が共有されます。" : "The recording stays on this device. Your teacher receives the transcript and provisional assessment.")
      : (ja ? "録音と練習結果はこの画面内だけで使われます。" : "The recording and practice feedback stay in this page.")}</p>
    {!submitted && <label>{ja ? "録音ファイルを選ぶ（90秒・20 MBまで）" : "Choose a recording (up to 90 seconds and 20 MB)"}
      <input type="file" accept="audio/*,.m4a,.mp4,.webm,.ogg" disabled={busy || closed || !!requestId.current}
        onChange={(event) => { setFile(event.target.files?.[0]); setPreview(""); setTranscript(undefined); setError(""); }} />
    </label>}
    {file && preview && <audio aria-label={ja ? "録音を確認" : "Preview recording"} src={preview} controls />}
    {classroom && sessionStatus === "ready" && <p role="status">{ja ? "先生が課題を開始すると提出できます。" : "You can submit when your teacher starts the assignment."}</p>}
    {classroom && sessionStatus === "paused" && <p role="status">{ja ? "先生が一時停止しました。" : "Your teacher paused the assignment."}</p>}
    {closed && !submitted && <p role="status">{ja ? "課題の受付が終了しました。" : "This assignment is closed."}</p>}
    {stage && <p role="status">{stage}</p>}
    {error && <p role="alert" className="speaking-error">{error}</p>}
    {(file || submitted) && <button type="button" className="speaking-primary-button" disabled={busy || !submitted && (closed || !!transcript && (!!classroom && sessionStatus !== "active" || !!alignment))}
      onClick={() => void process()}>
      {submitted ? (ja ? "結果を開く" : "Open result") : classroom && sessionStatus === "active" ? (ja ? "文字起こしを提出" : "Transcribe and submit") : (ja ? "端末で文字起こし" : "Transcribe on this device")}
    </button>}
    {alignment && <div>
      <h3>{ja ? "練習結果" : "Practice feedback"}</h3>
      <p>{ja ? "文字起こしの一致" : "Words matched by the transcript"} {alignment.matches}/{alignment.referenceWords}</p>
      <p lang="en">{transcript?.text}</p>
      <p>{ja ? "録音を聞いて、英文と違う箇所を確認しましょう。" : "Play back your recording and check where it differs from the passage."}</p>
    </div>}
  </section>;
}

