import { useSiteTranslation } from "../../../ui/siteTranslation";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, LockKeyhole, UsersRound } from "lucide-react";
import type { TeacherUser } from "@quizstrike/shared";
import { ApiError, tournamentApi } from "../../../api/client";

type InvitePayload = {
  tournament: { id: string; title: string; description: string; sponsorName?: string; sponsorMessage?: string; level: string; tournamentAt: string; timeZone: string; maximumTeams: number; registeredTeams: number };
  teamSize: number;
  remainingSlots: number;
};

const errorMessage = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : "We couldn’t use this invitation. Check the link and try again.";

export default function TournamentRegistrationPage({ tournamentId, invitationCode, teacher, onTeacherLogin }: { tournamentId: string; invitationCode: string; teacher?: TeacherUser | null; onTeacherLogin: () => void }) {
  const { t } = useSiteTranslation();
  const [payload, setPayload] = useState<InvitePayload | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ teamName: "", schoolName: "", className: "", roster: "", substitutes: "" });
  useEffect(() => {
    if (!invitationCode) {
      setError("This invitation link is missing its code. Ask the organizer for a new link.");
      return;
    }
    void tournamentApi.invitationDetails(tournamentId, invitationCode)
      .then((result) => setPayload(result as InvitePayload))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [invitationCode, tournamentId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!teacher) {
      setError("Sign in as a teacher before registering a team.");
      return;
    }
    setError("");
    try {
      await tournamentApi.addTeam(tournamentId, {
        ...form,
        invitationCode,
        roster: form.roster.split(",").map((displayName) => ({ displayName: displayName.trim() })).filter((item) => item.displayName),
        substitutes: form.substitutes.split(",").map((displayName) => ({ displayName: displayName.trim() })).filter((item) => item.displayName)
      });
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  if (submitted) return <section className="tournament-registration-page"><div className="tournament-study-public-card"><CheckCircle2 size={30} /><span className="eyebrow">{t("Team sent for review")}</span><h1>{payload?.tournament.title ?? t("Competition")}</h1><p>{t("Your team details are in. The organizer will review the roster before adding it to the bracket.")}</p></div></section>;
  if (error && !payload) return <section className="tournament-registration-page"><div className="tournament-study-public-card"><LockKeyhole size={30} /><span className="eyebrow">{t("Competition registration")}</span><h1>{t("Invitation unavailable")}</h1><p>{t(error)}</p></div></section>;
  if (!payload) return <section className="tournament-registration-page"><div className="tournament-study-public-card"><UsersRound size={26} /><p>{t("Loading team registration…")}</p></div></section>;
  return <section className="tournament-registration-page"><div className="tournament-registration-card"><div className="tournament-registration-heading"><span className="eyebrow">{t("Teacher invitation")}</span><h1>{payload.tournament.title}</h1><p>{payload.tournament.description}</p>{payload.tournament.sponsorName && <small>{t("Presented by")}{" "}{payload.tournament.sponsorName}{payload.tournament.sponsorMessage ? t(" · {value0}", { value0: payload.tournament.sponsorMessage }) : ""}</small>}</div><div className="tournament-registration-meta"><span>{payload.tournament.registeredTeams}/{payload.tournament.maximumTeams}{" "}{t("team places used")}</span><span>{payload.teamSize}{" "}{t("players per team")}</span></div>{!teacher && <div className="tournament-registration-login"><LockKeyhole size={17} /><span>{t("Sign in as a teacher to send this team for review.")}</span><button className="secondary-button" onClick={onTeacherLogin}>{t("Teacher login")}</button></div>}<form onSubmit={(event) => void submit(event)}><label>{t("Team name")}<input required value={form.teamName} onChange={(event) => setForm({ ...form, teamName: event.target.value })} /></label><label>{t("School name")}<input required value={form.schoolName} onChange={(event) => setForm({ ...form, schoolName: event.target.value })} /></label><label>{t("Class name")}{" "}<span className="field-help">{t("optional")}</span><input value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} /></label><label>{t("Player names")}{" "}<span className="field-help">{t("separate with commas")}</span><input required placeholder={t("Up to {value0} names", { value0: payload.teamSize })} value={form.roster} onChange={(event) => setForm({ ...form, roster: event.target.value })} /></label><label>{t("Substitutes")}{" "}<span className="field-help">{t("optional, separate with commas")}</span><input value={form.substitutes} onChange={(event) => setForm({ ...form, substitutes: event.target.value })} /></label>{error && <p className="inline-error" role="alert">{t(error)}</p>}<button className="primary" disabled={!teacher || payload.remainingSlots < 1}>{t("Send team for review")}</button></form></div></section>;
}
