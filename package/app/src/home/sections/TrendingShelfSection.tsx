import { buttonVariants } from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { ShelfDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { HorizontalShelfCarousel } from "@/shelf/components/HorizontalShelfCarousel";
import * as m from "@rezics/i18n/messages";

export type TrendingShelfSectionProps = {
  title?: string;
  limit?: number;
};

export const TrendingShelfSection: React.FC<TrendingShelfSectionProps> = ({
  title,
  limit = 8,
}) => {
  const resolvedTitle = title ?? m.page_home_sections_trending_shelves();
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
        <h6 className="text-base font-semibold mb-3">{resolvedTitle}</h6>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full @container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Link to="/shelf" className={buttonVariants({ variant: "ghost" })}>
          More
        </Link>
      </div>

      {isLoading && <Spinner size="sm" />}

      <div>
        <HorizontalShelfCarousel shelves={items} />
      </div>
    </div>
  );
};

export default TrendingShelfSection;
