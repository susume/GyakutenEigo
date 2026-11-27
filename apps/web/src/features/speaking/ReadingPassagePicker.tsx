import { useId } from "react";
import { type SpeakingPassage } from "@quizstrike/shared";
import { useSiteTranslation } from "../../ui/siteTranslation";

const bookKey = (passage: SpeakingPassage) => JSON.stringify([passage.textbook, passage.publisher ?? "", passage.edition]);
const bookLabel = (passage: SpeakingPassage) => [passage.textbook, passage.publisher, passage.edition].filter(Boolean).join(" · ");

export type ReadingPassageSelection = { grade: string; textbook: string; unit: string; passageId: string };
export const emptyReadingSelection: ReadingPassageSelection = { grade: "", textbook: "", unit: "", passageId: "" };

export default function ReadingPassagePicker({ passages, selection, setSelection }: {
  passages: SpeakingPassage[];
  selection: ReadingPassageSelection;
  setSelection: (selection: ReadingPassageSelection) => void;
}) {
  const { language } = useSiteTranslation();
  const ja = language === "ja";
  const id = useId();
  const grades = [...new Set(passages.map(({ grade }) => grade))].sort((a, b) => a - b);
  const inGrade = passages.filter(({ grade }) => String(grade) === selection.grade);
  const books = [...new Map(inGrade.map((item) => [bookKey(item), bookLabel(item)])).entries()];
  const inBook = inGrade.filter((item) => bookKey(item) === selection.textbook);
  const units = [...new Set(inBook.map(({ unit }) => unit))];
  const inUnit = inBook.filter(({ unit }) => unit === selection.unit);
  const placeholder = ja ? "選択してください" : "Choose…";
  return <div className="speaking-reading-selectors">
    <label htmlFor={id + "-grade"}>{ja ? "学年" : "Grade"}
      <select id={id + "-grade"} value={selection.grade} onChange={(event) => setSelection({ ...emptyReadingSelection, grade: event.target.value })}>
        <option value="">{placeholder}</option>{grades.map((grade) => <option key={grade}>{grade}</option>)}
      </select>
    </label>
    <label htmlFor={id + "-book"}>{ja ? "教科書" : "Textbook"}
      <select id={id + "-book"} value={selection.textbook} disabled={!inGrade.length} onChange={(event) => setSelection({ ...selection, textbook: event.target.value, unit: "", passageId: "" })}>
        <option value="">{placeholder}</option>{books.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
    </label>
    <label htmlFor={id + "-unit"}>Unit
      <select id={id + "-unit"} value={selection.unit} disabled={!units.length} onChange={(event) => setSelection({ ...selection, unit: event.target.value, passageId: "" })}>
        <option value="">{placeholder}</option>{units.map((unit) => <option key={unit}>{unit}</option>)}
      </select>
    </label>
    <label htmlFor={id + "-part"}>Part
      <select id={id + "-part"} value={selection.passageId} disabled={!inUnit.length} onChange={(event) => setSelection({ ...selection, passageId: event.target.value })}>
        <option value="">{placeholder}</option>{inUnit.map((item) => <option key={item.id} value={item.id}>{item.part}{item.title ? ` · ${item.title}` : ""}</option>)}
      </select>
    </label>
  </div>;
}
