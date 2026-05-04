import {
  Badge,
  Button,
  Input,
  ToggleGroup,
  ToggleGroupItem,
} from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import {
  tagQueries,
  useAttachTagMutation,
  useDetachTagMutation,
} from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
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
                解绑
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
          <ToggleGroupItem value="list">列表</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner size="sm" /> 加载中…
        </div>
      )}
      {error && (
        <div className="text-sm text-error-text">
          错误：{String((error as any)?.message ?? error)}
        </div>
      )}

      {!isLoading && !error && list.length === 0 && (
        <div className="text-sm text-text-secondary">暂无标签</div>
      )}

      {!isLoading && !error && renderListView()}

      {/* Search and attach existing tags */}
      <div className="mt-8 pt-4 border-t border-border-whisper">
        <div className="text-sm font-semibold text-text-primary mb-2">
          搜索并添加标签
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="输入标签名搜索…"
            className="w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isSearching && <Spinner size="sm" />}
        </div>
        {searchError && (
          <div className="text-xs text-error-text mb-2">
            搜索失败：{String((searchError as any)?.message ?? searchError)}
          </div>
        )}
        {searchTerm && !isSearching && searchResults.length === 0 && (
          <div className="text-xs text-text-secondary">未找到匹配的标签</div>
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
                  添加
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
