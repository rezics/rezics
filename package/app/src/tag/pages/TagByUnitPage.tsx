import { tagQueries } from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import { Route as tagBookRoute } from "@/routes/_mainLayout/tag/book/$bookId/route";
import { TextLink } from "@/shared/ui/link";
import { TagWrapper } from "../components/TagWrapper";

/**
 * 按书籍单位的标签页面。显示给定书籍的分组标签概览和完整列表链接。
 *
 * 布局结构：
 *
 * Overview (首屏):
 * ┌──────────────────────────────────────┐
 * │ ═════════════════════════════════    │
 * │ Tags / 标签                           │
 * │ ═════════════════════════════════    │
 * │ [TagWrapper - grouped mode]          │
 * │ [Tag] [Tag] [Tag] [Tag]              │
 * │ [Tag] [Tag] [Tag]                    │
 * └──────────────────────────────────────┘
 *
 * Full Listing (以 "/tag/book/$bookId/tag" 链接):
 * ┌──────────────────────────────────────┐
 * │ ═════════════════════════════════    │
 * │ Tags / 标签                           │
 * │ ═════════════════════════════════    │
 * │ [TagWrapper - grouped mode, render]  │
 * │ [Tag] [Tag] [Tag] [Tag] [Tag] ...    │
 * │ [Tag] [Tag] [Tag] [Tag] [Tag] ...    │
 * └──────────────────────────────────────┘
 *
 * Mobile:
 * ┌──────────────────────┐
 * │ Tag Header           │
 * │ TagWrapper (full)    │
 * │ [Tag] [Tag]          │
 * │ [Tag] [Tag]          │
 * │ View all link        │
 * └──────────────────────┘
 */
export function TagByBookPage() {
  const { t } = useTranslation(["common", "community"]);
  const { bookId } = tagBookRoute.useParams();
  const pageSize = 30;
  const {
    data: listData,
    isLoading,
    error,
  } = useQuery(tagQueries.forUnit(bookId, { limit: pageSize }));

  const tagIds = listData?.tags?.map((t) => t.tagUnitId) ?? [];
  const detailsResults = useQueries({
    queries: tagIds.map((id) => tagQueries.detail(id)),
  });

  const _details: UnitTagDTO[] = detailsResults
    .map((r) => r.data)
    .filter(Boolean) as UnitTagDTO[];

  const total = listData?.tags?.length ?? 0;
  const showSeeAll = total > pageSize;

  return (
    <div className="w-full px-4 mt-16">
      <AccentBarWithText text={t("community:tag_title")} />

      {isLoading && <div>{t("common:loading")}</div>}
      {error && <div>{t("common:load_failed")}</div>}

      {!isLoading && !error && (
        <div className="mt-4">
          <TagWrapper
            filters={{ unitId: bookId }}
            mode="grouped"
            renderAll={true}
          />
        </div>
      )}

      {showSeeAll && (
        <div className="mt-4">
          <TextLink to="/tag/book/$bookId/tag" params={{ bookId }}>
            <span className="text-primary-600 hover:underline">
              {t("community:tag_view_all", { count: total })}
            </span>
          </TextLink>
        </div>
      )}
    </div>
  );
}

export function TagByBookFullPage() {
  const { t } = useTranslation(["common", "community"]);
  const matchRoute = useMatchRoute();
  const withDomain = matchRoute({
    to: "/tag/book/$bookId/tag/$domainId",
    fuzzy: false,
  });
  const base = matchRoute({ to: "/tag/book/$bookId/tag", fuzzy: false });

  const bookId =
    (withDomain ? withDomain.bookId : "") || (base ? base.bookId : "") || "";

  const pageSize = 100;
  const {
    data: listData,
    isLoading,
    error,
  } = useQuery(tagQueries.forUnit(bookId, { limit: pageSize }));

  const tagIds = listData?.tags?.map((t) => t.tagUnitId) ?? [];
  const detailsResults = useQueries({
    queries: tagIds.map((id) => tagQueries.detail(id)),
  });

  const details: UnitTagDTO[] = detailsResults
    .map((r) => r.data)
    .filter(Boolean) as UnitTagDTO[];

  const total = listData?.tags?.length ?? 0;

  return (
    <div className="w-full px-4 mt-16">
      <AccentBarWithText text={t("community:tag_title")} />

      {isLoading && <div>{t("common:loading")}</div>}
      {error && <div>{t("common:load_failed")}</div>}

      {!isLoading && !error && (
        <div className="mt-4">
          <TagWrapper
            filters={{ unitId: bookId }}
            mode="grouped"
            renderAll={true}
          />
        </div>
      )}

      <div className="mt-2 text-xs text-text-secondary">
        total: {total} {details?.length ? `(details: ${details.length})` : ""}
      </div>
    </div>
  );
}
