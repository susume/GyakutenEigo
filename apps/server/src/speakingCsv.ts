import type { SpeakingEvaluation } from "@quizstrike/shared";

export type SpeakingCsvRow = {
  setNames: string;
  performanceTest: string;
  session: string;
  date: string;
  student: string;
  status: string;
  duration: string;
  overallScore?: number;
  criteria: Array<{ id: string; name: string; score?: number | null }>;
  helpCount: number;
};

const escapeCsv = (value: unknown) => {
  const raw = value === undefined || value === null ? "" : String(value);
  const text = typeof value === "string" && /^[\s]*[=+@-]|^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
};

export const buildSpeakingCsv = (rows: SpeakingCsvRow[]) => {
  const criteria = rows.flatMap((row) => row.criteria).reduce<Array<{ id: string; name: string }>>((all, criterion) => {
    if (!all.some((candidate) => candidate.id === criterion.id)) all.push({ id: criterion.id, name: criterion.name });
    return all;
  }, []);
  const headers = ["Set", "Performance Test", "Session", "Date", "Student", "Status", "Duration", "Overall Score", ...criteria.map((criterion) => criterion.name), "Help Count"];
  const lines = [headers, ...rows.map((row) => [
    row.setNames,
    row.performanceTest,
    row.session,
    row.date,
    row.student,
    row.status,
    row.duration,
    row.overallScore ?? "",
    ...criteria.map((criterion) => row.criteria.find((candidate) => candidate.id === criterion.id)?.score ?? ""),
    row.helpCount
  ])];
  return `\uFEFF${lines.map((line) => line.map(escapeCsv).join(",")).join("\r\n")}\r\n`;
};

export const speakingCsvEvaluationScores = (evaluation: SpeakingEvaluation | undefined) => evaluation?.scores ?? {};
