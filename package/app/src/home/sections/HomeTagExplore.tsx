import { Chip, CircularProgress, Typography } from "@mui/material";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import i18n from "i18next";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";

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
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("page.home.sections.tag_explore");

  const { data, isLoading, error } = useQuery(
    tagQueries.list({ limit }),
  );
  const tagUnitIds = useMemo(
    () => (data?.tags ?? []).slice(0, maxTags).map((t) => t.tagUnitId),
    [data, maxTags],
  );
  const { data: translations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, i18n.language),
  );

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {resolvedTitle}
        </Typography>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <Typography variant="h6">{resolvedTitle}</Typography>
        {isLoading && <CircularProgress size={20} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {tagUnitIds.map((id) => {
          const label = translations?.[id]?.name ?? id;
          const slug = translations?.[id]?.slug ?? "";
          return (
            <Link
              key={id}
              to="/book"
              search={{ tags: slug || label }}
            >
              <Chip label={label} clickable variant="outlined" />
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default HomeTagExplore;
