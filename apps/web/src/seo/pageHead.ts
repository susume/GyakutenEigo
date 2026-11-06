import {
  publicLanguages,
  publicPageMetadata,
  publicPageUrl,
  siteName,
  siteOrigin,
  type PublicPage
} from "./publicPages";

const entities = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: `${siteOrigin}/`
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderPageHead(page?: PublicPage): string {
  if (!page) return '<meta data-page-seo name="robots" content="noindex" />';

  const { route, language } = page;
  const { title, description, image } = publicPageMetadata(page);
  const url = publicPageUrl(route, language);
  const meta = (name: string, content: string) => `<meta data-page-seo name="${name}" content="${escapeHtml(content)}" />`;
  const openGraph = (name: string, content: string) => `<meta data-page-seo property="og:${name}" content="${escapeHtml(content)}" />`;
  const alternate = (hreflang: string, href: string) => `<link data-page-seo rel="alternate" hreflang="${hreflang}" href="${href}" />`;

  return [
    meta("description", description),
    `<link data-page-seo rel="canonical" href="${url}" />`,
    ...publicLanguages.map((locale) => alternate(locale, publicPageUrl(route, locale))),
    alternate("x-default", publicPageUrl(route, "en")),
    openGraph("type", "website"),
    openGraph("site_name", siteName),
    openGraph("title", title),
    openGraph("description", description),
    openGraph("url", url),
    openGraph("image", image),
    openGraph("locale", language === "ja" ? "ja_JP" : "en_GB"),
    ...(route === "/" && language === "en"
      ? [`<script data-page-seo type="application/ld+json">${JSON.stringify(entities).replaceAll("<", "\\u003c")}</script>`]
      : [])
  ].join("\n    ");
}
