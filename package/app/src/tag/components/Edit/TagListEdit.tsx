import {
  tagQueries,
  useAttachTagMutation,
  useDetachTagMutation,
} from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
import { SingleTagChip } from "../TagList";

/**
 * TagListEdit - now uses UnitTagDTO (scored tags) instead of old TagDetailDTO.
 * Attach/detach use tagUnitId + unitId (the target object).
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
const { data, isLoading, error, refetch } = useQuery(
    tagQueries.forUnit(objectUnitId),
  );
  const list: UnitTagDTO[] = useMemo(() => data?.tags ?? [], [data]);

  const [view, setView] = useState<"list" | "grouped">("list");
  const [search, setSearch] = useState("");

  const detachMutation = useDetachTagMutation({
    onSuccess: () => refetch(),
  });
  const attachMutation = useAttachTagMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const searchTerm = search.trim();
  const {
    data: searchData,
    isLoading: isSearching,
    error: searchError,
  } = useQuery(tagQueries.search(searchTerm));

  const searchResults: UnitTagDTO[] = useMemo(
    () =>
      (searchData?.tags ?? []).filter(
        (t) => !list.some((attached) => attached.tagUnitId === t.tagUnitId),
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
        {list.map((t) => (
          <div
            key={t.tagUnitId}
            className="flex items-center justify-between gap-2"
          >
            <SingleTagChip tag={t} />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-error-text"
                onClick={() => onDetach(t)}
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
          <ToggleGroupItem value="list">{t("entity:shelf_view_list")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner size="sm" /> {t("common:loading")}
        </div>
      )}
      {error && (
        <div className="text-sm text-error-text">
          {t("common:error")}: {String((error as any)?.message ?? error)}
        </div>
      )}

      {!isLoading && !error && list.length === 0 && (
        <div className="text-sm text-text-secondary">{t("community:tag_empty")}</div>
      )}

      {!isLoading && !error && renderListView()}

      {/* Search and attach existing tags */}
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
        {searchError && (
          <div className="text-xs text-error-text mb-2">
            {t("common:search_failed")}:{" "}
            {String((searchError as any)?.message ?? searchError)}
          </div>
        )}
        {searchTerm && !isSearching && searchResults.length === 0 && (
          <div className="text-xs text-text-secondary">
            {t("community:tag_no_matching")}
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="space-y-1">
            {searchResults.map((t) => (
              <div
                key={t.tagUnitId}
                className="flex items-center justify-between gap-2"
              >
                <Badge variant="secondary">{t.tagUnitId}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAttach(t.tagUnitId)}
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

export default TagListEdit;
