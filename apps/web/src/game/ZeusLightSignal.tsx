import { useSiteTranslation } from "../ui/siteTranslation";
import { Hand, Play, Timer } from "lucide-react";

export const ZeusLightSignal = ({ light, stopInSeconds, goInSeconds, floating = false }: {
  light: "green" | "red" | "waiting" | "defeated"; stopInSeconds?: number | null; goInSeconds?: number; floating?: boolean;
}) => {
  const { t } = useSiteTranslation();
  if (light === "defeated") return null;
  const warning = light === "green" && stopInSeconds != null;
  const Icon = light === "red" ? Hand : warning || light === "waiting" ? Timer : Play;
  return <div className={`zeus-light-signal is-${light}${warning ? " is-warning" : ""}${floating ? "" : " is-inline"}`} data-testid={floating ? "zeus-question-signal" : "zeus-light-signal"} data-light={light} data-stop-in={warning ? stopInSeconds : undefined} role="status" aria-live="polite" aria-atomic="true">
    <Icon className="zeus-signal-icon" size={22} aria-hidden="true" />
    <div><strong>{light === "red" ? t("STOP") : light === "green" ? t("GO") : t("GET READY")}</strong>
      <span>{light === "red" ? goInSeconds ? t("Hold still · GO in {value0}", { value0: goInSeconds }) : t("Hold still · GO soon")
        : warning ? t("STOP in {value0} · Get ready to freeze", { value0: stopInSeconds })
        : light === "green" ? t("Your turn to climb") : t("GO to climb · STOP to freeze")}</span></div>
  </div>;
};
