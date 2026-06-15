import { zoneSectionInfiniteQuery } from "@rezics/api";
import { mainMarkdownSource, type ZoneRichTextSection } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Skeleton } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionEmpty,
  ZoneSectionShell,
} from "./shared";

/**
 * Renders the zone fragment's resolved `ContentTranslation` doc returned by
 * the section data endpoint (single page; richText has no cursor).
 * 渲染分区数据端点返回的专区片段已解析 `ContentTranslation` 文档
 * （单页；richText 没有游标）。
 */
export function RichTextSection({
  section,
  ctx,
}: {
  section: ZoneRichTextSection;
  ctx: ZonePortalContext;
}) {
  const title = useZoneSectionTitle(section, ctx.refUnits);
  const query = useInfiniteQuery(
    zoneSectionInfiniteQuery(ctx.zone.unitId, ctx.pageId, section.id, {
      languages: ctx.languages,
      appLocale: ctx.appLocale,
      languageMode: ctx.languageMode,
    }),
  );

  if (query.isLoading) {
    return (
      <ZoneSectionShell title={title}>
        <Skeleton className="h-24 w-full" />
      </ZoneSectionShell>
    );
  }
  if (query.isError) {
    return (
      <ZoneSectionShell title={title}>
        <QueryErrorDisplay error={query.error} />
      </ZoneSectionShell>
    );
  }

  const markdown = mainMarkdownSource(query.data?.pages[0]?.doc ?? null);
  if (!markdown) {
    return <ZoneSectionEmpty title={title} emptyState={section.emptyState} />;
  }

  return (
    <ZoneSectionShell title={title}>
      <MarkdownContent content={markdown} />
    </ZoneSectionShell>
  );
}
