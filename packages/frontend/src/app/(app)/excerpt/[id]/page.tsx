import { SectionBoundary } from "@/components/SectionBoundary";
import { ExcerptDetailContent } from "./content";

/**
 * Mobile-Ultra-wide: max-w-2xl mx-auto。
 *
 * +-----------------------------+
 * | "Quoted passage text..."    |
 * |                             |
 * | — Book Title, Chapter Name  |
 * | by Author Name              |
 * |-----------------------------|
 * | Context / notes             |
 * |-----------------------------|
 * | [Comments section]          |
 * +-----------------------------+
 *
 * 书摘/引用详情：引文 + 来源 + 评注 + 评论。
 */
export default function ExcerptDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  return (
    <SectionBoundary>
      <ExcerptDetailContent paramsPromise={params} />
    </SectionBoundary>
  );
}
