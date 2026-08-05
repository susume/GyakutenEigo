import { useEffect, useState } from "react";
import type { Choice, GameSession, PlayerSession, PublicQuestion } from "@quizstrike/shared";
import { RESPAWN_CORRECT_ANSWERS_REQUIRED, ZOMBIE_HUMAN_CORRECT_ENERGY } from "@quizstrike/shared";
import { Volume2 } from "lucide-react";
import { getApiUrl } from "../../../api/client";

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
  const [audioError, setAudioError] = useState(false);
  useEffect(() => setAudioError(false), [question?.id, question?.audioUrl]);

  if (!question) return <div className="panel"><p>Your next question will appear here.</p></div>;
  const audioSource = question.audioUrl?.startsWith("/api/")
    ? `${getApiUrl()}${question.audioUrl}`
    : question.audioUrl;
  const reward = session.settings.gameMode === "zombie" && player.role !== "zombie"
    ? `+${ZOMBIE_HUMAN_CORRECT_ENERGY} running energy`
    : player.isAlive || session.settings.deadPlayersEarnMoney
    ? `$${session.settings.correctAnswerReward}`
    : session.settings.deadPlayersCanPractice
      ? `Respawn ${player.respawnCorrectAnswers ?? 0}/${RESPAWN_CORRECT_ANSWERS_REQUIRED}`
      : "Practice is off";
  const labels = {
    A: question.choiceA,
    B: question.choiceB,
    C: question.choiceC,
    D: question.choiceD
  };
  return (
    <div className="panel quiz-panel">
      <div className="panel-title">
        <h2>Question</h2>
        <span>{reward}</span>
      </div>
      <p className="menu-timer-note">The round clock keeps running while you answer.</p>
      <p className="question-text">{question.prompt}</p>
      {question.audioUrl && (
        <div className="question-audio">
          <Volume2 size={18} aria-hidden="true" />
          <span>Listen to the question</span>
          <audio controls preload="metadata" src={audioSource} aria-label="Question audio" onError={() => setAudioError(true)} />
          {audioError && <small role="status">The audio couldn’t load. You can still answer below.</small>}
        </div>
      )}
      <div className="answer-grid">
        {choices.map((choice, index) => (
          <button key={choice} onClick={() => onAnswer(choice)} disabled={Boolean(answeringChoice)}>
            <strong>{index + 1}</strong>
            {answeringChoice === choice ? "Checking..." : labels[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}
