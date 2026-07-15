import test from "node:test";
import assert from "node:assert/strict";
import { resolveClientOrigins } from "./origins.js";

test("production origins include every supported hosted entry point", () => {
  assert.deepEqual(
    resolveClientOrigins({ configuredOrigins: "https://school.example/", isProduction: true }),
    [
      "https://school.example",
      "https://gyakuteneigo.com",
      "https://www.gyakuteneigo.com",
      "https://susume.github.io"
    ]
  );
});

test("local origin configuration stays explicit and removes duplicates", () => {
  assert.deepEqual(
    resolveClientOrigins({
      configuredOrigins: "http://localhost:5173/, http://localhost:5173",
      isProduction: false
    }),
    ["http://localhost:5173"]
  );
});
