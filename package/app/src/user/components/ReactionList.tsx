import type {
  ReactionHistoryGivenItem,
  ReactionHistoryReceivedItem,
} from "@rezics/api/reaction/reaction.types";
import { EmptyState, Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { ReactionHistoryItem } from "./ReactionHistoryItem";

interface ReactionListGivenProps {
  mode: "given";
  items: ReactionHistoryGivenItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  refetch: () => void;
}

interface ReactionListReceivedProps {
  mode: "received";
  items: ReactionHistoryReceivedItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  refetch: () => void;
}

export type ReactionListProps =
  | ReactionListGivenProps
  | ReactionListReceivedProps;

export function ReactionList(props: ReactionListProps) {
  const {
    mode,
    items,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = props;

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fetchNextPage();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <EmptyState
        title="Couldn't load reactions"
        description={error.message}
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={
          mode === "given" ? "No reactions yet" : "No reactions received yet"
        }
        description={
          mode === "given"
            ? "Reactions to other content will appear here."
            : "Reactions to this profile's content will appear here."
        }
        icon={<Sparkles width={28} height={28} />}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {mode === "given"
        ? items.map((item) => (
            <ReactionHistoryItem key={item.id} mode="given" item={item} />
          ))
        : items.map((item) => (
            <ReactionHistoryItem key={item.id} mode="received" item={item} />
          ))}

      {hasNextPage ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-6"
        >
          {isFetchingNextPage ? (
            <Spinner />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              className="text-text-secondary"
            >
              Load more
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary text-center py-6">
          End of list
        </p>
      )}
    </div>
  );
}
