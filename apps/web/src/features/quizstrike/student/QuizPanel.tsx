import { useEffect, useState } from "react";
import type { Choice, GameSession, PlayerSession, PublicQuestion } from "@quizstrike/shared";
import { RESPAWN_CORRECT_ANSWERS_REQUIRED, ZOMBIE_HUMAN_CORRECT_ENERGY } from "@quizstrike/shared";
import { CheckCircle2, Volume2, XCircle } from "lucide-react";
import { getApiUrl } from "../../../api/client";

const choices: Choice[] = ["A", "B", "C", "D"];

export interface QuizAnswerFeedback {
  selectedChoice: Choice;
  correctChoice: Choice;
  isCorrect: boolean;
  rewardLabel?: string;
  explanation?: string;
  supportingText?: string;
}

export default function QuizPanel({
  question,
  player,
  session,
  playerToken,
  onAnswer,
  answeringChoice,
  answerFeedback
}: {
  question: PublicQuestion | null;
  player: PlayerSession;
  session: GameSession;
  playerToken: string;
  onAnswer: (choice: Choice) => void;
  answeringChoice: Choice | null;
  answerFeedback: QuizAnswerFeedback | null;
}) {
  const [audioError, setAudioError] = useState(false);
  const [audioSource, setAudioSource] = useState<string | undefined>();
  useEffect(() => setAudioError(false), [question?.id, question?.audioUrl]);

  useEffect(() => {
    const source = question?.audioUrl;
    if (!source) {
      setAudioSource(undefined);
      return;
    }
    if (!source.startsWith("/api/")) {
      setAudioSource(source);
      return;
    }
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | undefined;
    setAudioSource(undefined);
    void fetch(`${getApiUrl()}${source}`, {
      headers: { "X-Player-Token": playerToken },
      signal: controller.signal
    }).then(async (response) => {
      if (!response.ok) throw new Error("Question audio could not be loaded.");
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setAudioSource(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch((error: unknown) => {
      if (active && !(error instanceof DOMException && error.name === "AbortError")) setAudioError(true);
    });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [playerToken, question?.audioUrl, question?.id]);

  if (!question) return <div className="panel"><p>Your next question will appear here.</p></div>;
  const isAthletics = session.settings.gameMode === "athletics";
  const reward = isAthletics
    ? "+220 movement energy"
    : session.settings.gameMode === "zombie" && player.role !== "zombie"
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
        <div>
          <span className="menu-eyebrow">Live question</span>
          <h2>{isAthletics ? "Refuel movement" : "Answer to earn"}</h2>
        </div>
        <span className="question-reward">{reward}</span>
      </div>
      <div className="question-prompt-card">
        <p className="question-text">{question.prompt}</p>
      </div>
      {question.audioUrl && (
        <div className="question-audio">
          <Volume2 size={18} aria-hidden="true" />
          <span>Listen to the question</span>
          {audioSource && <audio controls preload="metadata" src={audioSource} aria-label="Question audio" onError={() => setAudioError(true)} />}
          {audioError && <small role="status">The audio couldn’t load. You can still answer below.</small>}
        </div>
      )}
      <div className="answer-grid">
        {choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            className={answerFeedback?.selectedChoice === choice ? "selected" : ""}
            onClick={() => onAnswer(choice)}
            disabled={Boolean(answeringChoice || answerFeedback)}
            aria-label={`Answer ${choice}: ${labels[choice]}`}
            aria-pressed={answerFeedback?.selectedChoice === choice}
          >
            <strong>{index + 1}</strong>
            <span>{answeringChoice === choice ? "Checking..." : labels[choice]}</span>
          </button>
        ))}
      </div>
      <section className={`question-feedback-area${answerFeedback ? " has-result" : ""}`} aria-live="polite" aria-atomic="true">
        {!answerFeedback ? (
          <span className="question-feedback-prompt">Choose an answer</span>
        ) : (
          <div className={`question-feedback-result ${answerFeedback.isCorrect ? "is-correct" : "is-incorrect"}`}>
            <div className="question-feedback-heading">
              {answerFeedback.isCorrect ? <CheckCircle2 size={27} aria-hidden="true" /> : <XCircle size={27} aria-hidden="true" />}
              <strong>{answerFeedback.isCorrect ? "✓ CORRECT!" : "✕ INCORRECT"}</strong>
            </div>
            <div className="question-feedback-answers">
              <div>
                <span>Your answer</span>
                <strong>{labels[answerFeedback.selectedChoice]}</strong>
              </div>
              {!answerFeedback.isCorrect && (
                <div>
                  <span>Correct answer</span>
                  <strong>{labels[answerFeedback.correctChoice]}</strong>
                </div>
              )}
            </div>
            {answerFeedback.rewardLabel && <p className="question-feedback-reward">{answerFeedback.rewardLabel}</p>}
            {answerFeedback.explanation && <p className="question-feedback-explanation">{answerFeedback.explanation}</p>}
            {answerFeedback.supportingText && <p className="question-feedback-note">{answerFeedback.supportingText}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
