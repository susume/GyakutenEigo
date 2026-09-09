import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Download, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { SpeakingActivity, SpeakingSetDetail, SpeakingSetSummary } from "@quizstrike/shared";
import { ApiError, speakingApi } from "../../../api/client";
import { SPEAKING_LEVEL_LABELS, SPEAKING_DIFFICULTY_LABELS } from "@quizstrike/shared";
import { formatDuration } from "../speakingData";

type Navigate = (nextPath: string) => void;
type LibraryResponse = { items: Array<{ activity: SpeakingActivity }> };

const errorMessage = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;
const SET_PREVIEW_IMAGES = [
  "/assets/speaking/scenario-directions.webp",
  "/assets/speaking/scenario-shopping.webp",
  "/assets/speaking/scenario-restaurant.webp",
  "/assets/speaking/scenario-weekend.webp"
];

export function SpeakingSetsPage({ navigate }: { navigate: Navigate }) {
  const [sets, setSets] = useState<SpeakingSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await speakingApi.sets() as { items: SpeakingSetSummary[] };
      setSets(payload.items);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError, "Sets could not be loaded."));
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
      const payload = await speakingApi.createSet({ name: name.trim(), description: description.trim() }) as { set: SpeakingSetSummary };
      setSets((current) => [payload.set, ...current]);
      setName("");
      setDescription("");
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
        <button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher")}><ArrowLeft size={16} aria-hidden="true" />Performance Tests</button>
        <div className="speaking-teacher-heading">
          <div><span className="speaking-eyebrow">Speaking Practice · Organization</span><h1>Sets</h1><p>Group Performance Tests by grade, unit, term, or class.</p></div>
          <button type="button" className="speaking-primary-button" onClick={() => setShowCreate((open) => !open)}><Plus size={18} aria-hidden="true" />New Set</button>
        </div>
        {error && <p className="speaking-error" role="alert">{error}</p>}
        {showCreate && <form className="speaking-set-create-form" onSubmit={create}>
          <label>Set name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Grade 2 — Term 1" maxLength={120} /></label>
          <label>Description <span className="speaking-muted-copy">optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="The speaking assessments for this term." maxLength={500} rows={2} /></label>
          <div className="speaking-form-actions"><button type="button" className="speaking-outline-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="speaking-primary-button" disabled={!name.trim() || working}>{working ? "Creating…" : "Create Set"}</button></div>
        </form>}
        {loading ? <div className="speaking-empty-card"><p>Loading Sets…</p></div> : sets.length ? <div className="speaking-set-grid">
          {sets.map((set, index) => <button type="button" className="speaking-set-card" key={set.id} onClick={() => navigate(`/speak/teacher/set/${set.id}`)}>
            <img className="speaking-set-mosaic" src={SET_PREVIEW_IMAGES[index % SET_PREVIEW_IMAGES.length]} alt="" loading="lazy" />
            <span className="speaking-set-card-copy"><strong>{set.name}</strong><span>{set.activityCount} Performance Test{set.activityCount === 1 ? "" : "s"}</span><small>{set.lastUsedAt ? `Last used ${new Date(set.lastUsedAt).toLocaleDateString()}` : "Not used yet"}</small></span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>)}
        </div> : <div className="speaking-empty-card"><img className="speaking-empty-art" src="/assets/speaking/empty-sets.webp" alt="" width={132} height={132} /><h2>Make your first Set</h2><p>Sets help you keep a term or class together without changing the Performance Tests inside.</p><button type="button" className="speaking-primary-button" onClick={() => setShowCreate(true)}>Create a Set</button></div>}
      </section>
    </main>
  </div>;
}

export function SpeakingSetDetailPage({ navigate, setId }: { navigate: Navigate; setId: string }) {
  const [set, setSet] = useState<SpeakingSetDetail>();
  const [library, setLibrary] = useState<SpeakingActivity[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [setPayload, libraryPayload] = await Promise.all([speakingApi.set(setId), speakingApi.library()]);
      const nextSet = (setPayload as { set: SpeakingSetDetail }).set;
      setSet(nextSet);
      setName(nextSet.name);
      setDescription(nextSet.description);
      setLibrary((libraryPayload as LibraryResponse).items.map((item) => item.activity));
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError, "This Set could not be loaded."));
    }
  }, [setId]);
  useEffect(() => { void load(); }, [load]);

  const memberIds = useMemo(() => new Set(set?.activities.map((item) => item.activity.id)), [set]);
  const available = library.filter((activity) => !memberIds.has(activity.id) && `${activity.title} ${activity.scenario}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  const updateSet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || working) return;
    setWorking(true);
    try {
      const payload = await speakingApi.updateSet(setId, { name: name.trim(), description: description.trim() }) as { set: SpeakingSetSummary };
      setSet((current) => current ? { ...current, ...payload.set } : current);
      setEditing(false);
    } catch (updateError) {
      setError(errorMessage(updateError, "The Set could not be updated."));
    } finally {
      setWorking(false);
    }
  };

  const deleteSet = async () => {
    if (working || !set || !window.confirm(`Delete “${set.name}”?\n\nThe Set will be removed. Its ${set.activities.length} Performance Tests will remain in your library.`)) return;
    setWorking(true);
    try { await speakingApi.deleteSet(setId); navigate("/speak/teacher/sets"); }
    catch (deleteError) { setError(errorMessage(deleteError, "The Set could not be deleted.")); setWorking(false); }
  };

  const add = async (activityId: string) => {
    if (working) return;
    setWorking(true);
    try { const payload = await speakingApi.addToSet(setId, activityId) as { set: SpeakingSetDetail }; setSet(payload.set); }
    catch (addError) { setError(errorMessage(addError, "The Performance Test could not be added.")); }
    finally { setWorking(false); }
  };

  const remove = async (activityId: string) => {
    if (working) return;
    setWorking(true);
    try { const payload = await speakingApi.removeFromSet(setId, activityId) as { set: SpeakingSetDetail }; setSet(payload.set); }
    catch (removeError) { setError(errorMessage(removeError, "The Performance Test could not be removed.")); }
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
    try { const blob = await speakingApi.setCsv(setId); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `speaking-${set?.name.toLocaleLowerCase().replace(/[^a-z0-9]+/giu, "-") || "set"}.csv`; link.click(); URL.revokeObjectURL(url); }
    catch (downloadError) { setError(errorMessage(downloadError, "CSV export could not be started.")); }
    finally { setWorking(false); }
  };

  if (!set && !error) return <div className="speaking-empty-page"><p>Loading Set…</p></div>;
  if (!set) return <div className="speaking-empty-page"><h1>Set not found</h1><p>{error}</p><button type="button" className="speaking-primary-button" onClick={() => navigate("/speak/teacher/sets")}>Back to Sets</button></div>;
  return <div className="speaking-page-shell speaking-teacher-shell">
    <main className="speaking-teacher-layout">
      <section className="speaking-teacher-content speaking-set-detail-page">
        <button type="button" className="speaking-text-button" onClick={() => navigate("/speak/teacher/sets")}><ArrowLeft size={16} aria-hidden="true" />Sets</button>
        <div className="speaking-teacher-heading"><div><span className="speaking-eyebrow">Set · {set.activities.length} Performance Tests</span><h1>{set.name}</h1><p>{set.description || "Organize a sequence of classroom speaking assessments."}</p></div><div className="speaking-heading-actions"><button type="button" className="speaking-outline-button" onClick={() => setEditing((open) => !open)}><Pencil size={16} aria-hidden="true" />Edit Set</button><button type="button" className="speaking-outline-button" onClick={() => void download()}><Download size={16} aria-hidden="true" />Download CSV</button><details open={menuOpen} onToggle={(event) => setMenuOpen(event.currentTarget.open)}><summary aria-label="Set actions"><ChevronDown size={17} aria-hidden="true" /></summary><div className="speaking-overflow-menu"><button type="button" onClick={() => void deleteSet()}><Trash2 size={15} aria-hidden="true" />Delete Set</button></div></details></div></div>
        {error && <p className="speaking-error" role="alert">{error}</p>}
        {editing && <form className="speaking-set-edit-form" onSubmit={updateSet}><label>Set name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} /></label><div className="speaking-form-actions"><button type="button" className="speaking-outline-button" onClick={() => setEditing(false)}>Cancel</button><button type="submit" className="speaking-primary-button" disabled={!name.trim() || working}>Save changes</button></div></form>}
        <section className="speaking-set-section"><div className="speaking-section-title"><div><span className="speaking-card-kicker">In this Set</span><h2>Performance Tests</h2></div><span>{set.activities.length} total</span></div>{set.activities.length ? <div className="speaking-set-member-list">{set.activities.map((item, index) => <article className="speaking-set-member" key={item.activity.id}><GripVertical size={17} aria-hidden="true" /><span className="speaking-set-position">{index + 1}</span><img src={item.activity.scenarioResources?.imageSrc ?? "/assets/speaking/scenario-introduction.webp"} alt="" loading="lazy" /><div className="speaking-set-member-copy"><strong>{item.activity.title}</strong><span>{SPEAKING_LEVEL_LABELS[item.activity.level]} · {SPEAKING_DIFFICULTY_LABELS[item.activity.difficulty]} · {formatDuration(item.activity.durationSeconds)}</span><small>{item.sessionCount} session{item.sessionCount === 1 ? "" : "s"}{item.lastSessionAt ? ` · Last used ${new Date(item.lastSessionAt).toLocaleDateString()}` : ""}</small></div><div className="speaking-set-member-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0 || working} aria-label={`Move ${item.activity.title} up`}>↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === set.activities.length - 1 || working} aria-label={`Move ${item.activity.title} down`}>↓</button><button type="button" onClick={() => navigate(`/speak/teacher/activity/${item.activity.id}`)} aria-label={`Open ${item.activity.title}`}><ChevronRight size={17} aria-hidden="true" /></button><button type="button" onClick={() => void remove(item.activity.id)} disabled={working} aria-label={`Remove ${item.activity.title} from Set`}><Trash2 size={16} aria-hidden="true" /></button></div></article>)}</div> : <div className="speaking-empty-card"><h3>This Set is empty</h3><p>Add a Performance Test below to start organizing the class.</p></div>}</section>
        <section className="speaking-set-section"><div className="speaking-section-title"><div><span className="speaking-card-kicker">Add from your library</span><h2>More Performance Tests</h2></div><label className="speaking-inline-search"><span className="sr-only">Search Performance Tests</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tests" /></label></div>{available.length ? <div className="speaking-set-add-list">{available.map((activity) => <article key={activity.id}><img src={activity.scenarioResources?.imageSrc ?? "/assets/speaking/scenario-introduction.webp"} alt="" loading="lazy" /><div><strong>{activity.title}</strong><span>{activity.scenario}</span></div><button type="button" className="speaking-outline-button" onClick={() => void add(activity.id)} disabled={working}><Plus size={15} aria-hidden="true" />Add</button></article>)}</div> : <p className="speaking-muted-copy">Everything in your library is already in this Set, or nothing matches the search.</p>}</section>
      </section>
    </main>
  </div>;
}
