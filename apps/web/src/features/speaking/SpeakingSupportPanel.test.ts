import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpeakingContextPanel } from "./SpeakingSupportPanel.js";

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
