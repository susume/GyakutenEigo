import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copy,
  Edit3,
  HelpCircle,
  Lightbulb,
  LoaderCircle,
  Menu,
  MessageCircle,
  Mic,
  PencilLine,
  RotateCcw,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Users,
  Volume2,
  X
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  SPEAKING_LIMITS,
  speakingFeedbackCopy,
  speakingScenarioResources,
  speakingRemainingSeconds,
  type SpeakingActivity,
  type SpeakingEvaluation,
  type SpeakingParticipant,
  type SpeakingSession,
  type SpeakingTurn
} from "@quizstrike/shared";
import { ApiError, speakingApi } from "../../api/client";
import { isSpeakingTeacherRoute } from "../../navigation";
import { SPEAKING_TEMPLATES, formatDuration, makeDemoEvaluation } from "./speakingData";
import { browserTtsProvider } from "./speakingProviders";
import { testSpeakingMicrophone } from "./speakingPreflight";
import { cancelSpeakingAudioCapture, createSpeakingAudioActivityMonitor, createSpeakingAudioRecorder, disposeSpeakingAudioCapture, stopSpeakingAudioCapture, type SpeakingAudioCapture } from "./speakingRecorder";
import { hasStudentSpeech, ResultPanel, scoreFor } from "./SpeakingResultPanel";
import { mergeSpeakingTurns, nextSpeakingPollDelay, shouldAcceptSpeakingRevision, speakingTimerReference } from "./speakingLifecycle";
import "./speaking.css";

type SpeakingRoute =
  | { kind: "home" }
  | { kind: "join"; code?: string }
  | { kind: "session"; id: string }
  | { kind: "result"; id: string };

type SpeakingUiState = "ready" | "listening" | "thinking" | "ai-speaking";
type SpeakingVoiceState = "ready" | "ai_speaking" | "student_recording" | "processing" | "paused" | "finishing" | "evaluating" | "completed" | "error";
type Navigate = (nextPath: string) => void;

type JoinResponse = { activity: SpeakingActivity; participant: SpeakingParticipant; session: SpeakingSession; token: string };
type SessionResponse = { activity: SpeakingActivity; participant: SpeakingParticipant; session: SpeakingSession; turns: SpeakingTurn[] };
type ResultResponse = { result: { activity: Pick<SpeakingActivity, "id" | "title" | "scenario" | "targetExpressions" | "nativeLanguage" | "rubric" | "scenarioResources">; session: SpeakingSession; participant: SpeakingParticipant; turns: SpeakingTurn[]; evaluation?: SpeakingEvaluation }; evaluationStatus?: "queued" | "running" | "completed" | "failed" };

const normalizePath = (path: string) => (path === "/" ? path : path.replace(/\/+$/u, ""));
const decodeRouteSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const parseRoute = (path: string): SpeakingRoute => {
  const segments = normalizePath(path).split("/").filter(Boolean).map(decodeRouteSegment);
  if (segments.length <= 1) return { kind: "home" };
  if (segments[1] === "join") return { kind: "join", ...(segments[2] ? { code: segments[2].toUpperCase() } : {}) };
  if (segments[1] === "session" && segments[2]) return { kind: "session", id: segments[2] };
  if (segments[1] === "result" && segments[2]) return { kind: "result", id: segments[2] };
  return { kind: "home" };
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;
const isFatalParticipantAuthorizationError = (error: unknown) => error instanceof ApiError && [401, 403, 404].includes(error.status);

const saveJoinCredentials = (payload: JoinResponse) => {
  sessionStorage.setItem(`speaking-token:${payload.session.id}`, payload.token);
  sessionStorage.setItem(`speaking-participant-token:${payload.participant.id}`, payload.token);
  sessionStorage.setItem("speaking-current-session", JSON.stringify({ sessionId: payload.session.id, participantId: payload.participant.id }));
};

const tokenForSession = (sessionId: string) => sessionStorage.getItem(`speaking-token:${sessionId}`) ?? "";

export default function SpeakingPracticeApp() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const route = parseRoute(path);

  const navigate = useCallback<Navigate>((nextPath) => {
    const target = new URL(nextPath, window.location.origin);
    const targetPath = `${normalizePath(target.pathname)}${target.search}${target.hash}`;
    window.history.pushState(null, "", targetPath);
    if (isSpeakingTeacherRoute(target.pathname)) {
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    setPath(normalizePath(target.pathname));
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.body.dataset.speaking = "true";
    document.title = "Speaking Practice · GyakutenEigo";
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => {
      delete document.body.dataset.speaking;
      document.title = previousTitle;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return (
    <div className="speaking-app" id="main-content" tabIndex={-1}>
      {route.kind === "home" && <SpeakingHome navigate={navigate} />}
      {route.kind === "join" && <SpeakingJoinPage navigate={navigate} initialCode={route.code} />}
      {route.kind === "session" && <SpeakingSessionPage key={route.id} navigate={navigate} sessionId={route.id} />}
      {route.kind === "result" && <SpeakingResultPageV2 key={route.id} navigate={navigate} participantId={route.id} />}
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
  const [demoState, setDemoState] = useState<SpeakingUiState>("ai-speaking");
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

interface SpeakingScreenProps { activity: SpeakingActivity; state: SpeakingUiState; remainingSeconds: number; turns: SpeakingTurn[]; transcriptPreview?: string; onMic: () => void; onReplay?: (text?: string) => void; onBrandClick?: () => void; onHelp: () => void; onHelpRetry?: () => void; helpLoading?: boolean; helpError?: string; onFinish: () => void; onPhraseClick?: (phrase: string) => void; disabled?: boolean; finishDisabled?: boolean; preview?: boolean; }
const stateLabels: Record<SpeakingUiState, string> = { ready: "Ready", listening: "Listening", thinking: "Processing", "ai-speaking": "AI Speaking" };
const stateDescriptions: Record<SpeakingUiState, string> = { ready: "Your turn — tap the microphone when you are ready.", listening: "Listening… tap again when you finish.", thinking: "Understanding what you said and preparing a reply…", "ai-speaking": "Listen to your speaking partner." };

function SpeakingScreen(props: SpeakingScreenProps) {
  if (!props.preview) return <SpeakingStudentScreenV2 {...props} />;
  const { activity, state, remainingSeconds, turns, transcriptPreview, onMic, onHelp, onFinish, onPhraseClick, disabled = false, finishDisabled = false } = props;
  const currentAiTurn = [...turns].reverse().find((turn) => turn.speaker === "ai");
  const sentence = state === "listening" ? "Your turn" : state === "thinking" ? "Processing your answer…" : currentAiTurn?.text ?? "Hi! Can I help you today?";
  const durationProgress = Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, activity.durationSeconds)) * 100));
  const micLabel = state === "listening" ? "Stop speaking" : state === "thinking" ? "Processing your answer" : "Tap to speak";
  return <div className={`speaking-screen speaking-screen-${state} speaking-screen-preview`}><header className="speaking-screen-header"><div className="speaking-screen-title"><button className="speaking-screen-menu" type="button" aria-label="Open speaking menu"><Menu size={22} aria-hidden="true" /></button><span>Speaking Practice</span></div><div className="speaking-screen-activity"><ShoppingBag size={19} aria-hidden="true" /><strong>{activity.title}</strong></div><div className="speaking-screen-timer"><Clock3 size={17} aria-hidden="true" /><span>{formatDuration(remainingSeconds)} left</span><span className="speaking-progress"><span style={{ width: `${durationProgress}%` }} /></span><button type="button" onClick={onFinish} disabled={finishDisabled}>Finish</button></div></header><div className="speaking-screen-body"><aside className="speaking-scenario-card"><ShoppingBag size={37} strokeWidth={1.6} aria-hidden="true" /><div><span className="speaking-card-kicker">Scenario</span><p>{activity.scenario}</p></div></aside><section className="speaking-partner-panel" aria-label="AI speaking partner"><div className="speaking-partner-avatar-wrap"><img src="/assets/speaking/ai-shop-assistant.png" alt="AI shop assistant" /></div><p className="speaking-partner-role">AI Partner: {activity.aiRole}</p><div className="speaking-speech-bubble"><Volume2 size={30} aria-hidden="true" /><span>{sentence}</span></div><p className="speaking-state-description" aria-live="polite">{stateDescriptions[state]}</p><div className="speaking-state-list" aria-label="Speaking state">{(Object.keys(stateLabels) as SpeakingUiState[]).map((item) => <span key={item} className={item === state ? "is-active" : ""}><span className="speaking-state-dot" aria-hidden="true">{item === state ? <CircleCheck size={15} /> : item === "thinking" ? <LoaderCircle size={15} /> : <span />}</span>{stateLabels[item]}</span>)}</div></section><aside className="speaking-useful-card"><div className="speaking-useful-heading"><strong>Useful English</strong><Bookmark size={19} aria-hidden="true" /></div><div className="speaking-expression-list">{activity.targetExpressions.slice(0, 5).map((expression) => <button type="button" key={expression} onClick={() => onPhraseClick?.(expression)} disabled={disabled}><MessageCircle size={17} aria-hidden="true" /><span>{expression}</span></button>)}</div></aside></div><footer className="speaking-screen-footer"><div className="speaking-transcript-preview"><span>Transcript <small>(preview)</small></span><p><strong>AI:</strong> {currentAiTurn?.text ?? "Hi! Can I help you today?"}</p><p><strong>You:</strong> {transcriptPreview ?? "…"}</p></div><div className="speaking-mic-wrap"><button className={`speaking-mic speaking-mic-${state}`} type="button" onClick={onMic} disabled={disabled || state === "thinking"} aria-label={micLabel}><Mic size={53} strokeWidth={1.9} aria-hidden="true" /></button><span className="speaking-mic-label">{state === "listening" ? "Listening…" : state === "thinking" ? "Processing…" : "Tap to Speak"}</span></div><button type="button" className="speaking-help-button" onClick={onHelp} disabled={disabled}><Lightbulb size={20} aria-hidden="true" /><span>Help</span></button></footer></div>;
}

function SpeakingStudentScreenV2({ activity, state, remainingSeconds, turns, onMic, onReplay, onBrandClick, onHelp, onHelpRetry, helpLoading = false, helpError = "", onFinish, onPhraseClick, disabled = false, finishDisabled = false }: SpeakingScreenProps) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const resources = speakingScenarioResources(activity.scenarioResources);
  const currentAiTurn = [...turns].reverse().find((turn) => turn.speaker === "ai");
  const durationProgress = Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, activity.durationSeconds)) * 100));
  const micLabel = state === "ai-speaking" ? "Stop playback" : state === "listening" ? "Stop speaking" : state === "thinking" ? "Processing your answer" : "Tap to speak";
  const pendingReply = state === "thinking" && turns.some((turn) => turn.speaker === "student");
  const partnerImage = resources.imageSrc;

  useEffect(() => {
    const transcript = transcriptEndRef.current?.parentElement;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [turns.length, pendingReply]);

  useEffect(() => {
    const handleSpacebar = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || disabled) return;
      if (helpLoading || document.querySelector('[role="dialog"]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target?.closest('input, textarea, select, button, a, summary, [contenteditable="true"], [role="button"]')) return;
      event.preventDefault();
      onMic();
    };
    window.addEventListener("keydown", handleSpacebar);
    return () => window.removeEventListener("keydown", handleSpacebar);
  }, [disabled, helpLoading, onMic]);

  return <div className={"speaking-student-screen speaking-student-screen-" + state}>
    <header className="speaking-student-header">
      <div className="speaking-student-brand"><SpeakingBrand navigate={onBrandClick ?? (() => undefined)} compact /></div>
      <div className="speaking-student-context"><span className="speaking-student-product">Speaking Practice</span><ChevronRight size={24} aria-hidden="true" /><strong title={activity.title}>{activity.title}</strong></div>
      <div className="speaking-student-timer"><span className="speaking-student-time"><Clock3 size={21} aria-hidden="true" />{formatDuration(remainingSeconds)} left</span><span className="speaking-student-progress" aria-label={Math.round(durationProgress) + "% time remaining"}><span style={{ width: durationProgress + "%" }} /></span><button type="button" onClick={onFinish} disabled={finishDisabled}>Finish</button></div>
    </header>
    <div className="speaking-student-grid">
      <div className="speaking-student-center">
        <section className="speaking-live-reply" aria-live="polite" aria-label="Current speaking partner">
          <div className="speaking-live-reply-avatar">{partnerImage ? <img src={partnerImage} alt={resources.imageAlt ?? "Speaking partner"} /> : <MessageCircle size={28} aria-hidden="true" />}</div>
          <div><span className="speaking-card-kicker">Your speaking partner · {activity.aiRole}</span><p>{state === "listening" ? "Your turn — speak when you are ready." : state === "thinking" ? "Understanding your answer…" : currentAiTurn?.text ?? resources.openingLine}</p></div>
          <button type="button" className="speaking-icon-button" onClick={() => onReplay?.(currentAiTurn?.text)} disabled={!onReplay || !currentAiTurn || state !== "ready"} aria-label="Replay current partner message"><Volume2 size={20} aria-hidden="true" /></button>
        </section>
        <section className="speaking-transcript-card" aria-label="Full transcript">
          <div className="speaking-transcript-heading"><MessageCircle size={28} strokeWidth={1.8} aria-hidden="true" /><strong>Full transcript</strong><span>Conversation record</span></div>
          <div className="speaking-transcript-list" aria-live="polite">
            {turns.map((turn) => <StudentTranscriptTurnV2 key={turn.id} activity={activity} turn={turn} onReplay={state === "ready" && !disabled ? onReplay : undefined} />)}
            {pendingReply && <div className="speaking-transcript-turn speaking-transcript-turn-ai is-pending"><div className="speaking-turn-avatar speaking-turn-avatar-ai">{partnerImage ? <img src={partnerImage} alt={resources.imageAlt ?? "Speaking partner"} /> : <MessageCircle size={22} aria-hidden="true" />}</div><div className="speaking-turn-body"><p className="speaking-turn-label">AI · {activity.aiRole}</p><div className="speaking-turn-bubble"><span className="speaking-pending-dots">•••</span></div></div></div>}
            <div ref={transcriptEndRef} aria-hidden="true" />
          </div>
        </section>
        <footer className="speaking-student-controls" aria-label="Speaking controls">
          <button className="speaking-replay-button" type="button" onClick={() => onReplay?.(currentAiTurn?.text)} disabled={!onReplay || !currentAiTurn || state !== "ready"}><RotateCcw size={27} strokeWidth={1.7} aria-hidden="true" /><span>Replay</span></button>
          <div className="speaking-student-mic-wrap"><button className={"speaking-student-mic speaking-student-mic-" + state} type="button" onClick={onMic} disabled={disabled} aria-label={micLabel}><Mic size={54} strokeWidth={1.65} aria-hidden="true" /></button><span>{state === "ai-speaking" ? "Stop playback" : state === "listening" ? "Stop speaking" : state === "thinking" ? "Processing…" : "Tap to Speak"}</span></div>
          <button className="speaking-student-help-button" type="button" onClick={onHelp} disabled={disabled || helpLoading || state !== "ready"}><Lightbulb size={22} strokeWidth={1.8} aria-hidden="true" /><span>{helpLoading ? "Loading Help…" : "Help"}</span><small>{activity.targetExpressions.length} expressions available</small></button>
        </footer>
        {helpError && <div className="speaking-inline-operation-error" role="alert"><span>{helpError}</span>{onHelpRetry && <button type="button" onClick={onHelpRetry}>Retry Help</button>}</div>}
        <p className="speaking-student-status" aria-live="polite">{stateDescriptions[state]}</p>
      </div>
      <aside className="speaking-flow-panel" aria-label="Suggested conversation steps">
        <details open={guidanceOpen} onToggle={(event) => setGuidanceOpen(event.currentTarget.open)}>
          <summary><span><strong>Suggested steps</strong><small>Optional guidance</small></span><ChevronDown size={19} aria-hidden="true" /></summary>
          <ol className="speaking-flow-list">{resources.suggestedSteps.map((step, index) => <li key={step}><span className="speaking-flow-number">{index + 1}</span><span className="speaking-flow-icon"><MessageCircle size={21} strokeWidth={1.8} aria-hidden="true" /></span><span className="speaking-flow-copy"><strong>{step}</strong></span></li>)}</ol>
        </details>
        <div className="speaking-goal-card"><Star size={25} strokeWidth={1.8} aria-hidden="true" /><div><strong>Goal</strong><p>{resources.studentGoal}</p></div></div>
      </aside>
      <aside className="speaking-student-sidebar">
        <section className="speaking-useful-student-card">
          <div className="speaking-student-card-heading"><div><h2>Useful English</h2><p>Target expressions</p></div><Bookmark size={22} strokeWidth={1.7} aria-hidden="true" /></div>
          <div className="speaking-student-expression-list">{activity.targetExpressions.map((expression) => <button type="button" key={expression} onClick={() => onPhraseClick?.(expression)} disabled={disabled}><MessageCircle size={19} strokeWidth={1.7} aria-hidden="true" /><span>{expression}</span></button>)}</div>
        </section>
        {resources.referenceItems.length > 0 && <section className="speaking-reference-card"><button type="button" onClick={() => setReferenceOpen((open) => !open)} aria-expanded={referenceOpen}><BookOpenText size={22} aria-hidden="true" /><span>Reference material</span><ChevronDown size={18} aria-hidden="true" /></button>{referenceOpen && <ul>{resources.referenceItems.map((item) => <li key={item.label}><strong>{item.label}</strong>{item.detail && <span>{item.detail}</span>}</li>)}</ul>}</section>}
        <section className="speaking-notes-card"><div className="speaking-student-card-heading"><div><h2>Notes</h2><p>Private on this device</p></div><PencilLine size={21} strokeWidth={1.7} aria-hidden="true" /></div><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Write a note…" aria-label="Notes" /></section>
      </aside>
    </div>
  </div>;
}
function StudentTranscriptTurnV2({ activity, turn, onReplay }: { activity: SpeakingActivity; turn: SpeakingTurn; onReplay?: (text?: string) => void }) {
  const isAi = turn.speaker === "ai";
  const resources = speakingScenarioResources(activity.scenarioResources);
  const createdAt = new Date(turn.createdAt);
  const time = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return <div className={"speaking-transcript-turn " + (isAi ? "speaking-transcript-turn-ai" : "speaking-transcript-turn-student")}>
    <div className={"speaking-turn-avatar " + (isAi ? "speaking-turn-avatar-ai" : "speaking-turn-avatar-student")}>{isAi ? resources.imageSrc ? <img src={resources.imageSrc} alt={resources.imageAlt ?? "Speaking partner"} /> : <MessageCircle size={22} aria-hidden="true" /> : <UserRound size={39} strokeWidth={1.5} aria-hidden="true" />}</div>
    <div className="speaking-turn-body"><p className="speaking-turn-label">{isAi ? "AI · " + activity.aiRole : "You"}</p><div className="speaking-turn-bubble"><div><strong>{turn.text}</strong></div><button type="button" onClick={() => onReplay?.(turn.text)} disabled={!isAi || !onReplay} aria-label="Replay AI message"><Volume2 size={22} strokeWidth={1.8} aria-hidden="true" /></button></div>{!isAi && time && <time dateTime={turn.createdAt}>{time}</time>}</div>
  </div>;
}
function TeacherPreviewCard({ navigate }: { navigate: Navigate }) { const [name, setName] = useState("Shopping for Clothes"); return <section className="speaking-rail-card speaking-create-preview"><div className="speaking-rail-card-heading"><Edit3 size={20} aria-hidden="true" /><strong>Create Activity</strong></div><label>Activity Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>AI Role<div className="speaking-select-wrap"><select defaultValue="Shop Assistant"><option>Shop Assistant</option><option>Restaurant worker</option><option>Helpful local</option></select><ChevronDown size={15} aria-hidden="true" /></div></label><label>Student Role<div className="speaking-select-wrap"><select defaultValue="Customer"><option>Customer</option><option>Student</option><option>Visitor</option></select><ChevronDown size={15} aria-hidden="true" /></div></label><label>Target English<textarea defaultValue="Asking about items, sizes, and prices" rows={2} /></label><div className="speaking-rubric-mini"><span>Rubric (4 Skills)</span>{["Communication", "Interaction", "Vocabulary", "Grammar"].map((criterion, index) => <div key={criterion}><strong>{criterion}</strong><span className="speaking-stars" aria-label={`${4 - (index === 3 ? 1 : 0)} out of 4 stars`}>{[0, 1, 2, 3].map((star) => <Star key={star} size={15} fill={star < (index === 3 ? 3 : 4) ? "currentColor" : "none"} aria-hidden="true" />)}</span></div>)}</div><div className="speaking-share-mini"><div><span>QR preview</span><QRCodeSVG value={`${window.location.origin}/speak/join/ABC123`} size={69} bgColor="#ffffff" fgColor="#12214b" level="M" /></div><div className="speaking-code-mini"><small>Example code</small><strong>ABC123</strong><Copy size={16} aria-hidden="true" /></div></div><button className="speaking-rail-link" type="button" onClick={() => navigate("/speak/teacher/create")}>Open activity builder <ArrowRight size={15} aria-hidden="true" /></button></section>; }

function ResultPreviewCard({ navigate }: { navigate: Navigate }) { const evaluation = makeDemoEvaluation("preview-participant"); return <section className="speaking-rail-card speaking-result-preview"><div className="speaking-result-heading"><strong>学習結果 (サマリー)</strong><button type="button" onClick={() => navigate("/speak")}>Preview</button></div><div className="speaking-student-summary"><span className="speaking-student-avatar"><UserRound size={22} aria-hidden="true" /></span><div><strong>Example learner</strong><small>Preview only</small></div><b>{scoreFor(evaluation)}<small>点</small></b></div><div className="speaking-mini-result-body"><div className="speaking-mini-score-list">{["Communication", "Interaction", "Vocabulary", "Grammar"].map((criterion, index) => <div key={criterion}><span>{criterion}</span><span className="speaking-stars">{[0, 1, 2, 3].map((star) => <Star key={star} size={12} fill={star < (index === 3 ? 3 : 4) ? "currentColor" : "none"} aria-hidden="true" />)}</span></div>)}</div><div className="speaking-feedback-note"><strong>Preview result</strong><span>Example data is shown only on this home-page preview.</span></div></div></section>; }

function SpeakingJoinPage({ navigate, initialCode }: { navigate: Navigate; initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState<JoinResponse>();
  const joinRequestIdRef = useRef<string | undefined>(undefined);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setJoining(true);
    try {
      if (!joinRequestIdRef.current) joinRequestIdRef.current = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random());
      const payload = await speakingApi.join(code, identifier.trim() || undefined, joinRequestIdRef.current) as JoinResponse;
      saveJoinCredentials(payload);
      joinRequestIdRef.current = undefined;
      setJoined(payload);
    } catch (joinError) {
      setError(getErrorMessage(joinError, "このクラスルームに参加できませんでした。コードを確認してください。"));
    } finally { setJoining(false); }
  };
  if (joined) return <SpeakingPreActivityPageV2 navigate={navigate} joined={joined} />;
  return <div className="speaking-page-shell speaking-join-page"><SpeakingTopbar navigate={navigate} active="join" /><main className="speaking-join-layout"><section className="speaking-join-copy"><span className="speaking-eyebrow"><ScanLine size={15} aria-hidden="true" /> Student entry</span><h1>Ready to speak?</h1><p>Enter the session code from your teacher. You do not need an account.</p><div className="speaking-join-proof"><CircleCheck size={17} aria-hidden="true" /><span>Private classroom session</span><CircleCheck size={17} aria-hidden="true" /><span>Short speaking practice</span></div></section><form className="speaking-form-card" onSubmit={submit}><div className="speaking-form-heading"><span>Join a classroom</span><h2>Enter session code</h2><p>Ask your teacher if you do not have the code.</p></div><label htmlFor="speaking-activity-code">Session code<input id="speaking-activity-code" className="speaking-code-input" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setError(""); }} placeholder="ABC123" autoComplete="off" maxLength={6} /></label><label htmlFor="speaking-identifier">Nickname or student number <small>(if requested by your teacher)</small><input id="speaking-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="e.g. Hana" maxLength={80} /></label>{error && <p className="speaking-error" role="alert">{error}</p>}<button className="speaking-primary-button speaking-wide-button" type="submit" disabled={joining || code.length !== 6}>{joining ? <><LoaderCircle size={18} className="speaking-spin" aria-hidden="true" />Joining…</> : <><ArrowRight size={18} aria-hidden="true" />Join session</>}</button><p className="speaking-privacy-note"><ShieldIcon /><span>Your teacher can review your transcript and feedback. Audio is sent for speech processing; the app does not store recordings.</span></p></form></main><div className="speaking-join-footer"><button type="button" className="speaking-text-button" onClick={() => navigate("/speak")}><ArrowLeft size={16} aria-hidden="true" />Back to Speaking Practice</button></div></div>;
}

function ShieldIcon() { return <span className="speaking-privacy-dot" aria-hidden="true"><CircleCheck size={14} /></span>; }

function SpeakingPreActivityPageV2({ navigate, joined }: { navigate: Navigate; joined: JoinResponse }) {
  const [micState, setMicState] = useState<"idle" | "requesting" | "testing" | "ready" | "unverified" | "no-signal" | "denied" | "unsupported" | "waiting">("idle");
  const preflightRef = useRef<AbortController | undefined>(undefined);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; preflightRef.current?.abort(); }; }, []);
  const [signalDetected, setSignalDetected] = useState(false);
  const [error, setError] = useState("");
  const startSession = useCallback(async () => {
    setError("");
    try {
      await speakingApi.startParticipant(joined.session.id, joined.token);
      if (!mountedRef.current) return;
      navigate("/speak/session/" + joined.session.id);
    } catch (startError) {
      if (!mountedRef.current) return;
      const message = getErrorMessage(startError, "The activity is not ready yet.");
      if (startError instanceof ApiError && startError.status === 409 && /waiting/i.test(message)) {
        setMicState("waiting");
        navigate("/speak/session/" + joined.session.id);
      } else { setMicState("unverified"); setError(message); }
    }
  }, [joined.session.id, joined.token, navigate]);
  const requestMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicState("unsupported");
      return;
    }
    setMicState("requesting");
    setSignalDetected(false);
    setError("");
    preflightRef.current?.abort();
    const controller = new AbortController();
    preflightRef.current = controller;
    try {
      setMicState("testing");
      const detected = await testSpeakingMicrophone(controller.signal, () => setSignalDetected(true));
      if (controller.signal.aborted) return;
      if (detected === undefined) {
        setMicState("unverified");
        setError("Microphone access is allowed, but this browser could not measure input. Check your microphone before continuing.");
        return;
      }
      if (detected === false) {
        setMicState("no-signal");
        return;
      }
      setSignalDetected(true);
      setMicState("ready");
      sessionStorage.setItem("speaking-microphone-ready", "true");
      void startSession();
    } catch (micError) {
      if (controller.signal.aborted) return;
      setMicState("denied");
      setError(micError instanceof DOMException && micError.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access, then try again." : "The microphone could not be tested. Check the device and try again.");
    }
  };
  const resources = speakingScenarioResources(joined.activity.scenarioResources);
  return <div className="speaking-page-shell speaking-preactivity-page"><SpeakingTopbar navigate={navigate} /><main className="speaking-preactivity-layout"><section className="speaking-preactivity-hero"><span className="speaking-eyebrow"><Mic size={15} aria-hidden="true" /> Before you start</span><h1>{joined.activity.title}</h1><p>{joined.activity.scenario}</p><div className="speaking-role-pills"><span>You are: <strong>{joined.activity.studentRole}</strong></span><span>Talk to: <strong>{joined.activity.aiRole}</strong></span><span><Clock3 size={14} aria-hidden="true" /> {formatDuration(joined.activity.durationSeconds)}</span></div></section><section className="speaking-prep-card"><div className="speaking-prep-card-heading"><div><span className="speaking-card-kicker">Quick microphone check</span><h2>Make sure we can hear you</h2><p>Speak for a moment when your browser asks. We only use this short check to test input.</p></div><Mic size={23} aria-hidden="true" /></div><div className="speaking-preflight-meter" aria-live="polite" aria-label={signalDetected ? "Microphone input detected" : "Waiting for microphone input"}>{[0, 1, 2, 3, 4].map((bar) => <span key={bar} className={signalDetected ? "is-active" : ""} style={{ animationDelay: bar * 80 + "ms" }} />)}</div><p className="speaking-preflight-status">{micState === "testing" ? "Speak now — checking for input…" : micState === "ready" ? "Microphone input detected." : micState === "no-signal" ? "No input was detected. Check the mute switch or microphone and try again." : micState === "waiting" ? "Waiting for your teacher to start the activity." : "You can retry the check if your microphone changes."}</p><details className="speaking-preflight-guidance"><summary>Microphone tips</summary><ul><li>Allow microphone access for this site.</li><li>Use headphones if the room is noisy.</li><li>Speak close enough to the device for the input meter to move.</li></ul></details>{error && <div className="speaking-error speaking-prep-error" role="alert"><strong>{error}</strong></div>}{micState === "denied" && <div className="speaking-preflight-actions"><button type="button" className="speaking-primary-button" onClick={requestMicrophone}>Retry microphone</button></div>}{micState === "unsupported" && <div className="speaking-error speaking-prep-error" role="alert"><strong>This browser cannot record a microphone.</strong><span>Use a current Chrome, Edge, or Safari browser on a secure connection.</span></div>}{micState === "no-signal" && <div className="speaking-preflight-actions"><button type="button" className="speaking-primary-button" onClick={requestMicrophone}>Test again</button></div>}{micState === "requesting" ? <button type="button" className="speaking-primary-button speaking-wide-button" disabled><LoaderCircle size={18} className="speaking-spin" aria-hidden="true" />Allowing microphone…</button> : micState === "testing" ? <button type="button" className="speaking-primary-button speaking-wide-button" disabled><LoaderCircle size={18} className="speaking-spin" aria-hidden="true" />Listening for your voice…</button> : micState === "idle" && <button type="button" className="speaking-primary-button speaking-wide-button" onClick={requestMicrophone}><Mic size={18} aria-hidden="true" />Start Speaking</button>}{micState === "unverified" && <button type="button" className="speaking-primary-button speaking-wide-button" onClick={() => void startSession()}>Continue without input test</button>}{micState === "ready" && <p className="speaking-session-note" role="status"><CircleCheck size={16} aria-hidden="true" />Microphone ready. Opening your activity…</p>}<div className="speaking-preflight-goal"><Star size={19} aria-hidden="true" /><span>{resources.studentGoal}</span></div><div className="speaking-prep-expressions">{joined.activity.targetExpressions.map((expression) => <div key={expression}><MessageCircle size={17} aria-hidden="true" /><span>{expression}</span></div>)}</div></section></main></div>;
}

function SpeakingSessionPage({ navigate, sessionId }: { navigate: Navigate; sessionId: string }) {
  const token = tokenForSession(sessionId);
  const [data, setData] = useState<SessionResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) { setLoading(false); setError("This student session is not available on this browser. Please join again with your teacher’s code."); return; }
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const next = await speakingApi.session(sessionId, token, controller.signal) as SessionResponse;
        if (cancelled) return;
        if (["evaluating", "completed", "error"].includes(next.participant.status)) {
          navigate("/speak/result/" + next.participant.id);
          return;
        }
        setData(next);
        setError("");
      } catch (loadError) { if (!cancelled && !(loadError instanceof DOMException && loadError.name === "AbortError")) setError(getErrorMessage(loadError, "This speaking session is no longer available.")); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [navigate, sessionId, token]);
  if (loading) return <div className="speaking-empty-page"><LoaderCircle size={34} className="speaking-spin" aria-hidden="true" /><h1>Opening your session</h1><p>Getting the classroom conversation ready…</p></div>;
  if (!data) return <div className="speaking-empty-page"><CircleCheck size={38} aria-hidden="true" /><h1>Session unavailable</h1><p>{error}</p><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}>Join another activity</button></div>;
  return <SpeakingSessionExperienceV2 navigate={navigate} token={token} initialData={data} />;
}

type SpeakingOperationError = "microphone" | "turn" | "connection" | "evaluation";

type SpeakingStatusResponse = {
  participant: SpeakingParticipant;
  session: SpeakingSession;
  revision: number;
  evaluationStatus?: "queued" | "running" | "completed" | "failed";
};

function SpeakingSessionExperienceV2({ navigate, token, initialData }: { navigate: Navigate; token: string; initialData: SessionResponse }) {
  const initialVoiceState: SpeakingVoiceState = initialData.participant.status === "evaluating"
    ? "evaluating"
    : initialData.participant.status === "completed"
      ? "completed"
      : initialData.participant.status === "error" ? "error" : "ready";
  const [data, setData] = useState(initialData);
  const [voiceState, setVoiceState] = useState<SpeakingVoiceState>(initialVoiceState);
  const [remaining, setRemaining] = useState(() => speakingRemainingSeconds(initialData.participant, initialData.session, initialData.activity.durationSeconds, speakingTimerReference(initialData.participant, initialData.session, Date.now())));
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpHint, setHelpHint] = useState("");
  const [helpEnglish, setHelpEnglish] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState("");
  const [error, setError] = useState("");
  const [errorOperation, setErrorOperation] = useState<SpeakingOperationError>();
  const errorOperationRef = useRef(errorOperation);
  errorOperationRef.current = errorOperation;
  const [micNotice, setMicNotice] = useState("");
  const [evaluationStatus, setEvaluationStatus] = useState<SpeakingStatusResponse["evaluationStatus"]>(initialData.participant.status === "evaluating" ? "running" : undefined);
  const [authorizationFailed, setAuthorizationFailed] = useState(false);
  const authorizationFailedRef = useRef(false);
  const participantFinalizedRef = useRef(["evaluating", "completed", "error"].includes(initialData.participant.status));
  const navigatedToResultRef = useRef(false);
  const recorderRef = useRef<SpeakingAudioCapture | undefined>(undefined);
  const recordingStartRef = useRef(false);
  const recordingGenerationRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const lastAudioRef = useRef<Blob | undefined>(undefined);
  const lastRequestIdRef = useRef<string | undefined>(undefined);
  const lastSpeechDetectedRef = useRef<boolean | undefined>(undefined);
  const lastAudioDurationRef = useRef<number | undefined>(undefined);
  const greetingSpokenRef = useRef(false);
  const finishRef = useRef<() => void>(() => undefined);
  const voiceStateRef = useRef(voiceState);
  const dataRef = useRef(data);
  const revisionRef = useRef(initialData.session.revision ?? 0);
  const pollNowRef = useRef<() => void>(() => undefined);
  dataRef.current = data;
  voiceStateRef.current = voiceState;

  const cancelRecording = useCallback(() => {
    recordingGenerationRef.current += 1;
    const current = recorderRef.current;
    if (current) {
      cancelSpeakingAudioCapture(current);
      recorderRef.current = undefined;
    }
    recordingStartRef.current = false;
    chunksRef.current = [];
  }, []);

  const releaseRetryAudio = useCallback(() => {
    lastAudioRef.current = undefined;
    lastRequestIdRef.current = undefined;
    lastSpeechDetectedRef.current = undefined;
    lastAudioDurationRef.current = undefined;
  }, []);

  const handleFatalAuthorization = useCallback((authorizationError: unknown) => {
    cancelRecording();
    releaseRetryAudio();
    browserTtsProvider.cancel();
    authorizationFailedRef.current = true;
    setAuthorizationFailed(true);
    setVoiceState("error");
    setErrorOperation("connection");
    setError(getErrorMessage(authorizationError, "This speaking session is no longer available."));
  }, [cancelRecording, releaseRetryAudio]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timerId: number | undefined;
    let stablePolls = 0;
    const controller = new AbortController();
    const schedule = (urgent = false) => {
      if (cancelled) return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => { void poll(false); }, nextSpeakingPollDelay({ stablePolls, urgent }));
    };
    const poll = async (urgent: boolean) => {
      if (cancelled || inFlight || authorizationFailedRef.current) return;
      inFlight = true;
      try {
        const next = await speakingApi.status(initialData.session.id, token, controller.signal) as SpeakingStatusResponse;
        if (cancelled) return;
        const nextRevision = next.revision ?? next.session.revision ?? 0;
        if (!shouldAcceptSpeakingRevision(revisionRef.current, nextRevision)) {
          schedule(false);
          return;
        }
        revisionRef.current = nextRevision;
        if (errorOperationRef.current === "connection") {
          setError("");
          setErrorOperation(undefined);
        }
        setEvaluationStatus(next.evaluationStatus);
        setData((current) => ({ ...current, participant: next.participant, session: next.session }));
        if (next.session.status === "active" && next.participant.status === "joined" && next.participant.readyAt) {
          await speakingApi.startParticipant(initialData.session.id, token);
          if (cancelled) return;
        }
        participantFinalizedRef.current = ["evaluating", "completed", "error"].includes(next.participant.status);
        if (["paused", "ended", "expired"].includes(next.session.status) || participantFinalizedRef.current) {
          cancelRecording();
          browserTtsProvider.cancel();
        }
        if (next.participant.status === "completed" && !navigatedToResultRef.current) {
          navigatedToResultRef.current = true;
          navigate("/speak/result/" + next.participant.id);
          return;
        }
        if (next.participant.status === "evaluating") {
          setVoiceState("evaluating");
          setErrorOperation(undefined);
        } else if (next.participant.status === "error") {
          setVoiceState("error");
          setErrorOperation("evaluation");
          setError("Your speaking practice is saved, but feedback could not be prepared.");
        } else if (next.session.status === "paused") {
          setVoiceState("paused");
        } else if (["ended", "expired"].includes(next.session.status)) {
          setVoiceState((current) => current === "student_recording" ? "ready" : current);
        } else if (next.session.status === "active") {
          setVoiceState((current) => current === "paused" ? "ready" : current);
        }
        stablePolls = Math.min(6, stablePolls + 1);
      } catch (loadError) {
        if (cancelled || (loadError instanceof DOMException && loadError.name === "AbortError")) return;
        if (isFatalParticipantAuthorizationError(loadError)) handleFatalAuthorization(loadError);
        else {
          if (!errorOperationRef.current || errorOperationRef.current === "connection") {
            setErrorOperation("connection");
            setError("Connection paused. Your saved conversation is safe; checking again soon.");
          }
        }
        stablePolls = 0;
      } finally {
        inFlight = false;
        if (!cancelled) schedule(urgent);
      }
    };
    pollNowRef.current = () => {
      stablePolls = 0;
      if (timerId !== undefined) window.clearTimeout(timerId);
      void poll(true);
    };
    schedule(true);
    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
      controller.abort();
      pollNowRef.current = () => undefined;
    };
  }, [cancelRecording, handleFatalAuthorization, initialData.session.id, navigate, token]);

  useEffect(() => {
    if (!["evaluating", "completed", "error"].includes(data.participant.status)) return;
    participantFinalizedRef.current = true;
    cancelRecording();
    browserTtsProvider.cancel();
    setVoiceState(data.participant.status === "evaluating" ? "evaluating" : data.participant.status === "completed" ? "completed" : "error");
  }, [cancelRecording, data.participant.status]);

  useEffect(() => {
    const greeting = data.turns.find((turn) => turn.speaker === "ai");
    const key = "speaking-greeting:" + data.session.id;
    if (greeting && !["paused", "ended", "expired"].includes(data.session.status) && !sessionStorage.getItem(key) && !greetingSpokenRef.current) {
      greetingSpokenRef.current = true;
      setVoiceState("ai_speaking");
      void browserTtsProvider.speak(greeting.text, { lang: "en-US", rate: data.activity.level === "beginner" ? 0.82 : 0.92 }).finally(() => {
        sessionStorage.setItem(key, "spoken");
        if (dataRef.current.session.status === "active" || dataRef.current.session.status === "ready") setVoiceState("ready");
      });
    }
  }, [data.activity.level, data.session.id, data.session.status, data.turns]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = dataRef.current;
      const referenceTime = speakingTimerReference(current.participant, current.session, Date.now());
      const nextRemaining = speakingRemainingSeconds(current.participant, current.session, current.activity.durationSeconds, referenceTime);
      setRemaining(nextRemaining);
      if (nextRemaining <= 0 && current.participant.startedAt && current.session.status === "active" && voiceStateRef.current === "ready") finishRef.current();
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const submitRecording = useCallback(async (audio: Blob, requestId: string, speechDetected?: boolean, audioDurationMs?: number) => {
    lastAudioRef.current = audio;
    lastRequestIdRef.current = requestId;
    lastSpeechDetectedRef.current = speechDetected;
    lastAudioDurationRef.current = audioDurationMs;
    setVoiceState("processing");
    setError("");
    setErrorOperation(undefined);
    try {
      const response = await speakingApi.turn(dataRef.current.session.id, token, { audio, requestId, speechDetected, audioDurationMs }) as { studentTurn: SpeakingTurn; aiTurn: SpeakingTurn; session: SpeakingSession };
      if (authorizationFailedRef.current || participantFinalizedRef.current) return;
      releaseRetryAudio();
      const acceptSession = shouldAcceptSpeakingRevision(revisionRef.current, response.session.revision ?? 0);
      setData((current) => ({ ...current, participant: { ...current.participant, status: "in_progress" }, session: acceptSession ? response.session : current.session, turns: mergeSpeakingTurns(current.turns, [response.studentTurn, response.aiTurn]) }));
      revisionRef.current = Math.max(revisionRef.current, response.session.revision ?? revisionRef.current);
      pollNowRef.current();
      const effectiveSession = acceptSession ? response.session : dataRef.current.session;
      if (["paused", "ended", "expired"].includes(effectiveSession.status)) {
        browserTtsProvider.cancel();
        cancelRecording();
        setVoiceState(effectiveSession.status === "paused" ? "paused" : "ready");
        return;
      }
      setVoiceState("ai_speaking");
      await browserTtsProvider.speak(response.aiTurn.text, { lang: "en-US", rate: dataRef.current.activity.level === "beginner" ? 0.82 : 0.92 });
      if (authorizationFailedRef.current || participantFinalizedRef.current) return;
      if (["paused", "ended", "expired"].includes(dataRef.current.session.status)) {
        browserTtsProvider.cancel();
        cancelRecording();
        setVoiceState(dataRef.current.session.status === "paused" ? "paused" : "ready");
      } else setVoiceState("ready");
    } catch (turnError) {
      if (isFatalParticipantAuthorizationError(turnError)) {
        handleFatalAuthorization(turnError);
      } else if (turnError instanceof ApiError && turnError.status === 422) {
        releaseRetryAudio();
        setMicNotice(turnError.message);
        setVoiceState("ready");
      } else if (turnError instanceof ApiError && turnError.status === 409 && /paused/i.test(turnError.message)) {
        setVoiceState("paused");
        setErrorOperation("connection");
        setError(turnError.message);
      } else {
        setErrorOperation("turn");
        setError(getErrorMessage(turnError, "This turn could not be completed. You can retry the same recording."));
        setVoiceState("error");
      }
    }
  }, [cancelRecording, handleFatalAuthorization, releaseRetryAudio, token]);

  const stopRecording = useCallback(() => {
    const current = recorderRef.current;
    if (current) stopSpeakingAudioCapture(current);
  }, []);

  const startRecording = useCallback(async () => {
    if (authorizationFailed || !["ready"].includes(voiceStateRef.current) || dataRef.current.session.status !== "active" || recordingStartRef.current || recorderRef.current) return;
    recordingStartRef.current = true;
    const generation = ++recordingGenerationRef.current;
    setMicNotice("");
    setError("");
    setErrorOperation(undefined);
    releaseRetryAudio();
    browserTtsProvider.cancel();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      recordingStartRef.current = false;
      setErrorOperation("microphone");
      setError("This browser cannot record audio. Try a current Chrome, Edge, or Safari browser.");
      setVoiceState("ready");
      return;
    }
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== recordingGenerationRef.current || dataRef.current.session.status !== "active") {
        stream.getTracks().forEach((track) => track.stop());
        recordingStartRef.current = false;
        return;
      }
      const { recorder, mimeType } = createSpeakingAudioRecorder(stream);
      const activityMonitor = createSpeakingAudioActivityMonitor(stream);
      const requestId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random());
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      const capture: SpeakingAudioCapture = { recorder, stream, timeoutId: 0, requestId, activityMonitor, startedAtMs: Date.now(), submitOnStop: true };
      recorder.onstop = () => {
        const shouldSubmit = capture.submitOnStop;
        const speechDetected = activityMonitor.getSpeechDetected();
        const durationMs = Math.max(0, Date.now() - capture.startedAtMs);
        const blob = new Blob(chunksRef.current, { type: mimeType || recorder.mimeType || "audio/webm" });
        recordingStartRef.current = false;
        disposeSpeakingAudioCapture(capture);
        if (recorderRef.current === capture) recorderRef.current = undefined;
        chunksRef.current = [];
        if (shouldSubmit) void submitRecording(blob, requestId, speechDetected, durationMs);
      };
      capture.timeoutId = window.setTimeout(() => { setMicNotice("The " + SPEAKING_LIMITS.maxTurnSeconds + "-second speaking limit was reached."); stopRecording(); }, SPEAKING_LIMITS.maxTurnSeconds * 1_000);
      recorderRef.current = capture;
      recorder.start();
      setVoiceState("student_recording");
    } catch (recordError) {
      recordingStartRef.current = false;
      if (recorderRef.current) cancelRecording();
      else stream?.getTracks().forEach((track) => track.stop());
      setErrorOperation("microphone");
      setError(recordError instanceof DOMException && recordError.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access, then retry." : "The microphone could not start. Check the device and retry.");
      setVoiceState("ready");
    }
  }, [authorizationFailed, cancelRecording, releaseRetryAudio, stopRecording, submitRecording]);

  const onMic = useCallback(() => {
    if (voiceStateRef.current === "ai_speaking") { browserTtsProvider.cancel(); setVoiceState("ready"); }
    else if (voiceStateRef.current === "student_recording") stopRecording();
    else if (voiceStateRef.current === "ready") void startRecording();
  }, [startRecording, stopRecording]);

  const requestHelp = useCallback(async () => {
    if (authorizationFailed || helpLoading || voiceStateRef.current !== "ready" || dataRef.current.session.status !== "active") return;
    setHelpLoading(true);
    setHelpError("");
    try {
      const help = await speakingApi.help(dataRef.current.session.id, token) as { hint: string; english: string; helpCount?: number };
      setHelpHint(help.hint);
      setHelpEnglish(help.english);
      setHelpOpen(true);
      setData((current) => ({ ...current, participant: { ...current.participant, helpCount: help.helpCount ?? current.participant.helpCount + 1 } }));
    } catch (helpRequestError) {
      if (isFatalParticipantAuthorizationError(helpRequestError)) handleFatalAuthorization(helpRequestError);
      else setHelpError(getErrorMessage(helpRequestError, "Help is temporarily unavailable. Retry Help when you are ready."));
    } finally {
      setHelpLoading(false);
    }
  }, [handleFatalAuthorization, helpLoading, token, authorizationFailed]);

  const finish = useCallback(async () => {
    if (authorizationFailed || ["finishing", "evaluating", "completed", "ai_speaking", "student_recording", "processing"].includes(voiceStateRef.current)) return;
    cancelRecording();
    browserTtsProvider.cancel();
    releaseRetryAudio();
    setVoiceState("finishing");
    setError("");
    setErrorOperation(undefined);
    try {
      const response = await speakingApi.finish(dataRef.current.session.id, token) as { result?: ResultResponse["result"]; evaluationStatus?: SpeakingStatusResponse["evaluationStatus"] };
      if (response.evaluationStatus) setEvaluationStatus(response.evaluationStatus);
      navigate("/speak/result/" + dataRef.current.participant.id);
    } catch (finishError) {
      if (isFatalParticipantAuthorizationError(finishError)) handleFatalAuthorization(finishError);
      else {
        setErrorOperation("evaluation");
        setError(getErrorMessage(finishError, speakingFeedbackCopy(dataRef.current.activity.nativeLanguage).evaluationUnavailableMessage));
        setVoiceState("error");
      }
    }
  }, [authorizationFailed, cancelRecording, handleFatalAuthorization, navigate, releaseRetryAudio, token]);
  finishRef.current = () => { void finish(); };

  const retryTurn = () => {
    if (lastAudioRef.current && lastRequestIdRef.current) void submitRecording(lastAudioRef.current, lastRequestIdRef.current, lastSpeechDetectedRef.current, lastAudioDurationRef.current);
  };
  const retryOperation = () => {
    if (errorOperation === "microphone") { setError(""); void startRecording(); }
    else if (errorOperation === "turn") { setError(""); retryTurn(); }
    else if (errorOperation === "evaluation") { setError(""); void finish(); }
    else { setError(""); pollNowRef.current(); }
  };
  const replay = useCallback((text?: string) => {
    if (voiceStateRef.current !== "ready" || authorizationFailedRef.current || participantFinalizedRef.current || dataRef.current.session.status !== "active") return;
    const aiTurn = text ?? [...dataRef.current.turns].reverse().find((turn) => turn.speaker === "ai")?.text;
    if (aiTurn) {
      voiceStateRef.current = "ai_speaking";
      setVoiceState("ai_speaking");
      void browserTtsProvider.speak(aiTurn, { lang: "en-US", rate: dataRef.current.activity.level === "beginner" ? 0.82 : 0.92 }).finally(() => {
        if (!authorizationFailedRef.current && !participantFinalizedRef.current && dataRef.current.session.status === "active") setVoiceState("ready");
      });
    }
  }, []);
  useEffect(() => () => { cancelRecording(); browserTtsProvider.cancel(); }, [cancelRecording]);

  const waiting = data.session.status === "ready";
  const paused = data.session.status === "paused" || voiceState === "paused";
  const ended = data.session.status === "ended" || data.session.status === "expired";
  const controlsDisabled = authorizationFailed || waiting || paused || ended || !["ready", "student_recording", "ai_speaking"].includes(voiceState);
  const uiState: SpeakingUiState = voiceState === "student_recording" ? "listening" : voiceState === "ai_speaking" ? "ai-speaking" : ["processing", "finishing", "evaluating", "error"].includes(voiceState) ? "thinking" : "ready";
  const latestStudent = [...data.turns].reverse().find((turn) => turn.speaker === "student");
  const operationMessage = errorOperation === "microphone" ? "Retry microphone" : errorOperation === "turn" ? "Retry this turn" : errorOperation === "evaluation" ? "Check evaluation" : "Refresh status";
  return <div className="speaking-session-page"><main className="speaking-session-main">{waiting && <div className="speaking-session-note" role="status"><Clock3 size={16} aria-hidden="true" /><span>You’re ready! Waiting for your teacher to start the activity.</span></div>}{paused && <div className="speaking-session-alert" role="alert"><HelpCircle size={18} aria-hidden="true" /><span>Your teacher paused the activity.</span></div>}{ended && <div className="speaking-session-alert" role="alert"><HelpCircle size={18} aria-hidden="true" /><span>This activity has ended. Your saved conversation can still be reviewed.</span></div>}{error && <div className="speaking-session-alert" role="alert"><HelpCircle size={18} aria-hidden="true" /><span>{error}</span>{!authorizationFailed && <button type="button" onClick={retryOperation}>{operationMessage}</button>}</div>}{micNotice && <div className="speaking-session-note" role="status"><Mic size={16} aria-hidden="true" /><span>{micNotice}</span></div>}{voiceState === "evaluating" && <div className="speaking-session-note" role="status"><LoaderCircle size={16} className="speaking-spin" aria-hidden="true" /><span>Your speaking practice is finished. Your feedback is being prepared.</span></div>}<SpeakingScreen activity={data.activity} state={uiState} remainingSeconds={remaining} turns={data.turns} transcriptPreview={latestStudent?.text ?? "…"} onMic={onMic} onReplay={replay} onBrandClick={() => navigate("/speak")} onHelp={requestHelp} onHelpRetry={requestHelp} helpLoading={helpLoading} helpError={helpError} onFinish={() => void finish()} onPhraseClick={(phrase) => { setHelpError(""); setHelpHint(speakingFeedbackCopy(data.activity.nativeLanguage).helpHint); setHelpEnglish(phrase); setHelpOpen(true); }} disabled={controlsDisabled} finishDisabled={authorizationFailed || waiting || ["finishing", "evaluating", "completed", "ai_speaking", "student_recording", "processing"].includes(voiceState)} /></main>{helpOpen && <HelpDialogV2 activity={data.activity} onClose={() => setHelpOpen(false)} helpText={helpHint} english={helpEnglish} />}</div>;
}
function HelpDialogV2({ activity, onClose, helpText, english }: { activity: SpeakingActivity; onClose: () => void; helpText?: string; english?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const phrase = english || activity.targetExpressions[0] || "Could you say that again, please?";
  const copy = speakingFeedbackCopy(activity.nativeLanguage);
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key === "Tab") {
        const controls = closeRef.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); returnFocusRef.current?.focus(); };
  }, []);
  return <div className="speaking-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="speaking-help-dialog" role="dialog" aria-modal="true" aria-labelledby="speaking-help-title" aria-describedby="speaking-help-description"><button ref={closeRef} type="button" className="speaking-dialog-close" onClick={onClose} aria-label="Close help"><X size={18} aria-hidden="true" /></button><span className="speaking-help-dialog-icon"><Lightbulb size={25} aria-hidden="true" /></span><span className="speaking-card-kicker">Help</span><h2 id="speaking-help-title">You can try this</h2>{helpText && <p id="speaking-help-description" className="speaking-help-copy">{helpText}</p>}{!helpText && <p id="speaking-help-description" className="speaking-help-copy">Use this sentence starter to keep the conversation moving.</p>}<p className="speaking-help-phrase">{phrase}</p><p className="speaking-help-copy">{copy.helpEncouragement}</p><button type="button" className="speaking-primary-button" onClick={onClose}>Got it</button></section></div>;
}

function HelpDialog({ activity, onClose, helpText, english, preview = false }: { activity: SpeakingActivity; onClose: () => void; helpText?: string; english?: string; preview?: boolean }) { const phrase = english || activity.targetExpressions[0] || "Could you say that again, please?"; const copy = speakingFeedbackCopy(activity.nativeLanguage); const japanese = activity.nativeLanguage === "ja"; return <div className="speaking-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="speaking-help-dialog" role="dialog" aria-modal="true" aria-labelledby="speaking-help-title"><button type="button" className="speaking-dialog-close" onClick={onClose} aria-label={japanese ? "ヒントを閉じる" : "Close help"}><X size={18} aria-hidden="true" /></button><span className="speaking-help-dialog-icon"><Lightbulb size={25} aria-hidden="true" /></span><span className="speaking-card-kicker">{japanese ? "ヒント" : "Help"}</span><h2 id="speaking-help-title">{japanese ? "こんな言い方を試せます" : "You can try this:"}</h2>{helpText && <p className="speaking-help-copy">{helpText}</p>}<p className="speaking-help-phrase">{phrase}</p><p className="speaking-help-copy">{preview ? (japanese ? "プレビューです。実際のヒントは現在の会話に合わせて生成されます。" : "Preview only — real Help is generated for the current classroom conversation.") : copy.helpEncouragement}</p><button type="button" className="speaking-primary-button" onClick={onClose}>{japanese ? "わかりました" : "Got it"}</button></section></div>; }

function MissingSpeakingSession({ navigate, message = "This practice session may have ended or expired." }: { navigate: Navigate; message?: string }) { return <div className="speaking-empty-page"><CircleCheck size={38} aria-hidden="true" /><h1>Session not found</h1><p>{message}</p><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}>Join another activity</button></div>; }

function SpeakingResultPageV2({ navigate, participantId }: { navigate: Navigate; participantId: string }) {
  const [result, setResult] = useState<ResultResponse["result"]>();
  const [evaluationStatus, setEvaluationStatus] = useState<ResultResponse["evaluationStatus"]>();
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const resultRef = useRef<ResultResponse["result"] | undefined>(undefined);
  const pollNowRef = useRef<() => void>(() => undefined);
  resultRef.current = result;
  const retryEvaluation = async () => {
    if (!result || retrying) return;
    const token = sessionStorage.getItem("speaking-participant-token:" + participantId) ?? undefined;
    if (!token) return;
    setRetrying(true);
    setError("");
    try {
      const response = await speakingApi.finish(result.session.id, token) as { result?: ResultResponse["result"]; evaluationStatus?: ResultResponse["evaluationStatus"] };
      if (response.result) {
        resultRef.current = response.result;
        setResult(response.result);
      }
      setEvaluationStatus(response.evaluationStatus ?? "queued");
    } catch (retryError) {
      setError(getErrorMessage(retryError, "Evaluation could not be restarted. Please try again."));
    } finally {
      setRetrying(false);
    }
  };
  useEffect(() => {
    const token = sessionStorage.getItem("speaking-participant-token:" + participantId) ?? undefined;
    resultRef.current = undefined;
    setResult(undefined);
    setEvaluationStatus(undefined);
    setError("");
    let cancelled = false;
    let inFlight = false;
    let timerId: number | undefined;
    let stablePolls = 0;
    const controller = new AbortController();
    const schedule = () => {
      if (cancelled || resultRef.current?.evaluation) return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => { void poll(); }, nextSpeakingPollDelay({ stablePolls }));
    };
    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const payload = await speakingApi.result(participantId, token, controller.signal) as ResultResponse;
        if (cancelled) return;
        resultRef.current = payload.result;
        setResult(payload.result);
        setEvaluationStatus(payload.evaluationStatus);
        setError("");
        stablePolls = Math.min(6, stablePolls + 1);
        if (!payload.result.evaluation) schedule();
      } catch (loadError) {
        if (!cancelled && !(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(getErrorMessage(loadError, "The result is not available yet."));
          stablePolls = 0;
          schedule();
        }
      } finally {
        inFlight = false;
      }
    };
    pollNowRef.current = () => {
      stablePolls = 0;
      if (timerId !== undefined) window.clearTimeout(timerId);
      void poll();
    };
    void poll();
    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
      controller.abort();
      pollNowRef.current = () => undefined;
    };
  }, [participantId]);
  if (!result && !error) return <div className="speaking-empty-page"><LoaderCircle size={34} className="speaking-spin" aria-hidden="true" /><h1>Preparing your result</h1><p>Your real conversation is being evaluated…</p></div>;
  if (!result) return <MissingSpeakingSession navigate={navigate} message={error} />;
  const hasSpeech = hasStudentSpeech(result.turns);
  const copy = speakingFeedbackCopy(result.evaluation?.language ?? result.activity.nativeLanguage);
  const insufficientEvidence = Boolean(result.evaluation && (result.evaluation.assessmentStatus === "insufficient_evidence" || !hasSpeech));
  const evaluationPending = !result.evaluation && (result.participant.status === "evaluating" || evaluationStatus === "queued" || evaluationStatus === "running");
  const evaluationFailed = !result.evaluation && (result.participant.status === "error" || evaluationStatus === "failed");
  return <div className="speaking-page-shell speaking-result-page"><SpeakingTopbar navigate={navigate} /><main className="speaking-result-layout">{evaluationPending ? <section className="speaking-empty-card speaking-evaluation-status-card"><LoaderCircle size={34} className="speaking-spin" aria-hidden="true" /><span className="speaking-card-kicker">Evaluation in progress</span><h1>Your speaking practice is finished.</h1><p>Your feedback is being prepared. You can leave this page and return later; the saved evaluation will continue.</p><button type="button" className="speaking-outline-button" onClick={() => pollNowRef.current()}>Refresh status</button></section> : <><section className="speaking-result-hero"><span className="speaking-eyebrow"><Trophy size={15} aria-hidden="true" />{insufficientEvidence ? copy.notScored : "Activity complete"}</span><h1>{result.evaluation ? (insufficientEvidence ? copy.insufficientEvidenceHeadline : copy.scoredHeadline) : copy.evaluationUnavailable}</h1><p>{result.evaluation ? (insufficientEvidence ? result.evaluation.overallMessage : result.activity.title + " · " + copy.scoredSummary) : copy.evaluationUnavailableMessage}</p>{result.evaluation && !insufficientEvidence ? <div className="speaking-result-score"><strong>{scoreFor(result.evaluation)}</strong><span>{result.evaluation.language === "ja" ? "点" : "points"}</span><small>{result.evaluation.language === "ja" ? "今日のスピーキング" : "Today’s speaking"}</small></div> : <div className="speaking-result-score"><strong>—</strong><small>{insufficientEvidence ? copy.notScoredDetail : copy.evaluationUnavailable}</small></div>}</section>{result.evaluation ? <ResultPanel activity={result.activity} turns={result.turns} evaluation={result.evaluation} teacherView={false} /> : <div className="speaking-empty-card"><h2>{evaluationFailed ? "Evaluation needs another try" : copy.evaluationUnavailable}</h2><p>{evaluationFailed ? "Your conversation is saved. Retry evaluation when the service is available; your old turn will not be sent again." : copy.evaluationUnavailableMessage}</p>{evaluationFailed && <button type="button" className="speaking-primary-button" onClick={() => void retryEvaluation()} disabled={retrying}>{retrying ? "Retrying evaluation…" : "Retry evaluation"}</button>}{error && <p className="speaking-error" role="alert">{error}</p>}</div>}</>}<div className="speaking-result-actions"><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}><RotateCcw size={17} aria-hidden="true" />Try another activity</button><button className="speaking-text-button" type="button" onClick={() => navigate("/speak")}><ArrowLeft size={16} aria-hidden="true" />Speaking Practice home</button></div></main></div>;
}
