import { useSiteTranslation } from "../ui/siteTranslation";
import "./zeus-feedback.css";

/** Screen-space impact survives the immediate server-authoritative reset. */
export const ZeusStrikeFeedback = ({ levelNumber }: { levelNumber: number }) => {
  const { t } = useSiteTranslation();
  return <div className="zeus-strike-feedback" data-testid="zeus-strike-feedback">
    <div className="zeus-strike-glow" aria-hidden="true" />
    <svg className="zeus-strike-bolts" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path d="M260 0 350 200 280 240 400 430 330 460 420 650 M740 0 650 200 720 240 600 430 670 460 580 650" />
    </svg>
    <div className="zeus-strike-message" role="alert">
      <span className="zeus-strike-symbol" aria-hidden="true">ϟ</span>
      <div><strong>{t("ZEUS STRUCK YOU!")}</strong>
        <p>{t("You moved during STOP. Back to level {value0}!", { value0: levelNumber })}</p>
        <small>{t("Half your energy kept · Wait for GO to climb again")}</small></div>
    </div>
  </div>;
};
