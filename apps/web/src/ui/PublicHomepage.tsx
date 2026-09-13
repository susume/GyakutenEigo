import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Lightbulb,
  ScanLine,
  Users
} from "lucide-react";

type PublicHomepageProps = {
  onCreateMatch: () => void;
  onJoinGame: (code?: string) => void;
  onTeacherLogin: () => void;
};

const benefits = [
  {
    title: "Clear Tasks",
    copy: "Students know what to do",
    icon: Lightbulb,
    tone: "blue"
  },
  {
    title: "Shared Criteria",
    copy: "Everyone is assessed the same way",
    icon: Users,
    tone: "green"
  },
  {
    title: "Quick Review",
    copy: "Evidence and scores in one place",
    icon: BarChart3,
    tone: "purple"
  }
] as const;

const flowSteps = [
  {
    number: "1",
    title: "Set Task",
    copy: <>Choose a task<br />and rubric</>,
    image: "/assets/speaking/performance-teacher.png",
    alt: "Teacher setting a task with a tablet",
    className: "flow-stage-teacher"
  },
  {
    number: "2",
    title: "Students Perform",
    copy: <>Speak independently<br />on any device</>,
    image: "/assets/speaking/performance-student.png",
    alt: "Student speaking with headphones at a laptop",
    className: "flow-stage-student"
  },
  {
    number: "3",
    title: "Score Fairly",
    copy: <>Use shared criteria<br />with clear evidence</>,
    image: "/assets/speaking/performance-results.png",
    alt: "Assessment results chart with a green checkmark",
    className: "flow-stage-results"
  }
] as const;

export default function PublicHomepage({
  onCreateMatch,
  onJoinGame,
  onTeacherLogin
}: PublicHomepageProps) {
  const [sessionCode, setSessionCode] = useState("");

  useEffect(() => {
    const previousSite = document.body.dataset.site;
    const previousTitle = document.title;
    document.body.dataset.site = "performance";
    document.title = "GyakutenEigo · Speaking Performance";
    return () => {
      if (previousSite === undefined) delete document.body.dataset.site;
      else document.body.dataset.site = previousSite;
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="performance-home">
      <span className="performance-orb performance-orb-one" aria-hidden="true" />
      <span className="performance-orb performance-orb-two" aria-hidden="true" />

      <section className="performance-shell performance-hero" aria-labelledby="public-hero-title">
        <div className="performance-hero-copy">
          <p className="performance-eyebrow">Computer-based performance test</p>
          <h1 id="public-hero-title" tabIndex={-1}>Speaking Performance</h1>
          <p className="performance-hero-lead">Fair, consistent speaking assessment for every student.</p>
          <div className="performance-hero-actions">
            <button className="performance-button performance-button-primary" type="button" onClick={onCreateMatch}>
              <BookOpen size={20} aria-hidden="true" />
              <span>Create a Performance Test</span>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
            <button className="performance-button performance-button-secondary" type="button" onClick={() => onJoinGame()}>
              <ScanLine size={20} aria-hidden="true" />
              <span>Join with Code</span>
            </button>
          </div>
          <p className="performance-scribble" aria-hidden="true">
            <span>Better English</span>
            <span>Brighter futures</span>
            <i />
          </p>
        </div>

        <PerformanceFlow />
      </section>

      <section className="performance-shell performance-benefits" aria-label="Assessment benefits">
        {benefits.map((benefit) => {
          const BenefitIcon = benefit.icon;
          return (
            <article className="performance-benefit-card" key={benefit.title}>
              <span className={`performance-benefit-icon performance-benefit-icon-${benefit.tone}`}>
                <BenefitIcon size={31} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="performance-benefit-copy">
                <strong>{benefit.title}</strong>
                <span>{benefit.copy}</span>
              </span>
            </article>
          );
        })}
      </section>

      <section className="performance-shell performance-entry-grid" aria-label="Choose how to begin">
        <article className="performance-entry-card performance-teacher-card">
          <div className="performance-entry-illustration">
            <img
              src="/assets/speaking/performance-teacher.png"
              alt="Friendly teacher holding a tablet"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="performance-entry-content">
            <p className="performance-entry-kicker performance-entry-kicker-teacher">For teachers</p>
            <h2>Create and manage tests</h2>
            <ul className="performance-checklist">
              <li><span><Check size={16} strokeWidth={3} aria-hidden="true" /></span>Choose a task</li>
              <li><span><Check size={16} strokeWidth={3} aria-hidden="true" /></span>Set a rubric</li>
              <li><span><Check size={16} strokeWidth={3} aria-hidden="true" /></span>Review results</li>
            </ul>
            <button className="performance-entry-action performance-entry-action-teacher" type="button" onClick={onTeacherLogin}>
              <BookOpen size={21} aria-hidden="true" />
              <span>Teacher workspace</span>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
          </div>
        </article>

        <article className="performance-entry-card performance-student-card">
          <div className="performance-entry-illustration">
            <img
              src="/assets/speaking/performance-student.png"
              alt="Student wearing headphones at a laptop"
              loading="lazy"
              decoding="async"
            />
          </div>
          <form className="performance-entry-content" onSubmit={(event) => { event.preventDefault(); onJoinGame(sessionCode); }}>
            <p className="performance-entry-kicker performance-entry-kicker-student">For students</p>
            <h2>Join and begin</h2>
            <div className="performance-session-code">
              <input aria-label="Session code" placeholder="ABC123" value={sessionCode}
                onChange={(event) => setSessionCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6} pattern="[A-Z0-9]{6}"
                title="Enter the six-character code from your teacher" />
            </div>
            <div className="performance-sequence" aria-label="Student steps">
              <span><b>1</b>Join</span>
              <ArrowRight size={16} aria-hidden="true" />
              <span><b>2</b>Check mic</span>
              <ArrowRight size={16} aria-hidden="true" />
              <span><b>3</b>Perform</span>
            </div>
            <button className="performance-entry-action performance-entry-action-student" type="submit">
              <ScanLine size={21} aria-hidden="true" />
              <span>Join Performance Test</span>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
          </form>
        </article>
      </section>

      <footer className="performance-shell performance-footer">
        <span>© {new Date().getFullYear()} GyakutenEigo. Empowering every learner&apos;s voice.</span>
        <nav aria-label="Footer">
          <a href="#performance-flow">How it works</a>
          <span lang="en">English</span>
        </nav>
      </footer>
    </div>
  );
}

function PerformanceFlow() {
  return (
    <section id="performance-flow" className="performance-flow" aria-label="Three-step speaking assessment flow" tabIndex={-1}>
      <div className="performance-flow-heading">
        <h2>A simple 3-step flow</h2>
        <span aria-hidden="true">Small<br />steps<br />Big<br />voices</span>
      </div>
      <div className="performance-flow-stages">
        {flowSteps.map((step, index) => (
          <div className="performance-flow-stage-wrap" key={step.number}>
            <article className={`performance-flow-stage ${step.className}`}>
              <div className="performance-flow-visual">
                <img src={step.image} alt={step.alt} decoding="async" />
              </div>
              <div className="performance-flow-stage-copy">
                <span className="performance-flow-number">{step.number}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.copy}</small>
                </span>
              </div>
            </article>
            {index < flowSteps.length - 1 && <ArrowRight className="performance-flow-arrow" size={31} strokeWidth={2.4} aria-hidden="true" />}
          </div>
        ))}
      </div>
    </section>
  );
}
