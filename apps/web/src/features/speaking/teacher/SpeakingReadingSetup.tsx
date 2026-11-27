import { useEffect, useState } from "react";
import {
  defaultSpeakingReadingRubric, speakingReadingCriteria, SpeakingReadingRubricSchema, SpeakingPassageImportSchema,
  type SpeakingPassage, type SpeakingReadingRubric
} from "@quizstrike/shared";
import { speakingApi } from "../../../api/client";
import { useSiteTranslation } from "../../../ui/siteTranslation";
import ReadingPassagePicker, { emptyReadingSelection } from "../ReadingPassagePicker";
import sampleCatalog from "../../../../../../docs/examples/speakcheck-read-aloud.original.json";

export default function SpeakingReadingSetup({ onChange, disabled }: {
  onChange: (selection: { passageId: string; rubric: SpeakingReadingRubric } | undefined) => void;
  disabled: boolean;
}) {
  const { language } = useSiteTranslation();
  const ja = language === "ja";
  const [passages, setPassages] = useState<SpeakingPassage[]>([]);
  const [selection, setSelection] = useState(emptyReadingSelection);
  const [rubric, setRubric] = useState(defaultSpeakingReadingRubric);
  const [json, setJson] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof SpeakingPassageImportSchema.parse>>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void speakingApi.passages(controller.signal).then((result) => setPassages(result.passages))
      .catch(() => { if (!controller.signal.aborted) setError("Passage catalog could not be opened. / 英文一覧を開けませんでした。"); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    onChange(selection.passageId && SpeakingReadingRubricSchema.safeParse(rubric).success ? { passageId: selection.passageId, rubric } : undefined);
  }, [onChange, rubric, selection.passageId]);

  const check = (input: string) => {
    setJson(input);
    setPreview(undefined);
    setMessage("");
    setError("");
    setAuthorized(false);
    try {
      const parsed = SpeakingPassageImportSchema.safeParse(JSON.parse(input));
      if (parsed.success) setPreview(parsed.data);
      else setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
    } catch { setError(ja ? "有効な JSON ファイルを選ぶか、貼り付けてください。" : "Choose or paste a valid JSON file."); }
  };
  const save = async () => {
    if (!preview || !authorized) return;
    setBusy(true);
    setError("");
    try {
      const result = await speakingApi.importPassages(preview, authorized);
      setPassages(result.passages);
      setSelection(emptyReadingSelection);
      setPreview(undefined);
      setJson("");
      setAuthorized(false);
      setMessage(ja ? "英文を登録しました。" : "Passages saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Passage import failed. / 英文を登録できませんでした。");
    } finally { setBusy(false); }
  };
  const selected = passages.find((item) => item.id === selection.passageId);

  return <fieldset disabled={busy || disabled} className="speaking-reading-card">
    <legend>{ja ? "音読チェックの課題" : "Read Aloud assignment"}</legend>
    <details open={!passages.length || undefined}>
      <summary>{ja ? "英文を登録する" : "Import passages"}</summary>
      <p>{ja ? "英文の共有許可を確認し、見出しと本文をプレビューしてください。" : "Preview the metadata and reference text. Import passages you have permission to share with your class."}</p>
      <label>{ja ? "JSON ファイル" : "JSON file"}
        <input type="file" accept=".json,application/json" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 500_000) { setPreview(undefined); setError(ja ? "ファイルは500 KB以下にしてください。" : "Choose a JSON file up to 500 KB."); return; }
          try { check(await file.text()); } catch { setError(ja ? "ファイルを開けませんでした。" : "Could not open the file."); }
        }} />
      </label>
      <label>{ja ? "JSON を貼り付ける" : "Paste JSON"}<textarea rows={4} maxLength={500_000} value={json}
        onChange={(event) => { setJson(event.target.value); setPreview(undefined); setAuthorized(false); setError(""); }} /></label>
      <div className="speaking-reading-actions">
        <button type="button" className="speaking-outline-button" onClick={() => check(json)}>{ja ? "インポートを確認" : "Preview import"}</button>
        <button type="button" className="speaking-outline-button" onClick={() => check(JSON.stringify(sampleCatalog, null, 2))}>{ja ? "オリジナル例文を使う" : "Load original sample catalog"}</button>
      </div>
      {preview && <>
        <ol>{preview.passages.map((passage, index) => <li key={index}><details><summary>
          {passage.grade} · {passage.textbook} · {passage.edition} · Unit {passage.unit} · Part {passage.part} {passage.title}
        </summary><p lang="en" className="speaking-reading-passage">{passage.text}</p></details></li>)}</ol>
        <label>{ja ? "この英文をクラスと共有する許可があります。" : "I have permission to share these passages with my class."}
          <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
        </label>
        <button type="button" className="speaking-primary-button" disabled={!authorized} onClick={() => void save()}>{ja ? "英文を登録" : "Import validated passages"}</button>
      </>}
    </details>
    {error && <p className="speaking-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <ReadingPassagePicker passages={passages} selection={selection} setSelection={setSelection} />
    {selected && <details><summary>{ja ? "課題の英文を確認" : "Confirm selected passage"} · v{selected.version}</summary>
      <p className="speaking-reading-passage" lang="en">{selected.text}</p>
    </details>}
    <details><summary>{ja ? "評価の配点を変更" : "Edit reading rubric weights"}</summary>
      {rubric.map(({ id, weight }) => <label key={id}>{speakingReadingCriteria[id][language]}
        <input type="number" min={0} max={100} value={weight} onChange={(event) => setRubric(rubric.map((item) =>
          item.id === id ? { ...item, weight: Number(event.target.value) } : item))} />
      </label>)}
      <p>{ja ? "合計を100にしてください。0は評価対象外です。" : "Weights must total 100. A weight of 0 disables the criterion."}</p>
    </details>
  </fieldset>;
}
