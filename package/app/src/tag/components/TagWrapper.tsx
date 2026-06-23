import type { TagFilters } from "@rezics/api/tag/tag";
import { tagContextQuery, tagQueries } from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryBoundary } from "@/core/components/QueryBoundary";
import { RealmTagHighlights } from "./RealmTagHighlights";
import { TagList } from "./TagList";

type Mode = "flat" | "grouped";

export type TagWrapperProps = {
  filters?: TagFilters;
  mode?: Mode;
  domainIds?: string[];
  className?: string;
  renderAll?: boolean;
};

export const TagWrapper: React.FC<TagWrapperProps> = ({
  filters,
  mode: _mode = "flat",
  renderAll: _renderAll = false,
  domainIds: _domainIds,
  className,
}) => {
  const query = useQuery(tagQueries.list(filters));

  const unitId = filters?.unitId;
  const { data: contextData } = useQuery({
    ...tagContextQuery(unitId ?? ""),
    enabled: !!unitId,
  });
  const realmHighlights = useMemo(
    () =>
      (contextData?.realmHighlights ?? []).map((highlight) => ({
        ...highlight,
        tags: highlight.tags.map((tag) => tag.label),
      })),
    [contextData],
  );

  return (
    <div className={className}>
      <QueryBoundary query={query}>
        {(data) => {
          const tags: UnitTagDTO[] = data?.tags ?? [];
          return (
            <>
              <TagList tags={tags} />
              <RealmTagHighlights realmHighlights={realmHighlights} />
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
};
