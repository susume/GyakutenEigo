import { useEffect, useState } from "react";
import { BookOpenCheck, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../../../api/client";

type StudyPayload = {
  tournament: { title: string; sponsorName?: string; sponsorMessage?: string; timeZone?: string };
  studyPack: { releaseAt: string; items: Array<{ id: string; term: string; pronunciation?: string; meaning?: string; example?: string; note?: string }> };
  released?: boolean;
};

const formatDate = (value: string, timeZone = "Asia/Tokyo") => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short", timeZone }).format(date) : "Release time not available";
};
const formatRemaining = (releaseAt: string, now: number) => {
  const releaseTime = new Date(releaseAt).getTime();
  if (!Number.isFinite(releaseTime)) return "Release time not available";
  const remaining = Math.max(0, releaseTime - now);
  const totalMinutes = Math.ceil(remaining / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h remaining` : hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
};

export default function TournamentStudyPage({ tournamentId }: { tournamentId: string }) {
  const [payload, setPayload] = useState<StudyPayload | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    void api(`/api/tournament-study/${encodeURIComponent(tournamentId)}`)
      .then((result) => setPayload(result as StudyPayload))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "We couldn’t load this study pack."));
  }, [tournamentId]);
  useEffect(() => {
    const releaseAt = payload?.studyPack.releaseAt;
    if (payload?.released || !releaseAt) return;
    const refreshAtRelease = () => {
      const next = Date.now();
      setNow(next);
      if (new Date(releaseAt).getTime() <= next) {
        void api(`/api/tournament-study/${encodeURIComponent(tournamentId)}`)
          .then((result) => setPayload(result as StudyPayload))
          .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "We couldn’t load this study pack."));
      }
    };
    const timer = window.setInterval(refreshAtRelease, 30_000);
    return () => window.clearInterval(timer);
  }, [payload?.released, payload?.studyPack.releaseAt, tournamentId]);
  if (error) return <section className="tournament-study-public"><div className="tournament-study-public-card"><LockKeyhole size={30} /><span className="eyebrow">Competition study pack</span><h1>Study pack unavailable</h1><p>{error}</p></div></section>;
  if (!payload) return <section className="tournament-study-public"><div className="tournament-study-public-card"><Clock3 size={26} /><p>Loading the study pack…</p></div></section>;
  if (!payload.released) return <section className="tournament-study-public"><div className="tournament-study-public-card"><Clock3 size={30} /><span className="eyebrow">Competition study pack</span><h1>{payload.tournament.title}</h1><p>The study pack is not open yet.</p><strong>{formatRemaining(payload.studyPack.releaseAt, now)}</strong><small>Available {formatDate(payload.studyPack.releaseAt, payload.tournament.timeZone)}. Answers and teacher notes stay private.</small></div></section>;
  return <section className="tournament-study-public"><div className="tournament-study-public-wrap"><header className="tournament-study-public-header"><div><span className="eyebrow"><BookOpenCheck size={15} />Official study pack</span><h1>{payload.tournament.title}</h1><p>Review the approved material below before match day.</p></div>{payload.tournament.sponsorName && <small>Presented by {payload.tournament.sponsorName}{payload.tournament.sponsorMessage ? ` · ${payload.tournament.sponsorMessage}` : ""}</small>}</header><div className="tournament-study-public-release"><ShieldCheck size={18} /><span><strong>Ready to study</strong><small>{formatDate(payload.studyPack.releaseAt, payload.tournament.timeZone)} · Answers and teacher notes stay private.</small></span></div><div className="tournament-study-public-grid">{payload.studyPack.items.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.term}</h2>{item.pronunciation && <small>{item.pronunciation}</small>}{item.meaning && <p>{item.meaning}</p>}{item.example && <blockquote>{item.example}</blockquote>}{item.note && <em>{item.note}</em>}</article>)}</div></div></section>;
}
