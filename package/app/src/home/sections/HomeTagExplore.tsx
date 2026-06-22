import { tagQueries } from "@rezics/api/tag/tag.queries";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Badge } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { AppSafeLink } from "@/shared/ui/link";
import { officialZoneSearchHref } from "@/zone";
import { HomeSectionShell } from "./HomeSectionShell";

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
  const { t } = useTranslation(["page"]);
  const locale = useLocale();
  const resolvedTitle = title ?? t("page:home_sections_tag_explore");

  const { data, isLoading, error } = useQuery(tagQueries.list({ limit }));
  const tagUnitIds = useMemo(
    () => (data?.tags ?? []).slice(0, maxTags).map((t) => t.tagUnitId),
    [data, maxTags],
  );
  const { data: translations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, locale),
  );

  return (
    <HomeSectionShell title={resolvedTitle} isLoading={isLoading} error={error}>
      <div className="flex flex-wrap gap-2">
        {tagUnitIds.map((id) => {
          const label = translations?.[id]?.name ?? id;
          const slug = translations?.[id]?.slug ?? "";
          return (
            <AppSafeLink
              key={id}
              href={officialZoneSearchHref("book", {
                q: `[${slug || label}]`,
              })}
            >
              <Badge variant="outline" className="cursor-pointer">
                {label}
              </Badge>
            </AppSafeLink>
          );
        })}
      </div>
    </HomeSectionShell>
  );
};
