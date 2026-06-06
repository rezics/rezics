import { Elysia } from "elysia";
import { ROBOTS_CACHE_CONTROL, SITEMAP_CACHE_CONTROL } from "../utils/cache";
import { getRequestOrigin } from "../utils/url";
import { robotsTxt, sitemapIndex, sitemapUrlSet } from "../utils/xml";
import {
  listBookSitemapEntries,
  listBookSitemapShards,
} from "./sitemap.service";

const XML_HEADERS = {
  "content-type": "application/xml; charset=utf-8",
  "cache-control": SITEMAP_CACHE_CONTROL,
} as const;

export const sitemapApi = new Elysia()
  .get("/robots.txt", ({ request }) => {
    const origin = getRequestOrigin(request);
    return new Response(robotsTxt(origin), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": ROBOTS_CACHE_CONTROL,
      },
    });
  })
  .get("/sitemap.xml", async ({ request, query }) => {
    const origin = getRequestOrigin(request);
    const shards = await listBookSitemapShards({
      origin,
      limit: query.limit,
    });

    return new Response(sitemapIndex(shards), { headers: XML_HEADERS });
  })
  .get("/sitemap/books.xml", async ({ request, query }) => {
    const origin = getRequestOrigin(request);
    const page = await listBookSitemapEntries({
      origin,
      start: query.start,
      limit: query.limit,
    });

    return new Response(sitemapUrlSet(page.entries), { headers: XML_HEADERS });
  });
