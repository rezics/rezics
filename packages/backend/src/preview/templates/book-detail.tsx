/** @jsxImportSource @kitajs/html */
import { Html } from "@kitajs/html";
import { type BookDTO, contentDocMarkdownFallback } from "@rezics/contract";
import { getBookShareStyles } from "../utils/shareStyles";

export interface BookDetailTemplateProps {
  book: BookDTO;
  canonicalUrl: string;
  origin: string;
}

function toAbsoluteUrl(
  url: string | undefined,
  origin: string,
): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).toString();
  } catch {
    try {
      return new URL(url, origin).toString();
    } catch {
      return undefined;
    }
  }
}

function clampDescription(desc: string, maxLen = 140): string {
  const s = desc.replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}...`;
}

function pickTranslation(book: BookDTO) {
  const translations = book.translations ?? [];
  if (!translations.length) return undefined;
  return (
    translations.find((t) => t.language === book.defaultLanguage) ??
    translations[0]
  );
}

export function BookDetailTemplate({
  book,
  canonicalUrl,
  origin,
}: BookDetailTemplateProps) {
  const translation = pickTranslation(book);
  const title = translation?.title || "Book";
  const description = clampDescription(
    contentDocMarkdownFallback(translation?.description) ||
      translation?.summary ||
      "Open to view details.",
    160,
  );
  const imageUrl = toAbsoluteUrl(book.coverUrl ?? undefined, origin);
  const safeStyles = getBookShareStyles() as "safe";
  const safeTitle = Html.escapeHtml(title) as "safe";
  const safeDescription = Html.escapeHtml(description) as "safe";
  const safeCanonicalUrl = Html.escapeHtml(canonicalUrl) as "safe";
  const safeImageUrl = imageUrl ? (Html.escapeHtml(imageUrl) as "safe") : null;
  const safeBookUnitId = Html.escapeHtml(book.unitId) as "safe";

  return (
    <html lang="zh-Hant">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{safeTitle}</title>

        <link rel="canonical" href={safeCanonicalUrl} />
        <meta name="description" content={safeDescription} />

        <meta property="og:type" content="article" />
        <meta property="og:title" content={safeTitle} />
        <meta property="og:description" content={safeDescription} />
        <meta property="og:url" content={safeCanonicalUrl} />
        {safeImageUrl ? (
          <meta property="og:image" content={safeImageUrl} />
        ) : null}

        <meta
          name="twitter:card"
          content={safeImageUrl ? "summary_large_image" : "summary"}
        />
        <meta name="twitter:title" content={safeTitle} />
        <meta name="twitter:description" content={safeDescription} />
        {safeImageUrl ? (
          <meta name="twitter:image" content={safeImageUrl} />
        ) : null}

        <style>{safeStyles}</style>
      </head>
      <body>
        <main class="wrap">
          <article class="card">
            {safeImageUrl ? (
              <div class="media">
                <img src={safeImageUrl} alt={safeTitle} />
              </div>
            ) : null}
            <div class="content">
              <h1>{safeTitle}</h1>
              <p>{safeDescription}</p>
              <dl class="meta">
                <div>
                  <dt>unitId</dt>
                  <dd>{safeBookUnitId}</dd>
                </div>
                <div>
                  <dt>canonical</dt>
                  <dd>{safeCanonicalUrl}</dd>
                </div>
              </dl>
            </div>
          </article>
        </main>
      </body>
    </html>
  );
}
