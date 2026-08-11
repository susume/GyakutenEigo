import { Eye, Pause } from "lucide-react";

export default function TeacherPauseOverlay() {
  return (
    <div className="teacher-pause-overlay" role="alert" aria-live="assertive" aria-atomic="true" data-testid="teacher-pause-overlay">
      <div className="teacher-pause-overlay-card">
        <span className="teacher-pause-icon"><Pause size={26} aria-hidden="true" /></span>
        <span className="menu-eyebrow">Classroom attention</span>
        <h1>GAME PAUSED</h1>
        <p><Eye size={18} aria-hidden="true" /> Look at the teacher.</p>
        <small>Your match is safely held. Nothing will move or count until the game resumes.</small>
      </div>
    </div>
  );
}
