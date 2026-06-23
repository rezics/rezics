import { SectionBoundary } from "@/components/SectionBoundary";
import { HomeContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [Home|All]   [Sort: v Hot]  |
 * |  ^tabs        ^w-32 shrink-0|
 * |-----------------------------|
 * | [PostCard]                  |
 * | [PostCard]                  |
 * | [PostCard]                  |
 * |       [Load more]          |
 * +-----------------------------+
 * w-full, 320px: sort select keeps w-32 (shrink-0);
 * tabs shrink (overflow-x-auto).
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [Home | All]          [Sort: v Hot]  |
 * |--------------------------------------|
 * | [PostCard]                           |
 * | [PostCard]                           |
 * |           [Load more]               |
 * +--------------------------------------+
 * max-w-3xl mx-auto 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [Home | All]              [Sort: v Hot]  |
 * |------------------------------------------|
 * | [PostCard]                               |
 * | [PostCard]                               |
 * |           [Load more]                    |
 * +------------------------------------------+
 * max-w-3xl mx-auto 居中，左侧有侧栏。
 *
 * Ultra-wide (>=1536px):
 * +--------------------------------------------------+
 * |      [Home | All]              [Sort: v Hot]      |
 * |--------------------------------------------------|
 * |      [PostCard]                                   |
 * |      [PostCard]                                   |
 * |               [Load more]                         |
 * +--------------------------------------------------+
 * max-w-3xl (48rem) mx-auto 居中。
 *
 * 首页显示帖子 feed，顶部 tabs 切换 home/all feed，
 * 右侧排序选择器（hot/new/top）。
 * 所有断点结构一致，仅容器宽度和外边距变化。
 */
export default function HomePage() {
  return (
    <SectionBoundary>
      <HomeContent />
    </SectionBoundary>
  );
}
