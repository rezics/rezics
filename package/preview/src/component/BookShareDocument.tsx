import type { BookDTO } from "@rezics/contract";
import { getBookShareStyles } from "@/utils/shareStyles";

export interface BookShareDocumentProps {
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
    // already absolute
    return new URL(url).toString();
  } catch {
    // relative path
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
  return `${s.slice(0, maxLen - 1)}…`;
}

export function BookShareDocument({
  book,
  canonicalUrl,
  origin,
}: BookShareDocumentProps) {
  const title = book.title || "Book";
  const description = clampDescription(
    book.description || "Open to view details.",
    160,
  );
  const imageUrl = toAbsoluteUrl(book.coverUrl, origin);

  const styles = getBookShareStyles();

  // Minimal, bot-friendly HTML: meta in <head>, readable content in <body>.
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>

        <link rel="canonical" href={canonicalUrl} />
        <meta name="description" content={description} />

        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        {imageUrl ? <meta property="og:image" content={imageUrl} /> : null}

        <meta
          name="twitter:card"
          content={imageUrl ? "summary_large_image" : "summary"}
        />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {imageUrl ? <meta name="twitter:image" content={imageUrl} /> : null}

        {/* Some crawlers still look at itemprop fields */}
        {imageUrl ? <meta itemProp="image" content={imageUrl} /> : null}

        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: style injection
          dangerouslySetInnerHTML={{
            __html: styles,
          }}
        />
      </head>
      <body>
        <div className="wrap">
          <div className="card">
            {imageUrl ? (
              <div className="media">
                <img src={imageUrl} alt={title} />
              </div>
            ) : null}
            <div className="content">
              <h1>{title}</h1>
              <p>{description}</p>
              <div className="meta">
                <div>unitId: {book.unitId}</div>
                <div>
                  分享链接: <a href={canonicalUrl}>{canonicalUrl}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
