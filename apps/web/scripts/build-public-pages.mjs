import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createServer } from "vite";

// Render the same React routes used in the browser, with Vite resolving their
// TSX, styles, and lazy imports. The host serves the result as static HTML.
const vite = await createServer({
  mode: "production",
  appType: "custom",
  server: { middlewareMode: true, watch: null, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] }
});

try {
  const { appShellHead, publicLanguages, publicPagePath, publicPageUrl, publicRoutes, renderPublicPage, siteOrigin } =
    await vite.ssrLoadModule("/src/seo/renderPublicPage.tsx");
  const output = vite.config.build.outDir;
  const template = await readFile(join(output, "index.html"), "utf8");
  const manifest = JSON.parse(await readFile(join(output, ".vite", "manifest.json"), "utf8"));
  const routeChunks = {
    "/": "ProductHubPage",
    "/speak": "SpeakingPracticeApp",
    "/quiz-strike": "QuizStrikeAppEntry",
    "/about": "AboutPage",
    "/private-lessons": "PrivateLessonsPage"
  };
  const lazyEntries = new Map(manifest["index.html"].dynamicImports.map((key) => [manifest[key].name, key]));

  const writeOutput = async (path, content) => {
    const file = join(output, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  const stylesFor = (entry) => {
    const visited = new Set();
    const styles = new Set();
    const collect = (key) => {
      if (visited.has(key)) return;
      visited.add(key);
      const chunk = manifest[key];
      if (!chunk) throw new Error(`No client build manifest entry for ${key}`);
      for (const dependency of chunk.imports ?? []) collect(dependency);
      for (const css of chunk.css ?? []) styles.add(css);
    };
    collect(entry);
    const base = vite.config.base;
    return [...styles].filter((css) => !template.includes(`href="${base}${css}"`))
      .map((css) => `<link rel="stylesheet" href="${base}${css}" />`).join("\n    ");
  };

  if (!template.includes('<div id="root"></div>')) throw new Error("The HTML template must contain an empty React root.");
  const shell = template.replace("</head>", () => `  ${appShellHead}\n  </head>`);
  await writeOutput("404.html", shell);
  for (const path of ["join", "game", "check", "diagnostics", "speak/join"]) {
    await writeOutput(`${path}/index.html`, shell);
  }

  const urls = [];
  for (const route of publicRoutes) {
    const entry = lazyEntries.get(routeChunks[route]);
    if (!entry) throw new Error(`No client chunk for ${route}`);
    const styles = stylesFor(entry);
    for (const language of publicLanguages) {
      const { title, head, body } = await renderPublicPage({ route, language });
      const path = publicPagePath(route, language);
      const bodyAttributes = route === "/" ? ' data-site="product-hub"'
        : route === "/speak" ? ' data-site="performance" data-speaking="true"' : "";
      const html = template
        .replace('<html lang="en">', `<html lang="${language}">`)
        .replace(/<title>[^<]*<\/title>/u, () => `<title>${title}</title>`)
        .replace("</head>", () => `  ${head}\n    ${styles}\n  </head>`)
        .replace('<body data-theme="gyakuteneigo">', `<body data-theme="gyakuteneigo"${bodyAttributes}>`)
        .replace('<div id="root"></div>', () => `<div id="root" data-prerendered>${body}</div>`);
      await writeOutput(`${path.slice(1)}index.html`, html);
      urls.push(publicPageUrl(route, language));
    }
  }

  // These Japanese pages from the former site have replacements. Retired
  // articles and tools without equivalents still fall through to the 404 page.
  const legacyRedirects = [
    { path: "aboutph.html", route: "/about" },
    { path: "contactme.html", route: "/private-lessons", fragment: "#lesson-contact-title" }
  ];
  for (const { path, route, fragment = "" } of legacyRedirects) {
    const destination = `${publicPagePath(route, "ja")}${fragment}`;
    // GitHub Pages serves static files; an immediate refresh redirects without JavaScript.
    await writeOutput(path, `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ページが移動しました | GyakutenEigo</title>
    <link rel="canonical" href="${publicPageUrl(route, "ja")}" />
    <meta http-equiv="refresh" content="0; url=${destination}" />
  </head>
  <body><p><a href="${destination}">移動先のページを開く</a></p></body>
</html>
`);
  }

  await writeOutput("sitemap.xml", [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${url}</loc></url>`),
    "</urlset>",
    ""
  ].join("\n"));
  await writeOutput("robots.txt", `User-agent: *\nDisallow:\n\nSitemap: ${siteOrigin}/sitemap.xml\n`);
  console.log(`Prerendered ${urls.length} public pages and generated sitemap.xml and robots.txt.`);
} finally {
  await vite.close();
}
