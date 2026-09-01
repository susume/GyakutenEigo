import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  Edit3,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  ShoppingBag,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  SPEAKING_DIFFICULTIES,
  SPEAKING_DIFFICULTY_LABELS,
  SPEAKING_IDENTIFIER_MODE_LABELS,
  SPEAKING_IDENTIFIER_MODES,
  SPEAKING_NATIVE_LANGUAGE_LABELS,
  SPEAKING_NATIVE_LANGUAGES,
  SPEAKING_LEVEL_LABELS,
  SPEAKING_LEVELS,
  speakingFeedbackCopy,
  type SpeakingActivity,
  type SpeakingCreateActivityInput,
  type SpeakingDifficulty,
  type SpeakingEvaluation,
  type SpeakingIdentifierMode,
  type SpeakingLevel,
  type SpeakingNativeLanguage,
  type SpeakingParticipant,
  type SpeakingRubricCriterion,
  type SpeakingSession,
  type SpeakingTurn,
} from "@quizstrike/shared";
import { ApiError, speakingApi } from "../../../api/client";
import { buildTeacherSpeakingPath } from "../../../navigation";
import { SPEAKING_TEMPLATES, formatDuration } from "../speakingData";
import { ResultPanel, scoreFor } from "../SpeakingResultPanel";
import "../speaking.css";

type Navigate = (nextPath: string) => void;
type ResultResponse = {
  result: {
    activity: Pick<
      SpeakingActivity,
      | "id"
      | "title"
      | "scenario"
      | "targetExpressions"
      | "nativeLanguage"
      | "rubric"
    >;
    session: SpeakingSession;
    participant: SpeakingParticipant;
    turns: SpeakingTurn[];
    evaluation?: SpeakingEvaluation;
  };
};
type SessionResultsResponse = {
  activity: SpeakingActivity;
  session: SpeakingSession;
  items: Array<{
    participant: SpeakingParticipant;
    status: SpeakingParticipant["status"];
    durationSeconds: number;
    overallScore?: number;
    helpCount: number;
    evaluation?: SpeakingEvaluation;
  }>;
};

const normalizePath = (path: string) =>
  path === "/" ? path : path.replace(/\/+$/u, "");
const decodeRouteSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
const parseTeacherRoute = (path: string) => {
  const segments = normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map(decodeRouteSegment);
  if (segments[1] === "teacher" && segments[2] === "create")
    return { kind: "create" as const };
  if (segments[1] === "teacher" && segments[2] === "activity" && segments[3])
    return {
      kind: "activity" as const,
      id: segments[3],
      results: segments[4] === "results",
      edit: segments[4] === "edit",
    };
  if (segments[1] === "teacher" && segments[2] === "result" && segments[3])
    return { kind: "teacher-result" as const, id: segments[3] };
  return { kind: "teacher" as const };
};

const toSpeakingTeacherPath = (path: string) => {
  const normalized = normalizePath(path);
  const canonicalPrefix = "/quiz-strike/teacher/speaking";
  if (
    normalized === canonicalPrefix ||
    normalized.startsWith(`${canonicalPrefix}/`)
  ) {
    return `/speak/teacher${normalized.slice(canonicalPrefix.length)}`;
  }
  return normalized.startsWith("/speak/teacher")
    ? normalized
    : "/speak/teacher";
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

function MissingSpeakingSession({
  navigate,
  message = "This teacher activity may have ended or no longer exists.",
}: {
  navigate: Navigate;
  message?: string;
}) {
  return (
    <div className="speaking-empty-page">
      <CircleCheck size={38} aria-hidden="true" />
      <h1>Activity not found</h1>
      <p>{message}</p>
      <button
        className="speaking-primary-button"
        type="button"
        onClick={() => navigate("/speak/teacher")}
      >
        Back to Speaking Practice
      </button>
    </div>
  );
}

function ShieldIcon() {
  return (
    <span className="speaking-privacy-dot" aria-hidden="true">
      <CircleCheck size={14} />
    </span>
  );
}

/**
 * Teacher-only Speaking Practice surface embedded in the unified QuizStrike
 * workspace. Student routes continue to use SpeakingPracticeApp directly.
 */
export function SpeakingTeacherWorkspace({
  initialPath,
  onNavigate,
}: {
  initialPath: string;
  onNavigate: Navigate;
}) {
  const [path, setPath] = useState(() => toSpeakingTeacherPath(initialPath));

  useEffect(() => {
    setPath(toSpeakingTeacherPath(initialPath));
  }, [initialPath]);

  const navigate = useCallback<Navigate>(
    (nextPath) => {
      const target = new URL(nextPath, window.location.origin);
      const nextPathname = normalizePath(target.pathname);
      setPath(nextPathname);
      const canonicalPath = buildTeacherSpeakingPath(nextPathname);
      onNavigate(`${canonicalPath}${target.search}${target.hash}`);
    },
    [onNavigate],
  );

  const route = parseTeacherRoute(path);
  return (
    <div
      className="speaking-app speaking-embedded-teacher"
      aria-label="Speaking Practice teacher tools"
    >
      {route.kind === "teacher" && (
        <SpeakingTeacherDashboard navigate={navigate} />
      )}
      {route.kind === "create" && <SpeakingCreatePage navigate={navigate} />}
      {route.kind === "activity" && (
        <SpeakingActivityPage
          navigate={navigate}
          activityId={route.id}
          results={route.results === true}
          edit={route.edit === true}
        />
      )}
      {route.kind === "teacher-result" && (
        <SpeakingTeacherResultPage
          navigate={navigate}
          participantId={route.id}
        />
      )}
    </div>
  );
}

function SpeakingTeacherDashboard({ navigate }: { navigate: Navigate }) {
  const [activities, setActivities] = useState<SpeakingActivity[]>([]);
  const [sessions, setSessions] = useState<Record<string, SpeakingSession[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const payload = (await speakingApi.activities()) as {
        items: SpeakingActivity[];
      };
      setActivities(payload.items);
      const pairs = await Promise.all(
        payload.items.map(
          async (activity) =>
            [
              activity.id,
              (
                (await speakingApi.sessions(activity.id)) as {
                  sessions: SpeakingSession[];
                }
              ).sessions,
            ] as const,
        ),
      );
      setSessions(Object.fromEntries(pairs));
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, "Teacher activities could not be loaded."),
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const sessionCount = Object.values(sessions).reduce(
    (sum, items) => sum + items.length,
    0,
  );
  if (loading) return <TeacherLoading />;
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <section className="speaking-teacher-content">
          <div className="speaking-teacher-heading">
            <div>
              <span className="speaking-eyebrow">
                <UserRound size={15} aria-hidden="true" /> Teacher workspace
              </span>
              <h1>Speaking Practice</h1>
              <p>
                Create a focused activity, launch one classroom session, and see
                how your students communicated.
              </p>
            </div>
            <button
              className="speaking-primary-button"
              type="button"
              onClick={() => navigate("/speak/teacher/create")}
            >
              <Plus size={18} aria-hidden="true" />
              Create Activity
            </button>
          </div>
          {error && (
            <p className="speaking-error" role="alert">
              {error}
            </p>
          )}
          <section className="speaking-teacher-stats">
            <div>
              <span>Activities</span>
              <strong>{activities.length}</strong>
              <small>reusable lessons</small>
            </div>
            <div>
              <span>Sessions launched</span>
              <strong>{sessionCount}</strong>
              <small>classroom runs</small>
            </div>
            <div>
              <span>Active now</span>
              <strong>
                {
                  Object.values(sessions)
                    .flat()
                    .filter((session) => session.status === "active").length
                }
              </strong>
              <small>live classrooms</small>
            </div>
          </section>
          <div className="speaking-section-title">
            <div>
              <span className="speaking-card-kicker">Your activities</span>
              <h2>Keep practice moving</h2>
            </div>
            <button
              className="speaking-text-button"
              type="button"
              onClick={() => navigate("/speak/teacher/create")}
            >
              New activity <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          {activities.length ? (
            <div className="speaking-activity-list">
              {activities.map((activity) => (
                <TeacherActivityRow
                  key={activity.id}
                  activity={activity}
                  sessions={sessions[activity.id] ?? []}
                  navigate={navigate}
                />
              ))}
            </div>
          ) : (
            <div className="speaking-empty-card">
              <Edit3 size={30} aria-hidden="true" />
              <h2>Create your first activity</h2>
              <p>
                Save a reusable conversation, then launch it for a classroom.
              </p>
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() => navigate("/speak/teacher/create")}
              >
                Create activity
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TeacherLoading() {
  return (
    <div className="speaking-empty-page">
      <LoaderCircle size={34} className="speaking-spin" aria-hidden="true" />
      <h1>Loading teacher workspace</h1>
      <p>Getting your real Speaking Practice activities…</p>
    </div>
  );
}

function TeacherActivityRow({
  activity,
  sessions,
  navigate,
}: {
  activity: SpeakingActivity;
  sessions: SpeakingSession[];
  navigate: Navigate;
}) {
  const latest = sessions[0];
  return (
    <article className="speaking-activity-row">
      <div className="speaking-activity-row-icon">
        <ShoppingBag size={21} aria-hidden="true" />
      </div>
      <div className="speaking-activity-row-main">
        <div>
          <strong>{activity.title}</strong>
          <span>
            {activity.aiRole} · {SPEAKING_LEVEL_LABELS[activity.level]}
          </span>
        </div>
        <p>{activity.scenario}</p>
      </div>
      <div className="speaking-activity-row-meta">
        <span
          className={`speaking-status-pill speaking-status-${latest?.status ?? "ready"}`}
        >
          {latest
            ? latest.status === "active"
              ? "Active"
              : latest.status === "paused"
                ? "Paused"
                : latest.status === "ended"
                  ? "Ended"
                  : "Ready"
            : "Not launched"}
        </span>
        <span>
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </span>
        {latest && <code>{latest.joinCode}</code>}
      </div>
      <div className="speaking-activity-row-actions">
        <button
          type="button"
          onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}
          aria-label={`Open ${activity.title}`}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

const draftFromTemplate = (
  template: SpeakingActivity,
): SpeakingCreateActivityInput => ({
  title: template.title,
  scenario: template.scenario,
  aiRole: template.aiRole,
  studentRole: template.studentRole,
  level: template.level,
  difficulty: template.difficulty,
  nativeLanguage: template.nativeLanguage,
  durationSeconds: template.durationSeconds,
  identifierMode: template.identifierMode,
  targetExpressions: [...template.targetExpressions],
  rubric: template.rubric.map((criterion) => ({ ...criterion })),
});
const SPEAKING_DURATION_PRESETS = [120, 180, 300, 420] as const;

function SpeakingDurationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const isCustom = !SPEAKING_DURATION_PRESETS.includes(
    value as (typeof SPEAKING_DURATION_PRESETS)[number],
  );
  return (
    <label>
      Speaking time
      <select
        value={isCustom ? "custom" : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === "custom"
              ? isCustom
                ? value
                : 240
              : Number(event.target.value),
          )
        }
      >
        <option value={120}>2 minutes</option>
        <option value={180}>3 minutes</option>
        <option value={300}>5 minutes</option>
        <option value={420}>7 minutes</option>
        <option value="custom">Custom</option>
      </select>
      {isCustom && (
        <div className="speaking-custom-duration">
          <input
            type="number"
            min={2}
            max={7}
            step={1}
            value={Math.round(value / 60)}
            onChange={(event) => {
              const minutes = Number(event.target.value);
              onChange(
                (Number.isFinite(minutes)
                  ? Math.min(7, Math.max(2, Math.round(minutes)))
                  : 2) * 60,
              );
            }}
            aria-label="Custom speaking time in minutes"
          />
          <span>minutes</span>
        </div>
      )}
    </label>
  );
}

function SpeakingCreatePage({
  navigate,
  activityId,
}: {
  navigate: Navigate;
  activityId?: string;
}) {
  const editing = Boolean(activityId);
  const [draft, setDraft] = useState<SpeakingCreateActivityInput>(() =>
    draftFromTemplate(SPEAKING_TEMPLATES[1]!),
  );
  const [newExpression, setNewExpression] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(editing);
  const update = <K extends keyof SpeakingCreateActivityInput>(
    key: K,
    value: SpeakingCreateActivityInput[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const updateCriterion = (
    index: number,
    patch: Partial<SpeakingRubricCriterion>,
  ) =>
    update(
      "rubric",
      draft.rubric.map((criterion, candidateIndex) =>
        candidateIndex === index ? { ...criterion, ...patch } : criterion,
      ),
    );
  const addExpression = () => {
    if (!newExpression.trim() || draft.targetExpressions.length >= 12) return;
    update("targetExpressions", [
      ...draft.targetExpressions,
      newExpression.trim(),
    ]);
    setNewExpression("");
  };
  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    void speakingApi
      .activity(activityId)
      .then((payload) => {
        if (cancelled) return;
        const activity = (payload as { activity: SpeakingActivity }).activity;
        setDraft(draftFromTemplate(activity));
        setLoadingActivity(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setFormError(
          getErrorMessage(loadError, "This activity could not be loaded."),
        );
        setLoadingActivity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);
  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.scenario.trim()) {
      setFormError("Activity name and speaking situation are required.");
      return;
    }
    if (!draft.rubric.some((criterion) => criterion.enabled)) {
      setFormError("Choose at least one rubric skill.");
      return;
    }
    setSaving(true);
    try {
      const payload = (
        editing && activityId
          ? await speakingApi.updateActivity(activityId, draft)
          : await speakingApi.createActivity(draft)
      ) as { activity: SpeakingActivity };
      navigate(`/speak/teacher/activity/${payload.activity.id}`);
    } catch (createError) {
      setFormError(
        getErrorMessage(
          createError,
          editing
            ? "The activity could not be updated. Please try again."
            : "The activity could not be saved. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  if (loadingActivity) return <TeacherLoading />;
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <form className="speaking-builder" onSubmit={handleCreate}>
          <div className="speaking-builder-header">
            <div>
              <span className="speaking-eyebrow">
                <Edit3 size={15} aria-hidden="true" /> Activity builder
              </span>
              <h1>{editing ? "Edit activity" : "Create an activity"}</h1>
              <p>
                {editing
                  ? "Update the reusable activity. Existing classroom sessions keep their original setup."
                  : "Set the situation first. The AI will stay in character while students practice."}
              </p>
            </div>
            <div className="speaking-builder-header-actions">
              <button
                type="button"
                className="speaking-text-button"
                onClick={() =>
                  navigate(
                    editing && activityId
                      ? `/speak/teacher/activity/${activityId}`
                      : "/speak/teacher",
                  )
                }
              >
                <ArrowLeft size={15} aria-hidden="true" />
                Back
              </button>
              <button
                type="submit"
                className="speaking-primary-button"
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="speaking-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Check size={17} aria-hidden="true" />
                )}
                {editing ? "Save changes" : "Create activity"}
              </button>
            </div>
          </div>
          <section className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">
                  Start with a template
                </span>
                <h2>Pick a familiar conversation</h2>
              </div>
              <span className="speaking-builder-step">01 / 04</span>
            </div>
            <div className="speaking-template-grid">
              {SPEAKING_TEMPLATES.map((template) => (
                <button
                  type="button"
                  className={`speaking-template-card${draft.title === template.title ? " is-selected" : ""}`}
                  key={template.id}
                  onClick={() => setDraft(draftFromTemplate(template))}
                >
                  <span className="speaking-template-icon">
                    <ShoppingBag size={19} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{template.title}</strong>
                    <small>
                      {SPEAKING_LEVEL_LABELS[template.level]} ·{" "}
                      {SPEAKING_DIFFICULTY_LABELS[template.difficulty]}
                    </small>
                  </span>
                  {draft.title === template.title && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </section>
          <section className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">The conversation</span>
                <h2>Give students a clear situation</h2>
              </div>
              <span className="speaking-builder-step">02 / 04</span>
            </div>
            <div className="speaking-builder-form-grid">
              <label>
                Activity name
                <input
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </label>
              <label>
                AI role
                <input
                  value={draft.aiRole}
                  onChange={(event) => update("aiRole", event.target.value)}
                />
              </label>
              <label>
                Student role
                <input
                  value={draft.studentRole}
                  onChange={(event) =>
                    update("studentRole", event.target.value)
                  }
                />
              </label>
              <label className="speaking-span-2">
                Speaking situation
                <textarea
                  value={draft.scenario}
                  onChange={(event) => update("scenario", event.target.value)}
                  rows={3}
                />
              </label>
            </div>
          </section>
          <section className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">Target English</span>
                <h2>Phrases the AI can bring into the conversation</h2>
              </div>
              <span className="speaking-builder-step">03 / 04</span>
            </div>
            <div className="speaking-expression-editor">
              {draft.targetExpressions.map((expression, index) => (
                <div
                  className="speaking-expression-chip"
                  key={`${expression}-${index}`}
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  <input
                    value={expression}
                    onChange={(event) =>
                      update(
                        "targetExpressions",
                        draft.targetExpressions.map((item, candidateIndex) =>
                          candidateIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "targetExpressions",
                        draft.targetExpressions.filter(
                          (_, candidateIndex) => candidateIndex !== index,
                        ),
                      )
                    }
                    aria-label={`Remove ${expression}`}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <div className="speaking-add-expression">
                <input
                  value={newExpression}
                  onChange={(event) => setNewExpression(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addExpression();
                    }
                  }}
                  placeholder="Add an expression"
                />
                <button
                  type="button"
                  className="speaking-outline-button"
                  onClick={addExpression}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add
                </button>
              </div>
            </div>
          </section>
          <section className="speaking-builder-card">
            <div className="speaking-builder-card-heading">
              <div>
                <span className="speaking-card-kicker">Activity settings</span>
                <h2>Set the right amount of support</h2>
              </div>
              <span className="speaking-builder-step">04 / 04</span>
            </div>
            <div className="speaking-settings-grid">
              <label>
                Student level
                <select
                  value={draft.level}
                  onChange={(event) =>
                    update("level", event.target.value as SpeakingLevel)
                  }
                >
                  {SPEAKING_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {SPEAKING_LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                AI difficulty
                <select
                  value={draft.difficulty}
                  onChange={(event) =>
                    update(
                      "difficulty",
                      event.target.value as SpeakingDifficulty,
                    )
                  }
                >
                  {SPEAKING_DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {SPEAKING_DIFFICULTY_LABELS[difficulty]}
                    </option>
                  ))}
                </select>
              </label>
              <SpeakingDurationField
                value={draft.durationSeconds}
                onChange={(value) => update("durationSeconds", value)}
              />
              <label>
                Feedback language
                <select
                  value={draft.nativeLanguage}
                  onChange={(event) =>
                    update(
                      "nativeLanguage",
                      event.target.value as SpeakingNativeLanguage,
                    )
                  }
                >
                  {SPEAKING_NATIVE_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {SPEAKING_NATIVE_LANGUAGE_LABELS[language]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Student identification
                <select
                  value={draft.identifierMode}
                  onChange={(event) =>
                    update(
                      "identifierMode",
                      event.target.value as SpeakingIdentifierMode,
                    )
                  }
                >
                  {SPEAKING_IDENTIFIER_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {SPEAKING_IDENTIFIER_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="speaking-rubric-editor-heading">
              <div>
                <span className="speaking-card-kicker">Editable rubric</span>
                <p>
                  Keep the skills that matter for this activity. Pronunciation
                  scoring is not included.
                </p>
              </div>
              <button
                type="button"
                className="speaking-outline-button"
                onClick={() =>
                  update("rubric", [
                    ...draft.rubric,
                    {
                      id: `custom-${Date.now()}`,
                      name: "New skill",
                      description: "What should students show?",
                      enabled: true,
                    },
                  ])
                }
              >
                <Plus size={16} aria-hidden="true" />
                Add criterion
              </button>
            </div>
            <div className="speaking-rubric-editor">
              {draft.rubric.map((criterion, index) => (
                <div
                  className={`speaking-rubric-row${criterion.enabled ? " is-enabled" : ""}`}
                  key={criterion.id}
                >
                  <label className="speaking-rubric-toggle">
                    <input
                      type="checkbox"
                      checked={criterion.enabled}
                      onChange={(event) =>
                        updateCriterion(index, {
                          enabled: event.target.checked,
                        })
                      }
                    />
                    <span>{criterion.enabled ? "On" : "Off"}</span>
                  </label>
                  <div>
                    <input
                      aria-label={`${criterion.name} name`}
                      value={criterion.name}
                      onChange={(event) =>
                        updateCriterion(index, { name: event.target.value })
                      }
                    />
                    <textarea
                      aria-label={`${criterion.name} description`}
                      rows={2}
                      value={criterion.description}
                      onChange={(event) =>
                        updateCriterion(index, {
                          description: event.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="speaking-icon-button speaking-danger-icon"
                    onClick={() =>
                      update(
                        "rubric",
                        draft.rubric.filter(
                          (_, candidateIndex) => candidateIndex !== index,
                        ),
                      )
                    }
                    aria-label={`Remove ${criterion.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>
          {formError && (
            <p className="speaking-error speaking-builder-error" role="alert">
              {formError}
            </p>
          )}
          <div className="speaking-builder-footer">
            <p>
              <ShieldIcon />
              <span>
                Activities are saved to your teacher workspace. Classroom join
                codes are created only when you launch a session.
              </span>
            </p>
            <button
              type="submit"
              className="speaking-primary-button"
              disabled={saving}
            >
              <Check size={17} aria-hidden="true" />
              {editing ? "Save changes" : "Create activity"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function SpeakingActivityPage({
  navigate,
  activityId,
  results,
  edit,
}: {
  navigate: Navigate;
  activityId: string;
  results: boolean;
  edit: boolean;
}) {
  if (results)
    return <SpeakingResultsPage navigate={navigate} activityId={activityId} />;
  if (edit)
    return <SpeakingCreatePage navigate={navigate} activityId={activityId} />;
  return (
    <SpeakingActivityDetailPage navigate={navigate} activityId={activityId} />
  );
}

function SpeakingActivityDetailPage({
  navigate,
  activityId,
}: {
  navigate: Navigate;
  activityId: string;
}) {
  const [activity, setActivity] = useState<SpeakingActivity>();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [activityPayload, sessionPayload] = await Promise.all([
        speakingApi.activity(activityId),
        speakingApi.sessions(activityId),
      ]);
      setActivity((activityPayload as { activity: SpeakingActivity }).activity);
      setSessions((sessionPayload as { sessions: SpeakingSession[] }).sessions);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, "This activity could not be loaded."),
      );
    }
  }, [activityId]);
  useEffect(() => {
    void load();
  }, [load]);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  if (!activity)
    return error ? (
      <MissingSpeakingSession navigate={navigate} message={error} />
    ) : (
      <TeacherLoading />
    );
  const latest = sessions[0];
  const shareable = Boolean(
    latest && ["ready", "active", "paused"].includes(latest.status),
  );
  const shareUrl = shareable
    ? `${window.location.origin}/speak/join/${latest!.joinCode}`
    : "";
  const run = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setError("");
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(
        getErrorMessage(
          actionError,
          "The classroom session could not be updated.",
        ),
      );
    } finally {
      setWorking(false);
    }
  };
  const endLatestSession = () => {
    if (
      !latest ||
      !window.confirm(
        `End speaking session ${latest.joinCode}? Students will not be able to continue this classroom run.`,
      )
    )
      return;
    void run(() => speakingApi.endSession(latest.id));
  };
  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <section className="speaking-share-page">
          <button
            type="button"
            className="speaking-text-button"
            onClick={() => navigate("/speak/teacher")}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            All activities
          </button>
          <div className="speaking-share-header">
            <div>
              <span className="speaking-eyebrow">
                <Check size={15} aria-hidden="true" />{" "}
                {latest ? "Classroom session" : "Reusable activity"}
              </span>
              <h1>{activity.title}</h1>
              <p>{activity.scenario}</p>
            </div>
            <span
              className={`speaking-status-pill speaking-status-${latest?.status ?? "ready"}`}
            >
              {latest ? latest.status : "Ready to launch"}
            </span>
          </div>
          {error && (
            <p className="speaking-error" role="alert">
              {error}
            </p>
          )}
          <div className="speaking-share-grid">
            <section className="speaking-share-card speaking-share-code-card">
              {shareable ? (
                <>
                  <div>
                    <span className="speaking-card-kicker">
                      参加コード / QRコード
                    </span>
                    <h2>
                      {latest!.status === "ready"
                        ? "Session ready"
                        : "Share with your class"}
                    </h2>
                    <p>
                      Scan the QR code or enter this short code at{" "}
                      <strong>/speak/join</strong>.
                    </p>
                  </div>
                  <div className="speaking-share-visual">
                    <QRCodeSVG
                      value={shareUrl}
                      size={172}
                      bgColor="#ffffff"
                      fgColor="#12214b"
                      level="M"
                    />
                    <div className="speaking-join-code-block">
                      <small>Session code</small>
                      <strong>{latest!.joinCode}</strong>
                      <button
                        type="button"
                        onClick={copyShareUrl}
                        aria-label="Copy join URL"
                      >
                        {copied ? (
                          <Check size={18} aria-hidden="true" />
                        ) : (
                          <Copy size={18} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="speaking-share-link">
                    <span>{shareUrl}</span>
                    <button
                      className="speaking-outline-button"
                      type="button"
                      onClick={copyShareUrl}
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="speaking-card-kicker">
                      {latest
                        ? "Launch a new classroom run"
                        : "Launch a classroom run"}
                    </span>
                    <h2>
                      {latest
                        ? "Ready for another class?"
                        : "Ready when you are"}
                    </h2>
                    <p>
                      Launching creates a new secure session code. This activity
                      itself stays reusable.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="speaking-primary-button"
                    disabled={working}
                    onClick={() =>
                      void run(() => speakingApi.launchSession(activity.id))
                    }
                  >
                    <Play size={17} aria-hidden="true" />
                    Launch session
                  </button>
                </>
              )}
            </section>
            <section className="speaking-share-card">
              <div className="speaking-share-card-heading">
                <span className="speaking-card-kicker">Activity setup</span>
                <button
                  type="button"
                  className="speaking-icon-button"
                  onClick={() =>
                    navigate(`/speak/teacher/activity/${activity.id}/edit`)
                  }
                  aria-label="Edit activity"
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <span className="speaking-edit-label">Edit Activity</span>
              </div>
              <dl className="speaking-activity-facts">
                <div>
                  <dt>AI role</dt>
                  <dd>{activity.aiRole}</dd>
                </div>
                <div>
                  <dt>Student role</dt>
                  <dd>{activity.studentRole}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{SPEAKING_LEVEL_LABELS[activity.level]}</dd>
                </div>
                <div>
                  <dt>Difficulty</dt>
                  <dd>{SPEAKING_DIFFICULTY_LABELS[activity.difficulty]}</dd>
                </div>
                <div>
                  <dt>Speaking time</dt>
                  <dd>{formatDuration(activity.durationSeconds)}</dd>
                </div>
                <div>
                  <dt>Feedback</dt>
                  <dd>
                    {SPEAKING_NATIVE_LANGUAGE_LABELS[activity.nativeLanguage]}
                  </dd>
                </div>
              </dl>
              <div className="speaking-share-targets">
                <span>Target English</span>
                <div>
                  {activity.targetExpressions.map((expression) => (
                    <span key={expression}>{expression}</span>
                  ))}
                </div>
              </div>
            </section>
          </div>
          <div className="speaking-share-actions">
            {latest && latest.status === "ready" && (
              <button
                type="button"
                className="speaking-primary-button"
                disabled={working}
                onClick={() =>
                  void run(() => speakingApi.startSession(latest.id))
                }
              >
                Start session
              </button>
            )}
            {latest && latest.status === "active" && (
              <button
                type="button"
                className="speaking-outline-button"
                disabled={working}
                onClick={() =>
                  void run(() => speakingApi.pauseSession(latest.id))
                }
              >
                Pause session
              </button>
            )}
            {latest && latest.status === "paused" && (
              <button
                type="button"
                className="speaking-primary-button"
                disabled={working}
                onClick={() =>
                  void run(() => speakingApi.resumeSession(latest.id))
                }
              >
                Resume session
              </button>
            )}
            {latest &&
              ["ready", "active", "paused"].includes(latest.status) && (
                <button
                  type="button"
                  className="speaking-outline-button"
                  disabled={working}
                  onClick={endLatestSession}
                >
                  End session
                </button>
              )}
            {latest && (
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() =>
                  navigate(
                    `/speak/teacher/activity/${activity.id}/results?sessionId=${encodeURIComponent(latest.id)}`,
                  )
                }
              >
                <Trophy size={17} aria-hidden="true" />
                View results
              </button>
            )}
          </div>
          {sessions.length > 1 && (
            <section className="speaking-share-card speaking-previous-sessions">
              <div className="speaking-share-card-heading">
                <span className="speaking-card-kicker">Previous sessions</span>
              </div>
              {sessions.slice(1).map((session) => (
                <button
                  className="speaking-results-table-row"
                  type="button"
                  key={session.id}
                  onClick={() =>
                    navigate(
                      `/speak/teacher/activity/${activity.id}/results?sessionId=${encodeURIComponent(session.id)}`,
                    )
                  }
                >
                  <span>{new Date(session.createdAt).toLocaleString()}</span>
                  <code>{session.joinCode}</code>
                  <span
                    className={`speaking-status-pill speaking-status-${session.status}`}
                  >
                    {session.status}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              ))}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

function SpeakingResultsPage({
  navigate,
  activityId,
}: {
  navigate: Navigate;
  activityId: string;
}) {
  const [activity, setActivity] = useState<SpeakingActivity>();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [sessionId, setSessionId] = useState(
    () => new URLSearchParams(window.location.search).get("sessionId") ?? "",
  );
  const [payload, setPayload] = useState<SessionResultsResponse>();
  const [error, setError] = useState("");
  const [loadingResults, setLoadingResults] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setError("");
    setPayload(undefined);
    void Promise.all([
      speakingApi.activity(activityId),
      speakingApi.sessions(activityId),
    ])
      .then(([activityPayload, sessionsPayload]) => {
        if (cancelled) return;
        const nextActivity = (activityPayload as { activity: SpeakingActivity })
          .activity;
        const nextSessions = (
          sessionsPayload as { sessions: SpeakingSession[] }
        ).sessions;
        setActivity(nextActivity);
        setSessions(nextSessions);
        setSessionId((current) =>
          nextSessions.some((session) => session.id === current)
            ? current
            : nextSessions[0]?.id || "",
        );
      })
      .catch((loadError) => {
        if (!cancelled)
          setError(getErrorMessage(loadError, "Results could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);
  useEffect(() => {
    if (!sessionId) {
      setPayload(undefined);
      setLoadingResults(false);
      return;
    }
    let cancelled = false;
    setError("");
    setPayload(undefined);
    setLoadingResults(true);
    void speakingApi
      .sessionResults(sessionId)
      .then((next) => {
        if (!cancelled) setPayload(next as SessionResultsResponse);
      })
      .catch((loadError) => {
        if (!cancelled)
          setError(getErrorMessage(loadError, "Results could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoadingResults(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  if (error && !activity)
    return <MissingSpeakingSession navigate={navigate} message={error} />;
  if (!activity || (sessionId && loadingResults)) return <TeacherLoading />;
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <section className="speaking-teacher-content">
          <button
            type="button"
            className="speaking-text-button"
            onClick={() => navigate(`/speak/teacher/activity/${activity.id}`)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {activity.title}
          </button>
          <div className="speaking-teacher-heading speaking-results-heading">
            <div>
              <span className="speaking-eyebrow">
                <Trophy size={15} aria-hidden="true" /> Learning results
              </span>
              <h1>See who found their voice</h1>
              <p>Results are scoped to one launched classroom session.</p>
            </div>
            {sessions.length > 0 && (
              <select
                aria-label="Select classroom session"
                value={sessionId}
                onChange={(event) => {
                  setPayload(undefined);
                  setError("");
                  setSessionId(event.target.value);
                  window.history.replaceState(
                    null,
                    "",
                    `${buildTeacherSpeakingPath(`/speak/teacher/activity/${activity.id}/results`)}?sessionId=${encodeURIComponent(event.target.value)}`,
                  );
                }}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {new Date(session.createdAt).toLocaleString()} ·{" "}
                    {session.joinCode}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && (
            <p className="speaking-error" role="alert">
              {error}
            </p>
          )}
          {sessions.length === 0 ? (
            <div className="speaking-empty-card">
              <Trophy size={32} aria-hidden="true" />
              <h2>No classroom sessions yet</h2>
              <p>Launch this activity before opening its learning results.</p>
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() =>
                  navigate(`/speak/teacher/activity/${activity.id}`)
                }
              >
                Open activity
              </button>
            </div>
          ) : error && !payload ? (
            <div className="speaking-empty-card">
              <Trophy size={32} aria-hidden="true" />
              <h2>Results unavailable</h2>
              <p>Please return to the activity and try opening the results again.</p>
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() =>
                  navigate(`/speak/teacher/activity/${activity.id}`)
                }
              >
                Open activity
              </button>
            </div>
          ) : payload?.items.length ? (
            <div className="speaking-results-table">
              <div className="speaking-results-table-head">
                <span>Participant</span>
                <span>Status</span>
                <span>Overall</span>
                <span>Support</span>
                <span />
              </div>
              {payload.items.map((item) => (
                <button
                  type="button"
                  className="speaking-results-table-row"
                  key={item.participant.id}
                  onClick={() =>
                    navigate(`/speak/teacher/result/${item.participant.id}`)
                  }
                >
                  <span className="speaking-participant-cell">
                    <span className="speaking-student-avatar">
                      <UserRound size={19} aria-hidden="true" />
                    </span>
                    <strong>
                      {item.participant.displayIdentifier ??
                        "Anonymous student"}
                    </strong>
                  </span>
                  <span>
                    <span
                      className={`speaking-status-pill speaking-status-${item.status}`}
                    >
                      {item.evaluation?.assessmentStatus ===
                      "insufficient_evidence"
                        ? speakingFeedbackCopy(item.evaluation.language)
                            .notScored
                        : item.status === "completed"
                          ? "Completed"
                          : item.status === "error"
                            ? "Evaluation unavailable"
                            : "In progress"}
                    </span>
                  </span>
                  <span className="speaking-table-score">
                    {item.overallScore === undefined ? (
                      "—"
                    ) : (
                      <>
                        {item.overallScore}
                        <small>/100</small>
                      </>
                    )}
                  </span>
                  <span className="speaking-table-help">
                    <Lightbulb size={15} aria-hidden="true" />
                    {item.helpCount}
                  </span>
                  <span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="speaking-empty-card">
              <Users size={32} aria-hidden="true" />
              <h2>No students yet</h2>
              <p>
                Share {payload?.session.joinCode} to invite the first practice
                session.
              </p>
              <button
                type="button"
                className="speaking-primary-button"
                onClick={() =>
                  navigate(`/speak/teacher/activity/${activity.id}`)
                }
              >
                Show session code
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SpeakingTeacherResultPage({
  navigate,
  participantId,
}: {
  navigate: Navigate;
  participantId: string;
}) {
  const [result, setResult] = useState<ResultResponse["result"]>();
  const [error, setError] = useState("");
  useEffect(() => {
    void speakingApi
      .result(participantId)
      .then((payload) => setResult((payload as ResultResponse).result))
      .catch((loadError) =>
        setError(
          getErrorMessage(
            loadError,
            "This student result could not be loaded.",
          ),
        ),
      );
  }, [participantId]);
  if (!result && !error) return <TeacherLoading />;
  if (!result)
    return <MissingSpeakingSession navigate={navigate} message={error} />;
  const evaluation = result.evaluation;
  return (
    <div className="speaking-page-shell speaking-teacher-shell">
      <main className="speaking-teacher-layout">
        <section className="speaking-teacher-content">
          <button
            type="button"
            className="speaking-text-button"
            onClick={() =>
              navigate(
                `/speak/teacher/activity/${result.activity.id}/results?sessionId=${encodeURIComponent(result.session.id)}`,
              )
            }
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to results
          </button>
          <div className="speaking-teacher-heading speaking-detail-heading">
            <div>
              <span className="speaking-eyebrow">
                <UserRound size={15} aria-hidden="true" /> Student detail
              </span>
              <h1>
                {result.participant.displayIdentifier ?? "Anonymous student"}
              </h1>
              <p>
                {result.activity.title} ·{" "}
                {
                  result.turns.filter((turn) => turn.speaker === "student")
                    .length
                }{" "}
                speaking turns · {result.participant.helpCount} Help uses
              </p>
            </div>
            <span className="speaking-detail-score">
              <strong>
                {evaluation ? (scoreFor(evaluation) ?? "—") : "—"}
              </strong>
              {evaluation && scoreFor(evaluation) !== undefined && (
                <small>/100</small>
              )}
            </span>
          </div>
          {evaluation ? (
            <ResultPanel
              activity={result.activity}
              turns={result.turns}
              evaluation={evaluation}
              teacherView
            />
          ) : (
            <div className="speaking-empty-card">
              <h2>Evaluation unavailable</h2>
              <p>
                The participant’s transcript remains available, but no
                trustworthy evaluation is stored.
              </p>
              <div className="speaking-transcript-detail">
                {result.turns.map((turn) => (
                  <p key={turn.id}>
                    <strong>{turn.speaker === "ai" ? "AI" : "Student"}</strong>
                    <span>{turn.text}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
