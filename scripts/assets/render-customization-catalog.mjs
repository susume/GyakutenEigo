import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { HEAD_STYLE_IDS, BACK_ACCESSORY_IDS, FOOTWEAR_IDS, VICTORY_POSE_IDS } from "@quizstrike/shared";

// Run the web dev server first. Portraits come from the exact arena factory.
const baseURL = process.argv[2] ?? "http://127.0.0.1:5173";
const categoryFilter = process.argv[3]?.split(",");
const executablePath = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
  .filter(Boolean).map(root => join(root, "Google/Chrome/Application/chrome.exe"))
  .find(path => existsSync(path));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error" && /shader|THREE|WebGL/.test(message.text())) errors.push(message.text()); });
try {
  for (const [category, ids, field] of [
    ["head", HEAD_STYLE_IDS, "head"], ["back", BACK_ACCESSORY_IDS, "back"],
    ["footwear", FOOTWEAR_IDS, "footwear"], ["victory", VICTORY_POSE_IDS, "pose"]
  ]) {
    if (categoryFilter && !categoryFilter.includes(category)) continue;
    const directory = resolve("apps/web/public/assets/customization-thumbnails", category);
    await mkdir(directory, { recursive: true });
    for (const id of ids) {
      await page.goto(`${baseURL}/character-lab?wardrobe=1&catalogCapture=${category}&${field}=${id}`);
      await page.locator(".character-preview[data-ready=true]").waitFor();
      const data = await page.locator(".character-preview canvas").evaluate(canvas => canvas.toDataURL("image/png"));
      const bytes = Buffer.from(data.split(",")[1], "base64");
      for (let attempt = 0; ; attempt++) {
        try { await writeFile(join(directory, `${id}.png`), bytes); break; }
        catch (error) {
          if (attempt >= 5 || !["EBUSY", "EPERM", "UNKNOWN"].includes(error.code)) throw error;
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      console.log(`${category}/${id}`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally { await browser.close(); }
