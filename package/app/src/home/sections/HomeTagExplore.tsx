import { Badge } from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { Link } from "@/shared/ui/link";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { useLocale } from "@rezics/i18n/react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import * as m from "@rezics/i18n/messages";

export type HomeTagExploreProps = {
  title?: string;
  limit?: number;
  maxTags?: number;
};

export const HomeTagExplore: React.FC<HomeTagExploreProps> = ({
  title,
  limit = 60,
  maxTags = 18,
}) => {
  const locale = useLocale();
  const resolvedTitle = title ?? m.page_home_sections_tag_explore();

  const { data, isLoading, error } = useQuery(tagQueries.list({ limit }));
  const tagUnitIds = useMemo(
    () => (data?.tags ?? []).slice(0, maxTags).map((t) => t.tagUnitId),
    [data, maxTags],
  );
  const { data: translations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, locale),
  );

  if (error) {
    return (
      <div className="w-full">
        <h6 className="text-base font-semibold mb-3">{resolvedTitle}</h6>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h6 className="text-base font-semibold m-0">{resolvedTitle}</h6>
        {isLoading && <Spinner size="sm" />}
      </div>
      <div className="flex flex-wrap gap-2">
        {tagUnitIds.map((id) => {
          const label = translations?.[id]?.name ?? id;
          const slug = translations?.[id]?.slug ?? "";
          return (
            <Link key={id} to="/book" search={{ tags: slug || label }}>
              <Badge variant="outline" className="cursor-pointer">
                {label}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default HomeTagExplore;
