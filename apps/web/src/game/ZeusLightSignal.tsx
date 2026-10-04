import { useSiteTranslation } from "../ui/siteTranslation";

export const ZeusLightSignal = ({ light, floating = false }: { light: "green" | "red" | "waiting" | "defeated"; floating?: boolean }) => {
  const { t } = useSiteTranslation();
  if (light === "defeated") return null;
  return <div className={`zeus-light-signal is-${light}${floating ? "" : " is-inline"}`} data-testid={floating ? "zeus-question-signal" : "zeus-light-signal"} data-light={light} role="status" aria-live="polite">
    <span className="zeus-signal-icon" aria-hidden="true">{light === "red" ? "■" : light === "green" ? "▶" : "…"}</span>
    <div><strong>{light === "red" ? t("STOP") : light === "green" ? t("GO") : t("GET READY")}</strong>
      <span>{light === "red" ? t("Zeus is watching") : light === "green" ? t("Climb while Zeus chants") : t("Watch Zeus's head")}</span></div>
  </div>;
};
