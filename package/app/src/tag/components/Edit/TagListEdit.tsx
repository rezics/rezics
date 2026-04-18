import {
  Button,
  Chip,
  CircularProgress,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  tagApi,
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
  } = useQuery<{
    tags: UnitTagDTO[];
    total: number;
  }>({
    queryKey: ["tags", "search", searchTerm],
    enabled: searchTerm.length > 0,
    queryFn: () => tagApi.list({ q: searchTerm, limit: 20 }),
  });

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
                size="small"
                color="error"
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
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setView(v)}
        >
          <ToggleButton value="list">列表</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CircularProgress size={16} /> 加载中…
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600">
          错误：{String((error as any)?.message ?? error)}
        </div>
      )}

      {!isLoading && !error && list.length === 0 && (
        <div className="text-sm text-gray-500">暂无标签</div>
      )}

      {!isLoading && !error && renderListView()}

      {/* Search and attach existing tags */}
      <div className="mt-6 pt-4 border-t">
        <div className="text-sm font-semibold text-gray-700 mb-2">
          搜索并添加标签
        </div>
        <div className="flex items-center gap-2 mb-3">
          <TextField
            size="small"
            fullWidth
            placeholder="输入标签名搜索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isSearching && <CircularProgress size={18} />}
        </div>
        {searchError && (
          <div className="text-xs text-red-600 mb-2">
            搜索失败：{String((searchError as any)?.message ?? searchError)}
          </div>
        )}
        {searchTerm && !isSearching && searchResults.length === 0 && (
          <div className="text-xs text-gray-500">未找到匹配的标签</div>
        )}
        {searchResults.length > 0 && (
          <div className="space-y-1">
            {searchResults.map((t) => (
              <div
                key={t.tagUnitId}
                className="flex items-center justify-between gap-2"
              >
                <Chip label={t.tagUnitId} size="small" />
                <Button
                  size="small"
                  variant="outlined"
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
