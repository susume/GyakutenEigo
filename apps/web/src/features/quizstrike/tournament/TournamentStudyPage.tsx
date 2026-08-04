import { useEffect, useState } from "react";
import { BookOpenCheck, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../../../api/client";

type StudyPayload = {
  tournament: { title: string; sponsorName?: string; sponsorMessage?: string };
  studyPack: { releaseAt: string; items: Array<{ id: string; term: string; pronunciation?: string; meaning?: string; example?: string; note?: string }> };
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));

export default function TournamentStudyPage({ tournamentId }: { tournamentId: string }) {
  const [payload, setPayload] = useState<StudyPayload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void api(`/api/tournament-study/${encodeURIComponent(tournamentId)}`).then((result) => setPayload(result as StudyPayload)).catch((err: unknown) => setError(err instanceof ApiError ? err.message : "This study pack is not available."));
  }, [tournamentId]);
  if (error) return <section className="tournament-study-public"><div className="tournament-study-public-card"><LockKeyhole size={30} /><span className="eyebrow">QuizStrike Tournament Center</span><h1>Study pack not released</h1><p>{error}</p><small>Return after the organizer’s scheduled release time.</small></div></section>;
  if (!payload) return <section className="tournament-study-public"><div className="tournament-study-public-card"><Clock3 size={26} /><p>Loading study pack…</p></div></section>;
  return <section className="tournament-study-public"><div className="tournament-study-public-wrap"><header className="tournament-study-public-header"><div><span className="eyebrow"><BookOpenCheck size={15} />Official study pack</span><h1>{payload.tournament.title}</h1><p>Study only the approved material below before the match.</p></div>{payload.tournament.sponsorName && <small>Presented by {payload.tournament.sponsorName}{payload.tournament.sponsorMessage ? ` · ${payload.tournament.sponsorMessage}` : ""}</small>}</header><div className="tournament-study-public-release"><ShieldCheck size={18} /><span><strong>Released for learners</strong><small>{formatDate(payload.studyPack.releaseAt)} · Answers and teacher notes stay private.</small></span></div><div className="tournament-study-public-grid">{payload.studyPack.items.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.term}</h2>{item.pronunciation && <small>{item.pronunciation}</small>}{item.meaning && <p>{item.meaning}</p>}{item.example && <blockquote>{item.example}</blockquote>}{item.note && <em>{item.note}</em>}</article>)}</div></div></section>;
}
