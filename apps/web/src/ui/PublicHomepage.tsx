import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleDollarSign,
  DoorOpen,
  Flag,
  GraduationCap,
  Keyboard,
  Play,
  Radio,
  ScanLine,
  Settings2,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
  Users,
  Zap
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
    title: "Students answer your question.",
    copy: "Open a question set, give the class a prompt, and let every answer enter the round.",
    icon: BookOpen,
    accent: "cyan",
    visual: "question"
  },
  {
    number: "02",
    label: "Earn",
    title: "Correct answers add to the team economy.",
    copy: "A right answer gives students money they can spend on snowballs and gear before the next push.",
    icon: CircleDollarSign,
    accent: "gold",
    visual: "reward"
  },
  {
    number: "03",
    label: "Compete",
    title: "Teams use the advantage in the arena.",
    copy: "Students move, tag, defend, and capture objectives while the teacher controls the match from the workspace.",
    icon: Target,
    accent: "green",
    visual: "arena"
  }
] as const;

const confirmedModes = [
  { label: "Flag Mode", detail: "Deliver. Protect. Capture.", color: "blue" },
  { label: "Zombie Mode", detail: "Answer for energy. Survive the round.", color: "red" },
  { label: "Classic Practice", detail: "A focused team warmup.", color: "gold" }
] as const;

export default function PublicHomepage({
  onCreateMatch,
  onJoinGame,
  onTeacherLogin,
  onOpenCompetitions
}: PublicHomepageProps) {
  const [activeLoopStep, setActiveLoopStep] = useState(0);

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

  return (
    <div className="public-home">
      <section className="public-hero" aria-labelledby="public-hero-title">
        <div className="public-hero-gridline public-hero-gridline-one" aria-hidden="true" />
        <div className="public-hero-gridline public-hero-gridline-two" aria-hidden="true" />
        <div className="public-hero-copy">
          <p className="public-overline"><span className="status-dot" /> QuizStrike Classroom <span className="overline-divider">/</span> teacher-controlled arena</p>
          <h1 id="public-hero-title">Turn classroom questions into a <em>live team battle.</em></h1>
          <p className="public-hero-lead">Students answer your questions, earn in-match advantages, and compete in a multiplayer arena you control from one teacher workspace.</p>
          <div className="public-hero-actions">
            <button className="public-button public-button-primary" onClick={onCreateMatch}>
              <Play size={18} aria-hidden="true" />
              Create a Match
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button className="public-button public-button-quiet" onClick={onJoinGame}>
              <DoorOpen size={18} aria-hidden="true" />
              Join a Game
            </button>
          </div>
          <div className="public-hero-note"><ShieldCheck size={16} aria-hidden="true" /> Private room code · browser-based play · teacher-made questions</div>
        </div>

        <div className="public-hero-stage" aria-label="QuizStrike game preview">
          <div className="hero-stage-topline">
            <span><Radio size={14} aria-hidden="true" /> Live match preview</span>
            <span>DESERT CITADEL <span className="hero-stage-slash">/</span> ROUND 02</span>
          </div>
          <div className="public-hero-media-wrap">
            <img
              className="public-hero-media"
              src="/assets/quizstrike-classroom-hero.png"
              alt="QuizStrike Classroom arena with students answering a question in a team match"
              fetchPriority="high"
            />
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
            <span><span className="hero-pulse" /> 24 students connected</span>
            <span>Answer → earn → play</span>
          </div>
        </div>
      </section>

      <section className="public-proof-strip" aria-label="Product summary">
        <div><span className="proof-index">01</span><strong>One teacher workspace</strong><small>Questions, settings, roster, and reports.</small></div>
        <div><span className="proof-index">02</span><strong>One room code</strong><small>Students join with a browser nickname.</small></div>
        <div><span className="proof-index">03</span><strong>One visible round</strong><small>Answers become choices inside the game.</small></div>
      </section>

      <section className="public-section public-loop-section" id="how-it-works" aria-labelledby="loop-title">
        <div className="public-section-intro">
          <p className="public-section-label">HOW THE ROUND WORKS</p>
          <h2 id="loop-title">One question can change the round.</h2>
          <p>QuizStrike keeps the learning moment and the game moment connected. Choose the prompt, watch the answers land, then let the class use the result.</p>
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
                <img src="/assets/quizstrike-actual-quiz.png" alt="Actual QuizStrike quiz panel showing a live question, answer choices, money reward, and round timer" loading="lazy" decoding="async" />
                <figcaption><strong>Answer inside the round.</strong></figcaption>
              </figure>
            )}
            {activeStep.visual === "reward" && (
              <figure className="loop-screenshot-card">
                <img src="/assets/quizstrike-actual-preparation.png" alt="Actual QuizStrike preparation screen showing money, snowballs, launchers, vest, and speed boots available before the round" loading="lazy" decoding="async" />
                <figcaption><strong>Earn money. Choose the next advantage.</strong></figcaption>
              </figure>
            )}
            {activeStep.visual === "arena" && (
              <figure className="loop-screenshot-card">
                <img src="/assets/quizstrike-actual-gameplay.png" alt="Actual QuizStrike gameplay view with arena buildings, player weapon, minimap, timer, team, money, gear, and snowball HUD" loading="lazy" decoding="async" />
                <figcaption><strong>Compete with the advantage you earned.</strong></figcaption>
              </figure>
            )}
          </div>
          <div className="loop-visual-caption"><strong>{activeStep.title}</strong><span>{activeStep.copy}</span></div>
        </div>
      </section>

      <section className="public-section public-teacher-section" id="for-teachers" aria-labelledby="teacher-title">
        <div className="teacher-console">
          <div className="console-topbar"><span className="console-brand"><span className="console-brand-mark">Q</span> QuizStrike</span><span className="console-live"><span /> live room</span><span className="console-teacher">Teacher view <GraduationCap size={14} aria-hidden="true" /></span></div>
          <div className="console-body">
            <aside className="console-sidebar" aria-label="Teacher workspace sections"><span className="console-nav-active"><BookOpen size={15} aria-hidden="true" /> Folders</span><span><Trophy size={15} aria-hidden="true" /> Reports</span><span><Settings2 size={15} aria-hidden="true" /> Settings</span></aside>
            <div className="console-main">
              <div className="console-heading"><div><span className="console-eyebrow">Next classroom action</span><h3>Create a room when your quiz is ready.</h3><p>Start with a quiz set, then choose the game mode and share one private code.</p></div><button className="console-action"><Play size={13} aria-hidden="true" /> Create Session</button></div>
              <div className="console-quiz-row"><div className="console-quiz-icon"><BookOpen size={17} aria-hidden="true" /></div><div><strong>Week 04 · Forces & motion</strong><small>12 questions · ready to play</small></div><button className="console-play"><Play size={13} aria-hidden="true" /> Play Live</button></div>
              <div className="console-controls"><span><Users size={14} aria-hidden="true" /> 24 students joined</span><span><Flag size={14} aria-hidden="true" /> Flag Mode</span><span><Timer size={14} aria-hidden="true" /> 02:00 round</span></div>
            </div>
          </div>
        </div>
        <div className="public-section-intro teacher-intro">
          <p className="public-section-label">FOR TEACHERS</p>
          <h2 id="teacher-title">You run the lesson. QuizStrike runs the arena.</h2>
          <p>Prepare questions, open a private room, select the mode and pacing, watch the roster, and bring the class back together when the round ends.</p>
          <ul className="teacher-confirmed-list">
            <li><Check size={16} aria-hidden="true" /> Folders for quiz sets and classes</li>
            <li><Check size={16} aria-hidden="true" /> Live sessions with visible student status</li>
            <li><Check size={16} aria-hidden="true" /> Reports for participation and accuracy</li>
          </ul>
          <button className="public-text-link" onClick={onTeacherLogin}>Open Teacher Login <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </section>

      <section className="public-section public-student-section" id="student-flow" aria-labelledby="student-title">
        <div className="public-section-intro">
          <p className="public-section-label">FOR STUDENTS</p>
          <h2 id="student-title">From room code to kickoff in minutes.</h2>
          <p>No student account flow to explain. Share the code, choose a team, answer, and get into the arena.</p>
          <button className="public-text-link" onClick={onJoinGame}>Open Join Game <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="student-flow-board">
          <div className="student-code-card"><div className="student-code-label"><ScanLine size={15} aria-hidden="true" /> Teacher room code</div><div className="student-code">A B C 1 2 3</div><small>6-character code · private classroom room</small></div>
          <div className="student-flow-line" aria-hidden="true"><span /><span /><span /></div>
          <ol className="student-steps">
            <li><span>01</span><div><strong>Join with a nickname</strong><small>Open the game link or enter the code.</small></div></li>
            <li><span>02</span><div><strong>Pick a team</strong><small>Blue or Red, then get ready.</small></div></li>
            <li><span>03</span><div><strong>Answer, buy, play</strong><small>Use the earned advantage in the arena.</small></div></li>
          </ol>
          <div className="student-input-hint"><Keyboard size={15} aria-hidden="true" /> WASD to move <span>·</span> F or click to fire <span>·</span> E for flag</div>
        </div>
      </section>

      <section className="public-section public-modes-section" id="competitions" aria-labelledby="modes-title">
        <div className="public-section-intro modes-intro"><p className="public-section-label">MATCH TYPES</p><h2 id="modes-title">Built for the round you want to run.</h2><p>Start with the mode that fits the lesson. The same teacher-led room keeps the setup familiar.</p></div>
        <div className="mode-ledger">
          {confirmedModes.map((mode, index) => <div className={`mode-ledger-row mode-ledger-${mode.color}`} key={mode.label}><span className="mode-ledger-number">0{index + 1}</span><div className="mode-ledger-name"><span className="mode-ledger-mark" /> <strong>{mode.label}</strong></div><span className="mode-ledger-detail">{mode.detail}</span><ArrowRight size={17} aria-hidden="true" /></div>)}
          <div className="competition-callout"><div><span className="public-section-label">QUIZ-STRIKE</span><strong>Official competition route</strong><small>Keep the dedicated route for school competitions and special events as it grows.</small></div><button className="public-button public-button-dark" onClick={onOpenCompetitions}>Explore Quiz-Strike <ArrowRight size={16} aria-hidden="true" /></button></div>
        </div>
      </section>

      <section className="public-section public-difference-section" aria-labelledby="difference-title">
        <div className="public-section-intro"><p className="public-section-label">THE DIFFERENCE</p><h2 id="difference-title">Not another question-and-leaderboard quiz.</h2><p>QuizStrike gives the answer a job to do after the question closes.</p></div>
        <div className="difference-table" role="table" aria-label="Traditional quiz compared with QuizStrike">
          <div className="difference-table-head" role="row"><span role="columnheader">Traditional quiz</span><span role="columnheader" className="difference-highlight">QuizStrike</span></div>
          <div className="difference-row" role="row"><span role="cell">Answer a question</span><span role="cell" className="difference-highlight">Answer a question</span></div>
          <div className="difference-row" role="row"><span role="cell">Receive points</span><span role="cell" className="difference-highlight">Earn an in-match advantage</span></div>
          <div className="difference-row" role="row"><span role="cell">Move to the next question</span><span role="cell" className="difference-highlight">Use it with your team</span></div>
          <div className="difference-row difference-row-last" role="row"><span role="cell">Check the leaderboard</span><span role="cell" className="difference-highlight">Change the outcome of the round</span></div>
        </div>
      </section>

      <section className="public-founder-section" id="about" aria-labelledby="founder-title">
        <div className="founder-mark" aria-hidden="true">P</div>
        <div><p className="public-section-label">BUILT WITH THE CLASSROOM IN MIND</p><h2 id="founder-title">Built by a teacher who grew up with competitive games.</h2><p>I built QuizStrike to bring the teamwork, focus, and excitement of competitive games into lessons — without taking control away from the teacher.</p><span className="founder-signoff">Peter · Founder of QuizStrike</span></div>
      </section>

      <section className="public-final-cta" aria-labelledby="final-cta-title">
        <div><p className="public-section-label">YOUR NEXT ROUND</p><h2 id="final-cta-title">Ready to run your first match?</h2><p>Teachers create the room. Students join with the game link or room code.</p></div>
        <div className="public-final-actions"><button className="public-button public-button-primary" onClick={onCreateMatch}><GraduationCap size={18} aria-hidden="true" /> Create a Classroom Match <ArrowRight size={17} aria-hidden="true" /></button><button className="public-button public-button-quiet" onClick={onJoinGame}><DoorOpen size={18} aria-hidden="true" /> Join an Existing Game</button></div>
        <div className="final-scoreline" aria-hidden="true"><span>BLUE 00</span><i /><span>RED 00</span><small>LOBBY OPEN</small></div>
      </section>

      <footer className="public-footer"><div className="footer-brand"><img src="/assets/quizstrike-logo.png" alt="QuizStrike Classroom" /></div><span>Peter Hoang · All Rights Reserved</span><div className="footer-links"><button onClick={onTeacherLogin}>Teacher Login</button><button onClick={onJoinGame}>Join Game</button></div></footer>
    </div>
  );
}
