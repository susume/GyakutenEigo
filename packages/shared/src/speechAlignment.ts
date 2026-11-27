export function speechWords(text: string) {
  return text.normalize("NFKC").toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)*/gu)?.map((word) => word.replaceAll("’", "'")) ?? [];
}

export type SpeechWordEdit = {
  kind: "match" | "substitution" | "insertion" | "deletion";
  reference?: string;
  recognized?: string;
};

/** Word-level Levenshtein alignment with deterministic ties favoring substitution. */
export function alignSpeechWords(expected: string, actual: string) {
  return alignSpeechTokens(speechWords(expected), speechWords(actual));
}

export function alignSpeechTokens(reference: string[], recognized: string[]) {
  const rows = Array.from({ length: reference.length + 1 }, () => new Uint32Array(recognized.length + 1));
  for (let col = 0; col <= recognized.length; col++) rows[0]![col] = col;
  for (let row = 1; row <= reference.length; row++) {
    rows[row]![0] = row;
    for (let col = 1; col <= recognized.length; col++) {
      const mismatch = Number(reference[row - 1] !== recognized[col - 1]);
      rows[row]![col] = Math.min(rows[row - 1]![col]! + 1, rows[row]![col - 1]! + 1, rows[row - 1]![col - 1]! + mismatch);
    }
  }
  const edits: SpeechWordEdit[] = [];
  const counts = { substitutions: 0, insertions: 0, deletions: 0 };
  let row = reference.length;
  let col = recognized.length;
  while (row || col) {
    const match = reference[row - 1] === recognized[col - 1];
    const value = rows[row]![col]!;
    if (row && col && value === rows[row - 1]![col - 1]! + Number(!match)) {
      edits.push({ kind: match ? "match" : "substitution", reference: reference[--row], recognized: recognized[--col] });
      if (!match) counts.substitutions++;
    } else if (row && value === rows[row - 1]![col]! + 1) {
      edits.push({ kind: "deletion", reference: reference[--row] });
      counts.deletions++;
    } else {
      edits.push({ kind: "insertion", recognized: recognized[--col] });
      counts.insertions++;
    }
  }
  return {
    edits: edits.reverse(), ...counts,
    referenceWords: reference.length, recognizedWords: recognized.length,
    wordErrorRate: reference.length ? (counts.substitutions + counts.insertions + counts.deletions) / reference.length : undefined
  };
}
