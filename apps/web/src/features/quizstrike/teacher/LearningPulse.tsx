import { BrainCircuit, HelpCircle, UsersRound } from "lucide-react";
import type { LearningPulse as LearningPulseData } from "@quizstrike/shared";

export default function LearningPulse({ pulse }: { pulse?: LearningPulseData }) {
  const classAccuracy = pulse?.classAccuracy === null || pulse?.classAccuracy === undefined
    ? "—"
    : `${pulse.classAccuracy}%`;
  return (
    <section className="learning-pulse-card" aria-labelledby="learning-pulse-title" data-testid="learning-pulse">
      <header>
        <div>
          <span className="menu-eyebrow"><BrainCircuit size={15} aria-hidden="true" /> Academic overview</span>
          <h3 id="learning-pulse-title">Learning Pulse</h3>
        </div>
        <span className="learning-pulse-note">Class level · live</span>
      </header>
      <div className="learning-pulse-metrics" aria-label="Live class learning metrics">
        <span><strong>{classAccuracy}</strong><small>Class accuracy</small></span>
        <span><strong>{pulse?.answersSubmitted ?? 0}</strong><small>Answers submitted</small></span>
        <span><strong>{pulse?.studentsNeedingReview ?? 0}</strong><small>May need review</small></span>
      </div>
      <div className="learning-pulse-questions">
        <div>
          <span><HelpCircle size={15} aria-hidden="true" /> Most difficult</span>
          {pulse?.difficultQuestion ? (
            <p><q>{pulse.difficultQuestion.prompt}</q><small>{pulse.difficultQuestion.accuracy}% correct · {pulse.difficultQuestion.attempts} attempts</small></p>
          ) : <p className="learning-pulse-empty">Waiting for 3 attempts on one question.</p>}
        </div>
        <div>
          <span><UsersRound size={15} aria-hidden="true" /> Best understood</span>
          {pulse?.strongestQuestion ? (
            <p><q>{pulse.strongestQuestion.prompt}</q><small>{pulse.strongestQuestion.accuracy}% correct · {pulse.strongestQuestion.attempts} attempts</small></p>
          ) : <p className="learning-pulse-empty">More answers will show a pattern.</p>}
        </div>
      </div>
    </section>
  );
}
