"use client";

import { useCallback, useTransition, type ReactNode } from "react";

export function PagedList<T>({
  items,
  renderItem,
  hasMore,
  onLoadMore,
  emptyMessage = "Nothing here yet.",
}: {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly hasMore: boolean;
  readonly onLoadMore: () => void;
  readonly emptyMessage?: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleLoadMore = useCallback(() => {
    startTransition(() => {
      onLoadMore();
    });
  }, [onLoadMore]);

  if (items.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="divide-border divide-y">{items.map((item, i) => renderItem(item, i))}</div>
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            className="bg-secondary text-secondary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={isPending}
            onClick={handleLoadMore}
            type="button"
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
