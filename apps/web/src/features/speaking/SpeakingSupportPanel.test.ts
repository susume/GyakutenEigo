import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpeakingContextPanel, SpeakingSupportPanel, getSpeakingSupportTabs } from "./SpeakingSupportPanel.js";
import { SPEAKING_TEMPLATES } from "./speakingData.js";

test("valid student context renders the accessible image without visible context copy", () => {
  const markup = renderToStaticMarkup(createElement(SpeakingContextPanel, {
    context: {
      title: "Neighborhood route",
      description: "Use the local map to give a visitor clear steps from the station to a destination.",
      imageUrl: "/assets/speaking/context-library-map.webp",
      alt: "Illustrated neighborhood map from the station to the library",
      type: "map"
    }
  }));

  assert.doesNotMatch(markup, /Neighborhood route/u);
  assert.doesNotMatch(markup, /Use the local map to give a visitor/u);
  assert.match(markup, /src="\/assets\/speaking\/context-library-map\.webp"/u);
  assert.match(markup, /alt="Illustrated neighborhood map from the station to the library"/u);
  assert.match(markup, /context-type-map/u);
});

test("student context keeps the missing-context empty state", () => {
  const markup = renderToStaticMarkup(createElement(SpeakingContextPanel, {}));

  assert.match(markup, /No context available for this activity\./u);
  assert.match(markup, /The speaking conversation is still ready whenever you are\./u);
});

test("student context keeps the missing-image empty state", () => {
  const markup = renderToStaticMarkup(createElement(SpeakingContextPanel, {
    context: {
      title: "Neighborhood route",
      description: "Use the local map to give a visitor clear steps from the station to a destination.",
      alt: "Illustrated neighborhood map from the station to the library",
      type: "map"
    }
  }));

  assert.match(markup, /No context image available for this activity\./u);
});

test("support tabs follow the teacher's launch-time settings", () => {
  const activity = {
    ...SPEAKING_TEMPLATES[0]!,
    targetExpressions: ["Could you help me?"],
    context: { title: "Map", imageUrl: "/map.webp", type: "map" as const },
    supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: false, allowReplay: false, allowHelp: false }
  };
  assert.deepEqual(getSpeakingSupportTabs(activity), [
    { id: "useful-english", label: "Useful English" },
    { id: "context", label: "Context" }
  ]);
  assert.deepEqual(getSpeakingSupportTabs({ ...activity, supportSettings: { showTargetExpressions: false, showContext: true } }), [
    { id: "context", label: "Context" }
  ]);
  assert.deepEqual(getSpeakingSupportTabs({ ...activity, supportSettings: { showTargetExpressions: false, showContext: false } }), []);
  const markup = renderToStaticMarkup(createElement(SpeakingSupportPanel, {
    activity: { ...activity, supportSettings: { showTargetExpressions: false, showContext: false } },
    activeTab: "useful-english",
    onTabChange: () => undefined,
    onClose: () => undefined
  }));
  assert.equal(markup, "");
});
