import { Alert, Button, CircularProgress, Typography } from "@mui/material";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { ShelfDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HorizontalShelfCarousel } from "@/shelf/component/HorizontalShelfCarousel";

export type TrendingShelfSectionProps = {
  title?: string;
  limit?: number;
};

export const TrendingShelfSection: React.FC<TrendingShelfSectionProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("page.home.sections.trending_shelves");
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(
    contentSearchQueryOptions({ type: "SHELF", offset: 0, limit }),
  );

  // Content search items cast to ShelfDTO shape (Meilisearch content index)
  const items = useMemo<ShelfDTO[]>(
    () => (data?.items ?? []) as unknown as ShelfDTO[],
    [data],
  );

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {resolvedTitle}
        </Typography>
        <Alert severity="error">{String(error)}</Alert>
      </div>
    );
  }

  return (
    <div className="w-full @container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({ to: "/shelf" })}
        >
          More
        </Button>
      </div>

      {isLoading && <CircularProgress size={20} />}

      <div>
        <HorizontalShelfCarousel shelves={items} />
      </div>
    </div>
  );
};

export default TrendingShelfSection;
