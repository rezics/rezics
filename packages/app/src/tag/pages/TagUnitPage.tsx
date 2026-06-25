import { tagQueries } from "@rezics/contract/api/tag/tag.queries";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { Route as tagUnitRoute } from "@/routes/_mainLayout/tag/$unitId";
import { TagDetailCard } from "../components/TagCards";

/**
 * 标签单位详情页面。显示单个标签的完整信息和详情卡片。
 *
 * 布局结构：
 *
 * Loading State:
 * ┌──────────────────────────────────────┐
 * │ Tag loading...                        │
 * │                                      │
 * └──────────────────────────────────────┘
 *
 * Error State:
 * ┌──────────────────────────────────────┐
 * │ Load failed: [error message]         │
 * │                                      │
 * └──────────────────────────────────────┘
 *
 * Success State:
 * ┌──────────────────────────────────────┐
 * │ ═════════════════════════════════    │
 * │ Tag Title / unitId                   │
 * │ ═════════════════════════════════    │
 * │                                      │
 * │ [TagDetailCard (full content)]       │
 * │                                      │
 * │ - Category                           │
 * │ - Aliases                            │
 * │ - Description                        │
 * │ - Related Tags                       │
 * │                                      │
 * └──────────────────────────────────────┘
 */
export function TagUnitPage() {
  const { t } = useTranslation(["common", "community"]);
  const { unitId } = tagUnitRoute.useParams();
  const { data, isLoading, error } = useQuery(tagQueries.detail(unitId));
  if (isLoading) {
    return (
      <div className="w-full px-4 mt-16">
        <div className="text-sm text-gray-500">
          {t("community:tag_loading")}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full px-4 mt-16">
        <div className="text-sm text-red-600">
          {t("common:load_failed")}: {String((error as any)?.message ?? error)}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full px-4 mt-16">
      <AccentBarWithText text={t("community:tag_unit_title", { id: unitId })} />
      <div className="mt-4">
        <TagDetailCard tag={data} />
      </div>
    </div>
  );
}
