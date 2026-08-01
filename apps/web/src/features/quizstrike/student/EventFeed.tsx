import type { GameEvent } from "@quizstrike/shared";

export default function EventFeed({ events }: { events: GameEvent[] }) {
  const recentEvents = events.slice(0, 8);
  return (
    <div className="event-feed">
      <div className="panel-title">
        <h2>Live Feed</h2>
        <span>{recentEvents.length ? "Latest actions" : "Waiting"}</span>
      </div>
      <div className="event-list" aria-live="polite">
        {recentEvents.map((event) => (
          <div className={`event-item event-${event.type}`} key={event.id}>
            <strong>{event.type}</strong>
            <span>{event.message}</span>
            <small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>
          </div>
        ))}
        {recentEvents.length === 0 && <p>No live actions yet.</p>}
      </div>
    </div>
  );
}
