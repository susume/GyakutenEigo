import { useSiteTranslation } from "../ui/siteTranslation";
import { RotateCcw } from "lucide-react";
import "./zeus-feedback.css";

/** Screen-space impact survives the immediate server-authoritative reset. */
export const ZeusStrikeFeedback = ({ levelNumber }: { levelNumber: number }) => {
  const { t } = useSiteTranslation();
  return <div className="zeus-strike-feedback" data-testid="zeus-strike-feedback">
    <div className="zeus-strike-message" role="status" aria-live="polite">
      <RotateCcw className="zeus-strike-symbol" size={32} aria-hidden="true" />
      <div><strong>{t("Caught! Try again")}</strong>
        <p>{t("Retry level {value0} · Your checkpoints are safe", { value0: levelNumber })}</p>
        <small>{t("90% energy kept · Freeze on STOP, climb on GO")}</small></div>
    </div>
  </div>;
};
