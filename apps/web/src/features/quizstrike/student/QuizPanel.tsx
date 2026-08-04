import type { Choice, GameSession, PlayerSession, PublicQuestion } from "@quizstrike/shared";
import { RESPAWN_CORRECT_ANSWERS_REQUIRED, ZOMBIE_HUMAN_CORRECT_ENERGY } from "@quizstrike/shared";
import { Volume2 } from "lucide-react";

const choices: Choice[] = ["A", "B", "C", "D"];

export default function QuizPanel({
  question,
  player,
  session,
  onAnswer,
  answeringChoice
}: {
  question: PublicQuestion | null;
  player: PlayerSession;
  session: GameSession;
  onAnswer: (choice: Choice) => void;
  answeringChoice: Choice | null;
}) {
  if (!question) return <div className="panel"><p>No quiz question is available yet.</p></div>;
  const reward = session.settings.gameMode === "zombie" && player.role !== "zombie"
    ? `+${ZOMBIE_HUMAN_CORRECT_ENERGY} running energy`
    : player.isAlive || session.settings.deadPlayersEarnMoney
    ? `$${session.settings.correctAnswerReward}`
    : session.settings.deadPlayersCanPractice
      ? `Respawn ${player.respawnCorrectAnswers ?? 0}/${RESPAWN_CORRECT_ANSWERS_REQUIRED}`
      : "Practice disabled";
  const labels = {
    A: question.choiceA,
    B: question.choiceB,
    C: question.choiceC,
    D: question.choiceD
  };
  return (
    <div className="panel quiz-panel">
      <div className="panel-title">
        <h2>Quiz Panel</h2>
        <span>{reward}</span>
      </div>
      <p className="menu-timer-note">The round timer continues while this panel is open.</p>
      <p className="question-text">{question.prompt}</p>
      {question.audioUrl && (
        <div className="question-audio">
          <Volume2 size={18} aria-hidden="true" />
          <span>Listen</span>
          <audio controls preload="metadata" src={question.audioUrl} aria-label="Question audio" />
        </div>
      )}
      <div className="answer-grid">
        {choices.map((choice, index) => (
          <button key={choice} onClick={() => onAnswer(choice)} disabled={Boolean(answeringChoice)}>
            <strong>{index + 1}</strong>
            {answeringChoice === choice ? "Working..." : labels[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}
