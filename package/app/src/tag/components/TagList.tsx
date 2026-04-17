import { Chip, Typography } from "@mui/material";
import type { UnitTagDTO } from "@rezics/contract";
import type React from "react";
import { useCallback, useState } from "react";
import { TagDetailCard } from "./TagCards";

interface SingleTagChipProps {
  tag: UnitTagDTO;
  className?: string;
  autoSelectFirst?: boolean;
  activeId?: string | null;
  handleClick?: (e: React.MouseEvent, tag: UnitTagDTO) => void;
}

export function SingleTagChip({
  tag,
  className,
  autoSelectFirst,
}: SingleTagChipProps) {
  const [activeId, setActiveId] = useState<string | null>(
    autoSelectFirst ? tag.tagUnitId : null,
  );
  const handleClick = useCallback(
    (e: React.MouseEvent, tag: UnitTagDTO) => {
      if (e.ctrlKey) {
        window.open(`/tag/${tag.tagUnitId}`, "_blank");
        return;
      }
      setActiveId(tag.tagUnitId === activeId ? null : tag.tagUnitId);
    },
    [activeId],
  );

  const label = tag.tagUnitId;

  return (
    <div className={className}>
      <Chip
        label={`${label} (${tag.score})`}
        size="small"
        clickable
        color={tag.tagUnitId === activeId ? "primary" : "default"}
        onClick={(e) => handleClick(e, tag)}
      />
      {activeId && (
        <div className="mt-4">
          <TagDetailCard tag={tag} />
        </div>
      )}
    </div>
  );
}

export const TagList: React.FC<{
  tags: UnitTagDTO[];
  className?: string;
  autoSelectFirst?: boolean;
}> = ({ tags, className, autoSelectFirst }) => {
  const [activeId, setActiveId] = useState<string | null>(
    autoSelectFirst && tags.length > 0 ? tags[0].tagUnitId : null,
  );
  const activeTag = tags.find((t) => t.tagUnitId === activeId) || null;

  const handleClick = useCallback(
    (e: React.MouseEvent, tag: UnitTagDTO) => {
      if (e.ctrlKey) {
        window.open(`/tag/${tag.tagUnitId}`, "_blank");
        return;
      }
      setActiveId(tag.tagUnitId === activeId ? null : tag.tagUnitId);
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
        {tags.map((tag) => {
          const label = tag.tagUnitId;
          return (
            <div key={tag.tagUnitId} className="flex items-center">
              <Chip
                label={`${label} (${tag.score})`}
                size="small"
                clickable
                color={tag.tagUnitId === activeId ? "primary" : "default"}
                onClick={(e) => handleClick(e, tag)}
              />
            </div>
          );
        })}
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
