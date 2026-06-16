import { Skeleton } from "@rezics/ui/shadcn";
import type React from "react";

/**
 * Skeleton rows for the pinboard list. Heights are tuned to match
 * the real `PinboardEntryCard` compact/card variants so switching from
 * loading to loaded does not cause layout shift.
 * pinboard 列表的骨架行。高度经过调整以匹配真实的 `PinboardEntryCard`
 * compact/card 变体，从而在加载态切换到已加载态时不会引起布局抖动。
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
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
          key={i}
          className="rounded-md w-full"
          style={{ height: rowHeight }}
        />
      ))}
    </div>
  );
};
