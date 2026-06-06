export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string | Date | null;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string | Date | null;
}

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

export function escapeXml(value: string | number | boolean): string {
  return String(value).replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function sitemapUrlSet(entries: readonly SitemapUrlEntry[]): string {
  const urls = entries
    .map((entry) => {
      const lastmod = formatDate(entry.lastmod);
      return [
        "  <url>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `${XML_DECLARATION}
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function sitemapIndex(entries: readonly SitemapIndexEntry[]): string {
  const sitemaps = entries
    .map((entry) => {
      const lastmod = formatDate(entry.lastmod);
      return [
        "  <sitemap>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
        "  </sitemap>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `${XML_DECLARATION}
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;
}

export function robotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${origin.replace(/\/$/, "")}/sitemap.xml`,
    "",
  ].join("\n");
}
