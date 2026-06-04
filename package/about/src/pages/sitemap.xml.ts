import { ABOUT_LOCALES, ABOUT_PAGES, getCanonicalUrl } from "../i18n/locales";

export function GET(): Response {
  const urls = ABOUT_LOCALES.flatMap((locale) =>
    ABOUT_PAGES.map((page) => getCanonicalUrl(locale, page)),
  );

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>
`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
}
