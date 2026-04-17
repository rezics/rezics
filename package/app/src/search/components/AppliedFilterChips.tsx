import CloseIcon from "@mui/icons-material/Close";
import { Chip, Stack } from "@mui/material";
import type React from "react";

export type AppliedFilter = {
  key: string;
  label: string;
  removable?: boolean;
};

export type AppliedFilterChipsProps = {
  filters: AppliedFilter[];
  onRemove?: (key: string) => void;
};

export const AppliedFilterChips: React.FC<AppliedFilterChipsProps> = ({
  filters,
  onRemove,
}) => {
  if (filters.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {filters.map((filter) => (
        <Chip
          key={filter.key}
          label={filter.label}
          size="small"
          variant="outlined"
          onDelete={
            filter.removable !== false && onRemove
              ? () => onRemove(filter.key)
              : undefined
          }
          deleteIcon={<CloseIcon fontSize="small" />}
        />
      ))}
    </Stack>
  );
};
