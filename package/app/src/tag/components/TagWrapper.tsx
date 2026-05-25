import type { TagFilters } from "@rezics/api/tag/tag";
import { tagContextQuery, tagQueries } from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { RealmTagHighlights } from "./RealmTagHighlights";
import TagList from "./TagList";
import { useMessage } from "@rezics/i18n/react";
import { tag_load_failed, tag_loading } from "@rezics/i18n/messages";
const m = {
  tag_load_failed,
  tag_loading,
};

const i18nMessages = {
  tag_load_failed,
  tag_loading,
};

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
  const m = useMessage(i18nMessages);
  const { data, isLoading, error } = useQuery(tagQueries.list(filters));
  const tags: UnitTagDTO[] = useMemo(() => data?.tags ?? [], [data]);

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

  if (isLoading) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500">{m.tag_loading()}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-sm text-red-600">
          {m.tag_load_failed({
            error: String((error as any)?.message ?? error),
          })}
        </div>
      </div>
    );
  }

  // For grouped mode, score-based grouping (no domain concept in new model)
  // Render as flat list for now
  return (
    <div className={className}>
      <TagList tags={tags} />
      <RealmTagHighlights realmHighlights={realmHighlights} />
    </div>
  );
};

export default TagWrapper;
