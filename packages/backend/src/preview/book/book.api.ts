import type { BookDTO } from "@rezics/contract";

import { bookParamsSchema } from "@rezics/contract";
import { bookService } from "../../server/book/book.service";
import { mapBookToDTO } from "../../server/book/mapper";
import { coreInstance } from "../core";
import { BookDetailTemplate } from "../templates/book-detail";
import { notFoundHtml } from "../templates/not-found";
import { BOOK_DETAIL_CACHE_CONTROL } from "../utils/cache";
import { getRequestOrigin, toAbsoluteUrl } from "../utils/url";

// Route everything through the MeiliSearch API later; do not query the primary DB directly, it is too slow.
// 之后全部走 MeiliSearch API，不要直接查主库，太慢了

async function renderBookSharePage(opts: {
  book: BookDTO;
  canonicalUrl: string;
  origin: string;
}): Promise<Response> {
  return new Response(
    `<!doctype html>${BookDetailTemplate({
      book: opts.book,
      canonicalUrl: opts.canonicalUrl,
      origin: opts.origin,
    })}`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": BOOK_DETAIL_CACHE_CONTROL,
        "x-robots-tag": "all",
      },
    },
  );
}

/**
 * Shareable HTML page (bots can parse OG/Twitter meta).
 * 可分享的 HTML 页面（爬虫可解析 OG/Twitter meta）。
 */
export const bookApi = coreInstance("/book")
  /**
   * GET /book/:unitId
   * 获取 /book/:unitId
   */
  .get(
    "/:unitId",
    async ({ params, request, set }): Promise<Response> => {
      try {
        const origin = getRequestOrigin(request);
        const canonicalUrl = toAbsoluteUrl(`/book/${params.unitId}`, origin);
        const book = await bookService.getByUnitId(params.unitId);
        const dto = mapBookToDTO(book as any);
        return await renderBookSharePage({ book: dto, canonicalUrl, origin });
      } catch {
        set.status = 404;
        return new Response(notFoundHtml(), {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: "Book share page",
        description:
          "Bot-friendly HTML page with OpenGraph/Twitter meta for sharing",
        tags: ["Books"],
      },
    },
  );
