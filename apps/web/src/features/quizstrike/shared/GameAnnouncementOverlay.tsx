import { useEffect, useState } from "react";
import type { GameAnnouncement } from "@quizstrike/shared";

export default function GameAnnouncementOverlay({
  announcement,
  serverTime
}: {
  announcement?: GameAnnouncement;
  serverTime?: string;
}) {
  const [visible, setVisible] = useState(Boolean(announcement));

  useEffect(() => {
    if (!announcement) {
      setVisible(false);
      return;
    }
    if (!announcement.expiresAt) {
      setVisible(true);
      return;
    }

    const serverTimeMs = serverTime ? Date.parse(serverTime) : Number.NaN;
    const serverOffsetMs = Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0;
    const remainingMs = Date.parse(announcement.expiresAt) - (Date.now() + serverOffsetMs);
    setVisible(remainingMs > 0);
    if (remainingMs <= 0) return;
    const timeout = window.setTimeout(() => setVisible(false), remainingMs);
    return () => window.clearTimeout(timeout);
  }, [announcement, serverTime]);

  if (!announcement || !visible) return null;
  return (
    <div className={`game-announcement game-announcement-${announcement.kind}`} role="alert" aria-live="assertive" aria-atomic="true">
      <div className="game-announcement-card">
        <span>{announcement.kind === "game_over" ? "Final result" : announcement.kind === "round_result" ? "Round complete" : announcement.kind === "buy_phase" || announcement.kind === "preparation" ? "Get ready" : "Next up"}</span>
        <h2>{announcement.title}</h2>
        <p>{announcement.message}</p>
        {announcement.detail && <strong>{announcement.detail}</strong>}
      </div>
    </div>
  );
}
