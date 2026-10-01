import { useSiteTranslation } from "../../../ui/siteTranslation";
import { useEffect, useMemo, useState } from "react";
import { Download, Mic, Search, Trash2 } from "lucide-react";
import { speakingTeacherDate } from "@quizstrike/shared";
import type { SpeakingReportSummary, SpeakingSetSummary } from "@quizstrike/shared";
import { ApiError, speakingApi } from "../../../api/client";
import { speakingModeLabel, speakingSupportSummary } from "../speakingCopy";
import "../speaking.css";
import "./speakingReports.css";

type Navigate = (nextPath: string) => void;

const messageFor = (error: unknown) => error instanceof ApiError ? error.message : "Speaking reports could not be loaded.";

export default function SpeakingReportsPanel({ navigate }: { navigate: Navigate }) {
  const { t } = useSiteTranslation();
  const [items, setItems] = useState<SpeakingReportSummary[]>([]);
  const [sets, setSets] = useState<SpeakingSetSummary[]>([]);
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const [reportPayload, setPayload] = await Promise.all([speakingApi.reports(), speakingApi.sets()]);
      setItems((reportPayload as { items: SpeakingReportSummary[] }).items);
      setSets([...new Map([...(reportPayload as { items: SpeakingReportSummary[] }).items.flatMap((item) => item.setMemberships), ...(setPayload as { items: SpeakingSetSummary[] }).items].map((set) => [set.id, set])).values()]);
      setError("");
    } catch (loadError) {
      setError(messageFor(loadError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const setText = item.setMemberships.map((set) => set.name).join(" ");
      return (!normalized || `${item.activity.title} ${item.activity.scenario} ${item.session.joinCode} ${setText}`.toLocaleLowerCase().includes(normalized)) && (setFilter === "all" || item.setMemberships.some((set) => set.id === setFilter));
    }).sort((left, right) => Date.parse(right.session.endedAt ?? right.session.createdAt) - Date.parse(left.session.endedAt ?? left.session.createdAt));
  }, [items, query, setFilter]);

  const download = async (item: SpeakingReportSummary) => {
    if (workingId) return;
    setWorkingId(item.session.id);
    try { const blob = await speakingApi.sessionCsv(item.session.id); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `speaking-${item.activity.title.toLocaleLowerCase().replace(/[^a-z0-9]+/giu, "-")}-${item.session.joinCode}.csv`; link.click(); URL.revokeObjectURL(url); }
    catch (downloadError) { setError(messageFor(downloadError)); }
    finally { setWorkingId(""); }
  };

  const deleteReport = async (item: SpeakingReportSummary) => {
    if (workingId || !window.confirm(`Delete the report for “${item.activity.title}” (${item.session.joinCode})?\n\nThis permanently removes this classroom Session and its results.`)) return;
    setWorkingId(item.session.id);
    try { await speakingApi.deleteSession(item.session.id); setItems((current) => current.filter((candidate) => candidate.session.id !== item.session.id)); }
    catch (deleteError) { setError(messageFor(deleteError)); }
    finally { setWorkingId(""); }
  };

  return <section className="speaking-reports-panel" aria-labelledby="speaking-reports-title"><header className="reports-page-heading speaking-reports-heading"><div><span className="eyebrow"><Mic size={15} aria-hidden="true" />{" "}{t("Speaking Tasks")}</span><h2 id="speaking-reports-title">{t("Speaking reports")}</h2><p>{t("Completed classroom sessions stay here for review, export, and follow-up.")}</p></div><span className="reports-count">{t(items.length === 1 ? "{value0} session" : "{value0} sessions", { value0: items.length })}</span></header>{error && <p className="speaking-error" role="alert">{t(error)}</p>}<div className="speaking-reports-toolbar"><label><span className="sr-only">{t("Search speaking reports")}</span><Search size={16} aria-hidden="true" /><input aria-label={t("Search speaking reports")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search Speaking Tasks, Sets or session codes")} /></label><select aria-label={t("Filter speaking reports by Set")} value={setFilter} onChange={(event) => setSetFilter(event.target.value)}><option value="all">{t("All Sets")}</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></div>{loading ? <div className="speaking-empty-card"><p>{t("Loading speaking reports…")}</p></div> : filtered.length ? <div className="speaking-report-list"><div className="speaking-report-list-header"><span>{t("Speaking Task")}</span><span>{t("Set")}</span><span>{t("Date")}</span><span>{t("Students")}</span><span>{t("Actions")}</span></div>{filtered.map((item) => <article className="speaking-report-row" key={item.session.id}><div><strong>{item.activity.title}</strong><small><span className={`speaking-mode-badge speaking-mode-badge-compact speaking-mode-${item.activity.mode}`}>{t(speakingModeLabel(item.activity.mode))}</span> · {t(speakingSupportSummary(item.activity, t))}</small><small>{item.session.joinCode} · {t(item.session.status)}</small></div><span>{item.setMemberships.length ? item.setMemberships.map((set) => set.name).join(", ") : "—"}</span><time dateTime={item.session.endedAt ?? item.session.createdAt}>{speakingTeacherDate(item.session.endedAt ?? item.session.createdAt)}</time><span><strong>{item.completedCount} / {item.participantCount}</strong>{" "}{t("completed")}{item.needsReviewCount ? <small>{item.needsReviewCount}{" "}{t("need review")}</small> : null}</span><div className="speaking-report-actions"><button type="button" className="speaking-outline-button" onClick={() => navigate(`/quiz-strike/teacher/speaking/activity/${item.activity.id}/results?sessionId=${encodeURIComponent(item.session.id)}`)}>{t("View results")}</button><button type="button" onClick={() => void download(item)} disabled={workingId === item.session.id} aria-label={t("Download CSV for {value0}", { value0: item.activity.title })}><Download size={16} aria-hidden="true" /></button><button type="button" onClick={() => void deleteReport(item)} disabled={Boolean(workingId)} aria-label={t("Delete report for {value0}", { value0: item.activity.title })}><Trash2 size={16} aria-hidden="true" /></button></div></article>)}</div> : <div className="speaking-empty-card"><img className="speaking-empty-art" src="/assets/speaking/empty-reports.webp" alt="" width={132} height={132} /><h3>{items.length ? t("No reports match") : t("No speaking reports yet")}</h3><p>{items.length ? t("Try a different search or Set filter.") : t("End a classroom session to see its results here.")}</p></div>}</section>;
}
