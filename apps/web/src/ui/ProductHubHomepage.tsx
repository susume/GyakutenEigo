import { useSiteTranslation, SiteText } from "./siteTranslation";
import { ArrowRight, BookOpenText, Gamepad2, Globe2, Lightbulb, Settings2, Users } from "lucide-react";
import { useEffect } from "react";
import { publicPagePath } from "../seo/publicPages";
import ClassroomCodeEntry from "./ClassroomCodeEntry";
import "./product-hub.css";

type ProductHubHomepageProps = {
  onNavigate: (path: string) => void;
};

const speakingSteps = [
  {
    number: "1",
    title: "Set Task",
    copy: <><SiteText text="Choose a task and rubric" /></>,
    image: "/assets/speaking/performance-teacher.webp",
    alt: "Teacher setting a speaking task with a tablet",
    className: "product-hub-stage-teacher"
  },
  {
    number: "2",
    title: "Students Speak",
    copy: <><SiteText text="Speak independently on any device" /></>,
    image: "/assets/speaking/performance-student.webp",
    alt: "Student speaking with headphones at a laptop",
    className: "product-hub-stage-student"
  },
  {
    number: "3",
    title: "Review Results",
    copy: <><SiteText text="See scores, rubrics and clear evidence" /></>,
    image: "/assets/speaking/performance-results.webp",
    alt: "Speaking assessment results chart with a green checkmark",
    className: "product-hub-stage-results"
  }
] as const;

const benefits = [
  { title: "Clear speaking tasks", copy: "Students know what to do", icon: Lightbulb, tone: "blue" },
  { title: "Fair classroom assessment", copy: "Consistent, evidence-based scoring", icon: Users, tone: "green" },
  { title: "Fun multiplayer review", copy: "Higher engagement, better retention", icon: Gamepad2, tone: "purple" }
] as const;

export default function ProductHubHomepage({ onNavigate }: ProductHubHomepageProps) {
  const { language, t } = useSiteTranslation();
  useEffect(() => {
    const previousSite = document.body.dataset.site;
    document.body.dataset.site = "product-hub";
    return () => {
      if (previousSite === undefined || previousSite === "product-hub") delete document.body.dataset.site;
      else document.body.dataset.site = previousSite;
    };
  }, []);

  return (
    <div className="product-hub-home">
      <section className="product-hub-shell" aria-labelledby="product-hub-title">
        <section className="product-hub-intro">
          <span className="ge-eyebrow">{t("GyakutenEigo · Classroom tools")}</span>
          <h1 id="product-hub-title" tabIndex={-1}>{t("Small steps.")}<br />{t("Confident English.")}</h1>
          <p>{t("GyakutenEigo gives English teachers two classroom tools. Use SpeakCheck to assess speaking and QuizStrike to review vocabulary and grammar in live team games.")}</p>
        </section>

        <ClassroomCodeEntry onJoin={(product, code) => onNavigate(product === "speaking" ? `/speak/join/${code}` : `/join?code=${code}`)} />

        <section className="product-hub-products" aria-label={t("GyakutenEigo products")}>
          <article className="product-hub-card product-hub-speaking-card">
            <p className="product-hub-card-label">{t("Speaking assessment")}</p>
            <h2>SpeakCheck</h2>
            <p className="product-hub-card-description">{t("Create speaking tasks, practise with an AI partner, and review each student’s evidence.")}</p>
            <div className="product-hub-speaking-flow" aria-label={t("SpeakCheck App steps")}>
              {speakingSteps.map((step, index) => (
                <div className="product-hub-flow-stage-wrap" key={step.number}>
                  <article className={`product-hub-flow-stage ${step.className}`}>
                    <div className="product-hub-flow-visual">
                      <img src={step.image} alt={t(step.alt)} width={1448} height={1086} decoding="async" />
                    </div>
                    <div className="product-hub-flow-copy">
                      <span className="product-hub-flow-number">{step.number}</span>
                      <span>
                        <strong>{t(step.title)}</strong>
                        <small>{step.copy}</small>
                      </span>
                    </div>
                  </article>
                  {index < speakingSteps.length - 1 && <ArrowRight className="product-hub-flow-arrow" size={25} strokeWidth={2.4} aria-hidden="true" />}
                </div>
              ))}
            </div>
            <a className="product-hub-card-button product-hub-speaking-button" href={publicPagePath("/speak", language)}>
              <BookOpenText size={21} aria-hidden="true" />
              <span>{t("Open SpeakCheck")}</span>
              <ArrowRight size={22} aria-hidden="true" />
            </a>
          </article>

          <article className="product-hub-card product-hub-quizstrike-card">
            <p className="product-hub-card-label">{t("Multiplayer review")}</p>
            <div className="product-hub-quiz-title-row">
              <h2>QuizStrike</h2>
              <Gamepad2 size={58} strokeWidth={1.9} aria-hidden="true" />
            </div>
            <p className="product-hub-card-description">{t("Turn classroom review into a multiplayer challenge.")}</p>
            <div className="product-hub-quiz-art-frame">
              <img src="/assets/quizstrike-home-hero.webp" alt={t("QuizStrike classroom review game with students answering a question")} width={1448} height={1086} fetchPriority="high" decoding="async" />
              <div className="product-hub-quiz-badges" aria-label={t("QuizStrike content areas")}>
                <span><BookOpenText size={15} aria-hidden="true" />{t("Vocabulary")}</span>
                <span><Settings2 size={15} aria-hidden="true" />{t("Grammar")}</span>
                <span><Globe2 size={15} aria-hidden="true" />{t("Culture")}</span>
              </div>
            </div>
            <a className="product-hub-card-button product-hub-quiz-button" href={publicPagePath("/quiz-strike", language)}>
              <Gamepad2 size={21} aria-hidden="true" />
              <span>{t("Open QuizStrike")}</span>
              <ArrowRight size={22} aria-hidden="true" />
            </a>
          </article>
        </section>

        <section className="product-hub-benefits" aria-label={t("Classroom benefits")}>
          {benefits.map((benefit) => {
            const BenefitIcon = benefit.icon;
            return (
              <article className="product-hub-benefit-card" key={benefit.title}>
                <span className={`product-hub-benefit-icon product-hub-benefit-icon-${benefit.tone}`}>
                  <BenefitIcon size={31} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span>
                  <strong>{t(benefit.title)}</strong>
                  <small>{t(benefit.copy)}</small>
                </span>
              </article>
            );
          })}
        </section>
        <footer className="product-hub-footer">
          <span>{t("GyakutenEigo · English classroom tools")}</span>
          <a href={publicPagePath("/about", language)}>{t("About / 講師紹介")}</a>
          <a href={publicPagePath("/private-lessons", language)}>{t("Private English lessons")}</a>
          <a href={publicPagePath("/", language === "en" ? "ja" : "en")} hrefLang={language === "en" ? "ja" : "en"} lang={language === "en" ? "ja" : "en"}>{language === "en" ? "日本語" : "English"}</a>
        </footer>
      </section>
    </div>
  );
}
