import type {
  ReactionHistoryGivenItem,
  ReactionHistoryReceivedItem,
} from "@rezics/api/reaction/reaction.types";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { Sparkles } from "lucide-react";
import { LoadMoreFooter } from "@/shared/ui/LoadMoreFooter";
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
  const { t } = useTranslation(["common", "community"]);
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
        title={t("community:reactions_load_failed")}
        description={error.message}
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("common:retry")}
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={
          mode === "given"
            ? t("community:reactions_empty_given")
            : t("community:reactions_empty_received")
        }
        description={
          mode === "given"
            ? t("community:reactions_empty_given_description")
            : t("community:reactions_empty_received_description")
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

      <LoadMoreFooter
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        showEndOfList
        autoLoad
        className="py-6"
      />
    </div>
  );
}
