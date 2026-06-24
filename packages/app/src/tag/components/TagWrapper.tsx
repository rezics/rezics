import type { TagFilters } from "@rezics/contract/api/tag/tag";
import { tagContextQuery, tagQueries } from "@rezics/contract/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { RealmTagHighlights } from "./RealmTagHighlights";
import { TagList } from "./TagList";

type Mode = "flat" | "grouped";

export type TagWrapperProps = {
  filters?: TagFilters;
  mode?: Mode;
  domainIds?: string[];
  className?: string;
  renderAll?: boolean;
};

export const TagWrapper: React.FC<TagWrapperProps> = ({
  filters,
  mode: _mode = "flat",
  renderAll: _renderAll = false,
  domainIds: _domainIds,
  className,
}) => {
  const { t } = useTranslation(["community"]);
  const { data, isLoading, error } = useQuery(tagQueries.list(filters));
  const tags: UnitTagDTO[] = useMemo(() => data?.tags ?? [], [data]);

  const unitId = filters?.unitId;
  const { data: contextData } = useQuery({
    ...tagContextQuery(unitId ?? ""),
    enabled: !!unitId,
  });
  const realmHighlights = useMemo(
    () =>
      (contextData?.realmHighlights ?? []).map((highlight) => ({
        ...highlight,
        tags: highlight.tags.map((tag) => tag.label),
      })),
    [contextData],
  );

  if (isLoading) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500">
          {t("community:tag_loading")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-sm text-red-600">
          {t("community:tag_load_failed", {
            error: String((error as any)?.message ?? error),
          })}
        </div>
      </div>
    );
  }

  // For grouped mode, score-based grouping (no domain concept in new model)
  // Render as flat list for now
  // 分组模式下采用基于分数的分组（新模型中没有 domain 概念）
  // 目前先以扁平列表渲染
  return (
    <div className={className}>
      <TagList tags={tags} />
      <RealmTagHighlights realmHighlights={realmHighlights} />
    </div>
  );
};
