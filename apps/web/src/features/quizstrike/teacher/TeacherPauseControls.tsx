import { Pause, Play } from "lucide-react";

export default function TeacherPauseControls({
  paused,
  busy,
  disabled,
  onToggle
}: {
  paused: boolean;
  busy: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`teacher-pause-controls${paused ? " is-paused" : ""}`} aria-label="Teacher game attention controls">
      <button
        type="button"
        className={paused ? "primary teacher-resume-button" : "teacher-pause-button"}
        onClick={onToggle}
        disabled={disabled || busy}
        aria-pressed={paused}
      >
        {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
        {busy ? (paused ? "Resuming…" : "Pausing…") : paused ? "Resume Game" : "Pause Game"}
      </button>
      {paused && <span role="status">Game paused · students are waiting for your instruction</span>}
    </div>
  );
}
