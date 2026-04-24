import { Skeleton, Stack } from "@mui/material";
import type React from "react";

/**
 * Skeleton rows for the pinboard list. Heights are tuned to match
 * the real `PinboardEntryCard` compact/card variants so switching from
 * loading to loaded does not cause layout shift.
 */
interface PinboardSkeletonProps {
  rows?: number;
  rowHeight?: number;
}

export const PinboardSkeleton: React.FC<PinboardSkeletonProps> = ({
  rows = 3,
  rowHeight = 72,
}) => {
  return (
    <Stack spacing={1.5} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
          key={i}
          variant="rounded"
          height={rowHeight}
        />
      ))}
    </Stack>
  );
};
