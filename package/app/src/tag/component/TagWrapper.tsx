import type { UnitTagDTO } from "@rezics/contract";
import { tagContextQuery, tagQueries } from "@rezics/api/tag/tag";
import type { TagFilters } from "@rezics/api/tag/tag";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useIsMobile } from "@/shared/util/use-media-query";
import { RealmTagHighlights } from "./RealmTagHighlights";
import TagList from "./TagList";

type Mode = "flat" | "grouped";

export type TagWrapperProps = {
  filters?: TagFilters;
  mode?: Mode;
  domainIds?: string[];
  className?: string;
  renderAll?: boolean;
};

/**
 * TagWrapper - now uses UnitTagDTO (scored tags) instead of old TagDTO.
 * Tags have tagUnitId, tagLabel, score, voteCount.
 */
export const TagWrapper: React.FC<TagWrapperProps> = ({
  filters,
  mode = "flat",
  renderAll = false,
  domainIds,
  className,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(tagQueries.list(filters));
  const tags: UnitTagDTO[] = useMemo(() => data?.tags ?? [], [data]);
  const isMobile = useIsMobile();

  const unitId = filters?.unitId;
  const { data: contextData } = useQuery({
    ...tagContextQuery(unitId ?? ""),
    enabled: !!unitId,
  });
  const realmHighlights = useMemo(
    () => contextData?.realmHighlights ?? [],
    [contextData],
  );

  if (isLoading) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500">{t("tag.loading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-sm text-red-600">
          {t("tag.load_failed", {
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
