import type { RealmBannerExtra } from "@rezics/contract";
import type React from "react";

/**
 * Hero banner image section for realm profile.
 * Displays full-width responsive banner image or null if not available.
 * Image is object-fit: cover, responsive heights (h-48 mobile, h-64 desktop).
 *
 * 社区资料的英雄横幅图像部分。
 * 显示全宽响应式横幅图像，如果不可用则返回null。
 * 图像使用object-fit: cover，响应式高度(移动设备h-48，桌面h-64)。
 *
 * Layout:
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │                          │
 * │ [Banner Image - h-48]    │
 * │ [Object-fit: cover]      │
 * │                          │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │                                    │
 * │ [Banner Image - h-48]              │
 * │ [Object-fit: cover]                │
 * │                                    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │                                      │
 * │ [Banner Image - h-64]                │
 * │ [Object-fit: cover]                  │
 * │                                      │
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────┐
 * │                                        │
 * │ [Banner Image - h-64]                  │
 * │ [Object-fit: cover, full width]        │
 * │                                        │
 * └────────────────────────────────────────┘
 */
export interface BannerSectionProps {
  banner?: RealmBannerExtra | null;
}

export const BannerSection: React.FC<BannerSectionProps> = ({ banner }) => {
  if (!banner?.url) return null;

  return (
    <section className="overflow-hidden rounded-md bg-surface-subtle">
      <img
        src={banner.url}
        alt=""
        className="h-48 w-full object-cover md:h-64"
      />
    </section>
  );
};
