import React, {useState, useCallback} from 'react';
import {Chip, Typography} from '@mui/material';
import type {TagDetailDTO} from '@rezics/api/tag/tag';
import {TagDetailCard} from './TagCards';

interface SingleTagChipProps {
  tag: TagDetailDTO;
  className?: string;
  autoSelectFirst?: boolean;
  activeId?: string | null;
  handleClick?: (e: React.MouseEvent, tag: TagDetailDTO) => void;
}

export function SingleTagChip({
  tag,
  className,
  autoSelectFirst,
}: SingleTagChipProps) {
  const [activeId, setActiveId] = useState<string | null>(
    autoSelectFirst ? tag.id : null,
  );
  const handleClick = useCallback(
    (e: React.MouseEvent, tag: TagDetailDTO) => {
      if (e.ctrlKey) {
        window.open(`/tags/${tag.id}`, '_blank');
        return;
      }
      setActiveId(tag.id === activeId ? null : tag.id);
    },
    [activeId],
  );

  return (
    <div className={className}>
      <Chip
        label={tag.name}
        size="small"
        clickable
        color={tag.id === activeId ? 'primary' : 'default'}
        onClick={e => handleClick(e, tag)}
      />
      {activeId && (
        <div className="mt-4">
          <TagDetailCard tag={tag} />
        </div>
      )}
    </div>
  );
}

/**
 * TagList – 展示标签列表（纯展示，不负责数据拉取）
 * 点击某个标签在下方展示 TagDetailCard，按住 Ctrl 点击直接跳转新窗口。
 */
export const TagList: React.FC<{
  tags: TagDetailDTO[];
  className?: string;
  autoSelectFirst?: boolean;
}> = ({tags, className, autoSelectFirst}) => {
  const [activeId, setActiveId] = useState<string | null>(
    autoSelectFirst && tags.length > 0 ? tags[0].id : null,
  );
  const activeTag = tags.find(t => t.id === activeId) || null;

  const handleClick = useCallback(
    (e: React.MouseEvent, tag: TagDetailDTO) => {
      if (e.ctrlKey) {
        window.open(`/tags/${tag.id}`, '_blank');
        return;
      }
      setActiveId(tag.id === activeId ? null : tag.id);
    },
    [activeId],
  );

  if (tags.length === 0) {
    return (
      <div className={className}>
        <Typography variant="body2" color="text.secondary">
          暂无标签
        </Typography>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <div key={tag.id} className="flex items-center">
            <Chip
              label={tag.name}
              size="small"
              clickable
              color={tag.id === activeId ? 'primary' : 'default'}
              onClick={e => handleClick(e, tag)}
            />
          </div>
        ))}
      </div>
      {activeTag && (
        <div className="mt-4">
          <TagDetailCard tag={activeTag} />
        </div>
      )}
    </div>
  );
};

export default TagList;
