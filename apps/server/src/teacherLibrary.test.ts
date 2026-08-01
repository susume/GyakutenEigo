import assert from "node:assert/strict";
import test from "node:test";
import {
  canMoveFolder,
  formatReportDisplayName,
  hasDuplicateSiblingName,
  oldestReportsToDelete,
  sanitizeExportFilename
} from "./teacherLibrary.js";

const folders = [
  { id: "root", teacherId: "teacher", name: "Root", createdAt: "", updatedAt: "" },
  { id: "child", teacherId: "teacher", parentId: "root", name: "Child", createdAt: "", updatedAt: "" },
  { id: "grandchild", teacherId: "teacher", parentId: "child", name: "Grandchild", createdAt: "", updatedAt: "" }
];

test("folder moves reject self moves, descendant cycles, and cross-account parents", () => {
  assert.equal(canMoveFolder(folders, folders[0], "root").ok, false);
  assert.equal(canMoveFolder(folders, folders[0], "grandchild").ok, false);
  assert.equal(canMoveFolder(folders, folders[0], "missing").ok, false);
  assert.equal(canMoveFolder(folders, folders[2], undefined).ok, true);
});

test("folder sibling names are deterministic and report names use UTC policy", () => {
  assert.equal(hasDuplicateSiblingName(folders, "teacher", "root", "Child"), true);
  assert.equal(hasDuplicateSiblingName(folders, "other", "root", "Child"), false);
  assert.equal(formatReportDisplayName("2026-08-01T06:30:00.000Z", "Animals", "ABC123"), "2026-08-01:06:30:Animals:ABC123");
});

test("export filenames remove Windows-invalid characters and preserve unicode", () => {
  assert.equal(sanitizeExportFilename("2026:08:01 / 動物?*.csv"), "2026_08_01 _ 動物__.csv");
  assert.equal(sanitizeExportFilename("   ...   "), "quizstrike-report");
});

test("report retention sorts by authoritative creation time then stable id", () => {
  const reports = Array.from({ length: 16 }, (_, index) => ({
    id: String(index).padStart(2, "0"),
    teacherId: "teacher",
    sessionId: String(index),
    sessionCode: String(index),
    quizSetId: "quiz",
    quizSetName: "Quiz",
    displayName: "Report",
    createdAt: index === 0 ? "2026-01-01" : index === 1 ? "2026-01-01" : `2026-01-${String(index + 1).padStart(2, "0")}`
  }));
  assert.deepEqual(oldestReportsToDelete(reports, "teacher").map((report) => report.id), ["00"]);
});
