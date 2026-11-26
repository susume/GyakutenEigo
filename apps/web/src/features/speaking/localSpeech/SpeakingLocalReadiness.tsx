import { useEffect, useRef, useState } from "react";
import type { SpeakingLocalSpeechReadiness } from "@quizstrike/shared";
import { getApiUrl } from "../../../api/client";
import { useSiteTranslation } from "../../../ui/siteTranslation";
import { createSpeakingAudioRecorder } from "../speakingRecorder";
import { BrowserSpeechRecognizer, speakCheckRecognizer } from "./browserSpeech";
import { localSpeechMessage, readinessPhrase, speechWordErrorRate } from "./diagnostics";
import { defaultLocalSpeechModel, localSpeechModels, localSpeechRuntimeBytes, type LocalSpeechModel } from "./models";
import type { LocalSpeechBackend, LocalSpeechPreparation, LocalSpeechProgress, LocalTranscript } from "./protocol";

const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1);
const MAX_SAMPLE_SECONDS = 15;

type Props = {
  diagnostic?: boolean;
  report?: (status: SpeakingLocalSpeechReadiness, signal: AbortSignal) => Promise<unknown>;
  onReady?: () => void;
};

export default function SpeakingLocalReadiness({ diagnostic = false, report, onReady }: Props) {
  const { t } = useSiteTranslation();
  const [engine] = useState(() => diagnostic ? new BrowserSpeechRecognizer() : speakCheckRecognizer);
  const [model, setModel] = useState<LocalSpeechModel>(defaultLocalSpeechModel);
  const [preferredBackend, setPreferredBackend] = useState<LocalSpeechBackend>();
  const [preparation, setPreparation] = useState<LocalSpeechPreparation>();
  const [progress, setProgress] = useState<LocalSpeechProgress>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alternativeReported, setAlternativeReported] = useState(false);
  const [sample, setSample] = useState<Blob>();
  const [sampleUrl, setSampleUrl] = useState("");
  const [played, setPlayed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<LocalTranscript>();
  const [reference, setReference] = useState(readinessPhrase);
  const [serverConnected, setServerConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [storage, setStorage] = useState<number>();
  const task = useRef<AbortController | undefined>(undefined);
  const record = useRef<{ stop: () => void; cancel: () => void } | undefined>(undefined);

  useEffect(() => {
    return () => {
      task.current?.abort();
      record.current?.cancel();
      if (diagnostic) engine.dispose();
    };
  }, [diagnostic, engine]);

  useEffect(() => {
    if (!sample) return;
    const url = URL.createObjectURL(sample);
    setSampleUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sample]);

  useEffect(() => {
    let active = true;
    void navigator.storage?.estimate?.().then(({ quota, usage }) => {
      if (active && quota !== undefined && usage !== undefined) setStorage(Math.max(0, quota - usage));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const replaceSample = (audio: Blob) => {
    setSample(audio);
    setPlayed(false);
    setReady(false);
    setTranscript(undefined);
  };

  const prepare = async (cachedOnly = false) => {
    if (task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setReady(false);
    setAlternativeReported(false);
    setPreparation(undefined);
    setTranscript(undefined);
    setError("");
    setProgress(undefined);
    let downloading: Promise<unknown> | undefined;
    try {
      await report?.("preparing", controller.signal);
      const initialized = await engine.prepare({
        model,
        backend: diagnostic ? preferredBackend : "wasm",
        cachedOnly,
        signal: controller.signal,
        onProgress: (value) => {
          setProgress(value);
          if (value.stage === "download" && !downloading && report) {
            downloading = report("downloading", controller.signal).catch(() => undefined);
          }
        }
      });
      setPreparation(initialized);
      if (!initialized.modelCached && !diagnostic) {
        await downloading;
        await report?.("issue", controller.signal);
        setError("The browser could not keep the model. Free up storage or ask your teacher for help.");
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(localSpeechMessage(reason));
        await downloading;
        await report?.("issue", controller.signal).catch(() => undefined);
      }
    } finally {
      await downloading;
      if (task.current === controller) task.current = undefined;
      setBusy(false);
    }
  };

  const recordSample = async () => {
    if (recording || task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setError("");
    setReady(false);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      controller.signal.throwIfAborted();
      const { recorder } = createSpeakingAudioRecorder(stream);
      const chunks: Blob[] = [];
      let keep = true;
      const stop = () => { if (recorder.state === "recording") recorder.stop(); };
      const dispose = () => {
        clearTimeout(timeout);
        stream?.getTracks().forEach((track) => track.stop());
        record.current = undefined;
      };
      const timeout = setTimeout(stop, MAX_SAMPLE_SECONDS * 1_000);
      record.current = { stop, cancel: () => { keep = false; stop(); dispose(); } };
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      recorder.onstop = () => {
        dispose();
        if (keep) {
          setRecording(false);
          replaceSample(new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }));
        }
      };
      recorder.onerror = () => {
        keep = false;
        dispose();
        setRecording(false);
        setError("Check microphone permission and try recording again.");
      };
      recorder.start();
      setRecording(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (!controller.signal.aborted) {
        setError("Check microphone permission and try recording again.");
        await report?.("issue", controller.signal).catch(() => undefined);
      }
    } finally {
      task.current = undefined;
      setBusy(false);
    }
  };

  const check = async () => {
    if (!preparation || !sample || task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setError("");
    setServerConnected(false);
    setReady(false);
    setProgress({ stage: "processing" });
    try {
      const result = await engine.transcribe(sample, diagnostic ? 32 : MAX_SAMPLE_SECONDS + 1, { signal: controller.signal });
      setTranscript(result);
      const sampleMatched = result.status === "recognized" && (speechWordErrorRate(readinessPhrase, result.text) ?? 1) <= 0.5;
      const slow = result.inferenceMs > Math.max(6_000, result.durationMs * 2);
      if (report) {
        if (!sampleMatched) setError("We could not recognize the practice sentence. Check the recording and try again.");
        else if (slow) setError("This device may take too long to recognize speech. Ask your teacher about another way to take the activity.");
        await report(sampleMatched && !slow ? "ready" : slow ? "alternative" : "issue", controller.signal);
        setReady(sampleMatched && !slow);
      } else {
        const response = await fetch(`${getApiUrl()}/api/health`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]), cache: "no-store" }).catch(() => undefined);
        setServerConnected(response?.ok === true);
      }
      if (report) setServerConnected(true);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(localSpeechMessage(reason));
        await report?.("issue", controller.signal).catch(() => undefined);
      }
    } finally {
      if (task.current === controller) task.current = undefined;
      setProgress(undefined);
      setBusy(false);
    }
  };

  const wordErrorRate = transcript && speechWordErrorRate(reference, transcript.text);
  const canCheck = preparation && (diagnostic || preparation.modelCached) && sample && (diagnostic || played);
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return <>
    <h2>{t("On-device speech check")}</h2>
    <p>{t("Prepare before class. Your recording stays on this device. The conversation and feedback use the activity’s configured service.")}</p>
    {diagnostic && <>
      <label>{t("Speech model")}<select value={model} disabled={busy || recording} onChange={(event) => { setModel(event.target.value as LocalSpeechModel); setPreparation(undefined); setTranscript(undefined); }}>
        {Object.entries(localSpeechModels).map(([id, value]) => <option value={id} key={id}>{value.label}</option>)}
      </select></label>
      <label>{t("Processing backend")}<select value={preferredBackend ?? ""} disabled={busy || recording} onChange={(event) => { setPreferredBackend(event.target.value as LocalSpeechBackend || undefined); setPreparation(undefined); setTranscript(undefined); }}>
        <option value="">{t("Automatic")}</option><option value="wasm">WebAssembly (CPU)</option><option value="webgpu">WebGPU</option>
      </select></label>
    </>}
    <p>{t("Model {value0} MB · Runtime {value1} MB on first use", { value0: mb(localSpeechModels[model].bytes), value1: mb(localSpeechRuntimeBytes) })}</p>
    {storage !== undefined && <p>{t("Estimated browser storage available: {value0} MB", { value0: mb(storage) })}</p>}
    {diagnostic && deviceMemory !== undefined && <p>{t("Approximate device memory: {value0} GB", { value0: deviceMemory })}</p>}
    <div className="speaking-preflight-actions">
      <button type="button" className="speaking-outline-button" disabled={busy || recording} onClick={() => void prepare()}>{t(preparation ? "Check model again" : "Prepare speech model")}</button>
      {diagnostic && <button type="button" className="speaking-outline-button" disabled={busy || recording} onClick={() => { engine.dispose(); void prepare(true); }}>{t("Test cached startup")}</button>}
      {busy && <button type="button" className="speaking-text-button" onClick={() => task.current?.abort()}>{t("Cancel")}</button>}
    </div>
    <div role="status">
      {busy && !progress && t("Checking your device…")}
      {busy && progress?.stage === "loading" && t("Preparing the speech model…")}
      {busy && progress?.stage === "processing" && t("Checking on-device recognition…")}
      {busy && progress?.stage === "download" && t("Downloading the speech model · {value0} of {value1} MB", { value0: mb(progress.loaded), value1: mb(progress.total) })}
      {preparation && t("Model loaded · {value0} · {value1} ms", { value0: preparation.backend, value1: preparation.initMs })}
      {diagnostic && preparation && <p>{t("Model assets fetched: {value0} MB", { value0: mb(preparation.downloadedBytes) })}</p>}
    </div>
    {busy && progress?.stage === "download" && <progress aria-label={t("Downloading the speech model")} value={progress.loaded} max={progress.total} />}
    <p>{t("Record this sentence, then play your recording.")} <strong lang="en">{readinessPhrase}</strong></p>
    <button type="button" className="speaking-outline-button" disabled={busy} onClick={() => recording ? record.current?.stop() : void recordSample()}>{t(recording ? "Stop recording" : "Record a sample")}</button>
    {diagnostic && <>
      <label>{t("Or choose an audio file")}<input type="file" accept="audio/*,.mp4,.m4a,.ogg,.webm" disabled={busy || recording} onChange={(event) => { const file = event.target.files?.[0]; if (file) replaceSample(file); }} /></label>
      <label>{t("Reference transcript for measurement")}<input value={reference} disabled={busy} maxLength={1500} onChange={(event) => setReference(event.target.value)} /></label>
    </>}
    {sample && <audio aria-label={t("Sample playback")} controls src={sampleUrl} onPlay={() => setPlayed(true)} onError={() => {
      setPlayed(false);
      setError("This recording could not be opened. Record again or choose a different format.");
    }} />}
    <button type="button" className="speaking-outline-button" disabled={busy || recording || !canCheck} onClick={() => void check()}>{t(diagnostic ? "Run speech recognition" : "I heard it. Check recognition")}</button>
    {transcript && <div role="status"><p>{t("Recognition time: {value0} ms", { value0: transcript.inferenceMs })}</p>
      {diagnostic && <p>{t("Word error rate: {value0}", { value0: wordErrorRate === undefined ? "—" : `${Math.round(wordErrorRate * 100)}%` })}</p>}
      {diagnostic && transcript.text && <p lang="en">{transcript.text}</p>}
      <p>{t(serverConnected ? "Server connected" : "Server connection unconfirmed")}</p>
    </div>}
    {error && <p className="speaking-error" role="alert">{t(error)}</p>}
    {ready && <p role="status">{t("Ready to speak")}</p>}
    {onReady && <button type="button" className="speaking-primary-button" disabled={!ready || busy || recording} onClick={onReady}>{t("Continue to activity")}</button>}
    {report && !ready && <button type="button" className="speaking-text-button" disabled={busy || recording || alternativeReported} onClick={() => {
      const controller = new AbortController();
      task.current = controller;
      setBusy(true);
      void report("alternative", controller.signal).then(() => setAlternativeReported(true)).catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(localSpeechMessage(reason));
      }).finally(() => {
        if (task.current === controller) task.current = undefined;
        setBusy(false);
      });
    }}>{t("Tell my teacher I need another way")}</button>}
    {alternativeReported && <p role="status">{t("Your teacher has been notified in the class monitor.")}</p>}
  </>;
}
