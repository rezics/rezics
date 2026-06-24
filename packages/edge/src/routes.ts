const PREVIEW_PREFIXES = [
  "/book/",
  "/game/",
  "/media/",
  "/post/",
  "/review/",
  "/realm/",
  "/r/",
  "/shelf/",
  "/tag/",
  "/u/",
  "/og/",
  "/svg/",
] as const;

const PREVIEW_EXACT_PATHS = ["/", "/robots.txt", "/sitemap.xml"] as const;

const ASSET_EXTENSIONS = new Set([
  "avif",
  "css",
  "gif",
  "ico",
  "jpg",
  "jpeg",
  "js",
  "json",
  "map",
  "png",
  "svg",
  "webp",
  "woff",
  "woff2",
]);

export function isAssetPath(pathname: string): boolean {
  const last = pathname.split("/").at(-1) ?? "";
  const extension = last.includes(".") ? last.split(".").at(-1) : undefined;
  return extension ? ASSET_EXTENSIONS.has(extension.toLowerCase()) : false;
}

export function isPreviewEligiblePath(pathname: string): boolean {
  if (isAssetPath(pathname)) return false;
  if (PREVIEW_EXACT_PATHS.includes(pathname as never)) return true;
  return PREVIEW_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
