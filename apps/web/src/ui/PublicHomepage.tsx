import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleDollarSign,
  DoorOpen,
  Flag,
  GraduationCap,
  Keyboard,
  Pause,
  Play,
  Radio,
  ScanLine,
  Settings2,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
  Users
} from "lucide-react";

type PublicHomepageProps = {
  onCreateMatch: () => void;
  onJoinGame: () => void;
  onTeacherLogin: () => void;
  onOpenCompetitions: () => void;
};

const loopSteps = [
  {
    number: "01",
    label: "Answer",
    title: "Players answer the question.",
    copy: "Open a question set and let every answer shape what happens next.",
    icon: BookOpen,
    accent: "cyan",
    visual: "question"
  },
  {
    number: "02",
    label: "Earn",
    title: "Correct answers unlock options.",
    copy: "A right answer earns rewards for snowballs and gear before the next push.",
    icon: CircleDollarSign,
    accent: "gold",
    visual: "reward"
  },
  {
    number: "03",
    label: "Compete",
    title: "Teams take the advantage into the arena.",
    copy: "Players move, tag, defend, and capture objectives while the host keeps the match on track.",
    icon: Target,
    accent: "green",
    visual: "arena"
  }
] as const;

const confirmedModes = [
  { label: "Capture the Flag", detail: "Deliver. Protect. Capture.", color: "blue" },
  { label: "Zombie Survival", detail: "Answer for energy. Survive the round.", color: "red" },
  { label: "Team Tag", detail: "A focused team warmup.", color: "gold" }
] as const;

export default function PublicHomepage({
  onCreateMatch,
  onJoinGame,
  onTeacherLogin,
  onOpenCompetitions
}: PublicHomepageProps) {
  const [activeLoopStep, setActiveLoopStep] = useState(0);
  const [isHeroVideoPlaying, setIsHeroVideoPlaying] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.body.dataset.site = "public";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      return () => {
        delete document.body.dataset.site;
      };
    }

    const interval = window.setInterval(() => {
      setActiveLoopStep((current) => (current + 1) % loopSteps.length);
    }, 4800);

    return () => {
      window.clearInterval(interval);
      delete document.body.dataset.site;
    };
  }, []);

  const activeStep = loopSteps[activeLoopStep];
  const ActiveStepIcon = activeStep.icon;

  const toggleHeroVideo = () => {
    const video = heroVideoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch(() => setIsHeroVideoPlaying(false));
    } else {
      video.pause();
    }
  };

  return (
    <div className="public-home">
      <section className="public-hero" aria-labelledby="public-hero-title">
        <div className="public-hero-gridline public-hero-gridline-one" aria-hidden="true" />
        <div className="public-hero-gridline public-hero-gridline-two" aria-hidden="true" />
        <div className="public-hero-copy">
          <p className="public-overline"><span className="status-dot" /> Live team game <span className="overline-divider">/</span> Answer. Earn. Compete.</p>
          <h1 id="public-hero-title">Answer right. Gear up. <em>Take the arena.</em></h1>
          <p className="public-hero-lead">QuizStrike turns questions into advantages players use in a live team match. Host the round, share one game code, and let the teams take it from there.</p>
          <div className="public-hero-actions">
            <button className="public-button public-button-primary" onClick={onCreateMatch}>
              <Play size={18} aria-hidden="true" />
              Host a Game
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button className="public-button public-button-quiet" onClick={onJoinGame}>
              <DoorOpen size={18} aria-hidden="true" />
              Join a Game
            </button>
          </div>
          <div className="public-hero-note"><ShieldCheck size={16} aria-hidden="true" /> One game code · browser-based play · host-controlled matches</div>
        </div>

        <div className="public-hero-stage" aria-label="QuizStrike game preview">
          <div className="hero-stage-topline">
            <span><Radio size={14} aria-hidden="true" /> Live game preview</span>
            <span>DESERT CITADEL <span className="hero-stage-slash">/</span> ROUND 02</span>
          </div>
          <div className="public-hero-media-wrap">
            <video
              ref={heroVideoRef}
              className="public-hero-media"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster="/assets/quizstrike-game-hero.png"
              aria-label="QuizStrike teams competing in an arena around a live question"
              onPlay={() => setIsHeroVideoPlaying(true)}
              onPause={() => setIsHeroVideoPlaying(false)}
            >
              <source src="/assets/quizstrike-promo-15s-v2.mp4" type="video/mp4" />
              Your browser does not support the QuizStrike gameplay preview video.
            </video>
            <button
              type="button"
              className="hero-video-toggle"
              onClick={toggleHeroVideo}
              aria-label={isHeroVideoPlaying ? "Pause gameplay preview" : "Play gameplay preview"}
              title={isHeroVideoPlaying ? "Pause gameplay preview" : "Play gameplay preview"}
            >
              {isHeroVideoPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              <span>{isHeroVideoPlaying ? "Pause" : "Play"}</span>
            </button>
            <div className="hero-scoreboard" aria-label="Live team score">
              <div className="hero-team hero-team-blue"><span>BLUE</span><strong>03</strong></div>
              <div className="hero-score-divider">:</div>
              <div className="hero-team hero-team-red"><span>RED</span><strong>02</strong></div>
              <div className="hero-timer"><Timer size={13} aria-hidden="true" /> 01:42</div>
            </div>
            <div className="hero-question-card">
              <span className="hero-question-label">Question 04 <span>·</span> Science</span>
              <strong>Which force keeps the planets in orbit?</strong>
              <div className="hero-answer-row" aria-label="Answer choices">
                <span><b>A</b> Friction</span>
                <span className="hero-answer-active"><b>B</b> Gravity <Check size={13} aria-hidden="true" /></span>
                <span><b>C</b> Magnetism</span>
              </div>
            </div>
          </div>
          <div className="hero-stage-bottomline">
            <span><span className="hero-pulse" /> 24 players connected</span>
            <span>Answer → earn → compete</span>
          </div>
        </div>
      </section>

      <section className="public-proof-strip" aria-label="Product summary">
        <div><span className="proof-index">01</span><strong>Questions become power</strong><small>Correct answers unlock useful rewards.</small></div>
        <div><span className="proof-index">02</span><strong>One game code</strong><small>Players join in a browser with a name.</small></div>
        <div><span className="proof-index">03</span><strong>One live arena</strong><small>Every answer can change the match.</small></div>
      </section>

      <section className="public-section public-loop-section" id="how-it-works" aria-labelledby="loop-title">
        <div className="public-section-intro">
          <p className="public-section-label">HOW THE ROUND WORKS</p>
          <h2 id="loop-title">Three beats. One live match.</h2>
          <p>Players answer, earn an advantage, and take it straight into the arena.</p>
          <div className="public-loop-tabs" role="tablist" aria-label="QuizStrike round steps">
            {loopSteps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <button
                  key={step.label}
                  className={`public-loop-tab public-loop-tab-${step.accent}${index === activeLoopStep ? " is-active" : ""}`}
                  role="tab"
                  aria-selected={index === activeLoopStep}
                  aria-controls={`loop-panel-${index}`}
                  onClick={() => setActiveLoopStep(index)}
                >
                  <span>{step.number}</span>
                  <StepIcon size={16} aria-hidden="true" />
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`public-loop-visual public-loop-visual-${activeStep.visual}`} id={`loop-panel-${activeLoopStep}`} role="tabpanel" aria-labelledby={activeStep.label}>
          <div className="loop-visual-header"><span><ActiveStepIcon size={16} aria-hidden="true" /> {activeStep.label}</span><span>ROUND 02 / LIVE</span></div>
          <div className="loop-visual-content">
            {activeStep.visual === "question" && (
              <figure className="loop-screenshot-card">
                <img src="/assets/quizstrike-actual-quiz.png" alt="Actual QuizStrike quiz panel showing a live question, answer choices, reward, and round timer" loading="lazy" decoding="async" />
                <figcaption><strong>Answer while the round is live.</strong></figcaption>
              </figure>
            )}
            {activeStep.visual === "reward" && (
              <figure className="loop-screenshot-card">
                <img src="/assets/quizstrike-actual-preparation.png" alt="Actual QuizStrike preparation screen showing rewards, snowballs, launchers, vest, and speed boots available before the round" loading="lazy" decoding="async" />
                <figcaption><strong>Earn a reward. Choose the next advantage.</strong></figcaption>
              </figure>
            )}
            {activeStep.visual === "arena" && (
              <figure className="loop-screenshot-card">
                <img src="/assets/quizstrike-actual-gameplay.png" alt="Actual QuizStrike gameplay view with arena buildings, player weapon, minimap, timer, team, rewards, gear, and snowball HUD" loading="lazy" decoding="async" />
                <figcaption><strong>Use the advantage with your team.</strong></figcaption>
              </figure>
            )}
          </div>
          <div className="loop-visual-caption"><strong>{activeStep.title}</strong><span>{activeStep.copy}</span></div>
        </div>
      </section>

      <section className="public-section public-teacher-section" id="for-teachers" aria-labelledby="teacher-title">
        <div className="teacher-console">
          <div className="console-topbar"><span className="console-brand"><span className="console-brand-mark">Q</span> QuizStrike</span><span className="console-live"><span /> live room</span><span className="console-teacher">Host view <GraduationCap size={14} aria-hidden="true" /></span></div>
          <div className="console-body">
            <aside className="console-sidebar" aria-label="Teacher workspace sections"><span className="console-nav-active"><BookOpen size={15} aria-hidden="true" /> Folders</span><span><Trophy size={15} aria-hidden="true" /> Reports</span><span><Settings2 size={15} aria-hidden="true" /> Settings</span></aside>
            <div className="console-main">
              <div className="console-heading"><div><span className="console-eyebrow">Next match</span><h3>Open a room when your questions are ready.</h3><p>Choose the mode, set the pace, and share one game code.</p></div><button className="console-action"><Play size={13} aria-hidden="true" /> Create game</button></div>
              <div className="console-quiz-row"><div className="console-quiz-icon"><BookOpen size={17} aria-hidden="true" /></div><div><strong>Week 04 · Forces & motion</strong><small>12 questions · ready to play</small></div><button className="console-play"><Play size={13} aria-hidden="true" /> Play Live</button></div>
              <div className="console-controls"><span><Users size={14} aria-hidden="true" /> 24 players joined</span><span><Flag size={14} aria-hidden="true" /> Capture the Flag</span><span><Timer size={14} aria-hidden="true" /> 02:00 round</span></div>
            </div>
          </div>
        </div>
        <div className="public-section-intro teacher-intro">
          <p className="public-section-label">FOR HOSTS</p>
          <h2 id="teacher-title">Set the questions. Control the match.</h2>
          <p>Build the question set, open a private room, choose the mode and pace, then watch the players join.</p>
          <ul className="teacher-confirmed-list">
            <li><Check size={16} aria-hidden="true" /> Folders for questions you use often</li>
            <li><Check size={16} aria-hidden="true" /> A live player roster</li>
            <li><Check size={16} aria-hidden="true" /> Match reports that show what to revisit</li>
          </ul>
          <button className="public-text-link" onClick={onTeacherLogin}>Open the teacher workspace <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </section>

      <section className="public-section public-student-section" id="student-flow" aria-labelledby="student-title">
        <div className="public-section-intro">
          <p className="public-section-label">PLAYER ENTRY</p>
          <h2 id="student-title">From game code to arena in seconds.</h2>
          <p>No player account required. Enter the code, choose a team, and get ready.</p>
          <button className="public-text-link" onClick={onJoinGame}>Join a game <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="student-flow-board">
          <div className="student-code-card"><div className="student-code-label"><ScanLine size={15} aria-hidden="true" /> Game code</div><div className="student-code">A B C 1 2 3</div><small>6-character code · private game room</small></div>
          <div className="student-flow-line" aria-hidden="true"><span /><span /><span /></div>
          <ol className="student-steps">
            <li><span>01</span><div><strong>Join with your name</strong><small>Open the game link or enter the code.</small></div></li>
            <li><span>02</span><div><strong>Choose a team</strong><small>Pick Blue or Red, then get ready.</small></div></li>
            <li><span>03</span><div><strong>Answer, choose, play</strong><small>Use what you earn to help your team.</small></div></li>
          </ol>
          <div className="student-input-hint"><Keyboard size={15} aria-hidden="true" /> WASD Move <span>·</span> F Fire <span>·</span> C Zoom <span>·</span> E Environment</div>
        </div>
      </section>

      <section className="public-section public-modes-section" id="competitions" aria-labelledby="modes-title">
        <div className="public-section-intro modes-intro"><p className="public-section-label">MATCH TYPES</p><h2 id="modes-title">Choose the fight.</h2><p>Pick a mode, set the rules, and send both teams into the arena.</p></div>
        <div className="mode-ledger">
          {confirmedModes.map((mode, index) => <div className={`mode-ledger-row mode-ledger-${mode.color}`} key={mode.label}><span className="mode-ledger-number">0{index + 1}</span><div className="mode-ledger-name"><span className="mode-ledger-mark" /> <strong>{mode.label}</strong></div><span className="mode-ledger-detail">{mode.detail}</span><ArrowRight size={17} aria-hidden="true" /></div>)}
          <div className="competition-callout"><div><span className="public-section-label">QUIZ-STRIKE</span><strong>School competitions, when you’re ready</strong><small>Run a bigger event with study packs, team registration, and a shared bracket.</small></div><button className="public-button public-button-dark" onClick={onOpenCompetitions}>Explore competitions <ArrowRight size={16} aria-hidden="true" /></button></div>
        </div>
      </section>

      <section className="public-section public-difference-section" aria-labelledby="difference-title">
        <div className="public-section-intro"><p className="public-section-label">THE DIFFERENCE</p><h2 id="difference-title">A question can change what happens next.</h2><p>QuizStrike gives every answer a job after the question closes.</p></div>
        <div className="difference-table" role="table" aria-label="Traditional quiz compared with QuizStrike">
          <div className="difference-table-head" role="row"><span role="columnheader">A typical quiz</span><span role="columnheader" className="difference-highlight">QuizStrike</span></div>
          <div className="difference-row" role="row"><span role="cell">Answer a question</span><span role="cell" className="difference-highlight">Answer a question</span></div>
          <div className="difference-row" role="row"><span role="cell">Receive points</span><span role="cell" className="difference-highlight">Earn an in-match advantage</span></div>
          <div className="difference-row" role="row"><span role="cell">Move to the next question</span><span role="cell" className="difference-highlight">Use it with your team</span></div>
          <div className="difference-row difference-row-last" role="row"><span role="cell">Check the leaderboard</span><span role="cell" className="difference-highlight">Change the outcome of the round</span></div>
        </div>
      </section>

      <section className="public-founder-section" id="about" aria-labelledby="founder-title">
        <div className="founder-mark" aria-hidden="true">P</div>
          <div><p className="public-section-label">BUILT FOR REAL PLAY</p><h2 id="founder-title">Built by a teacher who wanted revision to play differently.</h2><p>I built QuizStrike to bring the teamwork and focus of competitive games into learning while keeping the host in control.</p><span className="founder-signoff">Peter · Founder of QuizStrike</span></div>
      </section>

      <section className="public-final-cta" aria-labelledby="final-cta-title">
        <div><p className="public-section-label">YOUR NEXT MATCH</p><h2 id="final-cta-title">Ready to enter the arena?</h2><p>Host a game or join one with a game code.</p></div>
        <div className="public-final-actions"><button className="public-button public-button-primary" onClick={onCreateMatch}><Play size={18} aria-hidden="true" /> Host a Game <ArrowRight size={17} aria-hidden="true" /></button><button className="public-button public-button-quiet" onClick={onJoinGame}><DoorOpen size={18} aria-hidden="true" /> Join a Game</button></div>
        <div className="final-scoreline" aria-hidden="true"><span>BLUE 00</span><i /><span>RED 00</span><small>LOBBY OPEN</small></div>
      </section>

      <footer className="public-footer"><div className="footer-brand"><strong>QuizStrike</strong><small>Answer. Earn. Compete.</small></div><span>Peter Hoang · All rights reserved</span><div className="footer-links"><button onClick={onTeacherLogin}>Host workspace</button><button onClick={onJoinGame}>Join a game</button></div></footer>
    </div>
  );
}
