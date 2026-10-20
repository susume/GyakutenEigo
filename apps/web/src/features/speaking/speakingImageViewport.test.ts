import assert from "node:assert/strict";
import test from "node:test";
import { speakingImageFitWidth } from "./speakingImageViewport.js";

test("portrait maps and landscape images fit the available viewer without cropping", () => {
  assert.equal(speakingImageFitWidth({ width: 1000, height: 600 }, { width: 700, height: 1000 }), 420);
  assert.equal(speakingImageFitWidth({ width: 360, height: 700 }, { width: 1600, height: 900 }), 360);
  assert.equal(speakingImageFitWidth({ width: 900, height: 600 }, { width: 400, height: 400 }), 600);
});

test("the viewer waits for its viewport and handles unloaded image dimensions", () => {
  assert.equal(speakingImageFitWidth({ width: 0, height: 600 }, { width: 700, height: 1000 }), 0);
  assert.equal(speakingImageFitWidth({ width: 360, height: 0 }, { width: 700, height: 1000 }), 0);
  assert.equal(speakingImageFitWidth({ width: 360, height: 600 }, { width: 0, height: 0 }), 360);
});
