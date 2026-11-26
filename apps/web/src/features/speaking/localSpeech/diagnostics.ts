import { LocalSpeechError } from "./audio";

export const readinessPhrase = "I like reading books.";

const words = (text: string) => text.normalize("NFKC").toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)*/gu)?.map((word) => word.replaceAll("’", "'")) ?? [];

export function speechWordErrorRate(expected: string, recognized: string) {
  const reference = words(expected);
  const hypothesis = words(recognized);
  if (!reference.length) return undefined;
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, i) => i);
  for (const [row, word] of reference.entries()) {
    const current = [row + 1];
    for (const [column, observed] of hypothesis.entries()) {
      current.push(Math.min(current[column]! + 1, previous[column + 1]! + 1, previous[column]! + Number(word !== observed)));
    }
    previous = current;
  }
  return previous[hypothesis.length]! / reference.length;
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
