import { env } from "../env";

// Validates that a media URL belongs to the configured MEDIA_PUBLIC_BASE_URL.
// Skips validation when MEDIA_PUBLIC_BASE_URL is unset (dev convenience).
// Null/undefined pass through unchecked (clearing a field is always allowed).
// 验证媒体 URL 属于已配置的 MEDIA_PUBLIC_BASE_URL。
// 当 MEDIA_PUBLIC_BASE_URL 未设置时跳过验证（开发便利）。
// null/undefined 直接放行（清除字段总是允许的）。
export function assertMediaUrl(url: string | null | undefined): void {
  if (url == null) return;

  const base = env.MEDIA_PUBLIC_BASE_URL;
  if (!base) return;

  const normalized = base.replace(/\/$/, "");
  if (!url.startsWith(`${normalized}/`)) {
    throw new Error(
      `Media URL must start with ${normalized}/. Got: ${url.slice(0, 80)}`,
    );
  }
}
