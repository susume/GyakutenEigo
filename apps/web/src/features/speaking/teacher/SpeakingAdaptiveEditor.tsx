import { useState } from "react";
import { SpeakingStructuredPlanSchema, type SpeakingStructuredPlan } from "@quizstrike/shared";
import { speakingApi } from "../../../api/client";
import { useSiteTranslation } from "../../../ui/siteTranslation";

const blankStep: SpeakingStructuredPlan["steps"][number] = { question: "", objective: "", concepts: [], kind: "answer" };
export const emptyAdaptivePlan: SpeakingStructuredPlan = { version: 2, maxResponses: 8, steps: [blankStep] };
export const weekendAdaptivePlan: SpeakingStructuredPlan = {
  version: 2, maxResponses: 8, completeAfter: 2,
  steps: [
    { question: "Where did you go last Sunday?", objective: "Tell your partner where you went or stayed", kind: "answer",
      concepts: ["Kyoto", "the park", "mall", "library", "my friend's house"], followUp: "What did you do there?",
      alternateConcepts: ["home", "at home"], alternateFollowUp: "What did you do at home?", clarification: "Did you go somewhere, or did you stay home?" },
    { question: "Who were you with?", objective: "Say who was with you or say you were alone", kind: "answer",
      concepts: ["friend", "friends", "family", "mother", "father", "brother", "sister", "alone"], acceptsNegative: true }
  ]
};
const preferencesPlan: SpeakingStructuredPlan = {
  version: 2, maxResponses: 6,
  steps: [
    { question: "Do you like playing sports?", objective: "Express a preference", kind: "answer", concepts: ["soccer", "tennis", "basketball", "sport", "sports"], acceptsNegative: true,
      negativeFollowUp: "What do you like doing instead?", followUp: "Which sport do you play?", clarification: "Do you like sports?" },
    { question: "What question would you like to ask me?", objective: "Ask your partner a question", kind: "question", concepts: [] }
  ]
};

export default function SpeakingAdaptiveEditor({ activityId, plan, setPlan, disabled }: {
  activityId: string; plan: SpeakingStructuredPlan; setPlan: (plan: SpeakingStructuredPlan) => void; disabled: boolean;
}) {
  const { language } = useSiteTranslation();
  const ja = language === "ja";
  const [sample, setSample] = useState("");
  const [responses, setResponses] = useState<string[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof speakingApi.previewStructured>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (next: SpeakingStructuredPlan) => { setPlan(next); setPreview(undefined); setResponses([]); setSample(""); setError(""); };
  const editStep = (index: number, patch: Partial<typeof blankStep>) =>
    update({ ...plan, steps: plan.steps.map((step, position) => position === index ? { ...step, ...patch } : step) });
  const simulate = async () => {
    const parsed = SpeakingStructuredPlanSchema.safeParse(plan);
    if (!parsed.success) { setError(ja ? "質問、目標、回答例を確認してください。" : "Check the questions, objectives and answer cues."); return; }
    setBusy(true);
    setError("");
    const next = sample.trim() ? [...responses, sample.trim()] : responses;
    try {
      setPreview(await speakingApi.previewStructured(activityId, parsed.data, next));
      setSample("");
      setResponses(next);
    } catch { setError(ja ? "プレビューを開けませんでした。" : "The preview could not be opened."); }
    finally { setBusy(false); }
  };
  return <fieldset className="speaking-adaptive-editor" disabled={disabled || busy}>
    <legend>{ja ? "会話の質問と分岐" : "Adaptive conversation"}</legend>
    <div className="speaking-reading-actions">
      <button type="button" className="speaking-outline-button" onClick={() => update(weekendAdaptivePlan)}>{ja ? "週末の会話を使う" : "Use weekend template"}</button>
      <button type="button" className="speaking-outline-button" onClick={() => update(preferencesPlan)}>{ja ? "好きなことの会話を使う" : "Use preferences template"}</button>
    </div>
    {plan.steps.map((step, index) => <fieldset key={index}>
      <legend>{ja ? `質問 ${index + 1}` : `Question ${index + 1}`}</legend>
      <label>{ja ? "質問" : "Question"}<input maxLength={180} value={step.question} onChange={(event) => editStep(index, { question: event.target.value })} /></label>
      <label>{ja ? "目標" : "Objective"}<input maxLength={180} value={step.objective} onChange={(event) => editStep(index, { objective: event.target.value })} /></label>
      <label>{ja ? "生徒に期待すること" : "Expected interaction"}<select value={step.kind} onChange={(event) => editStep(index, { kind: event.target.value === "question" ? "question" : "answer" })}>
        <option value="answer">{ja ? "答える" : "Answer"}</option><option value="question">{ja ? "質問する" : "Ask a question"}</option>
      </select></label>
      {step.kind === "answer" && <details>
        <summary>{ja ? "回答例と追加の質問" : "Answer cues and follow-ups"}</summary>
        <CueInput key={step.question + step.objective + "primary"} label={ja ? "回答例・キーワード（カンマ区切り）" : "Valid answer cues (comma-separated)"} values={step.concepts} onChange={(concepts) => editStep(index, { concepts })} />
        <label>{ja ? "追加の質問" : "Follow-up"}<input maxLength={180} value={step.followUp ?? ""} onChange={(event) => editStep(index, { followUp: event.target.value || undefined })} /></label>
        <CueInput key={step.question + step.objective + "alternate"} label={ja ? "別の分岐のキーワード（カンマ区切り）" : "Alternate branch cues (comma-separated)"} values={step.alternateConcepts ?? []} onChange={(alternateConcepts) => editStep(index, { alternateConcepts })} />
        <label>{ja ? "別の分岐の質問" : "Alternate follow-up"}<input maxLength={180} value={step.alternateFollowUp ?? ""} onChange={(event) => editStep(index, { alternateFollowUp: event.target.value || undefined })} /></label>
        <label>{ja ? "否定の回答への質問" : "Follow-up for negative answers"}<input maxLength={180} value={step.negativeFollowUp ?? ""} onChange={(event) => editStep(index, { negativeFollowUp: event.target.value || undefined })} /></label>
        <label><input type="checkbox" checked={step.acceptsNegative ?? false} onChange={(event) => editStep(index, { acceptsNegative: event.target.checked })} />{ja ? "否定の回答も目標を満たす" : "Negative answers can satisfy this objective"}</label>
      </details>}
      <label>{ja ? "聞き返す質問（任意）" : "Clarifying question (optional)"}<input maxLength={180} value={step.clarification ?? ""} onChange={(event) => editStep(index, { clarification: event.target.value || undefined })} /></label>
      {plan.steps.length > 1 && <button type="button" className="speaking-text-button" onClick={() => update({
        ...plan, steps: plan.steps.filter((_, position) => position !== index),
        completeAfter: plan.completeAfter ? Math.min(plan.completeAfter, plan.steps.length - 1) : undefined
      })}>{ja ? "質問を削除" : "Remove question"}</button>}
    </fieldset>)}
    {plan.steps.length < 6 && <button type="button" className="speaking-outline-button" onClick={() => update({ ...plan, steps: [...plan.steps, blankStep] })}>{ja ? "質問を追加" : "Add question"}</button>}
    <label>{ja ? "回答回数の上限" : "Maximum student responses"}
      <input type="number" min={1} max={11} value={plan.maxResponses ?? ""} onChange={(event) => update({ ...plan, maxResponses: Number(event.target.value) || undefined })} />
    </label>
    <label>{ja ? "終了に必要な達成目標数" : "Objectives needed to finish"}
      <input type="number" min={1} max={plan.steps.length} value={plan.completeAfter ?? ""} placeholder={String(plan.steps.length)} onChange={(event) => update({ ...plan, completeAfter: Number(event.target.value) || undefined })} />
    </label>
    <details><summary>{ja ? "会話を試す" : "Simulate conversation"}</summary>
      <p lang="en" role="status">{preview?.reply ?? plan.steps[0]?.question}</p>
      {responses.length > 0 && <ol>{responses.map((answer, index) => <li lang="en" key={index}>{answer}</li>)}</ol>}
      {preview?.completedObjectives.length ? <p>{ja ? "達成した目標" : "Objectives matched"} · {preview.completedObjectives.join(" · ")}</p> : null}
      <label>{ja ? "生徒の回答例" : "Sample student response"}<input maxLength={1200} value={sample} onChange={(event) => setSample(event.target.value)} /></label>
      <div className="speaking-reading-actions">
        <button type="button" className="speaking-outline-button" onClick={() => void simulate()} disabled={preview?.complete || !sample.trim()}>{ja ? "回答を試す" : "Try response"}</button>
        <button type="button" className="speaking-text-button" onClick={() => update(plan)}>{ja ? "やり直す" : "Reset preview"}</button>
      </div>
      {error && <p className="speaking-error" role="alert">{error}</p>}
    </details>
  </fieldset>;
}

function CueInput({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <label>{label}<input maxLength={390} defaultValue={values.join(", ")} onChange={(event) =>
    onChange(event.target.value.split(",").map((value) => value.trim()).filter(Boolean))} /></label>;
}
