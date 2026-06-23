import { SectionBoundary } from "@/components/SectionBoundary";
import { PollDetailContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Poll Question Here?         |
 * | By @author · 2h ago         |
 * |-----------------------------|
 * | ( ) Option A          [42%] |
 * | ( ) Option B          [31%] |
 * | ( ) Option C          [27%] |
 * |                             |
 * | 128 votes · Ends in 3 days  |
 * |                             |
 * | [Vote]                      |
 * +-----------------------------+
 * w-full, options full width.
 *
 * Tablet-Ultra-wide: max-w-2xl mx-auto。
 *
 * 投票详情页：问题 + 选项列表 + 投票按钮。
 */
export default function PollDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  return (
    <SectionBoundary>
      <PollDetailContent paramsPromise={params} />
    </SectionBoundary>
  );
}
