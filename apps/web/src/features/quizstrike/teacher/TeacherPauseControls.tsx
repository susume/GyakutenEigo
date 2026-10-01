import { useSiteTranslation } from "../../../ui/siteTranslation";
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
  const { t } = useSiteTranslation();
  return (
    <div className={`teacher-pause-controls${paused ? " is-paused" : ""}`} aria-label={t("Teacher game attention controls")}>
      <button
        type="button"
        className={paused ? "primary teacher-resume-button" : "teacher-pause-button"}
        onClick={onToggle}
        disabled={disabled || busy}
        aria-pressed={paused}
      >
        {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
        {busy ? (paused ? t("Resuming…") : t("Pausing…")) : paused ? t("Resume Game") : t("Pause Game")}
      </button>
      {paused && <span role="status">{t("Game paused · students are waiting for your instruction")}</span>}
    </div>
  );
}
