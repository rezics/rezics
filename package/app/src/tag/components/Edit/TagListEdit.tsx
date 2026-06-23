import { meiliTagSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import {
  tagQueries,
  useAttachTagMutation,
  useDetachTagMutation,
} from "@rezics/api/tag/tag";
import type { TagSearchDocument, UnitTagDTO } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Input,
  ToggleGroup,
  ToggleGroupItem,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo, useState } from "react";
import { QueryBoundary } from "@/core/components/QueryBoundary";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { SingleTagChip } from "../TagList";

/**
 * TagListEdit - now uses UnitTagDTO (scored tags) instead of old TagDetailDTO.
 * Attach/detach use tagUnitId + unitId (the target object).
 * TagListEdit —— 现在使用 UnitTagDTO（带分值的标签）而非旧的 TagDetailDTO。
 * 关联/解除关联使用 tagUnitId + unitId（目标对象）。
 */
export type TagListEditProps = {
  objectUnitId: string;
  className?: string;
};

export const TagListEdit: React.FC<TagListEditProps> = ({
  objectUnitId,
  className,
}) => {
  const { t } = useTranslation(["common", "community", "entity"]);
  const locale = useLocale();
  const tagQuery = useQuery(tagQueries.forUnit(objectUnitId));
  const list: UnitTagDTO[] = useMemo(
    () => tagQuery.data?.tags ?? [],
    [tagQuery.data],
  );

  const [view, setView] = useState<"list" | "grouped">("list");
  const [search, setSearch] = useState("");

  const detachMutation = useDetachTagMutation({
    onSuccess: () => tagQuery.refetch(),
  });
  const attachMutation = useAttachTagMutation({
    onSuccess: () => {
      tagQuery.refetch();
    },
  });

  const searchTerm = search.trim();
  const {
    data: searchData,
    isLoading: isSearching,
    error: searchError,
  } = useQuery({
    ...meiliTagSearchQueryOptions({
      keyword: searchTerm,
      limit: 20,
      appLocale: locale,
    }),
    enabled: searchTerm.length > 0,
  });

  const searchResults: TagSearchDocument[] = useMemo(
    () =>
      (searchData?.items ?? []).filter(
        (tag) => !list.some((attached) => attached.tagUnitId === tag.unitId),
      ),
    [searchData, list],
  );

  const handleAttach = async (tagUnitId: string) => {
    await attachMutation.mutateAsync({
      tagUnitId,
      unitId: objectUnitId,
    });
  };

  const onDetach = async (tag: UnitTagDTO) => {
    await detachMutation.mutateAsync({
      tagUnitId: tag.tagUnitId,
      unitId: objectUnitId,
    });
  };

  const renderListView = () => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-2">
        {list.map((tag) => (
          <div
            key={tag.tagUnitId}
            className="flex items-center justify-between gap-2"
          >
            <SingleTagChip tag={tag} />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-error-text"
                onClick={() => onDetach(tag)}
                disabled={detachMutation.isPending}
              >
                {t("common:unlink")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <ToggleGroup
          type="single"
          size="sm"
          value={view}
          onValueChange={(v) => {
            if (v) setView(v as "list" | "grouped");
          }}
        >
          <ToggleGroupItem value="list">
            {t("entity:shelf_view_list")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <QueryBoundary
        query={tagQuery}
        isEmpty={(d) => (d.tags ?? []).length === 0}
        emptyTitle={t("community:tag_empty")}
      >
        {() => renderListView()}
      </QueryBoundary>

      {/* Search and attach existing tags — 搜索并关联已有标签 */}
      <div className="mt-8 pt-4 border-t border-border-whisper">
        <div className="text-sm font-semibold text-text-primary mb-2">
          {t("community:tag_search_and_add")}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder={t("community:tag_search_placeholder")}
            className="w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isSearching && <Spinner size="sm" />}
        </div>
        <QueryErrorDisplay error={searchError} className="mb-2" />
        {searchTerm && !isSearching && searchResults.length === 0 && (
          <div className="text-xs text-text-secondary">
            {t("community:tag_no_matching")}
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="space-y-1">
            {searchResults.map((tag) => (
              <div
                key={tag.unitId}
                className="flex items-center justify-between gap-2"
              >
                <Badge variant="secondary">
                  {tag.title ?? tag.slug ?? tag.unitId}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAttach(tag.unitId)}
                  disabled={attachMutation.isPending}
                >
                  {t("common:add")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
