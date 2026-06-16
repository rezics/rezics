import type { UnitTagDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { unitHref } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
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
  const handleClick = (e: React.MouseEvent, tag: UnitTagDTO) => {
    if (e.ctrlKey) {
      window.open(
        unitHref({ type: "TAG", unitId: tag.tagUnitId, slug: null }),
        "_blank",
      );
      return;
    }
    setActiveId(tag.tagUnitId === activeId ? null : tag.tagUnitId);
  };

  const label = tag.tagUnitId;
  const isActive = tag.tagUnitId === activeId;

  return (
    <div className={className}>
      <Badge
        variant={isActive ? "default" : "secondary"}
        className="cursor-pointer"
        onClick={(e) => handleClick(e, tag)}
      >
        {label} ({tag.score})
      </Badge>
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
  const { t } = useTranslation(["community"]);
  const [activeId, setActiveId] = useState<string | null>(
    autoSelectFirst && tags.length > 0 ? tags[0].tagUnitId : null,
  );
  const activeTag = tags.find((t) => t.tagUnitId === activeId) || null;

  const handleClick = (e: React.MouseEvent, tag: UnitTagDTO) => {
    if (e.ctrlKey) {
      window.open(
        unitHref({ type: "TAG", unitId: tag.tagUnitId, slug: null }),
        "_blank",
      );
      return;
    }
    setActiveId(tag.tagUnitId === activeId ? null : tag.tagUnitId);
  };

  if (tags.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-text-secondary">
          {t("community:tag_empty")}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const label = tag.tagUnitId;
          const isActive = tag.tagUnitId === activeId;
          return (
            <div key={tag.tagUnitId} className="flex items-center">
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={cn("cursor-pointer")}
                onClick={(e) => handleClick(e, tag)}
              >
                {label} ({tag.score})
              </Badge>
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
