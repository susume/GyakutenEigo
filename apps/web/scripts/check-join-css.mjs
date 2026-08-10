import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const sourcePath = fileURLToPath(new URL("../src/styles.css", import.meta.url));
const joinPath = fileURLToPath(new URL("../src/styles/join.css", import.meta.url));
const joinClasses = [
  "student-join-screen",
  "student-join-help",
  "student-join-form",
  "student-join-tips",
  "game-join-screen",
  "game-join-form-heading",
  "student-controls-grid",
  "student-control",
  "controls-card-heading",
  "auth-kicker",
  "linked-join-code",
  "join-field-label"
];

const normalize = (value) => `${value.replace(/\r\n/gu, "\n").trimEnd()}\n`;
const keepsJoinSelector = (selector) => joinClasses.some((name) => selector.includes(`.${name}`))
  || selector.includes(":has(.student-join-screen");

const collectJoinRules = (container) => {
  const output = postcss.root();
  for (const node of container.nodes ?? []) {
    if (node.type === "rule") {
      if (keepsJoinSelector(node.selector)) output.append(node.clone());
      continue;
    }
    if (node.type !== "atrule" || !node.nodes) continue;
    const children = collectJoinRules(node);
    if (!children.nodes.length) continue;
    const atRule = node.clone({ nodes: [] });
    atRule.append(children.nodes);
    output.append(atRule);
  }
  return output;
};

const source = normalize(readFileSync(sourcePath, "utf8"));
const output = postcss.root();
output.append(postcss.comment({
  text: "Order-preserving /join subset extracted from styles.css. Keep selector order aligned with the source cascade."
}));
output.append(collectJoinRules(postcss.parse(source)).nodes);
const expected = normalize(output.toString());

if (process.argv.includes("--write")) {
  writeFileSync(joinPath, expected);
  console.log("Updated src/styles/join.css from src/styles.css.");
  process.exit(0);
}

const actual = normalize(readFileSync(joinPath, "utf8"));
if (actual !== expected) {
  console.error("src/styles/join.css is out of sync. Run npm run sync:join-css -w @quizstrike/web.");
  process.exit(1);
}

console.log("Join CSS is synchronized with the source cascade.");
