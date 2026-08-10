import type { StudentPracticeQuestion } from "@quizstrike/shared";
import type { StudentLearningSummary } from "@quizstrike/shared";

export const WORKSHEET_CANVAS_WIDTH = 1240;
export const WORKSHEET_CANVAS_HEIGHT = 1754;

const QUESTION_LINE_HEIGHT = 27;
const OPTION_LINE_HEIGHT = 22;
const QUESTION_BLOCK_GAP = 10;
const COLUMN_GAP = 42;
const PAGE_MARGIN = 68;
const HEADER_BOTTOM = 344;
const FOOTER_Y = WORKSHEET_CANVAS_HEIGHT - PAGE_MARGIN;
const FONT_STACK = '"Noto Sans JP", "BIZ UDPGothic", "Yu Gothic", Meiryo, Arial, sans-serif';

export type WorksheetMeasureText = (text: string) => number;

export interface WorksheetLayoutOptions {
  width: number;
  height: number;
  pageMargin: number;
  headerBottom: number;
  footerY: number;
  columnGap: number;
  questionLineHeight: number;
  optionLineHeight: number;
  blockGap: number;
  measurePrompt: WorksheetMeasureText;
  measureOption: WorksheetMeasureText;
}

export interface WorksheetQuestionLayout {
  question: StudentPracticeQuestion;
  number: number;
  column: 0 | 1;
  x: number;
  y: number;
  width: number;
  height: number;
  promptLines: string[];
  optionLines: Array<{ label: string; lines: string[] }>;
}

export interface WorksheetLayout {
  questions: WorksheetQuestionLayout[];
  omittedQuestions: number;
  columnWidth: number;
}

const isCjkOrKana = (character: string) => /[\u1100-\u11ff\u2e80-\u2fff\u3000-\u30ff\u3130-\u318f\u31a0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7af\uf900-\ufaff]/u.test(character);

const splitLineIntoUnits = (line: string) => {
  const units: string[] = [];
  let token = "";
  let tokenKind: "word" | "space" | undefined;
  const flushToken = () => {
    if (token) units.push(token);
    token = "";
    tokenKind = undefined;
  };
  for (const character of Array.from(line)) {
    if (isCjkOrKana(character)) {
      flushToken();
      units.push(character);
    } else if (/\s/u.test(character)) {
      if (tokenKind !== "space") flushToken();
      tokenKind = "space";
      token += character;
    } else {
      if (tokenKind !== "word") flushToken();
      tokenKind = "word";
      token += character;
    }
  }
  flushToken();
  return units.length > 0 ? units : [""];
};

const splitOversizedUnit = (unit: string, maxWidth: number, measureText: WorksheetMeasureText) => {
  const pieces: string[] = [];
  let current = "";
  for (const character of Array.from(unit)) {
    const candidate = current + character;
    if (current && measureText(candidate) > maxWidth) {
      pieces.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
};

/** Wraps both space-separated text and long Japanese text without clipping. */
export const wrapWorksheetText = (
  value: string,
  maxWidth: number,
  measureText: WorksheetMeasureText
) => {
  const safeWidth = Math.max(1, maxWidth);
  const lines: string[] = [];
  for (const rawLine of String(value ?? "").split(/\r?\n/u)) {
    let current = "";
    for (const unit of splitLineIntoUnits(rawLine)) {
      const candidate = current + unit;
      if (measureText(candidate) <= safeWidth) {
        current = candidate;
        continue;
      }
      if (current.trimEnd()) lines.push(current.trimEnd());
      const trimmedUnit = unit.trimStart();
      if (!trimmedUnit) {
        current = "";
        continue;
      }
      if (measureText(trimmedUnit) <= safeWidth) {
        current = trimmedUnit;
      } else {
        const pieces = splitOversizedUnit(trimmedUnit, safeWidth, measureText);
        lines.push(...pieces.slice(0, -1));
        current = pieces.at(-1) ?? "";
      }
    }
    lines.push(current.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
};

const getQuestionOptions = (question: StudentPracticeQuestion) => [
  ["A", question.choiceA],
  ["B", question.choiceB],
  ["C", question.choiceC],
  ["D", question.choiceD]
] as const;

const defaultMeasure = (fontSize: number): WorksheetMeasureText => (text) => text.length * fontSize * 0.58;

export const createDefaultWorksheetLayoutOptions = (): WorksheetLayoutOptions => ({
  width: WORKSHEET_CANVAS_WIDTH,
  height: WORKSHEET_CANVAS_HEIGHT,
  pageMargin: PAGE_MARGIN,
  headerBottom: HEADER_BOTTOM,
  footerY: FOOTER_Y,
  columnGap: COLUMN_GAP,
  questionLineHeight: QUESTION_LINE_HEIGHT,
  optionLineHeight: OPTION_LINE_HEIGHT,
  blockGap: QUESTION_BLOCK_GAP,
  measurePrompt: defaultMeasure(23),
  measureOption: defaultMeasure(19)
});

/** Packs complete question blocks into two columns and drops anything that cannot fit. */
export const layoutWorksheetQuestions = (
  questions: readonly StudentPracticeQuestion[],
  options: WorksheetLayoutOptions = createDefaultWorksheetLayoutOptions()
): WorksheetLayout => {
  const contentWidth = Math.max(1, options.width - options.pageMargin * 2);
  const columnWidth = Math.max(1, (contentWidth - options.columnGap) / 2);
  const placed: WorksheetQuestionLayout[] = [];
  let column: 0 | 1 = 0;
  let y = options.headerBottom;
  let omittedQuestions = 0;

  for (const question of questions) {
    const promptLines = wrapWorksheetText(`${placed.length + 1}. ${question.prompt}`, columnWidth, options.measurePrompt);
    const optionLines = getQuestionOptions(question).map(([label, text]) => ({
      label,
      lines: wrapWorksheetText(`${label}. ${text}`, columnWidth, options.measureOption)
    }));
    const height = promptLines.length * options.questionLineHeight
      + 8
      + optionLines.reduce((total, option) => total + option.lines.length * options.optionLineHeight, 0)
      + 12
      + options.optionLineHeight
      + options.blockGap;

    if (height > options.footerY - options.headerBottom) {
      omittedQuestions += 1;
      continue;
    }
    if (y + height > options.footerY) {
      if (column === 0) {
        column = 1;
        y = options.headerBottom;
      } else {
        omittedQuestions += 1;
        continue;
      }
    }

    placed.push({
      question,
      number: placed.length + 1,
      column,
      x: options.pageMargin + column * (columnWidth + options.columnGap),
      y,
      width: columnWidth,
      height,
      promptLines,
      optionLines
    });
    y += height;
  }

  return { questions: placed, omittedQuestions, columnWidth };
};

export interface PracticeWorksheetPdfInput {
  studentName: string;
  setName: string;
  summary: StudentLearningSummary;
  practiceQuestions: readonly StudentPracticeQuestion[];
  generatedAt?: Date;
}

const setCanvasFont = (context: CanvasRenderingContext2D, size: number, weight = 400) => {
  context.font = `${weight} ${size}px ${FONT_STACK}`;
};

const fitCanvasText = (context: CanvasRenderingContext2D, value: string, maxWidth: number) => {
  const normalized = String(value ?? "").replace(/\s+/gu, " ").trim();
  const characters = Array.from(normalized);
  while (characters.length > 1 && context.measureText(`${characters.join("")}...`).width > maxWidth) characters.pop();
  const output = characters.join("");
  return output === normalized ? output : `${output}...`;
};

const drawRule = (context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#b6bec7", width = 2) => {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
};

const drawLines = (context: CanvasRenderingContext2D, lines: readonly string[], x: number, y: number, lineHeight: number) => {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
};

const buildPdfFromJpeg = (jpegBytes: Uint8Array, width: number, height: number) => {
  const encoder = new TextEncoder();
  const header = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 255, 255, 255, 255, 10]);
  const objects = [
    encoder.encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    encoder.encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    encoder.encode("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"),
    (() => {
      const prefix = encoder.encode(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`);
      const suffix = encoder.encode("\nendstream\nendobj\n");
      const output = new Uint8Array(prefix.byteLength + jpegBytes.byteLength + suffix.byteLength);
      output.set(prefix);
      output.set(jpegBytes, prefix.byteLength);
      output.set(suffix, prefix.byteLength + jpegBytes.byteLength);
      return output;
    })(),
    (() => {
      const content = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
      return encoder.encode(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
    })()
  ];
  const chunks: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let offset = header.byteLength;
  for (const object of objects) {
    offsets.push(offset);
    chunks.push(object);
    offset += object.byteLength;
  }
  const xrefOffset = offset;
  const xref = encoder.encode([
    "xref",
    "0 6",
    "0000000000 65535 f ",
    ...offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n `),
    "trailer",
    "<< /Size 6 /Root 1 0 R >>",
    "startxref",
    String(xrefOffset),
    "%%EOF",
    ""
  ].join("\n"));
  chunks.push(xref);
  const totalLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const pdf = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return pdf;
};

const decodeDataUrl = (dataUrl: string) => {
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

/**
 * Produces a monochrome-friendly single-page A4 PDF. Text is rasterized by the
 * browser so installed Japanese fonts work without shipping a 10 MB font file.
 */
export async function generatePracticeWorksheetPdf({
  studentName,
  setName,
  summary,
  practiceQuestions,
  generatedAt = new Date()
}: PracticeWorksheetPdfInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WORKSHEET_CANVAS_WIDTH;
  canvas.height = WORKSHEET_CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create the practice worksheet.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "alphabetic";
  context.textAlign = "left";

  setCanvasFont(context, 33, 900);
  const title = "QUIZSTRIKE CLASSROOM";
  context.fillStyle = "#101820";
  context.fillText(title, PAGE_MARGIN, 83);
  setCanvasFont(context, 23, 700);
  context.fillStyle = "#4e5b66";
  context.fillText("PRACTICE WORKSHEET", PAGE_MARGIN, 119);
  setCanvasFont(context, 18, 400);
  context.fillStyle = "#626d76";
  context.fillText("A quiet review sheet for your next round", PAGE_MARGIN, 148);
  drawRule(context, PAGE_MARGIN, 174, canvas.width - PAGE_MARGIN, 174, "#101820", 3);

  setCanvasFont(context, 20, 700);
  context.fillStyle = "#101820";
  context.fillText("Name:", PAGE_MARGIN, 211);
  setCanvasFont(context, 20, 400);
  context.fillText(fitCanvasText(context, studentName || "________________", 310), PAGE_MARGIN + 76, 211);
  drawRule(context, PAGE_MARGIN + 76, 218, PAGE_MARGIN + 372, 218, "#7e8992", 1.5);
  context.fillText("Date:", PAGE_MARGIN + 418, 211);
  drawRule(context, PAGE_MARGIN + 490, 218, canvas.width - PAGE_MARGIN, 218, "#7e8992", 1.5);
  context.fillText("Set:", PAGE_MARGIN, 244);
  context.fillText(fitCanvasText(context, setName || "Question set", canvas.width - PAGE_MARGIN * 2 - 70), PAGE_MARGIN + 58, 244);
  drawRule(context, PAGE_MARGIN, 266, canvas.width - PAGE_MARGIN, 266, "#b6bec7", 2);

  setCanvasFont(context, 17, 700);
  context.fillStyle = "#4e5b66";
  const accuracyLabel = summary.accuracy === null ? "-" : `${summary.accuracy}%`;
  context.fillText(`Questions answered: ${summary.totalAttempts}`, PAGE_MARGIN, 295);
  context.fillText(`Accuracy: ${accuracyLabel}`, PAGE_MARGIN + 310, 295);
  context.fillText(`Questions to review: ${summary.questionsToReview}`, PAGE_MARGIN + 555, 295);
  drawRule(context, PAGE_MARGIN, 317, canvas.width - PAGE_MARGIN, 317, "#101820", 3);

  const promptMeasure = (text: string) => {
    setCanvasFont(context, 23, 800);
    return context.measureText(text).width;
  };
  const optionMeasure = (text: string) => {
    setCanvasFont(context, 19, 500);
    return context.measureText(text).width;
  };
  const layout = layoutWorksheetQuestions(practiceQuestions, {
    ...createDefaultWorksheetLayoutOptions(),
    measurePrompt: promptMeasure,
    measureOption: optionMeasure
  });

  drawRule(
    context,
    PAGE_MARGIN + layout.columnWidth + COLUMN_GAP / 2,
    HEADER_BOTTOM,
    PAGE_MARGIN + layout.columnWidth + COLUMN_GAP / 2,
    FOOTER_Y,
    "#d5dbe0",
    1
  );

  if (layout.questions.length === 0) {
    setCanvasFont(context, 24, 700);
    context.fillStyle = "#101820";
    context.fillText("No practice questions are available for this game.", PAGE_MARGIN, HEADER_BOTTOM + 54);
  }

  for (const block of layout.questions) {
    let cursorY = block.y + 22;
    setCanvasFont(context, 23, 800);
    context.fillStyle = "#101820";
    drawLines(context, block.promptLines, block.x, cursorY, QUESTION_LINE_HEIGHT);
    cursorY += block.promptLines.length * QUESTION_LINE_HEIGHT + 7;
    setCanvasFont(context, 19, 500);
    context.fillStyle = "#29343d";
    for (const option of block.optionLines) {
      drawLines(context, option.lines, block.x, cursorY, OPTION_LINE_HEIGHT);
      cursorY += option.lines.length * OPTION_LINE_HEIGHT;
    }
    cursorY += 7;
    setCanvasFont(context, 18, 700);
    context.fillStyle = "#4e5b66";
    context.fillText("Answer:", block.x, cursorY);
    drawRule(context, block.x + 103, cursorY + 4, block.x + block.width, cursorY + 4, "#6d7881", 1.5);
  }

  setCanvasFont(context, 15, 400);
  context.fillStyle = "#6d7881";
  context.fillText(`QuizStrike Classroom - ${generatedAt.toLocaleDateString()}`, PAGE_MARGIN, canvas.height - 28);
  context.textAlign = "right";
  context.fillText("Review, then play again.", canvas.width - PAGE_MARGIN, canvas.height - 28);

  // JPEG keeps the school-printer worksheet compact while the fixed canvas
  // guarantees exactly one A4 portrait page and no second-page overflow.
  const jpegBytes = decodeDataUrl(canvas.toDataURL("image/jpeg", 0.96));
  const pdfBytes = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
  return new Blob([pdfBytes], { type: "application/pdf" });
}
