import { useCallback, useEffect, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
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
  type SpeakingRubricCriterion,
  type SpeakingTurn
} from "@quizstrike/shared";
import {
  SPEAKING_TEMPLATES,
  activityByCode,
  activityById,
  appendTurn,
  createActivity,
  createLocalSession,
  formatDuration,
  getActivityResult,
  loadSpeakingStore,
  makeDemoEvaluation,
  saveSpeakingStore,
  type LocalSpeakingSession,
  type SpeakingLocalStore
} from "./speakingData";
import {
  browserTtsProvider,
  mockConversationProvider,
  mockEvaluationProvider,
  mockTranscriptionProvider,
  type TranscriptionResult
} from "./speakingProviders";
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

type SpeakingState = "ready" | "listening" | "thinking" | "ai-speaking";
type Navigate = (nextPath: string) => void;

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

const updateStore = (setStore: Dispatch<SetStateAction<SpeakingLocalStore>>, next: SpeakingLocalStore) => {
  setStore(next);
  saveSpeakingStore(next);
};

export default function SpeakingPracticeApp() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const [store, setStore] = useState<SpeakingLocalStore>(() => loadSpeakingStore());
  const route = parseRoute(path);

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

  const navigate = useCallback<Navigate>((nextPath) => {
    const target = new URL(nextPath, window.location.origin);
    const targetPath = `${normalizePath(target.pathname)}${target.search}${target.hash}`;
    window.history.pushState(null, "", targetPath);
    setPath(normalizePath(target.pathname));
  }, []);

  const persist = useCallback((next: SpeakingLocalStore) => updateStore(setStore, next), []);

  return (
    <div className="speaking-app" id="main-content" tabIndex={-1}>
      {route.kind === "home" && <SpeakingHome navigate={navigate} store={store} />}
      {route.kind === "join" && route.code && activityByCode(store, route.code)
        ? <SpeakingPreActivityPage navigate={navigate} store={store} activity={activityByCode(store, route.code)!} persist={persist} />
        : route.kind === "join"
          ? <SpeakingJoinPage navigate={navigate} store={store} initialCode={route.code} persist={persist} />
          : null}
      {route.kind === "session" && <SpeakingSessionPage navigate={navigate} store={store} participantId={route.id} persist={persist} />}
      {route.kind === "result" && <SpeakingResultPage navigate={navigate} store={store} participantId={route.id} />}
      {route.kind === "teacher" && <SpeakingTeacherDashboard navigate={navigate} store={store} />}
      {route.kind === "create" && <SpeakingCreatePage navigate={navigate} store={store} persist={persist} />}
      {route.kind === "activity" && <SpeakingActivityPage navigate={navigate} store={store} persist={persist} activityId={route.id} results={route.results === true} />}
      {route.kind === "teacher-result" && <SpeakingTeacherResultPage navigate={navigate} store={store} participantId={route.id} />}
    </div>
  );
}

function SpeakingBrand({ navigate, compact = false }: { navigate: Navigate; compact?: boolean }) {
  return (
    <button className={`speaking-brand${compact ? " speaking-brand-compact" : ""}`} type="button" onClick={() => navigate("/speak")} aria-label="GyakutenEigo Speaking Practice home">
      <span className="speaking-brand-mark"><MessageCircle size={compact ? 22 : 28} strokeWidth={2.2} aria-hidden="true" /></span>
      <span className="speaking-brand-name">GyakutenEigo</span>
    </button>
  );
}

function SpeakingTopbar({ navigate, active = "home", teacher = false }: { navigate: Navigate; active?: "home" | "join" | "teacher"; teacher?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className={`speaking-topbar${teacher ? " speaking-topbar-teacher" : ""}`}>
      <SpeakingBrand navigate={navigate} compact />
      <nav id="speaking-navigation" className={`speaking-topbar-actions${menuOpen ? " is-open" : ""}`} aria-label="Speaking Practice navigation">
        <button type="button" className={active === "home" ? "is-active" : ""} onClick={() => navigate("/speak")}><Sparkles size={16} aria-hidden="true" />Practice</button>
        <button type="button" className={active === "join" ? "is-active" : ""} onClick={() => navigate("/speak/join")}><ScanLine size={16} aria-hidden="true" />Join activity</button>
        <button type="button" className={active === "teacher" ? "is-active" : ""} onClick={() => navigate("/speak/teacher")}><UserRound size={16} aria-hidden="true" />Teacher tools</button>
      </nav>
      <button className="speaking-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="speaking-navigation" onClick={() => setMenuOpen((open) => !open)}><Menu size={20} aria-hidden="true" /><span>Menu</span></button>
    </header>
  );
}

function SpeakingHome({ navigate, store }: { navigate: Navigate; store: SpeakingLocalStore }) {
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

  const demoTurns: SpeakingTurn[] = [
    { id: "preview-ai", participantId: "preview", speaker: "ai", text: "Hi! Can I help you today?", createdAt: new Date().toISOString() }
  ];
  const demoActivity = activityById(store, "demo-shopping") ?? SPEAKING_TEMPLATES[1];

  return (
    <div className="speaking-home-page">
      <header className="speaking-hero-header">
        <SpeakingBrand navigate={navigate} />
        <div className="speaking-hero-title-block">
          <h1>Speaking Practice</h1>
          <p>話す力を、未来のチカラに。<br /><span>AIとのリアルな会話で、英語がもっと身近に。</span></p>
        </div>
        <div className="speaking-hero-header-actions">
          <button type="button" className="speaking-outline-button" onClick={() => navigate("/speak/join")}><ScanLine size={17} aria-hidden="true" />Join</button>
          <button type="button" className="speaking-primary-button" onClick={() => navigate("/speak/teacher/create")}><Edit3 size={17} aria-hidden="true" />Create Activity</button>
        </div>
      </header>

      <main className="speaking-showcase" aria-label="Speaking Practice product preview">
        <section className="speaking-device" aria-label="Student speaking experience preview">
          <div className="speaking-device-camera" aria-hidden="true" />
          <div className="speaking-device-screen">
            <SpeakingScreen
              activity={demoActivity}
              state={demoState}
              remainingSeconds={222}
              turns={demoTurns}
              transcriptPreview={demoState === "listening" ? "You: listening…" : "You: …"}
              onMic={playDemoTurn}
              onHelp={() => setDemoHelp(true)}
              onFinish={() => navigate("/speak/result/demo-participant")}
              onPhraseClick={(phrase) => setSelectedPhrase(phrase)}
              preview
            />
          </div>
        </section>

        <aside className="speaking-teacher-rail" aria-label="Teacher tools preview">
          <p className="speaking-rail-label">先生用ツール（プレビュー）</p>
          <TeacherPreviewCard navigate={navigate} />
          <ResultPreviewCard navigate={navigate} />
        </aside>
      </main>

      <section className="speaking-feature-strip" aria-label="Speaking Practice features">
        <FeatureItem icon={<Volume2 size={28} aria-hidden="true" />} title="音声中心の学習体験" detail="タップして話すだけの\nシンプル操作" />
        <FeatureItem icon={<MessageCircle size={28} aria-hidden="true" />} title="AIパートナーとの対話" detail="自然な会話で、何度でも\n練習できる" />
        <FeatureItem icon={<BarChart3 size={28} aria-hidden="true" />} title="学習データで成長を可視化" detail="ルーブリック評価で、強みと\n課題がわかる" />
        <FeatureItem icon={<Users size={28} aria-hidden="true" />} title="先生の授業をもっと便利に" detail="簡単作成・QRで招待・評価で、\n指導をサポート" />
      </section>

      {selectedPhrase && <div className="speaking-toast" role="status"><Lightbulb size={17} aria-hidden="true" /><span>Try saying “{selectedPhrase}”</span><button type="button" onClick={() => setSelectedPhrase(undefined)} aria-label="Close phrase tip"><X size={15} aria-hidden="true" /></button></div>}
      {demoHelp && <HelpDialog activity={demoActivity} onClose={() => setDemoHelp(false)} />}
    </div>
  );
}

function FeatureItem({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="speaking-feature-item"><span className="speaking-feature-icon">{icon}</span><div><strong>{title}</strong><span>{detail}</span></div></div>;
}

interface SpeakingScreenProps {
  activity: SpeakingActivity;
  state: SpeakingState;
  remainingSeconds: number;
  turns: SpeakingTurn[];
  transcriptPreview?: string;
  onMic: () => void;
  onHelp: () => void;
  onFinish: () => void;
  onPhraseClick?: (phrase: string) => void;
  preview?: boolean;
}

const stateLabels: Record<SpeakingState, string> = {
  ready: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  "ai-speaking": "AI Speaking"
};

const stateDescriptions: Record<SpeakingState, string> = {
  ready: "Your turn — tap the microphone when you are ready.",
  listening: "Listening… tap again when you finish.",
  thinking: "I’m thinking about what you said…",
  "ai-speaking": "Listen to your speaking partner."
};

function SpeakingScreen({ activity, state, remainingSeconds, turns, transcriptPreview, onMic, onHelp, onFinish, onPhraseClick, preview = false }: SpeakingScreenProps) {
  const currentAiTurn = [...turns].reverse().find((turn) => turn.speaker === "ai");
  const sentence = state === "listening" ? "Your turn" : state === "thinking" ? "Let me think…" : currentAiTurn?.text ?? "Hi! Can I help you today?";
  const durationProgress = Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, activity.durationSeconds)) * 100));
  const micLabel = state === "listening" ? "Stop speaking" : state === "thinking" ? "Processing your answer" : "Tap to speak";
  return (
    <div className={`speaking-screen speaking-screen-${state}${preview ? " speaking-screen-preview" : ""}`}>
      <header className="speaking-screen-header">
        <div className="speaking-screen-title"><button className="speaking-screen-menu" type="button" aria-label="Open speaking menu"><Menu size={22} aria-hidden="true" /></button><span>Speaking Practice</span></div>
        <div className="speaking-screen-activity"><ShoppingBag size={19} aria-hidden="true" /><strong>{activity.title}</strong></div>
        <div className="speaking-screen-timer"><Clock3 size={17} aria-hidden="true" /><span>{formatDuration(remainingSeconds)} left</span><span className="speaking-progress"><span style={{ width: `${durationProgress}%` }} /></span><button type="button" onClick={onFinish}>Finish</button></div>
      </header>

      <div className="speaking-screen-body">
        <aside className="speaking-scenario-card">
          <ShoppingBag size={37} strokeWidth={1.6} aria-hidden="true" />
          <div><span className="speaking-card-kicker">Scenario</span><p>{activity.scenario}</p></div>
        </aside>

        <section className="speaking-partner-panel" aria-label="AI speaking partner">
          <div className="speaking-partner-avatar-wrap"><img src="/assets/speaking/ai-shop-assistant.png" alt="AI shop assistant" /></div>
          <p className="speaking-partner-role">AI Partner: {activity.aiRole}</p>
          <div className="speaking-speech-bubble"><Volume2 size={30} aria-hidden="true" /><span>{sentence}</span></div>
          <p className="speaking-state-description" aria-live="polite">{stateDescriptions[state]}</p>
          <div className="speaking-state-list" aria-label="Speaking state">
            {(Object.keys(stateLabels) as SpeakingState[]).map((item) => <span key={item} className={item === state ? "is-active" : ""}><span className="speaking-state-dot" aria-hidden="true">{item === state ? <CircleCheck size={15} /> : item === "thinking" ? <LoaderCircle size={15} /> : <span />}</span>{stateLabels[item]}</span>)}
          </div>
        </section>

        <aside className="speaking-useful-card">
          <div className="speaking-useful-heading"><strong>Useful English</strong><Bookmark size={19} aria-hidden="true" /></div>
          <div className="speaking-expression-list">
            {activity.targetExpressions.slice(0, 5).map((expression) => <button type="button" key={expression} onClick={() => onPhraseClick?.(expression)}><MessageCircle size={17} aria-hidden="true" /><span>{expression}</span></button>)}
          </div>
        </aside>
      </div>

      <footer className="speaking-screen-footer">
        <div className="speaking-transcript-preview"><span>Transcript <small>(preview)</small></span><p><strong>AI:</strong> {currentAiTurn?.text ?? "Hi! Can I help you today?"}</p><p><strong>You:</strong> {transcriptPreview ?? "…"}</p></div>
        <div className="speaking-mic-wrap"><button className={`speaking-mic speaking-mic-${state}`} type="button" onClick={onMic} disabled={state === "thinking"} aria-label={micLabel}><Mic size={53} strokeWidth={1.9} aria-hidden="true" /></button><span className="speaking-mic-label">{state === "listening" ? "Listening…" : state === "thinking" ? "Thinking…" : "Tap to Speak"}</span></div>
        <button type="button" className="speaking-help-button" onClick={onHelp}><Lightbulb size={20} aria-hidden="true" /><span>Help</span></button>
      </footer>
    </div>
  );
}

function TeacherPreviewCard({ navigate }: { navigate: Navigate }) {
  const [name, setName] = useState("Shopping for Clothes");
  return (
    <section className="speaking-rail-card speaking-create-preview">
      <div className="speaking-rail-card-heading"><Edit3 size={20} aria-hidden="true" /><strong>Create Activity</strong></div>
      <label>Activity Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>AI Role<div className="speaking-select-wrap"><select defaultValue="Shop Assistant"><option>Shop Assistant</option><option>Restaurant worker</option><option>Helpful local</option></select><ChevronDown size={15} aria-hidden="true" /></div></label>
      <label>Student Role<div className="speaking-select-wrap"><select defaultValue="Customer"><option>Customer</option><option>Student</option><option>Visitor</option></select><ChevronDown size={15} aria-hidden="true" /></div></label>
      <label>Target English<textarea defaultValue="Asking about items, sizes, and prices" rows={2} /></label>
      <div className="speaking-rubric-mini"><span>Rubric (4 Skills)</span>{["Communication", "Interaction", "Vocabulary", "Grammar"].map((criterion, index) => <div key={criterion}><strong>{criterion}</strong><span className="speaking-stars" aria-label={`${4 - (index === 3 ? 1 : 0)} out of 4 stars`}>{[0, 1, 2, 3].map((star) => <Star key={star} size={15} fill={star < (index === 3 ? 3 : 4) ? "currentColor" : "none"} aria-hidden="true" />)}</span></div>)}</div>
      <div className="speaking-share-mini"><div><span>参加コード / QRコード</span><QRCodeSVG value={`${window.location.origin}/speak/join/ABC123`} size={69} bgColor="#ffffff" fgColor="#12214b" level="M" /></div><div className="speaking-code-mini"><small>Join Code</small><strong>ABC123</strong><Copy size={16} aria-hidden="true" /></div></div>
      <button className="speaking-rail-link" type="button" onClick={() => navigate("/speak/teacher/create")}>Open activity builder <ArrowRight size={15} aria-hidden="true" /></button>
    </section>
  );
}

function ResultPreviewCard({ navigate }: { navigate: Navigate }) {
  return (
    <section className="speaking-rail-card speaking-result-preview">
      <div className="speaking-result-heading"><strong>学習結果 (サマリー)</strong><button type="button" onClick={() => navigate("/speak/teacher/activity/demo-shopping/results")}>一覧を見る</button></div>
      <div className="speaking-student-summary"><span className="speaking-student-avatar"><UserRound size={22} aria-hidden="true" /></span><div><strong>山田 花子</strong><small>Shopping for Clothes</small></div><b>85<small>点</small></b></div>
      <div className="speaking-mini-result-body"><div className="speaking-mini-score-list">{["Communication", "Interaction", "Vocabulary", "Grammar"].map((criterion, index) => <div key={criterion}><span>{criterion}</span><span className="speaking-stars">{[0, 1, 2, 3].map((star) => <Star key={star} size={12} fill={star < (index === 3 ? 3 : 4) ? "currentColor" : "none"} aria-hidden="true" />)}</span></div>)}</div><div className="speaking-feedback-note"><strong>よくできました！</strong><span>自然なやり取りができています。最後まで話せたのがとても良かったです。</span></div></div>
    </section>
  );
}

function SpeakingJoinPage({ navigate, store, initialCode, persist }: { navigate: Navigate; store: SpeakingLocalStore; initialCode?: string; persist: (store: SpeakingLocalStore) => void }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const recommended = store.activities.filter((activity) => activity.status !== "ended").slice(0, 3);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const activity = activityByCode(store, code);
    if (!activity) {
      setError("そのコードのアクティビティが見つかりません。もう一度確認してください。");
      return;
    }
    if (activity.identifierMode !== "anonymous" && !identifier.trim()) {
      setError(activity.identifierMode === "student_number" ? "学籍番号を入力してください。" : "ニックネームを入力してください。");
      return;
    }
    if (identifier.trim()) sessionStorage.setItem(`speaking-identifier:${activity.joinCode}`, identifier.trim());
    persist(store);
    navigate(`/speak/join/${activity.joinCode}`);
  };
  const selectedActivity = activityByCode(store, code);
  return (
    <div className="speaking-page-shell speaking-join-page">
      <SpeakingTopbar navigate={navigate} active="join" />
      <main className="speaking-join-layout">
        <section className="speaking-join-copy"><span className="speaking-eyebrow"><ScanLine size={15} aria-hidden="true" /> Student entry</span><h1>Ready to speak?</h1><p>Enter your activity code. You do not need an account.</p><div className="speaking-join-proof"><CircleCheck size={17} aria-hidden="true" /><span>Private classroom activity</span><CircleCheck size={17} aria-hidden="true" /><span>Short speaking practice</span></div></section>
        <form className="speaking-form-card" onSubmit={submit}>
          <div className="speaking-form-heading"><span>Join an activity</span><h2>Enter activity code</h2><p>Ask your teacher if you do not have the code.</p></div>
          <label htmlFor="speaking-activity-code">Activity code<input id="speaking-activity-code" className="speaking-code-input" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setError(""); }} placeholder="ABC123" autoComplete="off" maxLength={6} /></label>
          {selectedActivity && selectedActivity.identifierMode !== "anonymous" && <label htmlFor="speaking-identifier">{selectedActivity.identifierMode === "student_number" ? "Student number" : "Nickname"}<input id="speaking-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={selectedActivity.identifierMode === "student_number" ? "e.g. 12" : "e.g. Hana"} maxLength={80} /></label>}
          {error && <p className="speaking-error" role="alert">{error}</p>}
          <button className="speaking-primary-button speaking-wide-button" type="submit"><ArrowRight size={18} aria-hidden="true" />Join Activity</button>
          <p className="speaking-privacy-note"><ShieldIcon /><span>Your teacher sees your activity result, not a permanent profile.</span></p>
          <div className="speaking-demo-codes"><span>Demo codes</span>{recommended.map((activity) => <button key={activity.id} type="button" onClick={() => { setCode(activity.joinCode); setIdentifier(activity.identifierMode === "anonymous" ? "" : "Hana"); setError(""); }}>{activity.joinCode}<small>{activity.title}</small></button>)}</div>
        </form>
      </main>
      <div className="speaking-join-footer"><button type="button" className="speaking-text-button" onClick={() => navigate("/speak")}><ArrowLeft size={16} aria-hidden="true" />Back to Speaking Practice</button></div>
    </div>
  );
}

function ShieldIcon() {
  return <span className="speaking-privacy-dot" aria-hidden="true"><CircleCheck size={14} /></span>;
}

function SpeakingPreActivityPage({ navigate, store, activity, persist }: { navigate: Navigate; store: SpeakingLocalStore; activity: SpeakingActivity; persist: (store: SpeakingLocalStore) => void }) {
  const [micState, setMicState] = useState<"idle" | "requesting" | "denied" | "unsupported">("idle");
  const identifier = sessionStorage.getItem(`speaking-identifier:${activity.joinCode}`) ?? "";
  const startSession = () => {
    const session = createLocalSession(activity, identifier);
    persist({ ...store, sessions: { ...store.sessions, [session.participant.id]: session } });
    navigate(`/speak/session/${session.participant.id}`);
  };
  const requestMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState("unsupported");
      return;
    }
    setMicState("requesting");
    try {
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise<MediaStream>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 3_500))
      ]);
      stream.getTracks().forEach((track) => track.stop());
      sessionStorage.setItem("speaking-microphone-ready", "true");
      startSession();
    } catch {
      setMicState("denied");
    }
  };
  return (
    <div className="speaking-page-shell speaking-preactivity-page">
      <SpeakingTopbar navigate={navigate} />
      <main className="speaking-preactivity-layout">
        <section className="speaking-preactivity-hero"><span className="speaking-eyebrow"><ShoppingBag size={15} aria-hidden="true" /> Before you start</span><h1>{activity.title}</h1><p>{activity.scenario}</p><div className="speaking-role-pills"><span>You are: <strong>{activity.studentRole}</strong></span><span>Talk to: <strong>{activity.aiRole}</strong></span><span><Clock3 size={14} aria-hidden="true" /> {formatDuration(activity.durationSeconds)}</span></div></section>
        <section className="speaking-prep-card"><div className="speaking-prep-card-heading"><div><span className="speaking-card-kicker">Useful English</span><h2>A few phrases to try</h2></div><Bookmark size={20} aria-hidden="true" /></div><div className="speaking-prep-expressions">{activity.targetExpressions.map((expression) => <div key={expression}><MessageCircle size={17} aria-hidden="true" /><span>{expression}</span></div>)}</div><div className="speaking-mic-explanation"><span className="speaking-mic-explanation-icon"><Mic size={22} aria-hidden="true" /></span><div><strong>We need your microphone</strong><p>So you can talk to the AI. We do not save your recording by default.</p></div></div>{micState === "denied" && <div className="speaking-error speaking-prep-error" role="alert"><strong>Microphone permission was not available.</strong><span>You can try again, or continue with mock speaking practice.</span><div><button type="button" className="speaking-outline-button" onClick={() => setMicState("idle")}>Try again</button><button type="button" className="speaking-primary-button" onClick={startSession}>Continue</button></div></div>}{micState === "unsupported" && <div className="speaking-error speaking-prep-error" role="alert"><strong>This browser cannot use a microphone.</strong><span>Continue to see the full activity demo.</span><button type="button" className="speaking-primary-button" onClick={startSession}>Continue</button></div>}{micState === "requesting" ? <button type="button" className="speaking-primary-button speaking-wide-button" disabled><LoaderCircle size={18} className="speaking-spin" aria-hidden="true" />Checking microphone…</button> : micState === "idle" && <button type="button" className="speaking-primary-button speaking-wide-button" onClick={requestMicrophone}><Mic size={18} aria-hidden="true" />Start Speaking</button>}</section>
      </main>
    </div>
  );
}

function SpeakingSessionPage({ navigate, store, participantId, persist }: { navigate: Navigate; store: SpeakingLocalStore; participantId: string; persist: (store: SpeakingLocalStore) => void }) {
  const localSession = store.sessions[participantId];
  const activity = localSession ? activityById(store, localSession.activityId) : undefined;
  if (!localSession || !activity) return <MissingSpeakingSession navigate={navigate} />;
  return <SpeakingSessionExperience navigate={navigate} store={store} session={localSession} activity={activity} persist={persist} />;
}

function SpeakingSessionExperience({ navigate, store, session: initialSession, activity, persist }: { navigate: Navigate; store: SpeakingLocalStore; session: LocalSpeakingSession; activity: SpeakingActivity; persist: (store: SpeakingLocalStore) => void }) {
  const [session, setSession] = useState(initialSession);
  const [state, setState] = useState<SpeakingState>("ai-speaking");
  const [remaining, setRemaining] = useState(() => Math.max(0, activity.durationSeconds - Math.floor((Date.now() - Date.parse(initialSession.participant.startedAt)) / 1000)));
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [micNotice, setMicNotice] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const microphoneRequestRef = useRef<Promise<void> | null>(null);
  const microphoneCapturedRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const speechAnalysisAvailableRef = useRef(false);
  const speechMonitorRef = useRef<{ stream: MediaStream; context: AudioContext; frameId: number } | null>(null);

  const stopTurnMicrophone = () => {
    const monitor = speechMonitorRef.current;
    if (monitor) {
      window.cancelAnimationFrame(monitor.frameId);
      void monitor.context.close();
      speechMonitorRef.current = null;
    }
    const capture = {
      hasMicrophone: microphoneCapturedRef.current,
      speechDetected: speechDetectedRef.current,
      speechAnalyzed: speechAnalysisAvailableRef.current
    };
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    microphoneCapturedRef.current = false;
    speechDetectedRef.current = false;
    speechAnalysisAvailableRef.current = false;
    return capture;
  };

  useEffect(() => {
    const greetingTimer = window.setTimeout(() => setState("ready"), 1_500);
    const interval = window.setInterval(() => {
      setRemaining(Math.max(0, activity.durationSeconds - Math.floor((Date.now() - Date.parse(initialSession.participant.startedAt)) / 1000)));
    }, 1_000);
    return () => { window.clearTimeout(greetingTimer); window.clearInterval(interval); stopTurnMicrophone(); browserTtsProvider.cancel(); };
  }, [activity.durationSeconds, initialSession.participant.startedAt]);

  const saveSession = (nextSession: LocalSpeakingSession) => {
    setSession(nextSession);
    persist({ ...store, sessions: { ...store.sessions, [nextSession.participant.id]: nextSession } });
  };

  const requestTurnMicrophone = async () => {
    stopTurnMicrophone();
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise<MediaStream>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 2_500))
      ]);
      streamRef.current = stream;
      microphoneCapturedRef.current = true;
      speechDetectedRef.current = false;
      speechAnalysisAvailableRef.current = false;

      const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      const context = new AudioContextConstructor();
      try {
        await context.resume();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        let activeFrames = 0;
        speechAnalysisAvailableRef.current = true;
        const monitorState = { stream, context, frameId: 0 };
        speechMonitorRef.current = monitorState;
        const monitor = () => {
          if (streamRef.current !== stream || speechMonitorRef.current !== monitorState) return;
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;
          for (const sample of samples) {
            const centered = (sample - 128) / 128;
            sumSquares += centered * centered;
          }
          if (Math.sqrt(sumSquares / samples.length) > 0.035) activeFrames += 1;
          if (activeFrames >= 2) speechDetectedRef.current = true;
          monitorState.frameId = window.requestAnimationFrame(monitor);
        };
        monitor();
      } catch {
        speechAnalysisAvailableRef.current = false;
        await context.close();
      }
    } catch {
      setMicNotice("マイクを使えないため、デモ音声で続けます。");
    }
  };

  const processTurn = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setState("thinking");
    setError("");
    try {
      await microphoneRequestRef.current;
      microphoneRequestRef.current = null;
      const capture = stopTurnMicrophone();
      const transcription: TranscriptionResult = await mockTranscriptionProvider.transcribe(undefined, session.turns.filter((turn) => turn.speaker === "student").length, {
        hasMicrophone: capture.hasMicrophone,
        ...(capture.speechAnalyzed ? { speechDetected: capture.speechDetected } : {})
      });
      if (!transcription.text.trim()) {
        setMicNotice("I couldn't hear any speech. Please say a short sentence and try again.");
        setState("ready");
        return;
      }
      const withStudent = appendTurn(session, { speaker: "student", text: transcription.text, transcriptionConfidence: transcription.confidence });
      saveSession(withStudent);
      const response = await mockConversationProvider.respond({ activity, turns: withStudent.turns, studentText: transcription.text });
      const withAi = appendTurn(withStudent, { speaker: "ai", text: response });
      saveSession(withAi);
      setState("ai-speaking");
      await browserTtsProvider.speak(response, { lang: "en-US", rate: activity.level === "beginner" ? 0.82 : 0.92 });
      setState("ready");
    } catch {
      setError("I couldn't hear that clearly. Please try again.");
      setState("ready");
    } finally {
      setIsProcessing(false);
    }
  };

  const onMic = async () => {
    if (state === "thinking" || isProcessing) return;
    if (state === "listening") {
      await processTurn();
      return;
    }
    setMicNotice("");
    setState("listening");
    microphoneRequestRef.current = requestTurnMicrophone();
  };

  const onHelp = async () => {
    if (isProcessing) return;
    const help = await mockConversationProvider.help({ activity, turns: session.turns });
    const nextParticipant = { ...session.participant, helpCount: session.participant.helpCount + 1 };
    const nextSession = { ...session, participant: nextParticipant };
    saveSession(nextSession);
    setHelpText(help);
    setHelpOpen(true);
  };

  const finish = async () => {
    if (isProcessing || session.participant.status === "completed") return;
    setIsProcessing(true);
    setState("thinking");
    try {
      const evaluation = await mockEvaluationProvider.evaluate({ activity, turns: session.turns, participantId: session.participant.id, helpCount: session.participant.helpCount });
      const nextSession: LocalSpeakingSession = { ...session, participant: { ...session.participant, status: "completed", finishedAt: new Date().toISOString() }, evaluation };
      saveSession(nextSession);
      navigate(`/speak/result/${session.participant.id}`);
    } catch {
      setError("結果を作成できませんでした。もう一度お試しください。");
      setState("ready");
      setIsProcessing(false);
    }
  };

  const latestStudent = [...session.turns].reverse().find((turn) => turn.speaker === "student");
  return (
    <div className="speaking-session-page">
      <SpeakingTopbar navigate={navigate} active="home" />
      <main className="speaking-session-main">
        {error && <div className="speaking-session-alert" role="alert"><HelpCircle size={18} aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Close error"><X size={15} aria-hidden="true" /></button></div>}
        {micNotice && <div className="speaking-session-note" role="status"><Mic size={16} aria-hidden="true" /><span>{micNotice}</span></div>}
        <SpeakingScreen activity={activity} state={state} remainingSeconds={remaining} turns={session.turns} transcriptPreview={latestStudent?.text ?? "…"} onMic={onMic} onHelp={onHelp} onFinish={finish} onPhraseClick={(phrase) => setHelpText(`Try saying “${phrase}”`)} />
      </main>
      {helpOpen && <HelpDialog activity={activity} onClose={() => setHelpOpen(false)} helpText={helpText} />}
    </div>
  );
}

function HelpDialog({ activity, onClose, helpText }: { activity: SpeakingActivity; onClose: () => void; helpText?: string }) {
  const suggestion = helpText || activity.targetExpressions[0] || "Could you say that again, please?";
  return <div className="speaking-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="speaking-help-dialog" role="dialog" aria-modal="true" aria-labelledby="speaking-help-title"><button type="button" className="speaking-dialog-close" onClick={onClose} aria-label="Close help"><X size={18} aria-hidden="true" /></button><span className="speaking-help-dialog-icon"><Lightbulb size={25} aria-hidden="true" /></span><span className="speaking-card-kicker">Help</span><h2 id="speaking-help-title">You can try this:</h2><p className="speaking-help-phrase">{suggestion}</p><p className="speaking-help-copy">自分の言葉で大丈夫です。短い文でも、ゆっくりでも伝わります。</p><button type="button" className="speaking-primary-button" onClick={onClose}>Got it</button></section></div>;
}

function MissingSpeakingSession({ navigate }: { navigate: Navigate }) {
  return <div className="speaking-empty-page"><CircleCheck size={38} aria-hidden="true" /><h1>Session not found</h1><p>This practice session may have ended or expired.</p><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}>Join another activity</button></div>;
}

function SpeakingResultPage({ navigate, store, participantId }: { navigate: Navigate; store: SpeakingLocalStore; participantId: string }) {
  const result = getActivityResult(store, participantId);
  const fallbackActivity = activityById(store, "demo-shopping") ?? SPEAKING_TEMPLATES[1];
  const evaluation = result?.evaluation ?? makeDemoEvaluation(participantId);
  return <div className="speaking-page-shell speaking-result-page"><SpeakingTopbar navigate={navigate} /><main className="speaking-result-layout"><section className="speaking-result-hero"><span className="speaking-eyebrow"><Trophy size={15} aria-hidden="true" />{result?.turns && hasStudentSpeech(result.turns) ? "Activity complete" : "No speech detected"}</span><h1>{result?.turns && hasStudentSpeech(result.turns) ? "よくできました！" : "もう一度話してみよう"}</h1><p>{result?.turns && hasStudentSpeech(result.turns) ? `${result.activity.title} の会話が終わりました。` : "声が聞こえなかったため、会話は始まりませんでした。"}</p><div className="speaking-result-score"><strong>{scoreFor(evaluation, result?.turns ?? [])}</strong><span>点</span><small>今日のスピーキング</small></div></section><ResultPanel activity={result?.activity ?? fallbackActivity} turns={result?.turns ?? []} evaluation={evaluation} teacherView={false} /><div className="speaking-result-actions"><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/join")}><RotateCcw size={17} aria-hidden="true" />Try another activity</button><button className="speaking-text-button" type="button" onClick={() => navigate("/speak")}><ArrowLeft size={16} aria-hidden="true" />Speaking Practice home</button></div></main></div>;
}

const hasStudentSpeech = (turns: SpeakingTurn[]) => turns.some((turn) => turn.speaker === "student" && turn.text.trim().length > 0);

const scoreFor = (evaluation: SpeakingEvaluation, turns?: SpeakingTurn[]) => {
  if (turns && !hasStudentSpeech(turns)) return 0;
  const scores = Object.values(evaluation.scores);
  return scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / (scores.length * 4)) * 100) : 0;
};

const scoreForCriterion = (evaluation: SpeakingEvaluation, criterionId: string, turns: SpeakingTurn[]) => hasStudentSpeech(turns) ? evaluation.scores[criterionId] ?? 0 : 0;

function ResultPanel({ activity, turns, evaluation, teacherView }: { activity: Pick<SpeakingActivity, "title" | "rubric" | "targetExpressions" | "nativeLanguage">; turns: SpeakingTurn[]; evaluation: SpeakingEvaluation; teacherView: boolean }) {
  const studentTurns = turns.filter((turn) => turn.speaker === "student");
  return <section className={`speaking-result-panel${teacherView ? " speaking-result-panel-teacher" : ""}`}><div className="speaking-result-panel-heading"><div><span className="speaking-card-kicker">{teacherView ? "Evaluation detail" : "Your speaking result"}</span><h2>{teacherView ? activity.title : "今回の結果"}</h2></div><span className="speaking-result-language"><Languages size={15} aria-hidden="true" />{evaluation.language === "ja" ? "日本語フィードバック" : "English feedback"}</span></div><div className="speaking-score-grid">{activity.rubric.filter((criterion) => criterion.enabled).map((criterion) => <div className="speaking-score-row" key={criterion.id}><div><strong>{criterion.name === "Fluency / Comprehensibility" ? "Fluency" : criterion.name}</strong>{teacherView && <small>{evaluation.evidence[criterion.id] ?? criterion.description}</small>}</div><span className="speaking-stars" aria-label={`${scoreForCriterion(evaluation, criterion.id, turns)} out of 4 stars`}>{[1, 2, 3, 4].map((star) => <Star key={star} size={17} fill={star <= (scoreForCriterion(evaluation, criterion.id, turns)) ? "currentColor" : "none"} aria-hidden="true" />)}<b>{scoreForCriterion(evaluation, criterion.id, turns)}/4</b></span></div>)}</div><div className="speaking-result-columns"><div className="speaking-result-message speaking-result-message-good"><h3>👍 What You Did Well</h3><ul>{evaluation.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul></div><div className="speaking-result-message"><h3>🚀 Try This Next Time</h3><ul>{evaluation.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}</ul></div></div><div className="speaking-useful-result"><div className="speaking-result-section-heading"><h3>💬 Useful English</h3><span>{studentTurns.length} speaking turns</span></div>{evaluation.usefulEnglish.length ? evaluation.usefulEnglish.map((item) => <div className="speaking-correction-row" key={item.said}><div><small>You said</small><span>“{item.said}”</span></div><ArrowRight size={17} aria-hidden="true" /><div><small>Try</small><strong>“{item.try}”</strong></div></div>) : <p className="speaking-muted-copy">{hasStudentSpeech(turns) ? "Your conversation was saved for your teacher’s review." : "No speech was detected in this attempt."}</p>}</div>{teacherView && <div className="speaking-transcript-detail"><div className="speaking-result-section-heading"><h3>Transcript</h3><span>Conversation evidence</span></div>{turns.map((turn) => <p key={turn.id}><strong>{turn.speaker === "ai" ? "AI" : "Student"}</strong><span>{turn.text}</span></p>)}</div>}</section>;
}

function SpeakingTeacherDashboard({ navigate, store }: { navigate: Navigate; store: SpeakingLocalStore }) {
  const activities = store.activities.filter((activity) => activity.teacherId === "demo-teacher" || activity.id.startsWith("activity-"));
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="home" /><section className="speaking-teacher-content"><div className="speaking-teacher-heading"><div><span className="speaking-eyebrow"><UserRound size={15} aria-hidden="true" /> Teacher workspace</span><h1>Speaking Practice</h1><p>Create a focused activity, share one code, and see how your students communicated.</p></div><button className="speaking-primary-button" type="button" onClick={() => navigate("/speak/teacher/create")}><Plus size={18} aria-hidden="true" />Create Activity</button></div><section className="speaking-teacher-stats"><div><span>Activities</span><strong>{activities.length}</strong><small>ready to share</small></div><div><span>Students practiced</span><strong>{Object.keys(store.sessions).length}</strong><small>mock data included</small></div><div><span>Help used</span><strong>{Object.values(store.sessions).reduce((sum, session) => sum + session.participant.helpCount, 0)}</strong><small>support moments</small></div></section><div className="speaking-section-title"><div><span className="speaking-card-kicker">Your activities</span><h2>Keep practice moving</h2></div><button className="speaking-text-button" type="button" onClick={() => navigate("/speak/teacher/create")}>New activity <ArrowRight size={15} aria-hidden="true" /></button></div><div className="speaking-activity-list">{activities.map((activity) => <TeacherActivityRow key={activity.id} activity={activity} store={store} navigate={navigate} />)}</div></section></main></div>;
}

function SpeakingTeacherSidebar({ navigate, active }: { navigate: Navigate; active: "home" | "create" | "results" }) {
  return <aside className="speaking-teacher-sidebar"><div className="speaking-sidebar-label">Workspace</div><button type="button" className={active === "home" ? "is-active" : ""} onClick={() => navigate("/speak/teacher")}><BarChart3 size={17} aria-hidden="true" />Overview</button><button type="button" className={active === "create" ? "is-active" : ""} onClick={() => navigate("/speak/teacher/create")}><Edit3 size={17} aria-hidden="true" />Create Activity</button><button type="button" className={active === "results" ? "is-active" : ""} onClick={() => navigate("/speak/teacher/activity/demo-shopping/results")}><Trophy size={17} aria-hidden="true" />Results</button><div className="speaking-sidebar-divider" /><div className="speaking-sidebar-note"><Lightbulb size={17} aria-hidden="true" /><span>Mock mode is on.<br />You can demo the full flow without AI credentials.</span></div></aside>;
}

function TeacherActivityRow({ activity, store, navigate }: { activity: SpeakingActivity; store: SpeakingLocalStore; navigate: Navigate }) {
  const sessions = Object.values(store.sessions).filter((session) => session.activityId === activity.id);
  const completed = sessions.filter((session) => session.participant.status === "completed").length;
  return <article className="speaking-activity-row"><div className="speaking-activity-row-icon"><ShoppingBag size={21} aria-hidden="true" /></div><div className="speaking-activity-row-main"><div><strong>{activity.title}</strong><span>{activity.aiRole} · {SPEAKING_LEVEL_LABELS[activity.level]}</span></div><p>{activity.scenario}</p></div><div className="speaking-activity-row-meta"><span className={`speaking-status-pill speaking-status-${activity.status}`}>{activity.status === "active" ? "Active" : "Ready"}</span><span>{completed} result{completed === 1 ? "" : "s"}</span><code>{activity.joinCode}</code></div><div className="speaking-activity-row-actions"><button type="button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)} aria-label={`Open ${activity.title}`}><ChevronRight size={18} aria-hidden="true" /></button></div></article>;
}

const draftFromTemplate = (template: SpeakingActivity): SpeakingCreateActivityInput => ({ title: template.title, scenario: template.scenario, aiRole: template.aiRole, studentRole: template.studentRole, level: template.level, difficulty: template.difficulty, nativeLanguage: template.nativeLanguage, durationSeconds: template.durationSeconds, identifierMode: template.identifierMode, targetExpressions: [...template.targetExpressions], rubric: template.rubric.map((criterion) => ({ ...criterion })) });

const SPEAKING_DURATION_PRESETS = [120, 180, 300, 420] as const;

function SpeakingDurationField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const isCustom = !SPEAKING_DURATION_PRESETS.includes(value as (typeof SPEAKING_DURATION_PRESETS)[number]);
  return (
    <label>Speaking time
      <select value={isCustom ? "custom" : String(value)} onChange={(event) => onChange(event.target.value === "custom" ? (isCustom ? value : 240) : Number(event.target.value))}>
        <option value={120}>2 minutes</option>
        <option value={180}>3 minutes</option>
        <option value={300}>5 minutes</option>
        <option value={420}>7 minutes</option>
        <option value="custom">Custom</option>
      </select>
      {isCustom && <div className="speaking-custom-duration"><input type="number" min={2} max={7} step={1} value={Math.round(value / 60)} onChange={(event) => { const minutes = Number(event.target.value); onChange((Number.isFinite(minutes) ? Math.min(7, Math.max(2, Math.round(minutes))) : 2) * 60); }} aria-label="Custom speaking time in minutes" /><span>minutes</span></div>}
    </label>
  );
}

function SpeakingCreatePage({ navigate, store, persist }: { navigate: Navigate; store: SpeakingLocalStore; persist: (store: SpeakingLocalStore) => void }) {
  const [draft, setDraft] = useState<SpeakingCreateActivityInput>(() => draftFromTemplate(SPEAKING_TEMPLATES[1]));
  const [newExpression, setNewExpression] = useState("");
  const [formError, setFormError] = useState("");
  const update = <K extends keyof SpeakingCreateActivityInput>(key: K, value: SpeakingCreateActivityInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const chooseTemplate = (template: SpeakingActivity) => { setDraft(draftFromTemplate(template)); setFormError(""); };
  const addExpression = () => { if (!newExpression.trim()) return; update("targetExpressions", [...draft.targetExpressions, newExpression.trim()]); setNewExpression(""); };
  const updateCriterion = (index: number, patch: Partial<SpeakingRubricCriterion>) => update("rubric", draft.rubric.map((criterion, candidateIndex) => candidateIndex === index ? { ...criterion, ...patch } : criterion));
  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.scenario.trim()) { setFormError("Activity name and speaking situation are required."); return; }
    if (!draft.rubric.some((criterion) => criterion.enabled)) { setFormError("Choose at least one rubric skill."); return; }
    const created = createActivity(draft);
    persist({ ...store, activities: [created, ...store.activities] });
    navigate(`/speak/teacher/activity/${created.id}`);
  };
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="create" /><form className="speaking-builder" onSubmit={handleCreate}><div className="speaking-builder-header"><div><span className="speaking-eyebrow"><Edit3 size={15} aria-hidden="true" /> Activity builder</span><h1>Create an activity</h1><p>Set the situation first. The AI will stay in character while students practice.</p></div><div className="speaking-builder-header-actions"><button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher")}><ArrowLeft size={15} aria-hidden="true" />Back</button><button type="submit" className="speaking-primary-button"><Check size={17} aria-hidden="true" />Create activity</button></div></div><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Start with a template</span><h2>Pick a familiar conversation</h2></div><span className="speaking-builder-step">01 / 04</span></div><div className="speaking-template-grid">{SPEAKING_TEMPLATES.map((template) => <button type="button" className={`speaking-template-card${draft.title === template.title ? " is-selected" : ""}`} key={template.id} onClick={() => chooseTemplate(template)}><span className="speaking-template-icon"><ShoppingBag size={19} aria-hidden="true" /></span><span><strong>{template.title}</strong><small>{SPEAKING_LEVEL_LABELS[template.level]} · {SPEAKING_DIFFICULTY_LABELS[template.difficulty]}</small></span>{draft.title === template.title && <Check size={16} aria-hidden="true" />}</button>)}</div></section><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">The conversation</span><h2>Give students a clear situation</h2></div><span className="speaking-builder-step">02 / 04</span></div><div className="speaking-builder-form-grid"><label>Activity name<input value={draft.title} onChange={(event) => update("title", event.target.value)} /></label><label>AI role<input value={draft.aiRole} onChange={(event) => update("aiRole", event.target.value)} /></label><label>Student role<input value={draft.studentRole} onChange={(event) => update("studentRole", event.target.value)} /></label><label className="speaking-span-2">Speaking situation<textarea value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} rows={3} /></label></div></section><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Target English</span><h2>Phrases the AI can bring into the conversation</h2></div><span className="speaking-builder-step">03 / 04</span></div><div className="speaking-expression-editor">{draft.targetExpressions.map((expression, index) => <div className="speaking-expression-chip" key={`${expression}-${index}`}><MessageCircle size={16} aria-hidden="true" /><input value={expression} onChange={(event) => update("targetExpressions", draft.targetExpressions.map((item, candidateIndex) => candidateIndex === index ? event.target.value : item))} /><button type="button" onClick={() => update("targetExpressions", draft.targetExpressions.filter((_, candidateIndex) => candidateIndex !== index))} aria-label={`Remove ${expression}`}><X size={15} aria-hidden="true" /></button></div>)}<div className="speaking-add-expression"><input value={newExpression} onChange={(event) => setNewExpression(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addExpression(); } }} placeholder="Add an expression" /><button type="button" className="speaking-outline-button" onClick={addExpression}><Plus size={16} aria-hidden="true" />Add</button></div></div></section><section className="speaking-builder-card"><div className="speaking-builder-card-heading"><div><span className="speaking-card-kicker">Activity settings</span><h2>Set the right amount of support</h2></div><span className="speaking-builder-step">04 / 04</span></div><div className="speaking-settings-grid"><label>Student level<select value={draft.level} onChange={(event) => update("level", event.target.value as SpeakingLevel)}>{SPEAKING_LEVELS.map((level) => <option key={level} value={level}>{SPEAKING_LEVEL_LABELS[level]}</option>)}</select></label><label>AI difficulty<select value={draft.difficulty} onChange={(event) => update("difficulty", event.target.value as SpeakingDifficulty)}>{SPEAKING_DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{SPEAKING_DIFFICULTY_LABELS[difficulty]}</option>)}</select></label><SpeakingDurationField value={draft.durationSeconds} onChange={(value) => update("durationSeconds", value)} /><label>Feedback language<select value={draft.nativeLanguage} onChange={(event) => update("nativeLanguage", event.target.value as SpeakingNativeLanguage)}>{SPEAKING_NATIVE_LANGUAGES.map((language) => <option key={language} value={language}>{SPEAKING_NATIVE_LANGUAGE_LABELS[language]}</option>)}</select></label><label>Student identification<select value={draft.identifierMode} onChange={(event) => update("identifierMode", event.target.value as SpeakingIdentifierMode)}>{SPEAKING_IDENTIFIER_MODES.map((mode) => <option key={mode} value={mode}>{SPEAKING_IDENTIFIER_MODE_LABELS[mode]}</option>)}</select></label></div><div className="speaking-rubric-editor-heading"><div><span className="speaking-card-kicker">Editable rubric</span><p>Keep the skills that matter for this activity. Pronunciation scoring is not included.</p></div><button type="button" className="speaking-outline-button" onClick={() => update("rubric", [...draft.rubric, { id: `custom-${Date.now()}`, name: "New skill", description: "What should students show?", enabled: true }])}><Plus size={16} aria-hidden="true" />Add criterion</button></div><div className="speaking-rubric-editor">{draft.rubric.map((criterion, index) => <div className={`speaking-rubric-row${criterion.enabled ? " is-enabled" : ""}`} key={criterion.id}><label className="speaking-rubric-toggle"><input type="checkbox" checked={criterion.enabled} onChange={(event) => updateCriterion(index, { enabled: event.target.checked })} /><span>{criterion.enabled ? "On" : "Off"}</span></label><div><input aria-label={`${criterion.name} name`} value={criterion.name} onChange={(event) => updateCriterion(index, { name: event.target.value })} /><textarea aria-label={`${criterion.name} description`} rows={2} value={criterion.description} onChange={(event) => updateCriterion(index, { description: event.target.value })} /></div><button type="button" className="speaking-icon-button speaking-danger-icon" onClick={() => update("rubric", draft.rubric.filter((_, candidateIndex) => candidateIndex !== index))} aria-label={`Remove ${criterion.name}`}><Trash2 size={16} aria-hidden="true" /></button></div>)}</div></section>{formError && <p className="speaking-error speaking-builder-error" role="alert">{formError}</p>}<div className="speaking-builder-footer"><p><ShieldIcon /><span>Teacher ownership, private join codes, and mock mode are ready for local testing.</span></p><button type="submit" className="speaking-primary-button"><Check size={17} aria-hidden="true" />Create activity</button></div></form></main></div>;
}

function SpeakingActivityPage({ navigate, store, persist, activityId, results }: { navigate: Navigate; store: SpeakingLocalStore; persist: (store: SpeakingLocalStore) => void; activityId: string; results: boolean }) {
  const [copied, setCopied] = useState(false);
  const activity = activityById(store, activityId);
  if (!activity) return <MissingSpeakingSession navigate={navigate} />;
  if (results) return <SpeakingResultsPage navigate={navigate} store={store} activity={activity} />;
  const shareUrl = `${window.location.origin}/speak/join/${activity.joinCode}`;
  const copyShareUrl = async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2_000); } catch { setCopied(false); } };
  const toggleActivity = () => {
    if (activity.status === "ended") return;
    const nextStatus = activity.status === "active" ? "ready" : "active";
    persist({ ...store, activities: store.activities.map((candidate) => candidate.id === activity.id ? { ...candidate, status: nextStatus, updatedAt: new Date().toISOString() } : candidate) });
  };
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="home" /><section className="speaking-share-page"><button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher")}><ArrowLeft size={16} aria-hidden="true" />All activities</button><div className="speaking-share-header"><div><span className="speaking-eyebrow"><Check size={15} aria-hidden="true" /> Activity ready</span><h1>{activity.title}</h1><p>{activity.scenario}</p></div><span className={`speaking-status-pill speaking-status-${activity.status}`}>{activity.status === "active" ? "Active" : "Ready to share"}</span></div><div className="speaking-share-grid"><section className="speaking-share-card speaking-share-code-card"><div><span className="speaking-card-kicker">参加コード / QRコード</span><h2>Students can join now</h2><p>Scan the QR code or enter this short code at <strong>/speak/join</strong>.</p></div><div className="speaking-share-visual"><QRCodeSVG value={shareUrl} size={172} bgColor="#ffffff" fgColor="#12214b" level="M" /><div className="speaking-join-code-block"><small>Join Code</small><strong>{activity.joinCode}</strong><button type="button" onClick={copyShareUrl} aria-label="Copy join URL">{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</button></div></div><div className="speaking-share-link"><span>{shareUrl}</span><button className="speaking-outline-button" type="button" onClick={copyShareUrl}>{copied ? "Copied" : "Copy link"}</button></div></section><section className="speaking-share-card"><div className="speaking-share-card-heading"><span className="speaking-card-kicker">Activity setup</span><button type="button" className="speaking-icon-button" onClick={() => navigate(`/speak/teacher/create`)} aria-label="Edit activity"><Pencil size={16} aria-hidden="true" /></button></div><dl className="speaking-activity-facts"><div><dt>AI role</dt><dd>{activity.aiRole}</dd></div><div><dt>Student role</dt><dd>{activity.studentRole}</dd></div><div><dt>Level</dt><dd>{SPEAKING_LEVEL_LABELS[activity.level]}</dd></div><div><dt>Difficulty</dt><dd>{SPEAKING_DIFFICULTY_LABELS[activity.difficulty]}</dd></div><div><dt>Speaking time</dt><dd>{formatDuration(activity.durationSeconds)}</dd></div><div><dt>Feedback</dt><dd>{SPEAKING_NATIVE_LANGUAGE_LABELS[activity.nativeLanguage]}</dd></div></dl><div className="speaking-share-targets"><span>Target English</span><div>{activity.targetExpressions.map((expression) => <span key={expression}>{expression}</span>)}</div></div></section></div><div className="speaking-share-actions">{activity.status !== "ended" && <button type="button" className="speaking-outline-button" onClick={toggleActivity}>{activity.status === "active" ? "Pause activity" : "Activate activity"}</button>}<button type="button" className="speaking-primary-button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}/results`)}><Trophy size={17} aria-hidden="true" />View results</button><button type="button" className="speaking-outline-button" onClick={() => navigate(`/speak/join/${activity.joinCode}`)}><Play size={17} aria-hidden="true" />Preview as student</button></div></section></main></div>;
}

function SpeakingResultsPage({ navigate, store, activity }: { navigate: Navigate; store: SpeakingLocalStore; activity: SpeakingActivity }) {
  const sessions = Object.values(store.sessions).filter((session) => session.activityId === activity.id);
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="results" /><section className="speaking-teacher-content"><button type="button" className="speaking-text-button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}><ArrowLeft size={16} aria-hidden="true" />{activity.title}</button><div className="speaking-teacher-heading speaking-results-heading"><div><span className="speaking-eyebrow"><Trophy size={15} aria-hidden="true" /> Learning results</span><h1>See who found their voice</h1><p>Simple evidence for your next lesson: completion, rubric scores, and support moments.</p></div><span className="speaking-join-code-badge">Code <strong>{activity.joinCode}</strong></span></div>{sessions.length ? <div className="speaking-results-table"><div className="speaking-results-table-head"><span>Participant</span><span>Status</span><span>Overall</span><span>Support</span><span /></div>{sessions.map((session) => { const evaluation = session.evaluation ?? makeDemoEvaluation(session.participant.id); return <button type="button" className="speaking-results-table-row" key={session.participant.id} onClick={() => navigate(`/speak/teacher/result/${session.participant.id}`)}><span className="speaking-participant-cell"><span className="speaking-student-avatar"><UserRound size={19} aria-hidden="true" /></span><strong>{session.participant.displayIdentifier ?? "Anonymous student"}</strong></span><span><span className={`speaking-status-pill speaking-status-${session.participant.status}`}>{session.participant.status === "completed" ? "Completed" : "In progress"}</span></span><span className="speaking-table-score">{scoreFor(evaluation, session.turns)}<small>/100</small></span><span className="speaking-table-help"><Lightbulb size={15} aria-hidden="true" />{session.participant.helpCount}</span><span><ChevronRight size={18} aria-hidden="true" /></span></button>; })}</div> : <div className="speaking-empty-card"><Users size={32} aria-hidden="true" /><h2>No students yet</h2><p>Share {activity.joinCode} to invite the first practice session.</p><button type="button" className="speaking-primary-button" onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}>Show join code</button></div>}</section></main></div>;
}

function SpeakingTeacherResultPage({ navigate, store, participantId }: { navigate: Navigate; store: SpeakingLocalStore; participantId: string }) {
  const result = getActivityResult(store, participantId);
  if (!result) return <MissingSpeakingSession navigate={navigate} />;
  const evaluation = result.evaluation ?? makeDemoEvaluation(participantId);
  return <div className="speaking-page-shell speaking-teacher-shell"><SpeakingTopbar navigate={navigate} active="teacher" teacher /><main className="speaking-teacher-layout"><SpeakingTeacherSidebar navigate={navigate} active="results" /><section className="speaking-teacher-content"><button type="button" className="speaking-text-button" onClick={() => navigate(`/speak/teacher/activity/${result.activity.id}/results`)}><ArrowLeft size={16} aria-hidden="true" />Back to results</button><div className="speaking-teacher-heading speaking-detail-heading"><div><span className="speaking-eyebrow"><UserRound size={15} aria-hidden="true" /> Student detail</span><h1>{result.participant.displayIdentifier ?? "Anonymous student"}</h1><p>{result.activity.title} · {result.turns.filter((turn) => turn.speaker === "student").length} speaking turns · {result.participant.helpCount} Help uses</p></div><span className="speaking-detail-score"><strong>{scoreFor(evaluation, result.turns)}</strong><small>/100</small></span></div><ResultPanel activity={result.activity} turns={result.turns} evaluation={evaluation} teacherView /></section></main></div>;
}
