import type { QuizFolder, ReportMetadata } from "@quizstrike/shared";

export const MAX_SAVED_REPORTS = 15;
export const MAX_FOLDER_NAME_LENGTH = 80;
export const MAX_EXPORT_FILENAME_LENGTH = 180;

export const normalizeFolderName = (value: unknown) => {
  const name = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name) return { ok: false as const, error: "Folder name is required." };
  if (name.length > MAX_FOLDER_NAME_LENGTH) return { ok: false as const, error: `Folder names must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer.` };
  if (/[\\/]/.test(name)) return { ok: false as const, error: "Folder names cannot contain slashes." };
  return { ok: true as const, name };
};

export const hasDuplicateSiblingName = (
  folders: Iterable<QuizFolder>,
  teacherId: string,
  parentId: string | undefined,
  name: string,
  exceptId?: string
) => [...folders].some((folder) =>
  folder.teacherId === teacherId
  && folder.id !== exceptId
  && folder.parentId === parentId
  && folder.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0
);

export const isFolderDescendant = (
  folders: Iterable<QuizFolder>,
  folderId: string,
  possibleAncestorId: string
) => {
  const byId = new Map([...folders].map((folder) => [folder.id, folder]));
  let current = byId.get(folderId);
  const visited = new Set<string>();
  while (current?.parentId) {
    if (visited.has(current.id)) return true;
    visited.add(current.id);
    if (current.parentId === possibleAncestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
};

export const canMoveFolder = (
  folders: Iterable<QuizFolder>,
  folder: QuizFolder,
  parentId: string | undefined
) => {
  if (parentId === folder.id) return { ok: false as const, error: "A folder cannot be moved inside itself." };
  const targetParent = parentId ? [...folders].find((candidate) => candidate.id === parentId) : undefined;
  if (parentId && (!targetParent || targetParent.teacherId !== folder.teacherId)) {
    return { ok: false as const, error: "The destination folder is not available." };
  }
  if (parentId && isFolderDescendant(folders, parentId, folder.id)) {
    return { ok: false as const, error: "A folder cannot be moved into one of its descendants." };
  }
  return { ok: true as const };
};

export const formatReportDisplayName = (
  createdAt: string,
  quizSetName: string,
  sessionCode: string,
  timeZone = "UTC"
) => {
  const date = new Date(createdAt);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const datePart = `${values.year}-${values.month}-${values.day}`;
  const timePart = `${values.hour}:${values.minute}`;
  return `${datePart}:${timePart}:${quizSetName.trim() || "Quiz Set"}:${sessionCode.trim()}`;
};

export const sanitizeExportFilename = (value: string) => {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, MAX_EXPORT_FILENAME_LENGTH)
    .replace(/[. ]+$/g, "");
  return sanitized || "quizstrike-report";
};

export const oldestReportsToDelete = (
  reports: readonly ReportMetadata[],
  teacherId: string,
  keep = MAX_SAVED_REPORTS
) => [...reports]
  .filter((report) => report.teacherId === teacherId)
  .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
  .slice(0, Math.max(0, reports.filter((report) => report.teacherId === teacherId).length - keep));
