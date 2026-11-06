import { prerender } from "react-dom/static";
import SiteApp from "../SiteApp";
import { renderPageHead } from "./pageHead";
import { publicPageMetadata, publicPagePath, type PublicPage } from "./publicPages";

export { publicLanguages, publicPagePath, publicPageUrl, publicRoutes, siteOrigin } from "./publicPages";

export async function renderPublicPage(page: PublicPage) {
  const { route, language } = page;
  const { prelude } = await prerender(
    <SiteApp initialPath={publicPagePath(route, language)} initialLanguage={language} />,
    // Deliver completed Suspense boundaries inline so the page is visible before hydration.
    { progressiveChunkSize: Number.MAX_SAFE_INTEGER }
  );
  const body = await new Response(prelude).text();
  if (body.includes("<!--$?-->") || body.includes("<!--$!-->")) {
    throw new Error(`Prerender left a loading boundary on ${publicPagePath(route, language)}`);
  }
  return {
    body,
    head: renderPageHead(page),
    title: publicPageMetadata(page).title
  };
}

export const appShellHead = renderPageHead();
