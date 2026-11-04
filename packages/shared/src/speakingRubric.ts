/** Shared, task-based classroom anchors; these are not CEFR or report-card grades. */
export const SPEAKING_RUBRIC_VERSION = "2026-10-20-fair-task-rubric-v1";

export const HWG_DOCTOR_RUBRIC = [
  {
    id: "hwg_dl6_symptoms",
    name: "Symptoms",
    description: "Describe the symptoms on your patient card and say when they started.",
    levels: [
      "Communicates no symptom or feeling of illness that matches the card.",
      "Says only that they feel unwell.",
      "Communicates one symptom from the card.",
      "Communicates one symptom from the card and when it started.",
      "Communicates at least two symptoms from the card, but does not meet level 5.",
      "Communicates all symptoms on the card and when they started."
    ]
  },
  {
    id: "hwg_dl6_advice_response",
    name: "Advice response",
    description: "Respond to the doctor's advice and say what you will do.",
    levels: [
      "Does not respond to the advice.",
      "Responds with content that does not fit the advice.",
      "Gives a short acknowledgment such as “OK.”",
      "Responds using a keyword from the advice.",
      "Correctly repeats the action the doctor recommended.",
      "States what they themselves will do in line with the advice."
    ]
  },
  {
    id: "hwg_dl6_follow_up",
    name: "Follow-up question",
    description: "Ask a specific question about an action the doctor recommends.",
    levels: [
      "Asks no question.",
      "Asks a question unrelated to the advice.",
      "Asks a question whose connection to the advice is unclear.",
      "Asks to confirm information already given in the advice.",
      "Asks a question whose intent is clear from the immediately preceding advice.",
      "Names the recommended action and asks a specific question about it."
    ]
  },
  {
    id: "hwg_dl6_clarity",
    name: "Clarity",
    description: "Communicate so the doctor can understand. AI scoring uses what came across in the conversation.",
    levels: [
      "The listener could not understand the message.",
      "Only words or short expressions came across.",
      "Part of the message came across.",
      "The main point came across after the listener asked for clarification.",
      "Some parts were hard to understand, but the whole message came across.",
      "Voice and pace were easy to follow and the message came across right away."
    ]
  }
] as const;

export const HWG_DOCTOR_GRADE_BANDS = [
  { grade: "A", min: 17, max: 20 },
  { grade: "B", min: 11, max: 16 },
  { grade: "C", min: 0, max: 10 }
] as const;

export const speakingCriterionMax = (id: string) =>
  HWG_DOCTOR_RUBRIC.some((criterion) => criterion.id === id) ? 5 : 4;

export const hasHwgDoctorRubric = (rubric: ReadonlyArray<{ id: string; enabled: boolean }>) => {
  const enabled = rubric.filter((criterion) => criterion.enabled);
  return enabled.length === HWG_DOCTOR_RUBRIC.length &&
    HWG_DOCTOR_RUBRIC.every(({ id }) => enabled.some((criterion) => criterion.id === id));
};

export const hwgDoctorGrade = (
  rubric: Parameters<typeof hasHwgDoctorRubric>[0],
  scores?: Record<string, number | null>
) => {
  if (!scores || !hasHwgDoctorRubric(rubric)) return undefined;
  let points = 0;
  for (const { id } of HWG_DOCTOR_RUBRIC) {
    const score = scores[id];
    if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 5) return undefined;
    points += score;
  }
  const band = HWG_DOCTOR_GRADE_BANDS.find(({ min, max }) => points >= min && points <= max);
  return band ? { points, grade: band.grade } : undefined;
};

export const SPEAKING_RUBRIC_GUIDE = [
  {
    id: "task_achievement",
    name: "Task Achievement",
    levels: {
      4: "Achieves all material goals with accurate, relevant information and an appropriate outcome.",
      3: "Achieves the main outcome; a small omission does not prevent success.",
      2: "Achieves part of the task, but misses or confuses an important requirement.",
      1: "Makes limited relevant progress; most important requirements remain unmet.",
      0: "An observable attempt does not achieve a task-relevant outcome."
    }
  },
  {
    id: "interaction",
    name: "Interaction",
    levels: {
      4: "Responds appropriately and uses relevant questions, clarification or confirmation when needed; closes naturally.",
      3: "Maintains a mostly appropriate exchange; resolves an occasional misunderstanding.",
      2: "Participates partly, but several relevant questions or responses remain unresolved.",
      1: "Sustains little relevant exchange despite genuine opportunities to respond.",
      0: "An observable attempt gives no relevant response despite a clear interaction opportunity."
    }
  },
  {
    id: "language_range_control",
    name: "Language Range & Control",
    levels: {
      4: "Uses enough appropriate, familiar language to express the intended meaning; minor errors do not obstruct it.",
      3: "Uses suitable words and sentence patterns; some errors cause occasional ambiguity.",
      2: "Limited vocabulary or control repeatedly makes important meanings ambiguous.",
      1: "Mostly isolated words or unclear sentence patterns convey little intended meaning.",
      0: "An observable language attempt conveys no usable task-relevant meaning."
    }
  },
  {
    id: "communication_fluency",
    name: "Communication & Fluency",
    levels: {
      4: "Expresses a clear, sufficiently connected message that the listener can follow for this task.",
      3: "Communicates the main message clearly, with occasional missing links or unclear references.",
      2: "Conveys some of the message, but key parts require interpretation or clarification.",
      1: "Conveys little of the message clearly, even after a reasonable clarification opportunity.",
      0: "An observable attempt leaves the task-relevant message unintelligible."
    }
  }
] as const;

export const SPEAKING_RUBRIC_FAIRNESS_RULES = [
  "Judge the stated task and the opportunities actually provided. Do not add hidden requirements from textbook examples, suggested steps or vocabulary lists.",
  "Natural equivalents and simple taught language can earn full credit. Do not require every target phrase, advanced grammar, long answers or memorized dialogue.",
  "Allowed maps, expressions, example dialogues, transcript, replay and Help are task conditions. Their use alone cannot lower a score or prevent full credit.",
  "A useful clarification or self-correction can show successful interaction. Do not deduct merely because the learner requests repetition or checks a detail.",
  "Separate the criteria: minor grammar errors belong in language control only when they affect it; do not automatically deduct the same error from achievement or clarity when communication succeeds.",
  "Use null (N/A), not 0, when usable evidence or a genuine opportunity is missing. Mark an unobserved goal requirement uncertain; do not blame the learner for AI scaffolding, early closure or technical failures.",
  "Use 0 only for an observable unsuccessful attempt. Blank recordings, microphone failures and missing transcripts are insufficient evidence, not demonstrated failure.",
  "Do not infer pronunciation, accent quality, speech speed, pauses, eye contact, confidence, motivation or attitude from transcript text, recording duration or response latency.",
  "Use criterion-specific transcript evidence and consider speech-recognition uncertainty. Do not reward invented facts; a legitimate offer to check an unknown fact can be successful.",
  "Score only enabled, relevant criteria. For a presentation with no interaction opportunity, Interaction is N/A; it is not an automatic zero. Keep assessment conditions consistent across learners."
] as const;
