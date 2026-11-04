import { hasHwgDoctorRubric, HWG_DOCTOR_GRADE_BANDS, HWG_DOCTOR_RUBRIC, SPEAKING_RUBRIC_FAIRNESS_RULES, SPEAKING_RUBRIC_GUIDE, type SpeakingRubricCriterion } from "@quizstrike/shared";
import { useSiteTranslation } from "../../ui/siteTranslation";

export function SpeakingRubricGuide({ rubric }: { rubric: SpeakingRubricCriterion[] }) {
  const { t } = useSiteTranslation();
  const doctorCriteria = HWG_DOCTOR_RUBRIC.filter(({ id }) => rubric.some((criterion) => criterion.enabled && criterion.id === id));
  const levels = doctorCriteria.length
    ? doctorCriteria.map((criterion) => ({ ...criterion, levels: Object.entries(criterion.levels) }))
    : SPEAKING_RUBRIC_GUIDE.map((criterion) => ({ ...criterion, levels: Object.entries(criterion.levels) }));
  return <details className="speaking-rubric-guide">
    <summary>{doctorCriteria.length ? t("HWG DL6 scoring guide (0–5)") : t("Fair speaking rubric: scoring guide (0–4)")}</summary>
    <p>{t("Use the same task conditions and relevant criteria for each student. Full credit is possible with simple English and allowed support.")}</p>
    {hasHwgDoctorRubric(rubric) && <p>{HWG_DOCTOR_GRADE_BANDS.map(({ grade, min, max }) => `${grade} ${min}–${max}`).join(" · ")}</p>}
    {levels.map((criterion) => <section key={criterion.id}>
      <h4>{t(criterion.name)}</h4>
      <dl>{criterion.levels.slice().reverse().map(([score, anchor]) => <div key={score}><dt>{score}</dt><dd>{t(anchor)}</dd></div>)}</dl>
    </section>)}
    {doctorCriteria.some(({ id }) => id === "hwg_dl6_clarity") && <p>{t("AI scores Clarity from what the doctor understood in the conversation. Voice volume and pace require listening to the audio.")}</p>}
    <p><strong>N/A:</strong> {t("Use unscored when evidence or an opportunity is missing. Zero means an observed unsuccessful attempt.")}</p>
    <ul>{SPEAKING_RUBRIC_FAIRNESS_RULES.map((rule) => <li key={rule}>{t(rule)}</li>)}</ul>
  </details>;
}
