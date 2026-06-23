import { SectionBoundary } from "@/components/SectionBoundary";
import { ZoneDetailContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Zone Name                   |
 * | Description text...         |
 * | [Pages] [Posts] [Wiki]      |
 * |-----------------------------|
 * | [Page/Post list]            |
 * |       [Load more]           |
 * +-----------------------------+
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Zone Name                            |
 * | Description text...                  |
 * | [Pages | Posts | Wiki | Search]      |
 * |--------------------------------------|
 * | [Page/Post list]                     |
 * +--------------------------------------+
 * max-w-3xl mx-auto。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | Zone Name                                |
 * | Description text...                      |
 * | [Pages | Posts | Wiki | Search]          |
 * |------------------------------------------|
 * | [Page/Post list]                         |
 * +------------------------------------------+
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone（用户微站/Wiki）详情页：名称 + 描述 + 内容 tabs。
 */
export default function ZoneDetailPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  return (
    <SectionBoundary>
      <ZoneDetailContent paramsPromise={params} />
    </SectionBoundary>
  );
}
