import { ArrowRight, BookOpenText, Gamepad2, Globe2, Lightbulb, Settings2, Users } from "lucide-react";
import { useEffect } from "react";
import "./product-hub.css";

type ProductHubHomepageProps = {
  onOpenSpeaking: () => void;
  onOpenQuizStrike: () => void;
};

const speakingSteps = [
  {
    number: "1",
    title: "Set Task",
    copy: <>Choose a task and rubric</>,
    image: "/assets/speaking/performance-teacher.png",
    alt: "Teacher setting a speaking task with a tablet",
    className: "product-hub-stage-teacher"
  },
  {
    number: "2",
    title: "Students Speak",
    copy: <>Speak independently on any device</>,
    image: "/assets/speaking/performance-student.png",
    alt: "Student speaking with headphones at a laptop",
    className: "product-hub-stage-student"
  },
  {
    number: "3",
    title: "Review Results",
    copy: <>See scores, rubrics and clear evidence</>,
    image: "/assets/speaking/performance-results.png",
    alt: "Speaking assessment results chart with a green checkmark",
    className: "product-hub-stage-results"
  }
] as const;

const benefits = [
  { title: "Clear speaking tasks", copy: "Students know what to do", icon: Lightbulb, tone: "blue" },
  { title: "Fair classroom assessment", copy: "Consistent, evidence-based scoring", icon: Users, tone: "green" },
  { title: "Fun multiplayer review", copy: "Higher engagement, better retention", icon: Gamepad2, tone: "purple" }
] as const;

export default function ProductHubHomepage({ onOpenSpeaking, onOpenQuizStrike }: ProductHubHomepageProps) {
  useEffect(() => {
    const previousSite = document.body.dataset.site;
    const previousTitle = document.title;
    document.body.dataset.site = "product-hub";
    document.title = "GyakutenEigo · English classroom tools";
    return () => {
      if (previousSite === undefined) delete document.body.dataset.site;
      else document.body.dataset.site = previousSite;
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="product-hub-home">
      <section className="product-hub-shell" aria-labelledby="product-hub-title">
        <section className="product-hub-intro">
          <span className="product-hub-scribble product-hub-scribble-left" aria-hidden="true">
            <span>Better English</span>
            <span>Brighter futures</span>
            <i />
          </span>
          <h1 id="product-hub-title">Two powerful tools for English classrooms</h1>
          <span className="product-hub-scribble product-hub-scribble-right" aria-hidden="true">
            Small steps Big voices
          </span>
        </section>

        <section className="product-hub-products" aria-label="GyakutenEigo products">
          <article className="product-hub-card product-hub-speaking-card">
            <p className="product-hub-card-label">Speaking assessment</p>
            <h2>SpeakCheck App</h2>
            <p className="product-hub-card-description">Assess real speaking performance  across your whole class.</p>
            <div className="product-hub-speaking-flow" aria-label="SpeakCheck App steps">
              {speakingSteps.map((step, index) => (
                <div className="product-hub-flow-stage-wrap" key={step.number}>
                  <article className={`product-hub-flow-stage ${step.className}`}>
                    <div className="product-hub-flow-visual">
                  <img src={step.image} alt={step.alt} width={1440} height={1080} loading="eager" decoding="sync" />
                    </div>
                    <div className="product-hub-flow-copy">
                      <span className="product-hub-flow-number">{step.number}</span>
                      <span>
                        <strong>{step.title}</strong>
                        <small>{step.copy}</small>
                      </span>
                    </div>
                  </article>
                  {index < speakingSteps.length - 1 && <ArrowRight className="product-hub-flow-arrow" size={25} strokeWidth={2.4} aria-hidden="true" />}
                </div>
              ))}
            </div>
            <button className="product-hub-card-button product-hub-speaking-button" type="button" onClick={onOpenSpeaking}>
              <BookOpenText size={21} aria-hidden="true" />
              <span>Open SpeakCheck App</span>
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </article>

          <article className="product-hub-card product-hub-quizstrike-card">
            <p className="product-hub-card-label">Multiplayer review</p>
            <div className="product-hub-quiz-title-row">
              <h2>QuizStrike</h2>
              <Gamepad2 size={58} strokeWidth={1.9} aria-hidden="true" />
            </div>
            <p className="product-hub-card-description">Turn classroom review into a multiplayer challenge.</p>
            <div className="product-hub-quiz-art-frame">
              <img src="/assets/quizstrike-home-hero.png" alt="QuizStrike classroom review game with students answering a question" width={1448} height={1086} fetchPriority="high" decoding="sync" />
              <div className="product-hub-quiz-badges" aria-label="QuizStrike content areas">
                <span><BookOpenText size={15} aria-hidden="true" />Vocabulary</span>
                <span><Settings2 size={15} aria-hidden="true" />Grammar</span>
                <span><Globe2 size={15} aria-hidden="true" />Culture</span>
              </div>
            </div>
            <button className="product-hub-card-button product-hub-quiz-button" type="button" onClick={onOpenQuizStrike}>
              <Gamepad2 size={21} aria-hidden="true" />
              <span>Open QuizStrike</span>
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </article>
        </section>

        <section className="product-hub-benefits" aria-label="Classroom benefits">
          {benefits.map((benefit) => {
            const BenefitIcon = benefit.icon;
            return (
              <article className="product-hub-benefit-card" key={benefit.title}>
                <span className={`product-hub-benefit-icon product-hub-benefit-icon-${benefit.tone}`}>
                  <BenefitIcon size={31} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span>
                  <strong>{benefit.title}</strong>
                  <small>{benefit.copy}</small>
                </span>
              </article>
            );
          })}
        </section>
      </section>
    </div>
  );
}
