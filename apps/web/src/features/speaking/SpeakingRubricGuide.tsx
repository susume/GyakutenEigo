import { SPEAKING_RUBRIC_FAIRNESS_RULES, SPEAKING_RUBRIC_GUIDE } from "@quizstrike/shared";
import { useSiteTranslation } from "../../ui/siteTranslation";

export function SpeakingRubricGuide() {
  const { t } = useSiteTranslation();
  return <details className="speaking-rubric-guide">
    <summary>{t("Fair speaking rubric: scoring guide (0–4)")}</summary>
    <p>{t("Use the same task conditions and relevant criteria for each student. Full credit is possible with simple English and allowed support.")}</p>
    {SPEAKING_RUBRIC_GUIDE.map((criterion) => <section key={criterion.id}>
      <h4>{t(criterion.name)}</h4>
      <dl>{([4, 3, 2, 1, 0] as const).map((score) => <div key={score}><dt>{score}</dt><dd>{t(criterion.levels[score])}</dd></div>)}</dl>
    </section>)}
    <p><strong>N/A:</strong> {t("Use unscored when evidence or an opportunity is missing. Zero means an observed unsuccessful attempt.")}</p>
    <ul>{SPEAKING_RUBRIC_FAIRNESS_RULES.map((rule) => <li key={rule}>{t(rule)}</li>)}</ul>
  </details>;
}
