import { useSiteTranslation } from "../../../ui/siteTranslation";
import { BrainCircuit, HelpCircle, UsersRound } from "lucide-react";
import type { LearningPulse as LearningPulseData } from "@quizstrike/shared";

export default function LearningPulse({ pulse }: { pulse?: LearningPulseData }) {
  const { t } = useSiteTranslation();
  const classAccuracy = pulse?.classAccuracy === null || pulse?.classAccuracy === undefined
    ? "—"
    : `${pulse.classAccuracy}%`;
  return (
    <section className="learning-pulse-card" aria-labelledby="learning-pulse-title" data-testid="learning-pulse">
      <header>
        <div>
          <span className="menu-eyebrow"><BrainCircuit size={15} aria-hidden="true" />{" "}{t("Academic overview")}</span>
          <h3 id="learning-pulse-title">{t("Learning Pulse")}</h3>
        </div>
        <span className="learning-pulse-note">{t("Class level · live")}</span>
      </header>
      <div className="learning-pulse-metrics" aria-label={t("Live class learning metrics")}>
        <span><strong>{classAccuracy}</strong><small>{t("Class accuracy")}</small></span>
        <span><strong>{pulse?.answersSubmitted ?? 0}</strong><small>{t("Answers submitted")}</small></span>
        <span><strong>{pulse?.studentsNeedingReview ?? 0}</strong><small>{t("May need review")}</small></span>
      </div>
      <div className="learning-pulse-questions">
        <div>
          <span><HelpCircle size={15} aria-hidden="true" />{" "}{t("Most difficult")}</span>
          {pulse?.difficultQuestion ? (
            <p><q>{pulse.difficultQuestion.prompt}</q><small>{pulse.difficultQuestion.accuracy}{t("% correct ·")}{" "}{pulse.difficultQuestion.attempts}{" "}{t("attempts")}</small></p>
          ) : <p className="learning-pulse-empty">{t("Waiting for 3 attempts on one question.")}</p>}
        </div>
        <div>
          <span><UsersRound size={15} aria-hidden="true" />{" "}{t("Best understood")}</span>
          {pulse?.strongestQuestion ? (
            <p><q>{pulse.strongestQuestion.prompt}</q><small>{pulse.strongestQuestion.accuracy}{t("% correct ·")}{" "}{pulse.strongestQuestion.attempts}{" "}{t("attempts")}</small></p>
          ) : <p className="learning-pulse-empty">{t("More answers will show a pattern.")}</p>}
        </div>
      </div>
    </section>
  );
}
