import { useSiteTranslation, SiteText } from "./siteTranslation";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Lightbulb,
  ScanLine,
  Users
} from "lucide-react";
import "../homepage-game-first.css";

type PublicHomepageProps = {
  variant?: "quiz" | "speaking";
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

const speakingBenefits = [
  {
    title: "Clear Tasks",
    copy: "Students know what to do",
    icon: Lightbulb,
    tone: "blue"
  },
  {
    title: "Build Confidence",
    copy: "Practise before you speak",
    icon: Users,
    tone: "green"
  },
  {
    title: "Useful Feedback",
    copy: "Notice what students can do",
    icon: BarChart3,
    tone: "purple"
  }
] as const;

const flowSteps = [
  {
    number: "1",
    title: "Set Task",
    copy: <><SiteText text="Choose a task" /><br /><SiteText text="and rubric" /></>,
    image: "/assets/speaking/performance-teacher.png",
    alt: "Teacher setting a task with a tablet",
    className: "flow-stage-teacher"
  },
  {
    number: "2",
    title: "Students Perform",
    copy: <><SiteText text="Speak independently" /><br /><SiteText text="on any device" /></>,
    image: "/assets/speaking/performance-student.png",
    alt: "Student speaking with headphones at a laptop",
    className: "flow-stage-student"
  },
  {
    number: "3",
    title: "Score Fairly",
    copy: <><SiteText text="Use shared criteria" /><br /><SiteText text="with clear evidence" /></>,
    image: "/assets/speaking/performance-results.png",
    alt: "Assessment results chart with a green checkmark",
    className: "flow-stage-results"
  }
] as const;

const speakingFlowSteps = [
  {
    number: "1",
    title: "Choose a task",
    copy: <><SiteText text="Set the goal" /><br /><SiteText text="and support" /></>,
    image: "/assets/speaking/performance-teacher.png",
    alt: "Teacher setting a speaking task with a tablet",
    className: "flow-stage-teacher"
  },
  {
    number: "2",
    title: "Practise together",
    copy: <><SiteText text="Build confidence" /><br /><SiteText text="with helpful support" /></>,
    image: "/assets/speaking/performance-student.png",
    alt: "Student practising speaking with headphones at a laptop",
    className: "flow-stage-student"
  },
  {
    number: "3",
    title: "Show what you can do",
    copy: <><SiteText text="Use the English" /><br /><SiteText text="you know" /></>,
    image: "/assets/speaking/performance-results.png",
    alt: "Speaking task evidence ready for teacher review",
    className: "flow-stage-results"
  }
] as const;

export default function PublicHomepage({
  variant = "quiz",
  onCreateMatch,
  onJoinGame,
  onTeacherLogin
}: PublicHomepageProps) {
  const { t } = useSiteTranslation();
  const [sessionCode, setSessionCode] = useState("");
  const speaking = variant === "speaking";

  return (
    <div className="performance-home">
      <span className="performance-orb performance-orb-one" aria-hidden="true" />
      <span className="performance-orb performance-orb-two" aria-hidden="true" />

      <section className="performance-shell performance-hero" aria-labelledby="public-hero-title">
        <div className="performance-hero-copy">
          <p className="performance-eyebrow">{speaking ? t("SpeakCheck · Classroom speaking tasks") : t("Computer-based performance test")}</p>
          <h1 id="public-hero-title" tabIndex={-1}>{speaking ? t("Use the English you’ve learned.") : t("SpeakCheck App")}</h1>
          <p className="performance-hero-lead">{speaking ? t("Learn it in class. Practise it together. Then try the speaking task yourself and show what you can do.") : t("Fair, consistent speaking assessment for every student.")}</p>
          <div className="performance-hero-actions">
            <button className="performance-button performance-button-primary" type="button" onClick={onCreateMatch}>
              <BookOpen size={20} aria-hidden="true" />
              <span>{speaking ? t("Create a Speaking Task") : t("Create a Performance Test")}</span>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
            <button className="performance-button performance-button-secondary" type="button" onClick={() => onJoinGame()}>
              <ScanLine size={20} aria-hidden="true" />
              <span>{t("Join with Code")}</span>
            </button>
          </div>
          <p className="performance-scribble" aria-hidden="true">
            <span>{t("Better English")}</span>
            <span>{t("Brighter futures")}</span>
            <i />
          </p>
        </div>

        <PerformanceFlow speaking={speaking} />
      </section>

      <section className="performance-shell performance-benefits" aria-label={speaking ? t("Speaking task benefits") : t("Assessment benefits")}>
        {(speaking ? speakingBenefits : benefits).map((benefit) => {
          const BenefitIcon = benefit.icon;
          return (
            <article className="performance-benefit-card" key={benefit.title}>
              <span className={`performance-benefit-icon performance-benefit-icon-${benefit.tone}`}>
                <BenefitIcon size={31} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="performance-benefit-copy">
                <strong>{t(benefit.title)}</strong>
                <span>{t(benefit.copy)}</span>
              </span>
            </article>
          );
        })}
      </section>

      <section className="performance-shell performance-entry-grid" aria-label={t("Choose how to begin")}>
        <article className="performance-entry-card performance-teacher-card">
          <div className="performance-entry-illustration">
            <img
              src="/assets/speaking/performance-teacher.png"
              alt={t("Friendly teacher holding a tablet")}
              loading="eager"
              decoding="sync"
            />
          </div>
          <div className="performance-entry-content">
            <p className="performance-entry-kicker performance-entry-kicker-teacher">{t("For teachers")}</p>
            <h2>{speaking ? t("Create and review speaking tasks") : t("Create and manage tests")}</h2>
            <ul className="performance-checklist">
              <li><span><Check size={16} strokeWidth={3} aria-hidden="true" /></span>{speaking ? t("Create a real communication task") : t("Choose a task")}</li>
              <li><span><Check size={16} strokeWidth={3} aria-hidden="true" /></span>{t("Set a rubric")}</li>
              <li><span><Check size={16} strokeWidth={3} aria-hidden="true" /></span>{speaking ? t("Collect student evidence") : t("Review results")}</li>
            </ul>
            <button className="performance-entry-action performance-entry-action-teacher" type="button" onClick={onTeacherLogin}>
              <BookOpen size={21} aria-hidden="true" />
              <span>{t("Teacher workspace")}</span>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
          </div>
        </article>

        <article className="performance-entry-card performance-student-card">
          <div className="performance-entry-illustration">
            <img
              src="/assets/speaking/performance-student.png"
              alt={t("Student wearing headphones at a laptop")}
              loading="eager"
              decoding="sync"
            />
          </div>
          <form className="performance-entry-content" onSubmit={(event) => { event.preventDefault(); onJoinGame(sessionCode); }}>
            <p className="performance-entry-kicker performance-entry-kicker-student">{t("For students")}</p>
            <h2>{t("Join and begin")}</h2>
            <div className="performance-session-code">
              <label htmlFor="public-session-code" className="performance-code-label">{t("Classroom code")}</label>
              <input id="public-session-code" required aria-label={t("Session code")} aria-describedby="public-code-help" placeholder="ABC123" value={sessionCode}
                onChange={(event) => setSessionCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6} pattern="[A-Z0-9]{6}"
                title={t("Enter the six-character code from your teacher")} />
            </div>
            <small id="public-code-help" className="performance-code-help">{t("Enter the 6-character code from your teacher.")}</small>
            <div className="performance-sequence" aria-label={t("Student steps")}>
              <span><b>1</b>{t("Join")}</span>
              <ArrowRight size={16} aria-hidden="true" />
              <span><b>2</b>{t("Check mic")}</span>
              <ArrowRight size={16} aria-hidden="true" />
              <span><b>3</b>{t("Perform")}</span>
            </div>
            <button className="performance-entry-action performance-entry-action-student" type="submit">
              <ScanLine size={21} aria-hidden="true" />
              <span>{speaking ? t("Join speaking task") : t("Join Performance Test")}</span>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
          </form>
        </article>
      </section>

      <footer className="performance-shell performance-footer">
        <span>© {new Date().getFullYear()}{" "}{t("GyakutenEigo. Empowering every learner's voice.")}</span>
        <nav aria-label={t("Footer")}>
          <a href="#performance-flow">{t("How it works")}</a>
          <a href="/about">{t("About / 講師紹介")}</a>
        </nav>
      </footer>
    </div>
  );
}

function PerformanceFlow({ speaking }: { speaking: boolean }) {
  const { t } = useSiteTranslation();
  const steps = speaking ? speakingFlowSteps : flowSteps;
  return (
      <section id="performance-flow" className="performance-flow" aria-label={t("Three-step speaking task flow")} tabIndex={-1}>
      <div className="performance-flow-heading">
        <h2>{t("A simple 3-step flow")}</h2>
        <span aria-hidden="true">{t("Small")}<br />{t("steps")}<br />{t("Big")}<br />{t("voices")}</span>
      </div>
      <div className="performance-flow-stages">
        {steps.map((step, index) => (
          <div className="performance-flow-stage-wrap" key={step.number}>
            <article className={`performance-flow-stage ${step.className}`}>
              <div className="performance-flow-visual">
                <img src={step.image} alt={t(step.alt)} decoding="sync" />
              </div>
              <div className="performance-flow-stage-copy">
                <span className="performance-flow-number">{step.number}</span>
                <span>
                  <strong>{t(step.title)}</strong>
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
