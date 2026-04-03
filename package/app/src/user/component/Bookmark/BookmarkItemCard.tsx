import React, {useEffect, useState} from 'react';
import {useAlertStore} from '@app/state/windowAlertStore';
import {useDeleteReactionMutation} from '@rezics/api/reaction/reaction.mutations';
import {useSetBookmarkTagsMutation} from '@rezics/api/reaction/reaction.mutations';
import {
  Typography,
  TextField,
  Chip,
  Button,
  IconButton,
  Autocomplete,
  Paper,
  Tooltip,
} from '@mui/material';
import {Delete} from '@mui/icons-material';
import {type BookmarkEntry} from '../../page/BookmarkPage';
import {buildUnitUrl} from '@/shared/util/build-url';
import {Link} from '@rezics/ui/primitive/link/Link.tsx';

type BookmarkItemCardProps = {
  entry: BookmarkEntry;
  allBookmarkTags: string[];
  onRemoved?: (targetId: string) => void;
  onTagsUpdated?: (targetId: string, tags: string[]) => void;
};

export const BookmarkItemCard: React.FC<BookmarkItemCardProps> = ({
  entry,
  allBookmarkTags,
  onRemoved,
  onTagsUpdated,
}) => {
  const {unit, createdAt, tags: initialTags} = entry;
  const [localTags, setLocalTags] = useState<string[]>(initialTags ?? []);
  const [newTag, setNewTag] = useState('');
  const {show: showAlert} = useAlertStore();

  const unitUrl = buildUnitUrl(unit);

  useEffect(() => {
    setLocalTags(initialTags ?? []);
  }, [initialTags]);

  const deleteReactionMutation = useDeleteReactionMutation({
    onSuccess: (_data, variables) => {
      onRemoved?.(variables.targetId);
    },
  });

  const setBookmarkTagsMutation = useSetBookmarkTagsMutation({
    onSuccess: () => {
      onTagsUpdated?.(unit.id, localTags);
    },
  });

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
    onTagsUpdated?.(unit.id, next);
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
    onTagsUpdated?.(unit.id, next);
  };

  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleDateString()
    : '';

  return (
    <Paper
      elevation={2}
      className="flex items-start justify-between rounded-md px-3 py-2"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Tooltip title="打开内容页面" placement="top">
            <Link to={unitUrl}>
              <Chip
                label={unit.type || 'UNKNOWN'}
                size="small"
                variant="outlined"
                onClick={() => {}}
                className="text-[11px]"
              />
            </Link>
          </Tooltip>
          {createdLabel && (
            <Typography variant="caption" color="textSecondary">
              收藏于 {createdLabel}
            </Typography>
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
          <Typography variant="caption" className="text-gray-500 mr-1">
            书签标签:
          </Typography>
          {localTags.length === 0 ? (
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
          <Autocomplete
            size="small"
            options={allBookmarkTags} // 你的完整标签列表
            value={newTag}
            onChange={(_event, value) => setNewTag(value ?? '')} // 只能选列表中的项目
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
    </Paper>
  );
};
