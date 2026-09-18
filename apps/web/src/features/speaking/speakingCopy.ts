import {
  SPEAKING_MODE_LABELS,
  resolveSpeakingSupportSettings,
  type SpeakingActivity,
  type SpeakingMode,
  type SpeakingSupportSettings
} from "@quizstrike/shared";

export const speakingModeLabel = (mode: SpeakingMode | undefined) =>
  SPEAKING_MODE_LABELS[mode === "practice" ? "practice" : "assessment"];

export const speakingModeDescription = (mode: SpeakingMode | undefined) => mode === "practice"
  ? "Students rehearse the task with extra support and feedback."
  : "Students show what they can do independently; their conversation becomes evidence of real communication.";

export const speakingModeIntro = (mode: SpeakingMode | undefined) => mode === "practice"
  ? "Try the task and use the support if you need it."
  : "You’ve learned and practised this. Now complete the task in your own way.";

export const speakingModeAction = (mode: SpeakingMode | undefined, kind: "start" | "finish") => {
  if (kind === "start") return mode === "practice" ? "Start practice" : "Start task";
  return mode === "practice" ? "Finish practice" : "Finish task";
};

export const speakingSupportSettings = (activity: Pick<SpeakingActivity, "supportSettings"> | undefined) =>
  resolveSpeakingSupportSettings(activity?.supportSettings);

const supportLabels: Array<[keyof SpeakingSupportSettings, string]> = [
  ["showTargetExpressions", "Target English"],
  ["showContext", "Context"],
  ["showTranscript", "Transcript"],
  ["allowReplay", "Replay"],
  ["allowHelp", "Help"]
];

export const speakingSupportSummary = (activity: Pick<SpeakingActivity, "mode" | "supportSettings"> | undefined) => {
  const settings = speakingSupportSettings(activity);
  const allowed = supportLabels.filter(([key]) => settings[key]).map(([, label]) => `${label} allowed`);
  const disabled = supportLabels.filter(([key]) => !settings[key]).map(([, label]) => `${label} off`);
  return [...allowed, ...disabled].join(" · ") || "No optional support";
};

export const speakingSupportSettingsForMode = (mode: SpeakingMode): SpeakingSupportSettings =>
  mode === "practice"
    ? { showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true }
    : { showTargetExpressions: true, showContext: true, showTranscript: false, allowReplay: false, allowHelp: false };
