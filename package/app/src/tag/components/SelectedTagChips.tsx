import CancelIcon from "@mui/icons-material/Cancel";
import { Chip } from "@mui/material";
import type React from "react";
import type { InjectedTag } from "@/search/models/injectedTags";

export type SelectedTagChipsProps = {
  tags: InjectedTag[];
  onRemove?: (unitId: string) => void;
  className?: string;
};

/**
 * Render the currently-applied tag filter as a row of chips.
 *
 * Used by search pages to echo the tags carried in via navigation state
 * (`InjectedTag[]`). Name is taken from the injected payload, so no
 * additional translation fetch is needed at render time.
 */
export const SelectedTagChips: React.FC<SelectedTagChipsProps> = ({
  tags,
  onRemove,
  className,
}) => {
  if (tags.length === 0) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => {
          const label = tag.name || tag.slug || tag.unitId;
          return (
            <Chip
              key={tag.unitId}
              label={label}
              size="small"
              color="primary"
              variant="outlined"
              onDelete={onRemove ? () => onRemove(tag.unitId) : undefined}
              deleteIcon={
                onRemove ? <CancelIcon fontSize="small" /> : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
};

export default SelectedTagChips;
