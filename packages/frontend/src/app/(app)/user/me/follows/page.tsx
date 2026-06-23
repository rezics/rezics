"use client";

import { SectionBoundary } from "@/components/SectionBoundary";
import { FollowsContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Follows                     |
 * | [Following | Followers]     |
 * |-----------------------------|
 * | (tab content)               |
 * +-----------------------------+
 * w-full, tabs horizontally stacked.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Follows                              |
 * | [Following | Followers]              |
 * |--------------------------------------|
 * | (tab content)                        |
 * +--------------------------------------+
 * max-w-3xl mx-auto (set inside FollowsContent).
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | Follows                                  |
 * | [Following | Followers]                  |
 * |------------------------------------------|
 * | (tab content)                            |
 * +------------------------------------------+
 * max-w-3xl mx-auto.
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop.
 *
 * 关注页面包裹器：SectionBoundary 内渲染 FollowsContent。
 * 所有交互逻辑和 i18n 在 FollowsContent 中处理。
 */
export default function FollowsPage() {
  return (
    <SectionBoundary>
      <FollowsContent />
    </SectionBoundary>
  );
}
