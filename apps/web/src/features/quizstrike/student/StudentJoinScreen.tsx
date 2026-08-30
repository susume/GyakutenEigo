import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link2 } from "lucide-react";
import { studentApi } from "../../../api/client";
import { getJoinCodeFromSearch } from "../../../navigation";
import { formatStudentJoinError } from "../../../studentJoinErrors";
import {
  markStoredAppearanceForSession,
  readCosmeticProgressToken,
  readStoredStudentSession,
  storeCosmeticProgressToken,
  storeStudentSession,
  type StoredStudentSession
} from "./studentSessionStorage";
import { getNicknameError, validateStudentJoin } from "./studentJoinValidation";

type StudentJoinPayload = {
  session: { sessionCode: string };
  player: { id: string };
  playerToken: string;
  cosmeticProgressToken?: string;
};

export default function StudentJoinScreen({ onJoined }: { onJoined: (options?: { replace?: boolean }) => void }) {
  const joinCodeFromLink = useState(() => getJoinCodeFromSearch(window.location.search))[0];
  const [joinCode, setJoinCode] = useState(joinCodeFromLink);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const redirectedRef = useRef(false);
  const nicknameError = getNicknameError(nickname);

  useEffect(() => {
    const stored = readStoredStudentSession();
    if (!stored || (joinCodeFromLink && stored.sessionCode !== joinCodeFromLink) || redirectedRef.current) return;
    redirectedRef.current = true;
    onJoined({ replace: true });
  }, [joinCodeFromLink, onJoined]);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (isJoining || nicknameError) return;
    const validation = validateStudentJoin(joinCode, nickname);
    if (validation.error) {
      setError(validation.error);
      return;
    }
    setError("");
    setIsJoining(true);
    try {
      const payload = await studentApi.join(validation.code, validation.nickname, readCosmeticProgressToken()) as StudentJoinPayload;
      storeCosmeticProgressToken(payload.cosmeticProgressToken);
      storeStudentSession({
        sessionCode: payload.session.sessionCode,
        playerId: payload.player.id,
        playerToken: payload.playerToken
      } satisfies StoredStudentSession);
      markStoredAppearanceForSession(payload.session.sessionCode, payload.player.id);
      onJoined();
    } catch (joinError) {
      setError(formatStudentJoinError(joinError));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <section className="auth-layout student-join-screen game-join-screen">
      <div className="student-join-help">
        <div className="panel how-to-card controls-card" aria-labelledby="student-controls-heading">
          <div className="controls-card-heading"><h2 id="student-controls-heading">Quick controls</h2><span>Keyboard + touch</span></div>
          <div className="student-controls-grid">
            <div className="student-control"><kbd>WASD</kbd><span>Move at full speed (Athletics)</span></div>
            <div className="student-control"><kbd>Shift</kbd><span>Crouch (Athletics)</span></div>
            <div className="student-control"><kbd>Space</kbd><span>Jump (Athletics)</span></div>
            <div className="student-control"><kbd>Arrow keys / swipe</kbd><span>Look around</span></div>
            <div className="student-control"><kbd>F</kbd><span>Fire</span></div>
            <div className="student-control"><kbd>C</kbd><span>Zoom</span></div>
            <div className="student-control"><kbd>E</kbd><span>Environment button</span></div>
            <div className="student-control"><kbd>Q</kbd><span>Questions</span></div>
            <div className="student-control"><kbd>B / 1-6</kbd><span>Open and choose gear</span></div>
            <div className="student-control"><kbd>Tab</kbd><span>Scoreboard</span></div>
          </div>
        </div>
      </div>
      <form className="panel form-panel student-join-form" onSubmit={join}>
        <div className="game-join-form-heading">
          <span className="auth-kicker">Player join</span>
          <h1>Enter QuizStrike</h1>
          <p>Use the game code from the host, then choose your player name.</p>
        </div>
        {joinCodeFromLink ? (
          <div className="linked-join-code" aria-label={`Join session ${joinCode}`}>
            <span><Link2 size={17} aria-hidden="true" />Game link ready</span>
            <strong>{joinCode}</strong>
            <small>Add your player name below to join.</small>
          </div>
        ) : (
          <label className="join-field">
            <span className="join-field-label">Game code</span>
            <input
              value={joinCode}
              onChange={(event) => { setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setError(""); }}
              maxLength={6}
              required
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
              inputMode="text"
              enterKeyHint="next"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "join-error join-code-help" : "join-code-help"}
              placeholder="ABC123"
            />
            <small id="join-code-help">Enter the 6-character code on the host's screen.</small>
          </label>
        )}
        <label className="join-field">
          <span className="join-field-label">Player name</span>
          <input required placeholder="Player name" autoComplete="nickname" autoFocus={Boolean(joinCodeFromLink)} enterKeyHint="done" value={nickname} onChange={(event) => { setNickname(event.target.value); setError(""); }} maxLength={20} aria-invalid={Boolean(nicknameError)} aria-describedby={nicknameError ? "nickname-error nickname-help" : "nickname-help"} />
          <small id="nickname-help">Use a name other players will recognize.</small>
        </label>
        {nicknameError && <p id="nickname-error" className="error-text" role="alert">{nicknameError}</p>}
        {error && <p id="join-error" className="error-text" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={isJoining || Boolean(nicknameError)}>
          {isJoining ? "Joining..." : "Join game"}
        </button>
      </form>
    </section>
  );
}
