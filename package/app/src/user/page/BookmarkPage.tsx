import { useAlertStore } from "@app/state/windowAlertStore";
import { Box, Button, Chip, MenuItem, Select, Typography } from "@mui/material";
import { reactionApi, reactionQueries } from "@rezics/api/reaction/reaction";
import { unitApi } from "@rezics/api/unit/unit";
import type { UnitDTO } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { BookmarkItemCard } from "@/user/component/Bookmark/BookmarkItemCard.tsx";
import { useUserProfileStore } from "@/user/state";
import { UserBookmarkTagsCard } from "./UserBookmarkTagsCard";

export type BookmarkEntry = {
  unit: UnitDTO;
  createdAt?: string;
  tags: string[];
};

type BookmarkPageQueryResult = {
  entries: BookmarkEntry[];
  total: number;
};

const UNIT_TYPE_OPTIONS = [
  "",
  "BOOK",
  "REVIEW",
  "READLIST",
  "COMMENT",
  "NOTE",
  "QUOTE",
  "TAG",
  "DOMAIN",
  "IMAGE",
  "VIDEO",
  "CHAPTER",
] as const;

/**
 * BookmarkPage
 * @returns
 */
export const BookmarkPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useUserProfileStore((state) => state.user);
  const userId = user?.unitId;
  const { show: showAlert } = useAlertStore();

  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [entries, setEntries] = useState<BookmarkEntry[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const paginatorRef = React.useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

  const ITEMS_PER_PAGE = 10;
  const EXTERNAL_ITEMS_PER_PAGE = 100;
  const [start, setStart] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data, isLoading, isError } = useQuery<BookmarkPageQueryResult>({
    queryKey: [
      "user-bookmarks",
      userId,
      {
        start,
        limit: EXTERNAL_ITEMS_PER_PAGE,
      },
    ],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        return { entries: [], total: 0 };
      }

      const reactionList = await reactionApi.list({
        userId,
        reaction: "bookmark",
        start,
        limit: EXTERNAL_ITEMS_PER_PAGE,
      });

      const reactions = reactionList.reactions ?? [];
      const total = reactionList.total ?? 0;

      if (reactions.length === 0) {
        return { entries: [], total };
      }

      const targetIds = Array.from(
        new Set(reactions.map((r) => r.targetId).filter(Boolean)),
      );

      const units = await Promise.all(
        targetIds.map(async (targetId) => {
          try {
            const unit = await unitApi.get(targetId);
            return unit;
          } catch (e) {
            console.error("Failed to load unit for bookmark", targetId, e);
            return null;
          }
        }),
      );

      const unitMap = new Map<string, UnitDTO>();
      units.forEach((unit) => {
        if (unit) {
          unitMap.set(unit.id, unit);
        }
      });

      const tagResults = await Promise.all(
        targetIds.map(async (targetId) => {
          try {
            const res = await reactionApi.getBookmarkTags(targetId);
            return { targetId, tags: res.tags ?? [] };
          } catch (e) {
            console.error(
              "Failed to load bookmark tags for target",
              targetId,
              e,
            );
            return { targetId, tags: [] as string[] };
          }
        }),
      );

      const tagMap = new Map<string, string[]>();
      tagResults.forEach((result) => {
        tagMap.set(result.targetId, result.tags);
      });

      const nextEntries = reactions
        .map((reaction) => {
          const unit = unitMap.get(reaction.targetId);
          if (!unit) return null;
          const tags = tagMap.get(reaction.targetId) ?? [];

          return {
            unit,
            createdAt: reaction.createdAt,
            tags,
          };
        })
        .filter((entry) => entry !== null) as BookmarkEntry[];

      return {
        entries: nextEntries,
        total,
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    if (data) {
      setEntries(data.entries);
      setTotalItems(data.total);
    } else {
      setEntries([]);
      setTotalItems(0);
    }
  }, [data]);

  // 用户级别的标签库（targetId === userId，对前端来说用 "tag" 作为占位 key）
  const { data: userTagLibrary } = useQuery(
    reactionQueries.bookmarkTags("tag"),
  );

  const allBookmarkTags = useMemo(() => {
    const set = new Set<string>();
    if (userTagLibrary?.tags) {
      userTagLibrary.tags.forEach((tag) => set.add(tag));
    }
    entries.forEach((entry) => {
      entry.tags.forEach((tag) => set.add(tag));
    });
    return Array.from(set);
  }, [userTagLibrary, entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesType = typeFilter ? entry.unit.type === typeFilter : true;
      const matchesTags =
        selectedTags.length > 0
          ? selectedTags.every((tag) => entry.tags.includes(tag))
          : true;
      return matchesType && matchesTags;
    });
  }, [entries, typeFilter, selectedTags]);

  function handleNeedMoreData(externalPage: number) {
    const nextStart = (externalPage - 1) * EXTERNAL_ITEMS_PER_PAGE;
    setStart(nextStart);
  }

  async function handlePreRequestData(externalPage: number): Promise<number> {
    if (!userId) return 0;
    const nextStart = (externalPage - 1) * EXTERNAL_ITEMS_PER_PAGE;
    const result = await queryClient.fetchQuery<BookmarkPageQueryResult>({
      queryKey: [
        "user-bookmarks",
        userId,
        {
          start: nextStart,
          limit: EXTERNAL_ITEMS_PER_PAGE,
        },
      ],
      queryFn: async () => {
        const reactionList = await reactionApi.list({
          userId,
          reaction: "bookmark",
          start: nextStart,
          limit: EXTERNAL_ITEMS_PER_PAGE,
        });

        const reactions = reactionList.reactions ?? [];
        const total = reactionList.total ?? 0;

        if (reactions.length === 0) {
          return { entries: [], total };
        }

        const targetIds = Array.from(
          new Set(reactions.map((r) => r.targetId).filter(Boolean)),
        );

        const units = await Promise.all(
          targetIds.map(async (targetId) => {
            try {
              const unit = await unitApi.get(targetId);
              return unit;
            } catch (e) {
              console.error("Failed to load unit for bookmark", targetId, e);
              return null;
            }
          }),
        );
        const unitMap = new Map<string, UnitDTO>();
        units.forEach((unit) => {
          if (unit) {
            unitMap.set(unit.id, unit);
          }
        });

        const tagResults = await Promise.all(
          targetIds.map(async (targetId) => {
            try {
              const res = await reactionApi.getBookmarkTags(targetId);
              return { targetId, tags: res.tags ?? [] };
            } catch (e) {
              console.error(
                "Failed to load bookmark tags for target",
                targetId,
                e,
              );
              return { targetId, tags: [] as string[] };
            }
          }),
        );

        const tagMap = new Map<string, string[]>();
        tagResults.forEach((result) => {
          tagMap.set(result.targetId, result.tags);
        });

        const nextEntries = reactions
          .map((reaction) => {
            const unit = unitMap.get(reaction.targetId);
            if (!unit) return null;
            const tags = tagMap.get(reaction.targetId) ?? [];

            return {
              unit,
              createdAt: reaction.createdAt,
              tags,
            };
          })
          .filter((entry) => entry !== null) as BookmarkEntry[];

        return {
          entries: nextEntries,
          total,
        };
      },
      staleTime: 1000 * 60 * 2,
    });

    return result.entries.length;
  }

  const handleEntryRemoved = (targetId: string) => {
    setEntries((prev) => prev.filter((entry) => entry.unit.id !== targetId));
    setTotalItems((prev) => Math.max(0, prev - 1));
  };

  const handleEntryTagsUpdated = (targetId: string, tags: string[]) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.unit.id === targetId ? { ...entry, tags } : entry,
      ),
    );
  };

  useEffect(() => {
    setCurrentPage(1);
    paginatorRef.current?.resetPaginationPageNumber();
  }, []);

  if (!userId) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-[60px] text-center">
        <Typography variant="h5" className="mb-4">
          请先登录以查看收藏
        </Typography>
        <Typography variant="body2" color="textSecondary">
          登录后，我们会在这里展示你对书籍、书单、评论等内容的收藏。
        </Typography>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-[60px] text-center">
        <div className="py-10">加载中...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-[60px] text-center text-red-500">
        加载收藏时出错，请稍后重试。
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto mt-[60px] px-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Typography variant="h5" className="font-bold">
            我的收藏
          </Typography>
          <Typography variant="body2" color="textSecondary">
            根据内容类型和书签标签快速筛选、管理你的收藏。
          </Typography>
        </div>

        <div className="flex items-center gap-3">
          <Select
            size="small"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            displayEmpty
          >
            <MenuItem value="">全部类型</MenuItem>
            {UNIT_TYPE_OPTIONS.filter((v) => v).map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
          <Button
            variant="text"
            color="primary"
            onClick={() => navigate({ to: "/user/me" })}
          >
            返回
          </Button>
        </div>
      </div>

      {allBookmarkTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1 text-sm">
          <span className="text-gray-500 mr-1">标签：</span>
          {allBookmarkTags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              color={selectedTags.includes(tag) ? "primary" : "default"}
              onClick={() =>
                setSelectedTags((prev) =>
                  prev.includes(tag)
                    ? prev.filter((t) => t !== tag)
                    : [...prev, tag],
                )
              }
            />
          ))}
        </div>
      )}

      <div>
        <UserBookmarkTagsCard userId={userId} />
      </div>

      {entries.length === 0 ? (
        <div className="py-10 text-center text-gray-500">暂无收藏内容。</div>
      ) : filteredEntries.length === 0 ? (
        <div className="py-10 text-center text-gray-500">
          暂无符合条件的收藏内容。
        </div>
      ) : (
        <Box>
          <UniversalPaginator<BookmarkEntry>
            ref={paginatorRef}
            data={filteredEntries}
            totalExternalItems={totalItems}
            itemsPerPage={ITEMS_PER_PAGE}
            externalItemsPerPage={EXTERNAL_ITEMS_PER_PAGE}
            sortType="time"
            sortOrder="desc"
            // Bookmark 列表目前没有排序需求，这里传入占位配置
            onSortChange={() => {}}
            requestData={handleNeedMoreData}
            preRequestData={handlePreRequestData}
            isLoading={isLoading && entries.length === 0}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            // 使用自定义顶部区域，这里不需要内置排序控件
            sortControl={(<div />) as React.ReactElement<any>}
          >
            {(pageItems: BookmarkEntry[]) => (
              <div className="space-y-3">
                {pageItems.map((entry) => (
                  <BookmarkItemCard
                    key={entry.unit.id}
                    entry={entry}
                    allBookmarkTags={allBookmarkTags}
                    onRemoved={(targetId) => {
                      handleEntryRemoved(targetId);
                      showAlert("已取消收藏");
                    }}
                    onTagsUpdated={(targetId, tags) => {
                      handleEntryTagsUpdated(targetId, tags);
                      showAlert("书签标签已更新");
                    }}
                  />
                ))}
              </div>
            )}
          </UniversalPaginator>
        </Box>
      )}
    </div>
  );
};
