import { readFile, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { SpeakingPassageImportSchema, SpeakingPassageInputSchema, speakingPassageKey } from "@quizstrike/shared";

const { values } = parseArgs({ options: {
  source: { type: "string" }, format: { type: "string" }, edition: { type: "string" },
  publisher: { type: "string" }, output: { type: "string" }
} });
const { source, format, edition, publisher, output } = values;
const titles = { "here-we-go": "Here We Go!", "new-horizon": "New Horizon" };
if (!source || !Object.hasOwn(titles, format) || !edition) {
  throw new Error("Supply --source FILE --format here-we-go|new-horizon --edition LABEL. Optional: --publisher LABEL --output PRIVATE_DIRECTORY.");
}
const root = fileURLToPath(new URL("../", import.meta.url));
const target = output ? resolve(output) : undefined;
if (target) {
  const fromRepository = relative(root, target);
  if (fromRepository === "" || (!fromRepository.startsWith("..") && !isAbsolute(fromRepository))) {
    throw new Error("Choose a private output directory outside the repository.");
  }
}

const candidates = new Map();
const review = [];
let grade;
let unit;
let section;
const flush = () => {
  if (!section) return;
  const raw = section;
  section = undefined;
  const text = raw.lines.join("\n").trim();
  if (!text || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) {
    review.push({ ...raw.locator, reason: "empty_or_mixed_language" });
    return;
  }
  const candidate = SpeakingPassageInputSchema.safeParse({
    grade: raw.locator.grade, textbook: titles[format], edition, ...(publisher ? { publisher } : {}),
    unit: raw.locator.unit, part: raw.locator.part, text
  });
  if (!candidate.success) {
    review.push({ ...raw.locator, reason: "invalid_or_too_long" });
    return;
  }
  const key = speakingPassageKey(candidate.data);
  const occurrences = candidates.get(key) ?? [];
  occurrences.push({ passage: candidate.data, locator: raw.locator });
  candidates.set(key, occurrences);
};

const input = (await readFile(source, "utf8")).replace(/^\uFEFF/u, "").split(/\r?\n/u);
for (const [index, raw] of input.entries()) {
  const line = raw.trim();
  const book = format === "here-we-go"
    ? /^本文テキスト\s*[（(]([1-3])年[）)]/u.exec(line)
    : /^Book\s*([1-3])\s+本文データ/iu.exec(line);
  const unitHeader = /^Unit\s*(\d+)\b/iu.exec(line);
  const part = /^(?:Part\s*(\d+)|Read and Think(?:\s+(\d+))?)\s*$/iu.exec(line);
  if (book) { flush(); grade = Number(book[1]); unit = undefined; }
  else if (unitHeader) { flush(); unit = unitHeader[1]; }
  else if (part) {
    flush();
    if (grade && unit !== undefined) {
      const label = part[1] ?? (part[2] ? `Read and Think ${part[2]}` : "Read and Think");
      section = { locator: { grade, unit, part: label, line: index + 1 }, lines: [] };
    } else review.push({ grade, part: line, line: index + 1, reason: "missing_grade_or_unit" });
  } else if (/^(?:【全文】|(?:Stage Activity|Goal|Daily Life|Learning|Real Life English|You Can Do It|Let[’']s Read|Read and Think|Part)\b)/iu.test(line)) {
    flush();
    if (!line.startsWith("【")) unit = undefined;
  } else if (section && !/^\(p\.\s*\d+(?:\s*[-–]\s*\d+)?\)$/iu.test(line)) {
    section.lines.push(line);
  }
}
flush();
const passages = [];
for (const occurrences of candidates.values()) {
  if (occurrences.length === 1) passages.push(occurrences[0].passage);
  else review.push(...occurrences.map(({ locator }) => ({ ...locator, reason: "duplicate_locator" })));
}
const batches = [];
for (let offset = 0; offset < passages.length; offset += 20) {
  batches.push(SpeakingPassageImportSchema.parse({ formatVersion: 1, passages: passages.slice(offset, offset + 20) }));
}
if (target) {
  await mkdir(target, { recursive: true });
  for (const [index, batch] of batches.entries()) {
    await writeFile(resolve(target, `candidate-${index + 1}.json`), JSON.stringify(batch, null, 2), { flag: "wx" });
  }
  await writeFile(resolve(target, "review-locators.json"), JSON.stringify(review, null, 2), { flag: "wx" });
}
console.log(JSON.stringify({ format, candidates: passages.length, flaggedSections: review.length, batches: batches.length, filesWritten: Boolean(target) }));
