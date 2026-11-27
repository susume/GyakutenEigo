import { readFile } from "node:fs/promises";

const inputFile = process.argv[2];
if (!inputFile) throw new Error("Supply a local JSON file containing de-identified paired assessments.");
const rows = JSON.parse(await readFile(inputFile, "utf8"));
const level = (value) => value === null || Number.isInteger(value) && value >= 0 && value <= 4;
if (!Array.isArray(rows) || !rows.length || rows.some((row) => !row || typeof row !== "object" ||
  typeof row.criterion !== "string" || !/^[a-z][a-z0-9_]{0,63}$/u.test(row.criterion) || !level(row.provisional) || !level(row.teacher) ||
  Object.keys(row).some((key) => !["criterion", "provisional", "teacher"].includes(key)))) {
  throw new Error("Use an array of {criterion, provisional, teacher} rows. Each score is 0–4 or null. Omit names, IDs and comments.");
}
const ratio = (number, denominator) => denominator ? number / denominator : null;
const summarize = (pairs) => {
  const comparable = pairs.filter((pair) => pair.provisional !== null && pair.teacher !== null);
  const rowMargins = Array(5).fill(0), columnMargins = Array(5).fill(0);
  let exact = 0, withinOne = 0, absolute = 0, over = 0, under = 0, weightedDifference = 0;
  for (const { provisional, teacher } of comparable) {
    rowMargins[provisional]++;
    columnMargins[teacher]++;
    const delta = provisional - teacher;
    exact += Number(delta === 0);
    withinOne += Number(Math.abs(delta) <= 1);
    absolute += Math.abs(delta);
    over += Number(delta > 0);
    under += Number(delta < 0);
    weightedDifference += delta ** 2;
  }
  const n = comparable.length;
  let expected = 0;
  for (let index = 0; index < 5; index++) {
    for (let column = 0; column < 5; column++) expected += rowMargins[index] * columnMargins[column] * (index - column) ** 2;
  }
  return {
    records: pairs.length, comparable: n, provisionalNA: pairs.length - pairs.filter((item) => item.provisional !== null).length,
    teacherNA: pairs.length - pairs.filter((item) => item.teacher !== null).length, exactAgreement: ratio(exact, n),
    withinOneAgreement: ratio(withinOne, n), meanAbsoluteDifference: ratio(absolute, n),
    overrides: n - exact, overScored: over, underScored: under,
    quadraticWeightedKappa: expected ? 1 - weightedDifference * n / expected : null,
    provisionalCountsByLevel: rowMargins, teacherCountsByLevel: columnMargins
  };
};
const criteria = [...new Set(rows.map((row) => row.criterion))].sort();
console.log(JSON.stringify(Object.fromEntries(criteria.map((criterion) => [criterion, summarize(rows.filter((row) => row.criterion === criterion))])), null, 2));
