import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reactionQueries } from '@package/api/reaction/reaction';
import { useAlertStore } from '@/global/windowAlertStore';
import { useSetBookmarkTagsMutation } from '@package/api/reaction/reaction.mutations';
import { Typography, TextField, Chip, Button, Paper } from '@mui/material';

type UserBookmarkTagsCardProps = {
  userId: string;
};

export const UserBookmarkTagsCard: React.FC<UserBookmarkTagsCardProps> = ({
  userId,
}) => {
  const { show: showAlert } = useAlertStore();
  const targetId = 'tag';

  const { data, isLoading, isError } = useQuery(
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
    <Paper
      elevation={2}
      className="flex items-start justify-between rounded-md px-3 py-2 bg-white mb-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Chip
            label="TAG-LIB"
            size="small"
            color="primary"
            variant="outlined"
            className="text-[11px]"
          />
          <Typography variant="caption" color="textSecondary">
            用户 {userId} 的标签库
          </Typography>
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
          <Typography variant="caption" className="text-gray-500 mr-1">
            可用标签:
          </Typography>
          {isLoading ? (
            <Typography variant="caption" color="textSecondary">
              加载中…
            </Typography>
          ) : isError ? (
            <Typography variant="caption" color="error">
              加载失败
            </Typography>
          ) : localTags.length === 0 ? (
            <Typography variant="caption" color="textSecondary">
              暂无标签
            </Typography>
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
    </Paper>
  );
};
