import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { translateSiteText } from "./siteTranslation.js";
import { SiteLanguageProvider } from "./SiteLanguageProvider.js";
import SiteLanguagePicker from "./SiteLanguagePicker.js";
import { SpeakingSupportPanel } from "../features/speaking/SpeakingSupportPanel.js";
import { coreFallbackActivities } from "../features/speaking/teacher/speakingLibrary.js";
import { speakingSupportSummary } from "../features/speaking/speakingCopy.js";

const catalog: Record<string, string> = JSON.parse(readFileSync(new URL("./locales/ja.json", import.meta.url), "utf8"));
const uiRoot = dirname(fileURLToPath(import.meta.url));
(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("interface messages interpolate values without translating user text or codes", () => {
  assert.equal(translateSiteText("en", "Completed {value0}", { value0: "Today" }), "Completed Today");
  assert.equal(translateSiteText("ja", "Completed {value0}", { value0: "AB12CD" }), "終了：AB12CD");
  assert.equal(translateSiteText("ja", "Completed AB12CD"), "終了：AB12CD");
  assert.equal(translateSiteText("ja", "My own classroom question"), "My own classroom question");
  assert.equal(translateSiteText("ja", "Join"), "参加");
  assert.equal(translateSiteText("ja", "{value0}"), "{value0}");
  assert.equal(translateSiteText("ja", undefined), "");
});

test("Japanese translations keep the source message's placeholders valid", () => {
  for (const [source, translation] of Object.entries(catalog)) {
    assert.ok(translation.trim(), `Empty translation: ${source}`);
    for (const [placeholder] of translation.matchAll(/\{\w+\}/gu)) {
      assert.ok(source.includes(placeholder), `Unexpected ${placeholder} in ${source}`);
    }
  }
});

test("static interface messages have a Japanese translation", () => {
  const supported = new Set(Object.keys(catalog).map((key) => key.trim().toLowerCase()));
  const identityCopy = new Set([
    "environment - 環境\ngovernment - 政府\nincrease - 増加する",
    "What does “environment” mean?", "Asia/Tokyo", "/join", "/speak/join"
  ]);
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
  const missing = new Set<string>();
  for (const path of files(resolve(uiRoot, ".."))) {
    const tree = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const check = (key: string) => {
      const purelyFormatted = !/[a-zA-Z]/u.test(key.replace(/\{\w+\}/gu, ""));
      if (!purelyFormatted && !identityCopy.has(key) && !supported.has(key.trim().toLowerCase())) missing.add(key);
    };
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === "t" && node.arguments[0]) {
        const visitLiteral = (value: ts.Node): void => {
          if (ts.isStringLiteral(value)) check(value.text);
          else if (ts.isConditionalExpression(value)) { visitLiteral(value.whenTrue); visitLiteral(value.whenFalse); }
        };
        visitLiteral(node.arguments[0]);
      }
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "SiteText") {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && attr.name.getText(tree) === "text" && attr.initializer && ts.isStringLiteral(attr.initializer)) check(attr.initializer.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.deepEqual([...missing], []);
});

test("language options keep stable values and recognizable names", () => {
  const markup = renderToStaticMarkup(createElement(SiteLanguageProvider, {
    initialLanguage: "ja", children: createElement(SiteLanguagePicker)
  }));
  assert.match(markup, /value="en">English/u);
  assert.match(markup, /value="ja" selected="">日本語/u);
  assert.match(markup, /aria-label="Language \/ 言語"/u);
});

test("Japanese speaking support translates the interface while retaining English practice content", () => {
  const activity = coreFallbackActivities().find((item) => item.id === "workplace-restaurant-dietary-questions")!;
  const markup = renderToStaticMarkup(createElement(SiteLanguageProvider, {
    initialLanguage: "ja", children: createElement(SpeakingSupportPanel, {
      activity, activeTab: "useful-english", onTabChange: () => undefined, onClose: () => undefined
    })
  }));
  assert.match(markup, /使える英語/u);
  assert.match(markup, /cross-contact/u);
  assert.doesNotMatch(markup, />Useful English</u);
  const reference = coreFallbackActivities().find((item) => item.id === "workplace-luxury-car-explain-vehicle")!;
  const referenceMarkup = renderToStaticMarkup(createElement(SiteLanguageProvider, {
    initialLanguage: "ja", children: createElement(SpeakingSupportPanel, {
      activity: reference, activeTab: "context", onTabChange: () => undefined, onClose: () => undefined
    })
  }));
  assert.match(referenceMarkup, /lang="en"/u);
  assert.match(referenceMarkup, /Brake-pad replacement date/u);
  assert.match(referenceMarkup, /18,500 km/u);
});

test("support summaries translate each configured setting independently", () => {
  const summary = speakingSupportSummary({ mode: "assessment", supportSettings: {
    showTargetExpressions: true, showContext: true, showTranscript: false, allowReplay: false, allowHelp: false
  } }, (message) => translateSiteText("ja", message));
  assert.equal(summary, "目標表現：有効 · 資料：有効 · 会話記録：無効 · 再生：無効 · ヘルプ：無効");
});
