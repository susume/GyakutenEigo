import { ArrowRight, Languages } from "lucide-react";
import {
  speakingFeedbackCopy,
  speakingOverallScore,
  type SpeakingActivity,
  type SpeakingEvaluation,
  type SpeakingTurn,
} from "@quizstrike/shared";

export const hasStudentSpeech = (turns: SpeakingTurn[]) =>
  turns.some(
    (turn) => turn.speaker === "student" && turn.text.trim().length > 0,
  );
export const scoreFor = (evaluation?: SpeakingEvaluation) =>
  speakingOverallScore(evaluation);
const scoreForCriterion = (
  evaluation: SpeakingEvaluation,
  criterionId: string,
) => evaluation.scores[criterionId];

export function ResultPanel({
  activity,
  turns,
  evaluation,
  teacherView,
}: {
  activity: Pick<
    SpeakingActivity,
    "title" | "rubric" | "targetExpressions" | "nativeLanguage"
  >;
  turns: SpeakingTurn[];
  evaluation: SpeakingEvaluation;
  teacherView: boolean;
}) {
  const studentTurns = turns.filter((turn) => turn.speaker === "student");
  const copy = speakingFeedbackCopy(evaluation.language);
  return (
    <section
      className={`speaking-result-panel${teacherView ? " speaking-result-panel-teacher" : ""}`}
    >
      <div className="speaking-result-panel-heading">
        <div>
          <span className="speaking-card-kicker">
            {teacherView ? copy.evaluationDetail : copy.resultHeading}
          </span>
          <h2>{teacherView ? activity.title : copy.resultHeading}</h2>
        </div>
        <span className="speaking-result-language">
          <Languages size={15} aria-hidden="true" />
          {evaluation.language === "ja"
            ? "日本語フィードバック"
            : "English feedback"}
        </span>
      </div>
      {evaluation.assessmentStatus === "insufficient_evidence" && (
        <div className="speaking-result-message speaking-result-message-warning">
          <h3>{copy.insufficientEvidenceHeadline}</h3>
          <p>{evaluation.notScoredReason ?? copy.notScoredDetail}</p>
        </div>
      )}
      <p className="speaking-rubric-intro">{evaluation.language === "ja" ? "評価基準と会話の根拠 · 各項目4点満点" : "Rubric and conversation evidence · Each criterion is scored out of 4"}</p>
      <div className="speaking-score-grid">
        {activity.rubric
          .filter((criterion) => criterion.enabled)
          .map((criterion) => {
            const score = scoreForCriterion(evaluation, criterion.id);
            return (
              <div className="speaking-score-row" key={criterion.id}>
                <div>
                  <strong>
                    {criterion.name === "Fluency / Comprehensibility"
                      ? "Fluency"
                      : criterion.name}
                  </strong>
                  <small>{criterion.description}</small>
                  {evaluation.evidence[criterion.id] && <p className="speaking-criterion-evidence">{evaluation.evidence[criterion.id]}</p>}
                </div>
                <span
                  className="speaking-criterion-score"
                  aria-label={
                    score === null || score === undefined
                      ? copy.notScored
                      : `${score} out of 4`
                  }
                >
                  {typeof score === "number" && <meter min={0} max={4} value={score} aria-label={`${criterion.name} score`} />}
                  <b>
                    {typeof score === "number" ? `${score}/4` : copy.notScored}
                  </b>
                </span>
              </div>
            );
          })}
      </div>
      <div className="speaking-result-columns">
        <div className="speaking-result-message speaking-result-message-good">
          <h3>{copy.whatWentWell}</h3>
          <ul>
            {evaluation.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </div>
        <div className="speaking-result-message">
          <h3>{copy.tryNext}</h3>
          <ul>
            {evaluation.improvements.map((improvement) => (
              <li key={improvement}>{improvement}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="speaking-useful-result">
        <div className="speaking-result-section-heading">
          <h3>{copy.usefulEnglish}</h3>
          <span>
            {studentTurns.length} {copy.speakingTurns}
          </span>
        </div>
        {evaluation.usefulEnglish.length ? (
          evaluation.usefulEnglish.map((item) => (
            <div
              className="speaking-correction-row"
              key={`${item.said}-${item.try}`}
            >
              <div>
                <small>{copy.youSaid}</small>
                <span>“{item.said}”</span>
              </div>
              <ArrowRight size={17} aria-hidden="true" />
              <div>
                <small>{copy.tryLabel}</small>
                <strong>“{item.try}”</strong>
              </div>
            </div>
          ))
        ) : (
          <p className="speaking-muted-copy">
            {hasStudentSpeech(turns)
              ? copy.noUsefulEnglish
              : copy.noSpeechDetected}
          </p>
        )}
      </div>
        <details className="speaking-transcript-detail">
          <summary>{copy.transcript} · {turns.length}</summary>
          {turns.map((turn) => (
            <p key={turn.id}>
              <strong>
                {turn.speaker === "ai" ? copy.aiLabel : copy.studentLabel}
              </strong>
              <span>{turn.text}</span>
            </p>
          ))}
        </details>
    </section>
  );
}
