import { LocalSpeechError } from "./audio";
import { alignSpeechWords, speechWords } from "@quizstrike/shared";

export const readinessPhrase = "I like reading books.";

export function speechWordErrorRate(expected: string, recognized: string) {
  return alignSpeechWords(expected, recognized).wordErrorRate;
}

export function speechBenchmarkMetrics(reference: string, text: string, control: boolean) {
  const { edits: _edits, ...alignment } = alignSpeechWords(control ? "" : reference, text);
  const count = (value: string) => {
    const words = speechWords(value);
    return {
      fillers: words.filter((word) => /^(?:um|uh|erm|er|hmm)$/u.test(word)).length,
      adjacentRepeats: words.filter((word, index) => index > 0 && words[index - 1] === word).length
    };
  };
  return { ...alignment, missedSpeech: !control && alignment.referenceWords > 0 && !alignment.recognizedWords,
    hallucinatedSpeech: control && alignment.recognizedWords > 0, referencePatterns: count(control ? "" : reference), recognizedPatterns: count(text) };
}

export const localSpeechMessage = (error: unknown) => {
  if (!(error instanceof LocalSpeechError)) return "Could not complete the on-device check. Check your settings and try again.";
  switch (error.code) {
    case "unsupported": return "This browser cannot run on-device speech recognition. Ask your teacher for another way to take the activity.";
    case "decode": return "This recording could not be opened. Record again or choose a different format.";
    case "too-long": return "This recording is too long. Use a shorter recording.";
    case "too-large": return "This recording is too large. Choose a smaller file.";
    case "timeout": return "On-device speech recognition took too long. Try again or tell your teacher.";
    case "prepare": return "The model is missing from this browser. Open the preparation check and try again.";
    default: return "The on-device speech model could not run. Check your connection and available storage, then try again.";
  }
};
