export function GET(): Response {
  return new Response(
    "User-agent: *\nAllow: /\nSitemap: https://about.rezics.com/sitemap.xml\n",
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
