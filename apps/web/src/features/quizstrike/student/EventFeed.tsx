import { useSiteTranslation } from "../../../ui/siteTranslation";
import type { GameEvent } from "@quizstrike/shared";

export default function EventFeed({ events }: { events: GameEvent[] }) {
  const { t, locale } = useSiteTranslation();
  const recentEvents = events.slice(0, 8);
  return (
    <div className="event-feed">
      <div className="panel-title">
        <h2>{t("Live Feed")}</h2>
        <span>{recentEvents.length ? t("Latest updates") : t("Waiting for the first play")}</span>
      </div>
      <div className="event-list" aria-live="polite">
        {recentEvents.map((event) => (
          <div className={`event-item event-${event.type}`} key={event.id}>
            <strong>{event.type === "answer" ? t("Answer") : event.type === "buy" ? t("Gear") : event.type === "join" ? t("Joined") : event.type === "start" ? t("Start") : event.type}</strong>
            <span>{t(event.message)}</span>
            <small>{new Date(event.createdAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</small>
          </div>
        ))}
        {recentEvents.length === 0 && <p>{t("Updates will appear here as the game moves.")}</p>}
      </div>
    </div>
  );
}
