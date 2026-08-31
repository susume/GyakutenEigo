import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copy,
  Edit3,
  HelpCircle,
  Languages,
  Lightbulb,
  LoaderCircle,
  Menu,
  MessageCircle,
  Mic,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Volume2,
  X
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  SPEAKING_DIFFICULTIES,
  SPEAKING_DIFFICULTY_LABELS,
  SPEAKING_IDENTIFIER_MODE_LABELS,
  SPEAKING_IDENTIFIER_MODES,
  SPEAKING_LIMITS,
  SPEAKING_LEVEL_LABELS,
  SPEAKING_LEVELS,
  SPEAKING_NATIVE_LANGUAGE_LABELS,
  SPEAKING_NATIVE_LANGUAGES,
  type SpeakingActivity,
  type SpeakingCreateActivityInput,
  type SpeakingDifficulty,
  type SpeakingEvaluation,
  type SpeakingIdentifierMode,
  type SpeakingLevel,
  type SpeakingNativeLanguage,
  type SpeakingParticipant,
  type SpeakingRubricCriterion,
  type SpeakingSession,
  type SpeakingTurn
} from "@quizstrike/shared";
import { ApiError, authApi, getTeacherToken, speakingApi } from "../../api/client";
import { SPEAKING_TEMPLATES, formatDuration, makeDemoEvaluation } from "./speakingData";
import { browserTtsProvider } from "./speakingProviders";
import { createSpeakingAudioActivityMonitor, createSpeakingAudioRecorder, type SpeakingAudioActivityMonitor } from "./speakingRecorder";
import "./speaking.css";

type SpeakingRoute =
  | { kind: "home" }
  | { kind: "join"; code?: string }
  | { kind: "session"; id: string }
  | { kind: "result"; id: string }
  | { kind: "teacher" }
  | { kind: "create" }
  | { kind: "activity"; id: string; results?: boolean }
  | { kind: "teacher-result"; id: string };

type SpeakingUiState = "ready" | "listening" | "thinking" | "ai-speaking";
type SpeakingVoiceState = "ready" | "ai_speaking" | "student_recording" | "transcribing" | "generating_response" | "paused" | "finishing" | "evaluating" | "completed" | "error";
type Navigate = (nextPath: string) => void;

type JoinResponse = { activity: SpeakingActivity; participant: SpeakingParticipant; session: SpeakingSession; token: string };
type SessionResponse = { activity: SpeakingActivity; participant: SpeakingParticipant; session: SpeakingSession; turns: SpeakingTurn[] };
type ResultResponse = { result: { activity: Pick<SpeakingActivity, "id" | "title" | "scenario" | "targetExpressions" | "nativeLanguage" | "rubric">; session: SpeakingSession; participant: SpeakingParticipant; turns: SpeakingTurn[]; evaluation?: SpeakingEvaluation } };
type SessionResultsResponse = { activity: SpeakingActivity; session: SpeakingSession; items: Array<{ participant: SpeakingParticipant; status: SpeakingParticipant["status"]; durationSeconds: number; overallScore?: number; helpCount: number; evaluation?: SpeakingEvaluation }> };

const TEACHER_RETURN_KEY = "quizstrike_speaking_teacher_return";

const normalizePath = (path: string) => (path === "/" ? path : path.replace(/\/$/u, ""));

const parseRoute = (path: string): SpeakingRoute => {
  const segments = normalizePath(path).split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (segments.length <= 1) return { kind: "home" };
  if (segments[1] === "join") return { kind: "join", ...(segments[2] ? { code: segments[2].toUpperCase() } : {}) };
  if (segments[1] === "session" && segments[2]) return { kind: "session", id: segments[2] };
  if (segments[1] === "result" && segments[2]) return { kind: "result", id: segments[2] };
  if (segments[1] === "teacher" && segments[2] === "create") return { kind: "create" };
  if (segments[1] === "teacher" && segments[2] === "activity" && segments[3]) return { kind: "activity", id: segments[3], results: segments[4] === "results" };
  if (segments[1] === "teacher" && segments[2] === "result" && segments[3]) return { kind: "teacher-result", id: segments[3] };
  if (segments[1] === "teacher") return { kind: "teacher" };
  return { kind: "home" };
};

const isTeacherRoute = (route: SpeakingRoute) => route.kind === "teacher" || route.kind === "create" || route.kind === "activity" || route.kind === "teacher-result";

const getErrorMessage = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;

const saveJoinCredentials = (payload: JoinResponse) => {
  sessionStorage.setItem(`speaking-token:${payload.session.id}`, payload.token);
  sessionStorage.setItem(`speaking-participant-token:${payload.participant.id}`, payload.token);
  sessionStorage.setItem("speaking-current-session", JSON.stringify({ sessionId: payload.session.id, participantId: payload.participant.id }));
};

const tokenForSession = (sessionId: string) => sessionStorage.getItem(`speaking-token:${sessionId}`) ?? "";

export default function SpeakingPracticeApp() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const route = parseRoute(path);
  const requiresTeacher = isTeacherRoute(route);
  const [teacherAuth, setTeacherAuth] = useState<"idle" | "loading" | "ready" | "redirecting">("idle");

  const navigate = useCallback<Navigate>((nextPath) => {
    const target = new URL(nextPath, window.location.origin);
    const targetPath = `${normalizePath(target.pathname)}${target.search}${target.hash}`;
    window.history.pushState(null, "", targetPath);
    setPath(normalizePath(target.pathname));
  }, []);

  useEffect(() => {
    document.body.dataset.speaking = "true";
    document.title = "Speaking Practice · GyakutenEigo";
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => {
      delete document.body.dataset.speaking;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!requiresTeacher) {
      setTeacherAuth("idle");
      return;
    }
    if (!getTeacherToken()) {
      sessionStorage.setItem(TEACHER_RETURN_KEY, `${window.location.pathname}${window.location.search}`);
      setTeacherAuth("redirecting");
      window.history.pushState(null, "", "/quiz-strike/teacher/home");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    let cancelled = false;
    setTeacherAuth("loading");
    void authApi.me().then(() => {
      if (!cancelled) setTeacherAuth("ready");
    }).catch(() => {
      if (cancelled) return;
      localStorage.removeItem("quizstrike_token");
      sessionStorage.setItem(TEACHER_RETURN_KEY, `${window.location.pathname}${window.location.search}`);
      setTeacherAuth("redirecting");
      window.history.pushState(null, "", "/quiz-strike/teacher/home");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    return () => { cancelled = true; };
  }, [path, requiresTeacher]);

  if (requiresTeacher && teacherAuth !== "ready") return <div className="speaking-empty-page"><LoaderCircle size={34} className="speaking-spin" aria-hidden="true" /><h1>{teacherAuth === "redirecting" ? "Opening teacher login" : "Checking teacher account"}</h1><p>Your existing GyakutenEigo teacher account protects classroom activities and results.</p></div>;

  return (
    <div className="speaking-app" id="main-content" tabIndex={-1}>
      {route.kind === "home" && <SpeakingHome navigate={navigate} />}
      {route.kind === "join" && <SpeakingJoinPage navigate={navigate} initialCode={route.code} />}
      {route.kind === "session" && <SpeakingSessionPage navigate={navigate} sessionId={route.id} />}
      {route.kind === "result" && <SpeakingResultPage navigate={navigate} participantId={route.id} />}
      {route.kind === "teacher" && <SpeakingTeacherDashboard navigate={navigate} />}
      {route.kind === "create" && <SpeakingCreatePage navigate={navigate} />}
      {route.kind === "activity" && <SpeakingActivityPage navigate={navigate} activityId={route.id} results={route.results === true} />}
      {route.kind === "teacher-result" && <SpeakingTeacherResultPage navigate={navigate} participantId={route.id} />}
    </div>
  );
}

function SpeakingBrand({ navigate, compact = false }: { navigate: Navigate; compact?: boolean }) {
  return <button className={`speaking-brand${compact ? " speaking-brand-compact" : ""}`} type="button" onClick={() => navigate("/speak")} aria-label="GyakutenEigo Speaking Practice home"><span className="speaking-brand-mark"><MessageCircle size={compact ? 22 : 28} strokeWidth={2.2} aria-hidden="true" /></span><span className="speaking-brand-name">GyakutenEigo</span></button>;
}

function SpeakingTopbar({ navigate, active = "home", teacher = false }: { navigate: Navigate; active?: "home" | "join" | "teacher"; teacher?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className={`speaking-topbar${teacher ? " speaking-topbar-teacher" : ""}`}><SpeakingBrand navigate={navigate} compact /><nav id="speaking-navigation" className={`speaking-topbar-actions${menuOpen ? " is-open" : ""}`} aria-label="Speaking Practice navigation"><button type="button" className={active === "home" ? "is-active" : ""} onClick={() => navigate("/speak")}><Sparkles size={16} aria-hidden="true" />Practice</button><button type="button" className={active === "join" ? "is-active" : ""} onClick={() => navigate("/speak/join")}><ScanLine size={16} aria-hidden="true" />Join activity</button><button type="button" className={active === "teacher" ? "is-active" : ""} onClick={() => navigate("/speak/teacher")}><UserRound size={16} aria-hidden="true" />Teacher tools</button></nav><button className="speaking-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="speaking-navigation" onClick={() => setMenuOpen((open) => !open)}><Menu size={20} aria-hidden="true" /><span>Menu</span></button></header>;
}

function SpeakingHome({ navigate }: { navigate: Navigate }) {
  const [demoState, setDemoState] = useState<SpeakingState>("ai-speaking");
  const [demoHelp, setDemoHelp] = useState(false);
  const [selectedPhrase, setSelectedPhrase] = useState<string>();
  const timeoutIds = useRef<number[]>([]);
  const clearDemoTimers = () => timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
  useEffect(() => () => clearDemoTimers(), []);
  const playDemoTurn = () => {
    clearDemoTimers();
    if (demoState === "thinking" || demoState === "listening") return;
    setDemoState("listening");
    timeoutIds.current.push(window.setTimeout(() => setDemoState("thinking"), 900));
    timeoutIds.current.push(window.setTimeout(() => setDemoState("ai-speaking"), 2_100));
  };
  const demoActivity = SPEAKING_TEMPLATES[1]!;
  const demoTurns: SpeakingTurn[] = [{ id: "preview-ai", participantId: "preview", speaker: "ai", text: "Hi! Can I help you today?", createdAt: new Date().toISOString() }];
  return <div className="speaking-home-page"><header className="speaking-hero-header"><SpeakingBrand navigate={navigate} /><div className="speaking-hero-title-block"><h1>Speaking Practice</h1><p>話す力を、未来のチカラに。<br /><span>AIとのリアルな会話で、英語がもっと身近に。</span></p></div><div className="speaking-hero-header-actions"><button type="button" className="speaking-outline-button" onClick={() => navigate("/speak/join")}><ScanLine size={17} aria-hidden="true" />Join</button><button type="button" className="speaking-primary-button" onClick={() => navigate("/speak/teacher/create")}><Edit3 size={17} aria-hidden="true" />Create Activity</button></div></header><main className="speaking-showcase" aria-label="Speaking Practice product preview"><section className="speaking-device" aria-label="Student speaking experience preview"><div className="speaking-device-camera" aria-hidden="true" /><div className="speaking-device-screen"><SpeakingScreen activity={demoActivity} state={demoState} remainingSeconds={222} turns={demoTurns} transcriptPreview={demoState === "listening" ? "You: listening…" : "You: …"} onMic={playDemoTurn} onHelp={() => setDemoHelp(true)} onFinish={() => undefined} onPhraseClick={setSelectedPhrase} preview /></div></section><aside className="speaking-teacher-rail" aria-label="Teacher tools preview"><p className="speaking-rail-label">先生用ツール（プレビュー）</p><TeacherPreviewCard navigate={navigate} /><ResultPreviewCard navigate={navigate} /></aside></main><section className="speaking-feature-strip" aria-label="Speaking Practice features"><FeatureItem icon={<Volume2 size={28} aria-hidden="true" />} title="音声中心の学習体験" detail="タップして話すだけの\nシンプル操作" /><FeatureItem icon={<MessageCircle size={28} aria-hidden="true" />} title="AIパートナーとの対話" detail="自然な会話で、何度でも\n練習できる" /><FeatureItem icon={<BarChart3 size={28} aria-hidden="true" />} title="学習データで成長を可視化" detail="ルーブリック評価で、強みと\n課題がわかる" /><FeatureItem icon={<Users size={28} aria-hidden="true" />} title="先生の授業をもっと便利に" detail="簡単作成・QRで招待・評価で、\n指導をサポート" /></section>{selectedPhrase && <div className="speaking-toast" role="status"><Lightbulb size={17} aria-hidden="true" /><span>Try saying “{selectedPhrase}”</span><button type="button" onClick={() => setSelectedPhrase(undefined)} aria-label="Close phrase tip"><X size={15} aria-hidden="true" /></button></div>}{demoHelp && <HelpDialog activity={demoActivity} onClose={() => setDemoHelp(false)} helpText="相手の質問に、短い英語で答えてみよう。" english={demoActivity.targetExpressions[0]} preview />}</div>;
}

function FeatureItem({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <div className="speaking-feature-item"><span className="speaking-feature-icon">{icon}</span><div><strong>{title}</strong><span>{detail}</span></div></div>; }

interface SpeakingScreenProps { activity: SpeakingActivity; state: SpeakingUiState; remainingSeconds: number; turns: SpeakingTurn[]; transcriptPreview?: string; onMic: () => void; onHelp: () => void; onFinish: () => void; onPhraseClick?: (phrase: string) => void; disabled?: boolean; finishDisabled?: boolean; preview?: boolean; }
const stateLabels: Record<SpeakingUiState, string> = { ready: "Ready", listening: "Listening", thinking: "Thinking", "ai-speaking": "AI Speaking" };
const stateDescriptions: Record<SpeakingUiState, string> = { ready: "Your turn — tap the microphone when you are ready.", listening: "Listening… tap again when you finish.", thinking: "I’m thinking about what you said…", "ai-speaking": "Listen to your speaking partner." };

function SpeakingScreen({ activity, state, remainingSeconds, turns, transcriptPreview, onMic, onHelp, onFinish, onPhraseClick, disabled = false, finishDisabled = false, preview = false }: SpeakingScreenProps) {
  const currentAiTurn = [...turns].reverse().find((turn) => turn.speaker === "ai");
  const sentence = state === "listening" ? "Your turn" : state === "thinking" ? "Let me think…" : currentAiTurn?.text ?? "Hi! Can I help you today?";
  const durationProgress = Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, activity.durationSeconds)) * 100));
  const micLabel = state === "listening" ? "Stop speaking" : state === "thinking" ? "Processing your answer" : "Tap to speak";
  return <div className={`speaking-screen speaking-screen-${state}${preview ? " speaking-screen-preview" : ""}`}><header className="speaking-screen-header"><div className="speaking-screen-title"><button className="speaking-screen-menu" type="button" aria-label="Open speaking menu"><Menu size={22} aria-hidden="true" /></button><span>Speaking Practice</span></div><div className="speaking-screen-activity"><ShoppingBag size={19} aria-hidden="true" /><strong>{activity.title}</strong></div><div className="speaking-screen-timer"><Clock3 size={17} aria-hidden="true" /><span>{formatDuration(remainingSeconds)} left</span><span className="speaking-progress"><span style={{ width: `${durationProgress}%` }} /></span><button type="button" onClick={onFinish} disabled={finishDisabled && !preview}>Finish</button></div></header><div className="speaking-screen-body"><aside className="speaking-scenario-card"><ShoppingBag size={37} strokeWidth={1.6} aria-hidden="true" /><div><span className="speaking-card-kicker">Scenario</span><p>{activity.scenario}</p></div></aside><section className="speaking-partner-panel" aria-label="AI speaking partner"><div className="speaking-partner-avatar-wrap"><img src="/assets/speaking/ai-shop-assistant.png" alt="AI shop assistant" /></div><p className="speaking-partner-role">AI Partner: {activity.aiRole}</p><div className="speaking-speech-bubble"><Volume2 size={30} aria-hidden="true" /><span>{sentence}</span></div><p className="speaking-state-description" aria-live="polite">{stateDescriptions[state]}</p><div className="speaking-state-list" aria-label="Speaking state">{(Object.keys(stateLabels) as SpeakingUiState[]).map((item) => <span key={item} className={item === state ? "is-active" : ""}><span className="speaking-state-dot" aria-hidden="true">{item === state ? <CircleCheck size={15} /> : item === "thinking" ? <LoaderCircle size={15} /> : <span />}</span>{stateLabels[item]}</span>)}</div></section><aside className="speaking-useful-card"><div className="speaking-useful-heading"><strong>Useful English</strong><Bookmark size={19} aria-hidden="true" /></div><div className="speaking-expression-list">{activity.targetExpressions.slice(0, 5).map((expression) => <button type="button" key={expression} onClick={() => onPhraseClick?.(expression)} disabled={disabled && !preview}><MessageCircle size={17} aria-hidden="true" /><span>{expression}</span></button>)}</div></aside></div><footer className="speaking-screen-footer"><div className="speaking-transcript-preview"><span>Transcript <small>{preview ? "(preview)" : "(live)"}</small></span><p><strong>AI:</strong> {currentAiTurn?.text ?? "Hi! Can I help you today?"}</p><p><strong>You:</strong> {transcriptPreview ?? "…"}</p></div><div className="speaking-mic-wrap"><button className={`speaking-mic speaking-mic-${state}`} type="button" onClick={onMic} disabled={disabled || state === "thinking"} aria-label={micLabel}><Mic size={53} strokeWidth={1.9} aria-hidden="true" /></button><span className="speaking-mic-label">{state === "listening" ? "Listening…" : state === "thinking" ? "Thinking…" : "Tap to Speak"}</span></div><button type="button" className="speaking-help-button" onClick={onHelp} disabled={disabled}><Lightbulb size={20} aria-hidden="true" /><span>Help</span></button></footer></div>;
}

function TeacherPreviewCard({ navigate }: { navigate: Navigate }) { const [name, setName] = useState("Shopping for Clothes"); return <section className="speaking-rail-card speaking-create-preview"><div className="speaking-rail-card-heading"><Edit3 size={20} aria-hidden="true" /><strong>Create Activity</strong></div><label>Activity Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>AI Role<div className="speaking-select-wrap"><select defaultValue="Shop Assistant"><option>Shop Assistant</option><option>Restaurant worker</option><option>Helpful local</option></select><ChevronDown size={15} aria-hidden="true" /></div></label><label>Student Role<div className="speaking-select-wrap"><select defaultValue="Customer"><option>Customer</option><option>Student</option><option>Visitor</option></select><ChevronDown size={15} aria-hidden="true" /></div></label><label>Target English<textarea defaultValue="Asking about items, sizes, and prices" rows={2} /></label><div className="speaking-rubric-mini"><span>Rubric (4 Skills)</span>{["Communication", "Interaction", "Vocabulary", "Grammar"].map((criterion, index) => <div key={criterion}><strong>{criterion}</strong><span className="speaking-stars" aria-label={`${4 - (index === 3 ? 1 : 0)} out of 4 stars`}>{[0, 1, 2, 3].map((star) => <Star key={star} size={15} fill={star < (index === 3 ? 3 : 4) ? "currentColor" : "none"} aria-hidden="true" />)}</span></div>)}</div><div className="speaking-share-mini"><div><span>QR preview</span><QRCodeSVG value={`${window.location.origin}/speak/join/ABC123`} size={69} bgColor="#ffffff" fgColor="#12214b" level="M" /></div><div className="speaking-code-mini"><small>Example code</small><strong>ABC123</strong><Copy size={16} aria-hidden="true" /></div></div><button className="speaking-rail-link" type="button" onClick={() => navigate("/speak/teacher/create")}>Open activity builder <ArrowRight size={15} aria-hidden="true" /></button></section>; }

function ResultPreviewCard({ navigate }: { navigate: Navigate }) { const evaluation = makeDemoEvaluation("preview-participant"); return <section className="speaking-rail-card speaking-result-preview"><div className="speaking-result-heading"><strong>学習結果 (サマリー)</strong><button type="button" onClick={() => navigate("/speak")}>Preview</button></div><div className="speaking-student-summary"><span className="speaking-student-avatar"><UserRound size={22} aria-hidden="true" /></span><div><strong>Example learner</strong><small>Preview only</small></div><b>{scoreFor(evaluation)}<small>点</small></b></div><div className="speaking-mini-result-body"><div className="speaking-mini-score-list">{["Communication", "Interaction", "Vocabulary", "Grammar"].map((criterion, index) => <div key={criterion}><span>{criterion}</span><span className="speaking-stars">{[0, 1, 2, 3].map((star) => <Star key={star} size={12} fill={star < (index === 3 ? 3 : 4) ? "currentColor" : "none"} aria-hidden="true" />)}</span></div>)}</div><div className="speaking-feedback-note"><strong>Preview result</strong><span>Example data is shown only on this home-page preview.</span></div></div></section>; }

function SpeakingJoinPage({ navigate, initialCode }: { navigate: Navigate; initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState<JoinResponse>();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setJoining(true);
    try {
      const payload = await speakingApi.join(code, identifier.trim() || undefined) as JoinResponse;
      saveJoinCredentials(payload);
      setJoined(payload);
    } catch (joinError) {
      setError(getErrorMessage(joinError, "このクラスルームに参加できませんでした。コードを確認してください。"));
    } finally { setJoining(false); }
  };
  if (joined) return <SpeakingPreActivityPage navigate={navigate} joined={joined} />;
  return <div className="speaking-page-shell speaking-join-page"><SpeakingTopbar navigate={navigate} active="join" /><main className="speaking-join-layout"><section className="speaking-join-copy"><span className="speaking-eyebrow"><ScanLine size={15} aria-hidden="true" /> Student entry</span><h1>Ready to speak?</h1><p>Enter the session code from your teacher. You do not need an account.</p><div className="speaking-join-proof"><CircleCheck size={17} aria-hidden="true" /><span>Private classroom session</span><CircleCheck size={17} aria-hidden="true" /><span>Short speaking practice</span></div></section><form className="speaking-form-card" onSubmit={submit}><div className="speaking-form-heading"><span>Join a classroom</span><h2>Enter session code</h2><p>Ask your teacher if you do not have the code.</p></div><label htmlFor="speaking-activity-code">Session code<input id="speaking-activity-code" className="speaking-code-input" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setError(""); }} placeholder="ABC123" autoComplete="off" maxLength={6} /></label><label htmlFor="speaking-identifier">Nickname or student number <small>(if requested by your teacher)</small><input id="speaking-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="e.g. Hana" maxLength={80} /></label>{error && <p className="speaking-error" role="alert">{error}</p>}<button className="speaking-primary-button speaking-wide-button" type="submit" disabled={joining || code.length !== 6}>{joining ? <><LoaderCircle size={18} className="speaking-spin" aria-hidden="true" />Joining…</> : <><ArrowRight size={18} aria-hidden="true" />Join session</>}</button><p className="speaking-privacy-note"><ShieldIcon /><span>Your teacher sees your activity result, not a permanent profile.</span></p></form></main><div className="speaking-join-footer"><button type="button" className="speaking-text-button" onClick={() => navigate("/speak")}><ArrowLeft size={16} aria-hidden="true" />Back to Speaking Practice</button></div></div>;
}

function ShieldIcon() { return <span className="speaking-privacy-dot" aria-hidden="true"><CircleCheck size={14} /></span>; }

function SpeakingPreActivityPage({ navigate, joined }: { navigate: Navigate; joined: JoinResponse }) {
  const [micState, setMicState] = useState<"idle" | "requesting" | "denied" | "unsupported" | "waiting">("idle");
  const [error, setError] = useState("");
  const startSession = async () => {
    setError("");
    try {
      await speakingApi.startParticipant(joined.session.id, joined.token);
      navigate(`/speak/session/${joined.session.id}`);
    } catch (startError) {
      const message = getErrorMessage(startError, "The activity is not ready yet.");
      if (startError instanceof ApiError && startError.status === 409 && /waiting/i.test(message)) {
        setMicState("waiting");
        navigate(`/speak/session/${joined.session.id}`);
      } else setError(message);
    }
  };
  const requestMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMicState("unsupported"); return; }
    setMicState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      sessionStorage.setItem("speaking-microphone-ready", "true");
      await startSession();
    } catch { setMicState("denied"); }
  };
  return <div className="speaking-page-shell speaking-preactivity-page"><SpeakingTopbar navigate={navigate} /><main className="speaking-preactivity-layout"><section className="speaking-preactivity-hero"><span className="speaking-eyebrow"><ShoppingBag size={15} aria-hidden="true" /> Before you start</span><h1>{joined.activity.title}</h1><p>{joined.activity.scenario}</p><div className="speaking-role-pills"><span>You are: <strong>{joined.activity.studentRole}</strong></span><span>Talk to: <strong>{joined.activity.aiRole}</strong></span><span><Clock3 size={14} aria-hidden="true" /> {formatDuration(joined.activity.durationSeconds)}</span></div></section><section className="speaking-prep-card"><div className="speaking-prep-card-heading"><div><span className="speaking-card-kicker">Useful English</span><h2>A few phrases to try</h2></div><Bookmark size={20} aria-hidden="true" /></div><div className="speaking-prep-expressions">{joined.activity.targetExpressions.map((expression) => <div key={expression}><MessageCircle size={17} aria-hidden="true" /><span>{expression}</span></div>)}</div><div className="speaking-mic-explanation"><span className="speaking-mic-explanation-icon"><Mic size={22} aria-hidden="true" /></span><div><strong>We need your microphone</strong><p>So you can talk to the AI. We do not save your recording by default.</p></div></div>{error && <div className="speaking-error speaking-prep-error" role="alert"><strong>{error}</strong><button type="button" className="speaking-outline-button" onClick={() => setError("")}>Try again</button></div>}{micState === "denied" && <div className="speaking-error speaking-prep-error" role="alert"><strong>Microphone permission was not available.</strong><span>Try again, then return to the waiting room if needed.</span><div><button type="button" className="speaking-outline-button" onClick={() => setMicState("idle")}>Try again</button><button type="button" className="speaking-primary-button" onClick={() => navigate(`/speak/session/${joined.session.id}`)}>Continue</button></div></div>}{micState === "unsupported" && <div className="speaking-error speaking-prep-error" role="alert"><strong>This browser cannot record a microphone.</strong><span>Use a current Chrome, Edge, or Safari browser on a secure connection.</span><button type="button" className="speaking-primary-button" onClick={() => navigate(`/speak/session/${joined.session.id}`)}>Continue to session</button></div>}{micState === "waiting" && <p className="speaking-session-note" role="status">Waiting for your teacher to start the activity.</p>}{micState === "requesting" ? <button type="button" className="speaking-primary-button speaking-wide-button" disabled><LoaderCircle size={18} className="speaking-spin" aria-hidden="true" />Checking microphone…</button> : micState === "idle" && <button type="button" className="speaking-primary-button speaking-wide-button" onClick={requestMicrophone}><Mic size={18} aria-hidden="true" />Start Speaking</button>}</section></main></div>;
}

function SpeakingSessionPage({ navigate, sessionId }: { navigate: Navigate; sessionId: string }) {
  const token = tokenForSession(sessionId);
  const [data, setData] = useState<SessionResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) { setLoading(false); setError("This student session is not available on this browser. Please join again with your teacher’s code."); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await speakingApi.session(sessionId, token) as SessionResponse;
        if (!cancelled) { setData(next); setError(""); }
      } catch (loadError) { if (!cancelled) setError(getErrorMessage(loadError, "This speaking session is no longer available.")); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 2_500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [sessionId, token]);
  if (loading) return <div className="speaking-empty-page"><LoaderCircle size={34} className="speaking-spin" aria-hidden="true" /><h1>Opening your session</h1><p>Getting the classroom conversation ready…</p></div>;
  if (!data) return <div className="speaking-empty-page"><CircleCheck size={38} aria-hidden="true" /><h1>Session unavailable</h1><p>{error}</p><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}>Join another activity</button></div>;
  return <SpeakingSessionExperience navigate={navigate} token={token} initialData={data} />;
}

function SpeakingSessionExperience({ navigate, token, initialData }: { navigate: Navigate; token: string; initialData: SessionResponse }) {
  const [data, setData] = useState(initialData);
  const [voiceState, setVoiceState] = useState<SpeakingVoiceState>("ready");
  const [remaining, setRemaining] = useState(initialData.participant.startedAt ? Math.max(0, initialData.activity.durationSeconds - Math.floor((Date.now() - Date.parse(initialData.participant.startedAt)) / 1_000)) : initialData.activity.durationSeconds);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpHint, setHelpHint] = useState("");
  const [helpEnglish, setHelpEnglish] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const [error, setError] = useState("");
  const [micNotice, setMicNotice] = useState("");
  const recorderRef = useRef<{ recorder: MediaRecorder; stream: MediaStream; timeoutId: number; requestId: string; activityMonitor: SpeakingAudioActivityMonitor } | undefined>(undefined);
  const recordingStartRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const lastAudioRef = useRef<Blob | undefined>(undefined);
  const lastRequestIdRef = useRef<string | undefined>(undefined);
  const lastSpeechDetectedRef = useRef<boolean | undefined>(undefined);
  const greetingSpokenRef = useRef(false);
  const finishRef = useRef<() => void>(() => undefined);
  const dataRef = useRef(data);
  dataRef.current = data;

  const refresh = useCallback(async () => {
    try {
      const next = await speakingApi.session(initialData.session.id, token) as SessionResponse;
      setData(next);
      if (next.session.status === "paused" && voiceState === "student_recording") setVoiceState("paused");
      if (next.session.status === "active" && voiceState === "paused") setVoiceState("ready");
    } catch { /* The current UI retains its last trustworthy state during a short poll failure. */ }
  }, [initialData.session.id, token, voiceState]);

  useEffect(() => {
    const interval = window.setInterval(() => { void refresh(); }, 2_500);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const greeting = data.turns.find((turn) => turn.speaker === "ai");
    const key = `speaking-greeting:${data.session.id}`;
    if (greeting && !sessionStorage.getItem(key) && !greetingSpokenRef.current) {
      greetingSpokenRef.current = true;
      setVoiceState("ai_speaking");
      void browserTtsProvider.speak(greeting.text, { lang: "en-US", rate: data.activity.level === "beginner" ? 0.82 : 0.92 }).finally(() => {
        sessionStorage.setItem(key, "spoken");
        if (dataRef.current.session.status === "active" || dataRef.current.session.status === "ready") setVoiceState("ready");
      });
    }
  }, [data.session.id, data.activity.level, data.turns]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = dataRef.current;
      const nextRemaining = current.participant.startedAt ? Math.max(0, current.activity.durationSeconds - Math.floor((Date.now() - Date.parse(current.participant.startedAt)) / 1_000)) : current.activity.durationSeconds;
      setRemaining(nextRemaining);
      if (nextRemaining <= 0 && current.participant.startedAt && current.session.status === "active" && voiceState === "ready") finishRef.current();
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [voiceState]);

  const cleanupRecorder = () => {
    const current = recorderRef.current;
    if (current) {
      window.clearTimeout(current.timeoutId);
      current.activityMonitor.dispose();
      current.stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = undefined;
    }
    chunksRef.current = [];
  };

  const submitRecording = useCallback(async (audio: Blob, requestId: string, speechDetected?: boolean) => {
    lastAudioRef.current = audio;
    lastRequestIdRef.current = requestId;
    lastSpeechDetectedRef.current = speechDetected;
    setVoiceState("transcribing");
    setError("");
    try {
      setVoiceState("generating_response");
      const response = await speakingApi.turn(dataRef.current.session.id, token, { audio, requestId, speechDetected }) as { studentTurn: SpeakingTurn; aiTurn: SpeakingTurn; session: SpeakingSession };
      setData((current) => ({ ...current, participant: { ...current.participant, status: "in_progress" }, session: response.session, turns: [...current.turns, response.studentTurn, response.aiTurn] }));
      setVoiceState("ai_speaking");
      await browserTtsProvider.speak(response.aiTurn.text, { lang: "en-US", rate: dataRef.current.activity.level === "beginner" ? 0.82 : 0.92 });
      if (dataRef.current.session.status === "paused") setVoiceState("paused"); else setVoiceState("ready");
    } catch (turnError) {
      if (turnError instanceof ApiError && turnError.status === 422) {
        setMicNotice(turnError.message);
        setVoiceState("ready");
      } else if (turnError instanceof ApiError && turnError.status === 409 && /paused/i.test(turnError.message)) {
        setVoiceState("paused");
        setError(turnError.message);
      } else {
        setError(getErrorMessage(turnError, "I couldn't hear that clearly. Please try again."));
        setVoiceState("error");
      }
    }
  }, [token]);

  const stopRecording = useCallback(() => {
    const current = recorderRef.current;
    if (!current || current.recorder.state !== "recording") return;
    current.recorder.stop();
  }, []);

  const startRecording = async () => {
    if (voiceState !== "ready" || dataRef.current.session.status !== "active" || recordingStartRef.current || recorderRef.current) return;
    recordingStartRef.current = true;
    setMicNotice("");
    setError("");
    browserTtsProvider.cancel();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { recordingStartRef.current = false; setError("This browser cannot record audio. Try a current Chrome, Edge, or Safari browser."); setVoiceState("error"); return; }
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorder, mimeType } = createSpeakingAudioRecorder(stream);
      const activityMonitor = createSpeakingAudioActivityMonitor(stream);
      const requestId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const speechDetected = activityMonitor.getSpeechDetected();
        const blob = new Blob(chunksRef.current, { type: mimeType || recorder.mimeType || "audio/webm" });
        recordingStartRef.current = false;
        cleanupRecorder();
        void submitRecording(blob, requestId, speechDetected);
      };
      const timeoutId = window.setTimeout(() => { setMicNotice(`The ${SPEAKING_LIMITS.maxTurnSeconds}-second speaking limit was reached.`); stopRecording(); }, SPEAKING_LIMITS.maxTurnSeconds * 1_000);
      recorderRef.current = { recorder, stream, timeoutId, requestId, activityMonitor };
      recorder.start();
      setVoiceState("student_recording");
    } catch (recordError) {
      recordingStartRef.current = false;
      if (recorderRef.current) cleanupRecorder();
      else stream?.getTracks().forEach((track) => track.stop());
      setError(recordError instanceof DOMException && recordError.name === "NotAllowedError" ? "Microphone permission was denied. Please allow microphone access and try again." : "I couldn't start the microphone. Please try again.");
      setVoiceState("error");
    }
  };

  const onMic = () => {
    if (voiceState === "student_recording") stopRecording();
    else if (voiceState === "ready") void startRecording();
  };

  const onHelp = async () => {
    if (helpLoading || voiceState !== "ready" || data.session.status !== "active") return;
    setHelpLoading(true);
    try {
      const help = await speakingApi.help(data.session.id, token) as { hint: string; english: string };
      setHelpHint(help.hint);
      setHelpEnglish(help.english);
      setHelpOpen(true);
      setData((current) => ({ ...current, participant: { ...current.participant, helpCount: current.participant.helpCount + 1 } }));
    } catch (helpError) { setError(getErrorMessage(helpError, "Help is temporarily unavailable. Please try again.")); }
    finally { setHelpLoading(false); }
  };

  const finish = useCallback(async () => {
    if (["finishing", "evaluating", "completed", "ai_speaking", "student_recording", "transcribing", "generating_response"].includes(voiceState)) return;
    setVoiceState("finishing");
    setError("");
    browserTtsProvider.cancel();
    try {
      await speakingApi.finish(dataRef.current.session.id, token);
      setVoiceState("completed");
      navigate(`/speak/result/${dataRef.current.participant.id}`);
    } catch (finishError) {
      setError(getErrorMessage(finishError, "結果を作成できませんでした。もう一度お試しください。"));
      setVoiceState("error");
    }
  }, [navigate, token, voiceState]);
  finishRef.current = () => { void finish(); };

  const retry = () => { if (lastAudioRef.current && lastRequestIdRef.current) void submitRecording(lastAudioRef.current, lastRequestIdRef.current, lastSpeechDetectedRef.current); };
  useEffect(() => () => { cleanupRecorder(); browserTtsProvider.cancel(); }, []);

  const waiting = data.session.status === "ready";
  const paused = data.session.status === "paused" || voiceState === "paused";
  const ended = data.session.status === "ended" || data.session.status === "expired";
  const controlsDisabled = waiting || paused || ended || voiceState !== "ready" && voiceState !== "student_recording";
  const uiState: SpeakingUiState = voiceState === "student_recording" ? "listening" : voiceState === "ai_speaking" ? "ai-speaking" : ["transcribing", "generating_response", "finishing", "evaluating", "error"].includes(voiceState) ? "thinking" : "ready";
  const latestStudent = [...data.turns].reverse().find((turn) => turn.speaker === "student");
  return <div className="speaking-session-page"><SpeakingTopbar navigate={navigate} active="home" /><main className="speaking-session-main">{waiting && <div className="speaking-session-note" role="status"><Clock3 size={16} aria-hidden="true" /><span>You’re ready! Waiting for your teacher to start the activity.</span></div>}{paused && <div className="speaking-session-alert" role="alert"><HelpCircle size={18} aria-hidden="true" /><span>Your teacher paused the activity.</span></div>}{ended && <div className="speaking-session-alert" role="alert"><HelpCircle size={18} aria-hidden="true" /><span>This activity has ended. You can still finish and view your result if you already joined.</span></div>}{error && <div className="speaking-session-alert" role="alert"><HelpCircle size={18} aria-hidden="true" /><span>{error}</span>{voiceState === "error" && lastAudioRef.current && <button type="button" onClick={retry}>Retry</button>}<button type="button" onClick={() => setError("")} aria-label="Close error"><X size={15} aria-hidden="true" /></button></div>}{micNotice && <div className="speaking-session-note" role="status"><Mic size={16} aria-hidden="true" /><span>{micNotice}</span></div>}<SpeakingScreen activity={data.activity} state={uiState} remainingSeconds={remaining} turns={data.turns} transcriptPreview={latestStudent?.text ?? "…"} onMic={onMic} onHelp={onHelp} onFinish={() => void finish()} onPhraseClick={(phrase) => { setHelpHint("Try this phrase in your own sentence."); setHelpEnglish(phrase); setHelpOpen(true); }} disabled={controlsDisabled || helpLoading} finishDisabled={waiting || ["finishing", "evaluating", "completed"].includes(voiceState)} /></main>{helpOpen && <HelpDialog activity={data.activity} onClose={() => setHelpOpen(false)} helpText={helpHint} english={helpEnglish} />}</div>;
}

function HelpDialog({ activity, onClose, helpText, english, preview = false }: { activity: SpeakingActivity; onClose: () => void; helpText?: string; english?: string; preview?: boolean }) { const phrase = english || activity.targetExpressions[0] || "Could you say that again, please?"; return <div className="speaking-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="speaking-help-dialog" role="dialog" aria-modal="true" aria-labelledby="speaking-help-title"><button type="button" className="speaking-dialog-close" onClick={onClose} aria-label="Close help"><X size={18} aria-hidden="true" /></button><span className="speaking-help-dialog-icon"><Lightbulb size={25} aria-hidden="true" /></span><span className="speaking-card-kicker">Help</span><h2 id="speaking-help-title">You can try this:</h2>{helpText && <p className="speaking-help-copy">{helpText}</p>}<p className="speaking-help-phrase">{phrase}</p><p className="speaking-help-copy">{preview ? "Preview only — real Help is generated for the current classroom conversation." : "自分の言葉で大丈夫です。短い文でも、ゆっくりでも伝わります。"}</p><button type="button" className="speaking-primary-button" onClick={onClose}>Got it</button></section></div>; }

function MissingSpeakingSession({ navigate, message = "This practice session may have ended or expired." }: { navigate: Navigate; message?: string }) { return <div className="speaking-empty-page"><CircleCheck size={38} aria-hidden="true" /><h1>Session not found</h1><p>{message}</p><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}>Join another activity</button></div>; }

function SpeakingResultPage({ navigate, participantId }: { navigate: Navigate; participantId: string }) {
  const [result, setResult] = useState<ResultResponse["result"]>();
  const [error, setError] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem(`speaking-participant-token:${participantId}`) ?? undefined;
    void speakingApi.result(participantId, token).then((payload) => setResult((payload as ResultResponse).result)).catch((loadError) => setError(getErrorMessage(loadError, "The result is not available yet.")));
  }, [participantId]);
  if (!result && !error) return <div className="speaking-empty-page"><LoaderCircle size={34} className="speaking-spin" aria-hidden="true" /><h1>Preparing your result</h1><p>Your real conversation is being evaluated…</p></div>;
  if (!result) return <MissingSpeakingSession navigate={navigate} message={error} />;
  const hasSpeech = hasStudentSpeech(result.turns);
  return <div className="speaking-page-shell speaking-result-page"><SpeakingTopbar navigate={navigate} /><main className="speaking-result-layout"><section className="speaking-result-hero"><span className="speaking-eyebrow"><Trophy size={15} aria-hidden="true" />{hasSpeech ? "Activity complete" : "No speech detected"}</span><h1>{hasSpeech ? "よくできました！" : "もう一度話してみよう"}</h1><p>{hasSpeech ? `${result.activity.title} の会話が終わりました。` : "声が聞こえなかったため、会話は始まりませんでした。"}</p>{result.evaluation ? <div className="speaking-result-score"><strong>{scoreFor(result.evaluation)}</strong><span>点</span><small>今日のスピーキング</small></div> : <div className="speaking-result-score"><strong>—</strong><small>Evaluation unavailable</small></div>}</section>{result.evaluation ? <ResultPanel activity={result.activity} turns={result.turns} evaluation={result.evaluation} teacherView={false} /> : <div className="speaking-empty-card"><h2>Evaluation unavailable</h2><p>Your transcript is saved, but the evaluation provider did not return a result. Please ask your teacher to try again.</p></div>}<div className="speaking-result-actions"><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}><RotateCcw size={17} aria-hidden="true" />Try another activity</button><button className="speaking-text-button" type="button" onClick={() => navigate("/speak")}><ArrowLeft size={16} aria-hidden="true" />Speaking Practice home</button></div></main></div>;
}

const hasStudentSpeech = (turns: SpeakingTurn[]) => turns.some((turn) => turn.speaker === "student" && turn.text.trim().length > 0);
const scoreFor = (evaluation?: SpeakingEvaluation) => { if (!evaluation) return undefined; const scores = Object.values(evaluation.scores); return scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / (scores.length * 4)) * 100) : 0; };
const scoreForCriterion = (evaluation: SpeakingEvaluation, criterionId: string) => evaluation.scores[criterionId] ?? 0;

function ResultPanel({ activity, turns, evaluation, teacherView }: { activity: Pick<SpeakingActivity, "title" | "rubric" | "targetExpressions" | "nativeLanguage">; turns: SpeakingTurn[]; evaluation: SpeakingEvaluation; teacherView: boolean }) {
  const studentTurns = turns.filter((turn) => turn.speaker === "student");
  return <section className={`speaking-result-panel${teacherView ? " speaking-result-panel-teacher" : ""}`}><div className="speaking-result-panel-heading"><div><span className="speaking-card-kicker">{teacherView ? "Evaluation detail" : "Your speaking result"}</span><h2>{teacherView ? activity.title : "今回の結果"}</h2></div><span className="speaking-result-language"><Languages size={15} aria-hidden="true" />{evaluation.language === "ja" ? "日本語フィードバック" : "English feedback"}</span></div><div className="speaking-score-grid">{activity.rubric.filter((criterion) => criterion.enabled).map((criterion) => <div className="speaking-score-row" key={criterion.id}><div><strong>{criterion.name === "Fluency / Comprehensibility" ? "Fluency" : criterion.name}</strong>{teacherView && <small>{evaluation.evidence[criterion.id] ?? criterion.description}</small>}</div><span className="speaking-stars" aria-label={`${scoreForCriterion(evaluation, criterion.id)} out of 4 stars`}>{[1, 2, 3, 4].map((star) => <Star key={star} size={17} fill={star <= scoreForCriterion(evaluation, criterion.id) ? "currentColor" : "none"} aria-hidden="true" />)}<b>{scoreForCriterion(evaluation, criterion.id)}/4</b></span></div>)}</div><div className="speaking-result-columns"><div className="speaking-result-message speaking-result-message-good"><h3>👍 What You Did Well</h3><ul>{evaluation.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul></div><div className="speaking-result-message"><h3>🚀 Try This Next Time</h3><ul>{evaluation.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}</ul></div></div><div className="speaking-useful-result"><div className="speaking-result-section-heading"><h3>💬 Useful English</h3><span>{studentTurns.length} speaking turns</span></div>{evaluation.usefulEnglish.length ? evaluation.usefulEnglish.map((item) => <div className="speaking-correction-row" key={`${item.said}-${item.try}`}><div><small>You said</small><span>“{item.said}”</span></div><ArrowRight size={17} aria-hidden="true" /><div><small>Try</small><strong>“{item.try}”</strong></div></div>) : <p className="speaking-muted-copy">{hasStudentSpeech(turns) ? "Your conversation was saved for your teacher’s review." : "No speech was detected in this attempt."}</p>}</div>{teacherView && <div className="speaking-transcript-detail"><div className="speaking-result-section-heading"><h3>Transcript</h3><span>Conversation evidence</span></div>{turns.map((turn) => <p key={turn.id}><strong>{turn.speaker === "ai" ? "AI" : "Student"}</strong><span>{turn.text}</span></p>)}</div>}</section>;
}

function SpeakingTeacherDashboard({ navigate }: { navigate: Navigate }) {
  const [activities, setActivities] = useState<SpeakingActivity[]>([]);
  const [sessions, setSessions] = useState<Record<string, SpeakingSession[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const payload = await speakingApi.activities() as { items: SpeakingActivity[] };
      setActivities(payload.items);
      const pairs = await Promise.all(payload.items.map(async (activity) => [activity.id, ((await speakingApi.sessions(activity.id)) as { sessions: SpeakingSession[] }).sessions] as const));
      setSessions(Object.fromEntries(pairs));
    } catch (loadError) { setError(getErrorMessage(loadError, "Teacher activities could not be loaded.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const sessionCount = Object.values(sessions).reduce((sum, items) => sum + items.length, 0);
  if (loading) return <TeacherLoading />;
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="home" /><section className="speaking-teacher-content"><div className="speaking-teacher-heading"><div><span className="speaking-eyebrow"><UserRound size={15} aria-hidden="true" /> Teacher workspace</span><h1>Speaking Practice</h1><p>Create a focused activity, launch one classroom session, and see how your students communicated.</p></div><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/teacher/create")}><Plus size={18} aria-hidden="true" />Create Activity</button></div>{error && <p className="speaking-error" role="alert">{error}</p>}<section className="speaking-teacher-stats"><div><span>Activities</span><strong>{activities.length}</strong><small>reusable lessons</small></div><div><span>Sessions launched</span><strong>{sessionCount}</strong><small>classroom runs</small></div><div><span>Active now</span><strong>{Object.values(sessions).flat().filter((session) => session.status === "active").length}</strong><small>live classrooms</small></div></section><div className="speaking-section-title"><div><span className="speaking-card-kicker">Your activities</span><h2>Keep practice moving</h2></div><button className="speaking-text-button" type="button" onClick={() => navigate("/speak/teacher/create")}>New activity <ArrowRight size={15} aria-hidden="true" /></button></div>{activities.length ? <div className="speaking-activity-list">{activities.map((activity) => <TeacherActivityRow key={activity.id} activity={activity} sessions={sessions[activity.id] ?? []} navigate={navigate} />)}</div> : <div className="speaking-empty-card"><Edit3 size={30} aria-hidden="true" /><h2>Create your first activity</h2><p>Save a reusable conversation, then launch it for a classroom.</p><button type="button" className="speaking-primary-button" onClick={() => navigate("/speak/teacher/create")}>Create activity</button></div>}</section></main></div>;
}

function TeacherLoading() { return <div className="speaking-empty-page"><LoaderCircle size={34} className="speaking-spin" aria-hidden="true" /><h1>Loading teacher workspace</h1><p>Getting your real Speaking Practice activities…</p></div>; }

function SpeakingTeacherSidebar({ navigate, active }: { navigate: Navigate; active: "home" | "create" | "results" }) { return <aside className="speaking-teacher-sidebar"><div className="speaking-sidebar-label">Workspace</div><button type="button" className={active === "home" ? "is-active" : ""} onClick={() => navigate("/speak/teacher")}><BarChart3 size={17} aria-hidden="true" />Overview</button><button type="button" className={active === "create" ? "is-active" : ""} onClick={() => navigate("/speak/teacher/create")}><Edit3 size={17} aria-hidden="true" />Create Activity</button><button type="button" className={active === "results" ? "is-active" : ""} onClick={() => navigate("/speak/teacher")}><Trophy size={17} aria-hidden="true" />Results</button><div className="speaking-sidebar-divider" /><div className="speaking-sidebar-note"><ShieldIcon /><span>Real classroom data is stored on the server.<br />Templates and preview data stay separate.</span></div></aside>; }

function TeacherActivityRow({ activity, sessions, navigate }: { activity: SpeakingActivity; sessions: SpeakingSession[]; navigate: Navigate }) { const latest = sessions[0]; return <article className="speaking-activity-row"><div className="speaking-activity-row-icon"><ShoppingBag size={21} aria-hidden="true" /></div><div className="speaking-activity-row-main"><div><strong>{activity.title}</strong><span>{activity.aiRole} · {SPEAKING_LEVEL_LABELS[activity.level]}</span></div><p>{activity.scenario}</p></div><div className="speaking-activity-row-meta"><span className={`speaking-status-pill speaking-status-${latest?.status ?? "ready"}`}>{latest ? latest.status === "active" ? "Active" : latest.status === "paused" ? "Paused" : latest.status === "ended" ? "Ended" : "Ready" : "Not launched"}</span><span>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>{latest && <code>{latest.joinCode}</code>}</div><div className="speaking-activity-row-actions"><button type="button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)} aria-label={`Open ${activity.title}`}><ChevronRight size={18} aria-hidden="true" /></button></div></article>; }

const draftFromTemplate = (template: SpeakingActivity): SpeakingCreateActivityInput => ({ title: template.title, scenario: template.scenario, aiRole: template.aiRole, studentRole: template.studentRole, level: template.level, difficulty: template.difficulty, nativeLanguage: template.nativeLanguage, durationSeconds: template.durationSeconds, identifierMode: template.identifierMode, targetExpressions: [...template.targetExpressions], rubric: template.rubric.map((criterion) => ({ ...criterion })) });
const SPEAKING_DURATION_PRESETS = [120, 180, 300, 420] as const;

function SpeakingDurationField({ value, onChange }: { value: number; onChange: (value: number) => void }) { const isCustom = !SPEAKING_DURATION_PRESETS.includes(value as (typeof SPEAKING_DURATION_PRESETS)[number]); return <label>Speaking time<select value={isCustom ? "custom" : String(value)} onChange={(event) => onChange(event.target.value === "custom" ? (isCustom ? value : 240) : Number(event.target.value))}><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option><option value={420}>7 minutes</option><option value="custom">Custom</option></select>{isCustom && <div className="speaking-custom-duration"><input type="number" min={2} max={7} step={1} value={Math.round(value / 60)} onChange={(event) => { const minutes = Number(event.target.value); onChange((Number.isFinite(minutes) ? Math.min(7, Math.max(2, Math.round(minutes))) : 2) * 60); }} aria-label="Custom speaking time in minutes" /><span>minutes</span></div>}</label>; }

function SpeakingCreatePage({ navigate }: { navigate: Navigate }) {
  const [draft, setDraft] = useState<SpeakingCreateActivityInput>(() => draftFromTemplate(SPEAKING_TEMPLATES[1]!));
  const [newExpression, setNewExpression] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof SpeakingCreateActivityInput>(key: K, value: SpeakingCreateActivityInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const updateCriterion = (index: number, patch: Partial<SpeakingRubricCriterion>) => update("rubric", draft.rubric.map((criterion, candidateIndex) => candidateIndex === index ? { ...criterion, ...patch } : criterion));
  const addExpression = () => { if (!newExpression.trim() || draft.targetExpressions.length >= 12) return; update("targetExpressions", [...draft.targetExpressions, newExpression.trim()]); setNewExpression(""); };
  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.scenario.trim()) { setFormError("Activity name and speaking situation are required."); return; }
    if (!draft.rubric.some((criterion) => criterion.enabled)) { setFormError("Choose at least one rubric skill."); return; }
    setSaving(true);
    try { const payload = await speakingApi.createActivity(draft) as { activity: SpeakingActivity }; navigate(`/speak/teacher/activity/${payload.activity.id}`); }
    catch (createError) { setFormError(getErrorMessage(createError, "The activity could not be saved. Please try again.")); }
    finally { setSaving(false); }
  };
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="create" /><form className="speaking-builder" onSubmit={handleCreate}><div className="speaking-builder-header"><div><span className="speaking-eyebrow"><Edit3 size={15} aria-hidden="true" /> Activity builder</span><h1>Create an activity</h1><p>Set the situation first. The AI will stay in character while students practice.</p></div><div className="speaking-builder-header-actions"><button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher")}><ArrowLeft size={15} aria-hidden="true" />Back</button><button type="submit" className="speaking-primary-button" disabled={saving}>{saving ? <LoaderCircle size={17} className="speaking-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}Create activity</button></div></div><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Start with a template</span><h2>Pick a familiar conversation</h2></div><span className="speaking-builder-step">01 / 04</span></div><div className="speaking-template-grid">{SPEAKING_TEMPLATES.map((template) => <button type="button" className={`speaking-template-card${draft.title === template.title ? " is-selected" : ""}`} key={template.id} onClick={() => setDraft(draftFromTemplate(template))}><span className="speaking-template-icon"><ShoppingBag size={19} aria-hidden="true" /></span><span><strong>{template.title}</strong><small>{SPEAKING_LEVEL_LABELS[template.level]} · {SPEAKING_DIFFICULTY_LABELS[template.difficulty]}</small></span>{draft.title === template.title && <Check size={16} aria-hidden="true" />}</button>)}</div></section><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">The conversation</span><h2>Give students a clear situation</h2></div><span className="speaking-builder-step">02 / 04</span></div><div className="speaking-builder-form-grid"><label>Activity name<input value={draft.title} onChange={(event) => update("title", event.target.value)} /></label><label>AI role<input value={draft.aiRole} onChange={(event) => update("aiRole", event.target.value)} /></label><label>Student role<input value={draft.studentRole} onChange={(event) => update("studentRole", event.target.value)} /></label><label className="speaking-span-2">Speaking situation<textarea value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} rows={3} /></label></div></section><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Target English</span><h2>Phrases the AI can bring into the conversation</h2></div><span className="speaking-builder-step">03 / 04</span></div><div className="speaking-expression-editor">{draft.targetExpressions.map((expression, index) => <div className="speaking-expression-chip" key={`${expression}-${index}`}><MessageCircle size={16} aria-hidden="true" /><input value={expression} onChange={(event) => update("targetExpressions", draft.targetExpressions.map((item, candidateIndex) => candidateIndex === index ? event.target.value : item))} /><button type="button" onClick={() => update("targetExpressions", draft.targetExpressions.filter((_, candidateIndex) => candidateIndex !== index))} aria-label={`Remove ${expression}`}><X size={15} aria-hidden="true" /></button></div>)}<div className="speaking-add-expression"><input value={newExpression} onChange={(event) => setNewExpression(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addExpression(); } }} placeholder="Add an expression" /><button type="button" className="speaking-outline-button" onClick={addExpression}><Plus size={16} aria-hidden="true" />Add</button></div></div></section><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Activity settings</span><h2>Set the right amount of support</h2></div><span className="speaking-builder-step">04 / 04</span></div><div className="speaking-settings-grid"><label>Student level<select value={draft.level} onChange={(event) => update("level", event.target.value as SpeakingLevel)}>{SPEAKING_LEVELS.map((level) => <option key={level} value={level}>{SPEAKING_LEVEL_LABELS[level]}</option>)}</select></label><label>AI difficulty<select value={draft.difficulty} onChange={(event) => update("difficulty", event.target.value as SpeakingDifficulty)}>{SPEAKING_DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{SPEAKING_DIFFICULTY_LABELS[difficulty]}</option>)}</select></label><SpeakingDurationField value={draft.durationSeconds} onChange={(value) => update("durationSeconds", value)} /><label>Feedback language<select value={draft.nativeLanguage} onChange={(event) => update("nativeLanguage", event.target.value as SpeakingNativeLanguage)}>{SPEAKING_NATIVE_LANGUAGES.map((language) => <option key={language} value={language}>{SPEAKING_NATIVE_LANGUAGE_LABELS[language]}</option>)}</select></label><label>Student identification<select value={draft.identifierMode} onChange={(event) => update("identifierMode", event.target.value as SpeakingIdentifierMode)}>{SPEAKING_IDENTIFIER_MODES.map((mode) => <option key={mode} value={mode}>{SPEAKING_IDENTIFIER_MODE_LABELS[mode]}</option>)}</select></label></div><div className="speaking-rubric-editor-heading"><div><span className="speaking-card-kicker">Editable rubric</span><p>Keep the skills that matter for this activity. Pronunciation scoring is not included.</p></div><button type="button" className="speaking-outline-button" onClick={() => update("rubric", [...draft.rubric, { id: `custom-${Date.now()}`, name: "New skill", description: "What should students show?", enabled: true }])}><Plus size={16} aria-hidden="true" />Add criterion</button></div><div className="speaking-rubric-editor">{draft.rubric.map((criterion, index) => <div className={`speaking-rubric-row${criterion.enabled ? " is-enabled" : ""}`} key={criterion.id}><label className="speaking-rubric-toggle"><input type="checkbox" checked={criterion.enabled} onChange={(event) => updateCriterion(index, { enabled: event.target.checked })} /><span>{criterion.enabled ? "On" : "Off"}</span></label><div><input aria-label={`${criterion.name} name`} value={criterion.name} onChange={(event) => updateCriterion(index, { name: event.target.value })} /><textarea aria-label={`${criterion.name} description`} rows={2} value={criterion.description} onChange={(event) => updateCriterion(index, { description: event.target.value })} /></div><button type="button" className="speaking-icon-button speaking-danger-icon" onClick={() => update("rubric", draft.rubric.filter((_, candidateIndex) => candidateIndex !== index))} aria-label={`Remove ${criterion.name}`}><Trash2 size={16} aria-hidden="true" /></button></div>)}</div></section>{formError && <p className="speaking-error speaking-builder-error" role="alert">{formError}</p>}<div className="speaking-builder-footer"><p><ShieldIcon /><span>Activities are saved to your teacher workspace. Classroom join codes are created only when you launch a session.</span></p><button type="submit" className="speaking-primary-button" disabled={saving}><Check size={17} aria-hidden="true" />Create activity</button></div></form></main></div>;
}

function SpeakingActivityPage({ navigate, activityId, results }: { navigate: Navigate; activityId: string; results: boolean }) {
  if (results) return <SpeakingResultsPage navigate={navigate} activityId={activityId} />;
  return <SpeakingActivityDetailPage navigate={navigate} activityId={activityId} />;
}

function SpeakingActivityDetailPage({ navigate, activityId }: { navigate: Navigate; activityId: string }) {
  const [activity, setActivity] = useState<SpeakingActivity>();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [activityPayload, sessionPayload] = await Promise.all([speakingApi.activity(activityId), speakingApi.sessions(activityId)]); setActivity((activityPayload as { activity: SpeakingActivity }).activity); setSessions((sessionPayload as { sessions: SpeakingSession[] }).sessions); } catch (loadError) { setError(getErrorMessage(loadError, "This activity could not be loaded.")); } }, [activityId]);
  useEffect(() => { void load(); }, [load]);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  if (!activity) return error ? <MissingSpeakingSession navigate={navigate} message={error} /> : <TeacherLoading />;
  const latest = sessions[0];
  const shareable = Boolean(latest && ["ready", "active", "paused"].includes(latest.status));
  const shareUrl = shareable ? `${window.location.origin}/speak/join/${latest!.joinCode}` : "";
  const run = async (action: () => Promise<unknown>) => { setWorking(true); setError(""); try { await action(); await load(); } catch (actionError) { setError(getErrorMessage(actionError, "The classroom session could not be updated.")); } finally { setWorking(false); } };
  const copyShareUrl = async () => { if (!shareUrl) return; try { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2_000); } catch { setCopied(false); } };
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="home" /><section className="speaking-share-page"><button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher")}><ArrowLeft size={16} aria-hidden="true" />All activities</button><div className="speaking-share-header"><div><span className="speaking-eyebrow"><Check size={15} aria-hidden="true" /> {latest ? "Classroom session" : "Reusable activity"}</span><h1>{activity.title}</h1><p>{activity.scenario}</p></div><span className={`speaking-status-pill speaking-status-${latest?.status ?? "ready"}`}>{latest ? latest.status : "Ready to launch"}</span></div>{error && <p className="speaking-error" role="alert">{error}</p>}<div className="speaking-share-grid"><section className="speaking-share-card speaking-share-code-card">{shareable ? <><div><span className="speaking-card-kicker">参加コード / QRコード</span><h2>{latest!.status === "ready" ? "Session ready" : "Share with your class"}</h2><p>Scan the QR code or enter this short code at <strong>/speak/join</strong>.</p></div><div className="speaking-share-visual"><QRCodeSVG value={shareUrl} size={172} bgColor="#ffffff" fgColor="#12214b" level="M" /><div className="speaking-join-code-block"><small>Session code</small><strong>{latest!.joinCode}</strong><button type="button" onClick={copyShareUrl} aria-label="Copy join URL">{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</button></div></div><div className="speaking-share-link"><span>{shareUrl}</span><button className="speaking-outline-button" type="button" onClick={copyShareUrl}>{copied ? "Copied" : "Copy link"}</button></div></> : <><div><span className="speaking-card-kicker">{latest ? "Launch a new classroom run" : "Launch a classroom run"}</span><h2>{latest ? "Ready for another class?" : "Ready when you are"}</h2><p>Launching creates a new secure session code. This activity itself stays reusable.</p></div><button type="button" className="speaking-primary-button" disabled={working} onClick={() => void run(() => speakingApi.launchSession(activity.id))}><Play size={17} aria-hidden="true" />Launch session</button></>}</section><section className="speaking-share-card"><div className="speaking-share-card-heading"><span className="speaking-card-kicker">Activity setup</span><button type="button" className="speaking-icon-button" onClick={() => navigate("/speak/teacher/create")} aria-label="Create another activity"><Pencil size={16} aria-hidden="true" /></button></div><dl className="speaking-activity-facts"><div><dt>AI role</dt><dd>{activity.aiRole}</dd></div><div><dt>Student role</dt><dd>{activity.studentRole}</dd></div><div><dt>Level</dt><dd>{SPEAKING_LEVEL_LABELS[activity.level]}</dd></div><div><dt>Difficulty</dt><dd>{SPEAKING_DIFFICULTY_LABELS[activity.difficulty]}</dd></div><div><dt>Speaking time</dt><dd>{formatDuration(activity.durationSeconds)}</dd></div><div><dt>Feedback</dt><dd>{SPEAKING_NATIVE_LANGUAGE_LABELS[activity.nativeLanguage]}</dd></div></dl><div className="speaking-share-targets"><span>Target English</span><div>{activity.targetExpressions.map((expression) => <span key={expression}>{expression}</span>)}</div></div></section></div><div className="speaking-share-actions">{latest && latest.status === "ready" && <button type="button" className="speaking-primary-button" disabled={working} onClick={() => void run(() => speakingApi.startSession(latest.id))}>Start session</button>}{latest && latest.status === "active" && <button type="button" className="speaking-outline-button" disabled={working} onClick={() => void run(() => speakingApi.pauseSession(latest.id))}>Pause session</button>}{latest && latest.status === "paused" && <button type="button" className="speaking-primary-button" disabled={working} onClick={() => void run(() => speakingApi.resumeSession(latest.id))}>Resume session</button>}{latest && ["ready", "active", "paused"].includes(latest.status) && <button type="button" className="speaking-outline-button" disabled={working} onClick={() => void run(() => speakingApi.endSession(latest.id))}>End session</button>}{latest && <button type="button" className="speaking-primary-button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}/results?sessionId=${encodeURIComponent(latest.id)}`)}><Trophy size={17} aria-hidden="true" />View results</button>}</div>{sessions.length > 1 && <section className="speaking-share-card speaking-previous-sessions"><div className="speaking-share-card-heading"><span className="speaking-card-kicker">Previous sessions</span></div>{sessions.slice(1).map((session) => <button className="speaking-results-table-row" type="button" key={session.id} onClick={() => navigate(`/speak/teacher/activity/${activity.id}/results?sessionId=${encodeURIComponent(session.id)}`)}><span>{new Date(session.createdAt).toLocaleString()}</span><code>{session.joinCode}</code><span className={`speaking-status-pill speaking-status-${session.status}`}>{session.status}</span><ChevronRight size={18} aria-hidden="true" /></button>)}</section>}</section></main></div>;
}

function SpeakingResultsPage({ navigate, activityId }: { navigate: Navigate; activityId: string }) {
  const [activity, setActivity] = useState<SpeakingActivity>();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [sessionId, setSessionId] = useState(() => new URLSearchParams(window.location.search).get("sessionId") ?? "");
  const [payload, setPayload] = useState<SessionResultsResponse>();
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([speakingApi.activity(activityId), speakingApi.sessions(activityId)]).then(([activityPayload, sessionsPayload]) => { const nextActivity = (activityPayload as { activity: SpeakingActivity }).activity; const nextSessions = (sessionsPayload as { sessions: SpeakingSession[] }).sessions; setActivity(nextActivity); setSessions(nextSessions); setSessionId((current) => current || nextSessions[0]?.id || ""); }).catch((loadError) => setError(getErrorMessage(loadError, "Results could not be loaded."))); }, [activityId]);
  useEffect(() => { if (!sessionId) return; void speakingApi.sessionResults(sessionId).then((next) => setPayload(next as SessionResultsResponse)).catch((loadError) => setError(getErrorMessage(loadError, "Results could not be loaded."))); }, [sessionId]);
  if (error && !activity) return <MissingSpeakingSession navigate={navigate} message={error} />;
  if (!activity || !payload) return <TeacherLoading />;
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="results" /><section className="speaking-teacher-content"><button type="button" className="speaking-text-button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}><ArrowLeft size={16} aria-hidden="true" />{activity.title}</button><div className="speaking-teacher-heading speaking-results-heading"><div><span className="speaking-eyebrow"><Trophy size={15} aria-hidden="true" /> Learning results</span><h1>See who found their voice</h1><p>Results are scoped to one launched classroom session.</p></div><select aria-label="Select classroom session" value={sessionId} onChange={(event) => { setSessionId(event.target.value); window.history.replaceState(null, "", `/speak/teacher/activity/${activity.id}/results?sessionId=${encodeURIComponent(event.target.value)}`); }}>{sessions.map((session) => <option key={session.id} value={session.id}>{new Date(session.createdAt).toLocaleString()} · {session.joinCode}</option>)}</select></div>{error && <p className="speaking-error" role="alert">{error}</p>}{payload.items.length ? <div className="speaking-results-table"><div className="speaking-results-table-head"><span>Participant</span><span>Status</span><span>Overall</span><span>Support</span><span /></div>{payload.items.map((item) => <button type="button" className="speaking-results-table-row" key={item.participant.id} onClick={() => navigate(`/speak/teacher/result/${item.participant.id}`)}><span className="speaking-participant-cell"><span className="speaking-student-avatar"><UserRound size={19} aria-hidden="true" /></span><strong>{item.participant.displayIdentifier ?? "Anonymous student"}</strong></span><span><span className={`speaking-status-pill speaking-status-${item.status}`}>{item.status === "completed" ? "Completed" : item.status === "error" ? "Evaluation unavailable" : "In progress"}</span></span><span className="speaking-table-score">{item.overallScore === undefined ? "—" : <>{item.overallScore}<small>/100</small></>}</span><span className="speaking-table-help"><Lightbulb size={15} aria-hidden="true" />{item.helpCount}</span><span><ChevronRight size={18} aria-hidden="true" /></span></button>)}</div> : <div className="speaking-empty-card"><Users size={32} aria-hidden="true" /><h2>No students yet</h2><p>Share {payload.session.joinCode} to invite the first practice session.</p><button type="button" className="speaking-primary-button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}>Show session code</button></div>}</section></main></div>;
}

function SpeakingTeacherResultPage({ navigate, participantId }: { navigate: Navigate; participantId: string }) {
  const [result, setResult] = useState<ResultResponse["result"]>();
  const [error, setError] = useState("");
  useEffect(() => { void speakingApi.result(participantId).then((payload) => setResult((payload as ResultResponse).result)).catch((loadError) => setError(getErrorMessage(loadError, "This student result could not be loaded."))); }, [participantId]);
  if (!result && !error) return <TeacherLoading />;
  if (!result) return <MissingSpeakingSession navigate={navigate} message={error} />;
  const evaluation = result.evaluation;
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="results" /><section className="speaking-teacher-content"><button type="button" className="speaking-text-button" onClick={() => navigate(`/speak/teacher/activity/${result.activity.id}/results?sessionId=${encodeURIComponent(result.session.id)}`)}><ArrowLeft size={16} aria-hidden="true" />Back to results</button><div className="speaking-teacher-heading speaking-detail-heading"><div><span className="speaking-eyebrow"><UserRound size={15} aria-hidden="true" /> Student detail</span><h1>{result.participant.displayIdentifier ?? "Anonymous student"}</h1><p>{result.activity.title} · {result.turns.filter((turn) => turn.speaker === "student").length} speaking turns · {result.participant.helpCount} Help uses</p></div><span className="speaking-detail-score"><strong>{evaluation ? scoreFor(evaluation) : "—"}</strong>{evaluation && <small>/100</small>}</span></div>{evaluation ? <ResultPanel activity={result.activity} turns={result.turns} evaluation={evaluation} teacherView /> : <div className="speaking-empty-card"><h2>Evaluation unavailable</h2><p>The participant’s transcript remains available, but no trustworthy evaluation is stored.</p><div className="speaking-transcript-detail">{result.turns.map((turn) => <p key={turn.id}><strong>{turn.speaker === "ai" ? "AI" : "Student"}</strong><span>{turn.text}</span></p>)}</div></div>}</section></main></div>;
}

type SpeakingState = SpeakingUiState;
