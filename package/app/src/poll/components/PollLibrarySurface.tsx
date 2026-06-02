import { useCurrentUserId } from "@rezics/api/hooks";
import { usePollSearchQuery } from "@rezics/api/meili/meili";
import type { PollSearchDocument } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Button, Input } from "@rezics/ui/shadcn";
import { BarChart3, CheckCircle2, Circle, Search, Vote } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

type UsageFilter = "all" | "used" | "unused";
type ClosedFilter = "all" | "open" | "closed";

const usageFilterLabels = {
  all: "community:poll_library_filter_usage_all",
  used: "community:poll_library_filter_usage_used",
  unused: "community:poll_library_filter_usage_unused",
} as const;

const closedFilterLabels = {
  all: "community:poll_library_filter_closed_all",
  open: "community:poll_library_filter_closed_open",
  closed: "community:poll_library_filter_closed_closed",
} as const;

export interface PollLibrarySurfaceProps {
  ownerUserId?: string | null;
  renderAction?: (poll: PollSearchDocument) => React.ReactNode;
}

function pollTitle(poll: PollSearchDocument) {
  return poll.titles[0] || poll.unitId;
}

function pollDescription(poll: PollSearchDocument) {
  return poll.descriptions[0] || poll.optionLabels.slice(0, 3).join(" · ");
}

export function PollLibrarySurface({
  ownerUserId,
  renderAction,
}: PollLibrarySurfaceProps) {
  const { t } = useTranslation(["common", "community"]);
  const currentUserId = useCurrentUserId();
  const resolvedOwnerUserId =
    ownerUserId === undefined ? currentUserId : ownerUserId;
  const [keyword, setKeyword] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [closedFilter, setClosedFilter] = useState<ClosedFilter>("all");

  const query = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      ownerUserId: resolvedOwnerUserId ?? undefined,
      used: usageFilter === "all" ? undefined : usageFilter === "used",
      closed: closedFilter === "all" ? undefined : closedFilter === "closed",
      sort: keyword.trim()
        ? { field: "relevance" as const }
        : { field: "updatedAt" as const, order: "desc" as const },
      limit: 20,
    }),
    [closedFilter, keyword, resolvedOwnerUserId, usageFilter],
  );

  const { data, isLoading, error } = usePollSearchQuery(query);
  const polls = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("community:poll_library_search_placeholder")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "used", "unused"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={usageFilter === value ? "secondary" : "ghost"}
              onClick={() => setUsageFilter(value)}
            >
              {value === "used" ? (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              ) : value === "unused" ? (
                <Circle className="mr-1 h-4 w-4" />
              ) : (
                <BarChart3 className="mr-1 h-4 w-4" />
              )}
              {t(usageFilterLabels[value])}
            </Button>
          ))}
          {(["all", "open", "closed"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={closedFilter === value ? "secondary" : "ghost"}
              onClick={() => setClosedFilter(value)}
            >
              {t(closedFilterLabels[value])}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="m-0 text-sm leading-ui text-text-secondary">
          {t("common:loading")}
        </p>
      ) : error ? (
        <p className="m-0 text-sm leading-ui text-error-text">
          {t("community:poll_library_error")}
        </p>
      ) : polls.length === 0 ? (
        <p className="m-0 text-sm leading-ui text-text-secondary">
          {t("community:poll_library_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {polls.map((poll) => (
            <div
              key={poll.unitId}
              className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <Vote className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                <div className="min-w-0">
                  <h3 className="m-0 truncate text-sm font-medium leading-ui text-text-primary">
                    {pollTitle(poll)}
                  </h3>
                  {pollDescription(poll) ? (
                    <p className="m-0 mt-1 line-clamp-2 text-xs leading-dense text-text-secondary">
                      {pollDescription(poll)}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">
                      {t("community:poll_library_usage_count", {
                        count: poll.usageCount,
                      })}
                    </Badge>
                    <Badge variant={poll.closed ? "secondary" : "outline"}>
                      {poll.closed
                        ? t("community:poll_library_closed")
                        : t("community:poll_library_open")}
                    </Badge>
                  </div>
                </div>
              </div>
              {renderAction ? (
                <div className="shrink-0">{renderAction(poll)}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
