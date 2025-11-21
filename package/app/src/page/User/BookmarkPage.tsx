import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
  Select,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Button,
  Typography,
  Autocomplete,
} from '@mui/material';
import {Delete} from '@mui/icons-material';
import type {UnitDTO} from '@package/contract';

import {reactionApi, reactionQueries} from '@/api/reaction/reaction';
import {unitApi} from '@/api/unit/unit';
import {useDeleteReactionMutation} from '@/api/reaction/reaction.mutations';
import {useSetBookmarkTagsMutation} from '@/api/reaction/reaction.mutations';
import {useUserStore} from '@/global/userStore';
import {useAlertStore} from '@/global/windowAlertStore';

type BookmarkEntry = {
  unit: UnitDTO;
  createdAt?: string;
};

const UNIT_TYPE_OPTIONS = [
  '',
  'BOOK',
  'REVIEW',
  'READLIST',
  'COMMENT',
  'NOTE',
  'QUOTE',
  'TAG',
  'DOMAIN',
  'IMAGE',
  'VIDEO',
  'CHAPTER',
] as const;

export const BookmarkPage: React.FC = () => {
  const user = useUserStore(state => state.user);
  const userId = user?.unitId;
  const {show: showAlert} = useAlertStore();

  const [typeFilter, setTypeFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  // 记录每个 targetId 是否在当前 tag 筛选下命中，用于决定是否展示「暂无符合条件」
  const [tagMatchMap, setTagMatchMap] = useState<Record<string, boolean>>({});

  const {
    data: entries,
    isLoading,
    isError,
  } = useQuery<BookmarkEntry[]>({
    queryKey: ['bookmarks', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const {reactions} = await reactionApi.list({
        userId,
        reaction: 'bookmark',
        limit: 200,
      });

      if (!reactions.length) return [];

      const targetIds = Array.from(new Set(reactions.map(r => r.targetId)));

      const [unitList] = await Promise.all([
        Promise.all(
          targetIds.map(async id => {
            const unit = await unitApi.get(id);
            return {id, unit};
          }),
        ),
      ]);

      const unitMap = new Map(unitList.map(({id, unit}) => [id, unit]));

      const rawItems = targetIds.map(id => {
        const unit = unitMap.get(id);
        if (!unit) return null;
        const firstReaction = reactions.find(r => r.targetId === id);
        const item: BookmarkEntry = {
          unit,
          createdAt: firstReaction?.createdAt,
        };
        return item;
      });

      return rawItems.filter((x): x is BookmarkEntry => x !== null);
    },
  });

  // 用户级别的标签库（targetId === userId，对前端来说用 "tag" 作为占位 key）
  const {data: userTagLibrary} = useQuery(reactionQueries.bookmarkTags('tag'));

  const filteredEntriesByType = useMemo(() => {
    if (!entries) return [];
    return entries.filter(entry => {
      const matchesType =
        !typeFilter || (entry.unit.type || '').toUpperCase() === typeFilter;
      return matchesType;
    });
  }, [entries, typeFilter]);

  const handleTagMatchChange = useCallback(
    (targetId: string, matches: boolean) => {
      setTagMatchMap(prev => {
        if (prev[targetId] === matches) return prev;
        return {...prev, [targetId]: matches};
      });
    },
    [],
  );

  // 计算在当前 type + tag 筛选下可见的条目数量
  const visibleCountByFilters = useMemo(() => {
    const trimmedTag = tagFilter.trim();
    if (!trimmedTag) {
      return filteredEntriesByType.length;
    }
    return filteredEntriesByType.reduce((count, entry) => {
      const matched = tagMatchMap[entry.unit.id];
      return matched ? count + 1 : count;
    }, 0);
  }, [filteredEntriesByType, tagFilter, tagMatchMap]);

  const allBookmarkTags = useMemo(() => {
    const set = new Set<string>();
    (userTagLibrary?.tags ?? []).forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [userTagLibrary]);

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
            onChange={e => setTypeFilter(e.target.value)}
            displayEmpty
          >
            <MenuItem value="">全部类型</MenuItem>
            {UNIT_TYPE_OPTIONS.filter(v => v).map(type => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>

          <TextField
            size="small"
            label="标签筛选"
            placeholder="输入标签关键字"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
          />
        </div>
      </div>

      {allBookmarkTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1 text-sm">
          <span className="text-gray-500 mr-1">常用标签：</span>
          {allBookmarkTags.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              color={tagFilter === tag ? 'primary' : 'default'}
              onClick={() => setTagFilter(tag)}
            />
          ))}
        </div>
      )}

      <div>
        <UserBookmarkTagsCard userId={userId} />
      </div>

      {visibleCountByFilters === 0 ? (
        <div className="py-10 text-center text-gray-500">
          暂无符合条件的收藏内容。
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntriesByType.map(entry => (
            <BookmarkItemCard
              key={entry.unit.id}
              entry={entry}
              tagFilter={tagFilter}
              allBookmarkTags={allBookmarkTags}
              onTagMatchChange={handleTagMatchChange}
              onRemoved={() => {
                showAlert('已取消收藏');
              }}
              onTagsUpdated={() => {
                showAlert('书签标签已更新');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type BookmarkItemCardProps = {
  entry: BookmarkEntry;
  tagFilter: string;
  allBookmarkTags: string[];
  onRemoved?: () => void;
  onTagsUpdated?: () => void;
  onTagMatchChange?: (targetId: string, matches: boolean) => void;
};

const BookmarkItemCard: React.FC<BookmarkItemCardProps> = ({
  entry,
  tagFilter,
  allBookmarkTags,
  onRemoved,
  onTagsUpdated,
  onTagMatchChange,
}) => {
  const {unit, createdAt} = entry;
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const {show: showAlert} = useAlertStore();

  // 每个卡片自行查询当前 target 的书签标签，实现「两段式查询」
  const {data: bookmarkTagsData} = useQuery(
    reactionQueries.bookmarkTags(unit.id),
  );

  useEffect(() => {
    if (bookmarkTagsData?.tags) {
      setLocalTags(bookmarkTagsData.tags);
    } else {
      setLocalTags([]);
    }
  }, [bookmarkTagsData]);

  const deleteReactionMutation = useDeleteReactionMutation({
    onSuccess: () => {
      onRemoved?.();
    },
  });

  const setBookmarkTagsMutation = useSetBookmarkTagsMutation({
    onSuccess: () => {
      onTagsUpdated?.();
    },
  });

  const trimmedTagFilter = tagFilter.trim().toLowerCase();
  const matchesTag =
    !trimmedTagFilter ||
    localTags.some(tag => tag.toLowerCase().includes(trimmedTagFilter));

  useEffect(() => {
    onTagMatchChange?.(unit.id, matchesTag);
  }, [unit.id, matchesTag, onTagMatchChange]);

  const handleRemoveBookmark = () => {
    deleteReactionMutation.mutate({
      targetId: unit.id,
      reaction: 'bookmark',
    });
  };

  const handleRemoveTag = (tag: string) => {
    const next = localTags.filter(t => t !== tag);
    setLocalTags(next);
    setBookmarkTagsMutation.mutate({
      targetId: unit.id,
      tags: next,
    });
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (localTags.includes(trimmed)) {
      showAlert('该标签已存在');
      return;
    }
    const next = [...localTags, trimmed];
    setLocalTags(next);
    setNewTag('');
    setBookmarkTagsMutation.mutate({
      targetId: unit.id,
      tags: next,
    });
  };

  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleDateString()
    : '';

  // 在 tag 筛选不命中的情况下直接不渲染内容（组件仍然挂载，副作用仍会执行）
  if (trimmedTagFilter && !matchesTag) {
    return null;
  }

  return (
    <div className="flex items-start justify-between border rounded-md px-3 py-2 bg-white shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block text-[11px] px-2 py-[2px] rounded-full bg-gray-100 text-gray-600">
            {unit.type || 'UNKNOWN'}
          </span>
          {createdLabel && (
            <span className="text-[11px] text-gray-400">
              收藏于 {createdLabel}
            </span>
          )}
        </div>
        <Typography variant="subtitle1" className="font-semibold truncate mb-1">
          {unit.title || '(未命名内容)'}
        </Typography>
        {unit.content && (
          <Typography
            variant="body2"
            color="textSecondary"
            className="line-clamp-2"
          >
            {unit.content}
          </Typography>
        )}

        <div className="mt-2 flex flex-wrap gap-1 items-center">
          <span className="text-xs text-gray-500 mr-1">书签标签:</span>
          {localTags.length === 0 ? (
            <span className="text-xs text-gray-400">暂无标签</span>
          ) : (
            localTags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => handleRemoveTag(tag)}
              />
            ))
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Autocomplete
            size="small"
            options={allBookmarkTags} // 你的完整标签列表
            value={newTag}
            onChange={(event, value) => setNewTag(value ?? '')} // 只能选列表中的项目
            renderInput={params => (
              <TextField
                {...params}
                placeholder="选择标签"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(); // 保持你之前的行为
                  }
                }}
              />
            )}
            sx={{minWidth: 160}}
          />

          <Button
            variant="outlined"
            size="small"
            onClick={handleAddTag}
            disabled={setBookmarkTagsMutation.isPending}
          >
            添加
          </Button>
        </div>
      </div>

      <div className="ml-3 flex flex-col items-end gap-2">
        <IconButton
          size="small"
          color="error"
          onClick={handleRemoveBookmark}
          title="取消收藏"
        >
          <Delete fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
};

type UserBookmarkTagsCardProps = {
  userId: string;
};

const UserBookmarkTagsCard: React.FC<UserBookmarkTagsCardProps> = ({
  userId,
}) => {
  const {show: showAlert} = useAlertStore();
  const targetId = 'tag';

  const {data, isLoading, isError} = useQuery(
    reactionQueries.bookmarkTags(targetId),
  );

  const [localTags, setLocalTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (data?.tags) {
      setLocalTags(data.tags);
    } else {
      setLocalTags([]);
    }
  }, [data]);

  const setBookmarkTagsMutation = useSetBookmarkTagsMutation({
    onSuccess: () => {
      showAlert('标签库已更新');
    },
  });

  const handleRemoveTag = (tag: string) => {
    const next = localTags.filter(t => t !== tag);
    setLocalTags(next);
    setBookmarkTagsMutation.mutate({
      targetId,
      tags: next,
    });
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (localTags.includes(trimmed)) {
      showAlert('该标签已存在');
      return;
    }
    const next = [...localTags, trimmed];
    setLocalTags(next);
    setNewTag('');
    setBookmarkTagsMutation.mutate({
      targetId,
      tags: next,
    });
  };

  return (
    <div className="flex items-start justify-between border rounded-md px-3 py-2 bg-white shadow-sm mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block text-[11px] px-2 py-[2px] rounded-full bg-blue-50 text-blue-600">
            TAG-LIB
          </span>
          <span className="text-[11px] text-gray-400">
            用户 {userId} 的标签库
          </span>
        </div>
        <Typography variant="subtitle1" className="font-semibold truncate mb-1">
          标签管理
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          className="line-clamp-2"
        >
          配置你在本地支持使用的所有标签，这些标签可以在收藏的内容中复用。
        </Typography>

        <div className="mt-2 flex flex-wrap gap-1 items-center">
          <span className="text-xs text-gray-500 mr-1">可用标签:</span>
          {isLoading ? (
            <span className="text-xs text-gray-400">加载中…</span>
          ) : isError ? (
            <span className="text-xs text-red-500">加载失败</span>
          ) : localTags.length === 0 ? (
            <span className="text-xs text-gray-400">暂无标签</span>
          ) : (
            localTags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => handleRemoveTag(tag)}
              />
            ))
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <TextField
            size="small"
            placeholder="添加新标签"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={handleAddTag}
            disabled={setBookmarkTagsMutation.isPending}
          >
            添加
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookmarkPage;
