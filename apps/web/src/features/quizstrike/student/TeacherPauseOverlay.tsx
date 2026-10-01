import { useSiteTranslation } from "../../../ui/siteTranslation";
import { Eye, Pause } from "lucide-react";

export default function TeacherPauseOverlay() {
  const { t } = useSiteTranslation();
  return (
    <div className="teacher-pause-overlay" role="alert" aria-live="assertive" aria-atomic="true" data-testid="teacher-pause-overlay">
      <div className="teacher-pause-overlay-card">
        <span className="teacher-pause-icon"><Pause size={26} aria-hidden="true" /></span>
        <span className="menu-eyebrow">{t("Classroom attention")}</span>
        <h1>{t("GAME PAUSED")}</h1>
        <p><Eye size={18} aria-hidden="true" />{" "}{t("Look at the teacher.")}</p>
        <small>{t("Your match is safely held. Nothing will move or count until the game resumes.")}</small>
      </div>
    </div>
  );
}
