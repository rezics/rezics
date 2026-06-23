import { SectionBoundary } from "@/components/SectionBoundary";
import { EntityDetailContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | (avatar 64px)               |
 * | Entity Name                 |
 * | @slug · kind                |
 * | Summary text...             |
 * |-----------------------------|
 * | [Works|Credits|About]       |
 * |  ^tabs, overflow-x-auto    |
 * |-----------------------------|
 * | [WorkCard]                  |
 * | [WorkCard]                  |
 * |       [Load more]           |
 * +-----------------------------+
 * w-full, stacked vertically.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | (avatar 80px) Entity Name            |
 * |               @slug · kind           |
 * |               Summary text...        |
 * |--------------------------------------|
 * | [Works | Credits | About]            |
 * |--------------------------------------|
 * | [WorkCard]                           |
 * |           [Load more]               |
 * +--------------------------------------+
 * max-w-3xl mx-auto，avatar 与信息横排。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | (avatar 96px) Entity Name                |
 * |               @slug · kind               |
 * |               Summary text, more detail  |
 * |------------------------------------------|
 * | [Works | Credits | About]                |
 * |------------------------------------------|
 * | [WorkCard] [WorkCard]                    |
 * |           [Load more]                    |
 * +------------------------------------------+
 * max-w-3xl mx-auto。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致，max-w-3xl mx-auto 居中。
 *
 * 实体（人物/组织）详情页：头像 + 名称 + 描述 + 作品 tabs。
 * slug 从 URL 获取，用于查询实体数据。
 */
export default function EntityDetailPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  return (
    <SectionBoundary>
      <EntityDetailContent paramsPromise={params} />
    </SectionBoundary>
  );
}
