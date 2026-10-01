import { useSiteTranslation } from "../../../ui/siteTranslation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardCheck, Download, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { SpeakingSession, SpeakingActivity, SpeakingSetDetail, SpeakingSetSummary } from "@quizstrike/shared";
import { ApiError, speakingApi } from "../../../api/client";
import { speakingTeacherDate, speakingScenarioResources } from "@quizstrike/shared";
import { formatDuration } from "../speakingData";
import { speakingModeLabel } from "../speakingCopy";

type Navigate = (nextPath: string) => void;
type LibraryResponse = { items: Array<{ activity: SpeakingActivity }> };

const errorMessage = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;
const SET_PREVIEW_IMAGES = [
  "/assets/speaking/scenario-directions.webp",
  "/assets/speaking/scenario-shopping.webp",
  "/assets/speaking/scenario-restaurant.webp",
  "/assets/speaking/scenario-weekend.webp"
];

function SpeakingSetThumbnail({ activity }: { activity: SpeakingActivity }) {
  const imageSrc = speakingScenarioResources(activity.scenarioResources).imageSrc;
  return imageSrc
    ? <img className="speaking-set-thumbnail" src={imageSrc} alt="" loading="lazy" />
    : <span className="speaking-set-thumbnail speaking-set-thumbnail-placeholder" aria-hidden="true"><ClipboardCheck size={20} /></span>;
}

export function SpeakingSetsPage({ navigate }: { navigate: Navigate }) {
  const { t } = useSiteTranslation();
  const [sets, setSets] = useState<SpeakingSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [focus, setFocus] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const payload = await speakingApi.sets() as { items: SpeakingSetSummary[] };
      setSets(payload.items);
      setError("");
    } catch (loadError) {
      setLoadFailed(true);
      setError(errorMessage(loadError, "My Sets could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || working) return;
    setWorking(true);
    try {
      const payload = await speakingApi.createSet({ name: name.trim(), description: description.trim(), focus: focus.trim() }) as { set: SpeakingSetSummary };
      setSets((current) => [payload.set, ...current]);
      setName("");
      setDescription("");
      setFocus("");
      setShowCreate(false);
      navigate(`/speak/teacher/set/${payload.set.id}`);
    } catch (createError) {
      setError(errorMessage(createError, "The Set could not be created."));
    } finally {
      setWorking(false);
    }
  };

  return <div className="speaking-page-shell speaking-teacher-shell">
    <main className="speaking-teacher-layout">
      <section className="speaking-teacher-content speaking-sets-page">
        <button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher")}><ArrowLeft size={16} aria-hidden="true" />{t("Speaking Tasks")}</button>
        <div className="speaking-teacher-heading">
          <div><span className="speaking-eyebrow">{t("Speaking Tasks · Organization")}</span><h1>{t("My Sets")}</h1><p>{t("Group your speaking tasks by grade, unit, term, or class.")}</p></div>
          <button type="button" className="speaking-primary-button" onClick={() => setShowCreate((open) => !open)}><Plus size={18} aria-hidden="true" />{t("New Set")}</button>
        </div>
        {error && <p className="speaking-error" role="alert">{t(error)}</p>}
        {showCreate && <form className="speaking-set-create-form" onSubmit={create}>
          <label>{t("Set name")}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Grade 2 — Term 1")} maxLength={120} /></label>
          <label>{t("Description")}{" "}<span className="speaking-muted-copy">{t("optional")}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("The speaking tasks for this term.")} maxLength={500} rows={2} /></label>
          <label>{t("Shared focus")}{" "}<span className="speaking-muted-copy">{t("optional")}</span><textarea value={focus} onChange={(event) => setFocus(event.target.value)} placeholder={t("Pay particular attention to follow-up questions and clarification.")} maxLength={500} rows={2} /><small className="speaking-form-help">{t("Optional focus for feedback and review across tasks in this Set.")}</small></label>
          <div className="speaking-form-actions"><button type="button" className="speaking-outline-button" onClick={() => setShowCreate(false)}>{t("Cancel")}</button><button type="submit" className="speaking-primary-button" disabled={!name.trim() || working}>{working ? t("Creating…") : t("Create Set")}</button></div>
        </form>}
        {loading ? <div className="speaking-empty-card" role="status"><p>{t("Loading My Sets…")}</p></div> : loadFailed ? <div className="speaking-empty-card"><h2>{t("Your Sets couldn’t load")}</h2><p>{t("Check your connection, then try again.")}</p><button type="button" className="speaking-outline-button" onClick={() => void load()}>{t("Try again")}</button></div> : sets.length ? <div className="speaking-set-grid">
          {sets.map((set, index) => <button type="button" className="speaking-set-card" key={set.id} onClick={() => navigate(`/speak/teacher/set/${set.id}`)}>
            <img className="speaking-set-mosaic" src={SET_PREVIEW_IMAGES[index % SET_PREVIEW_IMAGES.length]} alt="" loading="lazy" />
            <span className="speaking-set-card-copy"><strong>{set.name}</strong><span>{t(set.activityCount === 1 ? "{value0} task" : "{value0} tasks", { value0: set.activityCount })}</span><small>{set.lastUsedAt ? t("Last used {value0}", { value0: speakingTeacherDate(set.lastUsedAt) }) : t("Not used yet")}</small></span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>)}
        </div> : <div className="speaking-empty-card"><img className="speaking-empty-art" src="/assets/speaking/empty-sets.webp" alt="" width={132} height={132} /><h2>{t("Make your first Set")}</h2><p>{t("My Sets help you keep a term or class together without changing your tasks.")}</p><button type="button" className="speaking-primary-button" onClick={() => setShowCreate(true)}>{t("Create a Set")}</button></div>}
      </section>
    </main>
  </div>;
}

export function SpeakingSetDetailPage({ navigate, setId }: { navigate: Navigate; setId: string }) {
  const { t } = useSiteTranslation();
  const [set, setSet] = useState<SpeakingSetDetail>();
  const [library, setLibrary] = useState<SpeakingActivity[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [focus, setFocus] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [setPayload, libraryPayload] = await Promise.all([speakingApi.set(setId), speakingApi.library()]);
      const nextSet = (setPayload as { set: SpeakingSetDetail }).set;
      setSet(nextSet);
      setName(nextSet.name);
      setDescription(nextSet.description);
      setFocus(nextSet.focus ?? "");
      setLibrary((libraryPayload as LibraryResponse).items.map((item) => item.activity));
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError, "This Set could not be loaded."));
    }
  }, [setId]);
  useEffect(() => { void load(); }, [load]);

  const launch = async (activityId: string) => {
    if (working) return;
    setWorking(true);
    try {
      const payload = await speakingApi.launchSession(activityId, setId) as { session: SpeakingSession };
      navigate(`/speak/teacher/activity/${activityId}?sessionId=${payload.session.id}`);
    } catch (launchError) { setError(errorMessage(launchError, "The session could not be launched.")); }
    finally { setWorking(false); }
  };

  useEffect(() => {
    if (!editing && set) {
      setName(set.name);
      setDescription(set.description);
      setFocus(set.focus ?? "");
    }
  }, [editing, set]);

  const memberIds = useMemo(() => new Set(set?.activities.map((item) => item.activity.id)), [set]);
  const available = library.filter((activity) => !memberIds.has(activity.id) && `${activity.title} ${activity.scenario}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  const updateSet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || working) return;
    setWorking(true);
    try {
      const payload = await speakingApi.updateSet(setId, { name: name.trim(), description: description.trim(), focus: focus.trim() }) as { set: SpeakingSetSummary };
      setSet((current) => current ? { ...current, ...payload.set } : current);
      setEditing(false);
    } catch (updateError) {
      setError(errorMessage(updateError, "The Set could not be updated."));
    } finally {
      setWorking(false);
    }
  };

  const deleteSet = async () => {
    if (working || !set || !window.confirm(`Delete “${set.name}”?\n\nThe Set will be removed. Its ${set.activities.length} tasks will remain in your library.`)) return;
    setWorking(true);
    try { await speakingApi.deleteSet(setId); navigate("/speak/teacher/sets"); }
    catch (deleteError) { setError(errorMessage(deleteError, "The Set could not be deleted.")); setWorking(false); }
  };

  const add = async (activityId: string) => {
    if (working) return;
    setWorking(true);
    try { const payload = await speakingApi.addToSet(setId, activityId) as { set: SpeakingSetDetail }; setSet(payload.set); }
    catch (addError) { setError(errorMessage(addError, "The Speaking Task could not be added.")); }
    finally { setWorking(false); }
  };

  const remove = async (activityId: string) => {
    if (working) return;
    setWorking(true);
    try { const payload = await speakingApi.removeFromSet(setId, activityId) as { set: SpeakingSetDetail }; setSet(payload.set); }
    catch (removeError) { setError(errorMessage(removeError, "The Speaking Task could not be removed.")); }
    finally { setWorking(false); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    if (!set || working) return;
    const next = [...set.activities];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSet({ ...set, activities: next.map((item, position) => ({ ...item, position })) });
    setWorking(true);
    try { const payload = await speakingApi.reorderSet(setId, next.map((item) => item.activity.id)) as { set: SpeakingSetDetail }; setSet(payload.set); }
    catch (reorderError) { setError(errorMessage(reorderError, "The Set order could not be saved.")); await load(); }
    finally { setWorking(false); }
  };

  const download = async () => {
    if (working) return;
    setWorking(true);
    try { const blob = await speakingApi.setCsv(setId); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `speaking-${set?.name.toLocaleLowerCase().replace(/[^a-z0-9]+/giu, "-") || "set"}-${speakingTeacherDate(new Date())}.csv`; link.click(); URL.revokeObjectURL(url); }
    catch (downloadError) { setError(errorMessage(downloadError, "CSV export could not be started.")); }
    finally { setWorking(false); }
  };

  if (!set && !error) return <div className="speaking-empty-page"><p>{t("Loading Set…")}</p></div>;
  if (!set) return <div className="speaking-empty-page"><h1>{t("Set not found")}</h1><p>{t(error)}</p><button type="button" className="speaking-primary-button" onClick={() => navigate("/speak/teacher/sets")}>{t("Back to My Sets")}</button></div>;
  return <div className="speaking-page-shell speaking-teacher-shell">
    <main className="speaking-teacher-layout">
      <section className="speaking-teacher-content speaking-set-detail-page">
        <button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher/sets")}><ArrowLeft size={16} aria-hidden="true" />{t("My Sets")}</button>
        <div className="speaking-teacher-heading"><div><span className="speaking-eyebrow">{t("My Set ·")}{" "}{t(set.activities.length === 1 ? "{value0} task" : "{value0} tasks", { value0: set.activities.length })}</span><h1>{set.name}</h1><p>{set.description || t("Organize a sequence of classroom speaking tasks.")}</p></div><div className="speaking-heading-actions"><button type="button" className="speaking-outline-button" onClick={() => setEditing((open) => !open)}><Pencil size={16} aria-hidden="true" />{t("Edit Set")}</button><button type="button" className="speaking-outline-button" onClick={() => void download()}><Download size={16} aria-hidden="true" />{t("Download CSV")}</button><details open={menuOpen} onToggle={(event) => setMenuOpen(event.currentTarget.open)}><summary aria-label={t("Set actions")}><ChevronDown size={17} aria-hidden="true" /></summary><div className="speaking-overflow-menu"><button type="button" onClick={() => void deleteSet()}><Trash2 size={15} aria-hidden="true" />{t("Delete Set")}</button></div></details></div></div>
        {error && <p className="speaking-error" role="alert">{t(error)}</p>}
        {set.focus && <aside className="speaking-set-focus-card"><span className="speaking-card-kicker">{t("Shared focus")}</span><p>{set.focus}</p><small>{t("Optional focus for feedback and review across tasks in this Set.")}</small></aside>}
        {editing && <form className="speaking-set-edit-form" onSubmit={updateSet}><label>{t("Set name")}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label><label>{t("Description")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} /></label><label>{t("Shared focus")}{" "}<span className="speaking-muted-copy">{t("optional")}</span><textarea value={focus} onChange={(event) => setFocus(event.target.value)} placeholder={t("Pay particular attention to follow-up questions and clarification.")} maxLength={500} rows={2} /><small className="speaking-form-help">{t("Optional focus for feedback and review across tasks in this Set.")}</small></label><div className="speaking-form-actions"><button type="button" className="speaking-outline-button" onClick={() => setEditing(false)}>{t("Cancel")}</button><button type="submit" className="speaking-primary-button" disabled={!name.trim() || working}>{t("Save changes")}</button></div></form>}
        <section className="speaking-set-section"><div className="speaking-section-title"><div><span className="speaking-card-kicker">{t("In this Set")}</span><h2>{t("Speaking Tasks")}</h2></div><span>{set.activities.length}{" "}{t("total")}</span></div>{set.activities.length ? <div className="speaking-set-member-list">{set.activities.map((item, index) => <article className="speaking-set-member" key={item.activity.id}><GripVertical size={17} aria-hidden="true" /><span className="speaking-set-position">{index + 1}</span><SpeakingSetThumbnail activity={item.activity} /><div className="speaking-set-member-copy"><strong>{item.activity.title}</strong><span><span className={`speaking-mode-badge speaking-mode-badge-compact speaking-mode-${item.activity.mode}`}>{t(speakingModeLabel(item.activity.mode))}</span> · {speakingScenarioResources(item.activity.scenarioResources).category ?? t("Everyday Communication")} · {formatDuration(item.activity.durationSeconds)}</span><small>{t(item.sessionCount === 1 ? "{value0} session" : "{value0} sessions", { value0: item.sessionCount })}{item.lastSessionAt ? t(" · Last used {value0}", { value0: speakingTeacherDate(item.lastSessionAt) }) : ""}</small></div><div className="speaking-set-member-actions"><button type="button" disabled={working} onClick={() => void launch(item.activity.id)} aria-label={t("Launch {value0} from Set", { value0: item.activity.title })}>{t("Launch")}</button><button type="button" onClick={() => move(index, -1)} disabled={index === 0 || working} aria-label={t("Move {value0} up", { value0: item.activity.title })}>↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === set.activities.length - 1 || working} aria-label={t("Move {value0} down", { value0: item.activity.title })}>↓</button><button type="button" onClick={() => navigate(`/speak/teacher/activity/${item.activity.id}`)} aria-label={t("Open {value0}", { value0: item.activity.title })}><ChevronRight size={17} aria-hidden="true" /></button><button type="button" onClick={() => void remove(item.activity.id)} disabled={working} aria-label={t("Remove {value0} from Set", { value0: item.activity.title })}><Trash2 size={16} aria-hidden="true" /></button></div></article>)}</div> : <div className="speaking-empty-card"><h3>{t("This Set is empty")}</h3><p>{t("Add a speaking task below to start organizing the class.")}</p></div>}</section>
        <section className="speaking-set-section"><div className="speaking-section-title"><div><span className="speaking-card-kicker">{t("Add from your library")}</span><h2>{t("More Speaking Tasks")}</h2></div><label className="speaking-inline-search"><span className="sr-only">{t("Search Speaking Tasks")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search tasks")} /></label></div>{available.length ? <div className="speaking-set-add-list">{available.map((activity) => <article key={activity.id}><SpeakingSetThumbnail activity={activity} /><div><strong>{activity.title}</strong><span>{activity.scenario}</span></div><button type="button" className="speaking-outline-button" onClick={() => void add(activity.id)} disabled={working}><Plus size={15} aria-hidden="true" />{t("Add")}</button></article>)}</div> : <p className="speaking-muted-copy">{t("Everything in your Set is already in Speaking Tasks, or nothing matches the search.")}</p>}</section>
      </section>
    </main>
  </div>;
}
