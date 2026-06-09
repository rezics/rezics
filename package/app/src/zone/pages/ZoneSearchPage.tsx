import { zoneByUnitIdQueryOptions } from "@rezics/api/zone/zone";
import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { FederatedSearchPage } from "@/search";
import { useAllowedRatings } from "@/user";
import { useZone } from "../hooks/useZone";
import { zoneFiltersToSearchQuery } from "../models/zone";

type ZoneSearchPageBaseProps = {
  initialQuery?: SearchQuery;
  initialCategory?: SearchCategory;
  onCategoryChange: (next: SearchCategory) => void;
};

export type ZoneSearchPageProps = ZoneSearchPageBaseProps &
  (
    | {
        slug: string;
        unitId?: never;
      }
    | {
        slug?: never;
        unitId: string;
      }
  );

export const ZoneSearchPage: React.FC<ZoneSearchPageProps> = ({
  slug,
  unitId,
  initialQuery,
  initialCategory,
  onCategoryChange,
}) => {
  const { t } = useTranslation(["common", "search"]);
  const slugQuery = useZone(slug ?? "");
  const unitQuery = useQuery(zoneByUnitIdQueryOptions(unitId ?? ""));
  const zone = slug ? slugQuery.zone : unitQuery.data;
  const zoneLoading = slug ? slugQuery.isLoading : unitQuery.isLoading;
  const { allowed } = useAllowedRatings();

  const implicitInitial = useMemo(
    () => zoneFiltersToSearchQuery(zone?.filters, allowed),
    [zone?.filters, allowed],
  );

  if (zoneLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-text-secondary">{t("common:loading")}</p>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-semibold">{t("search:zone_not_found")}</h2>
      </div>
    );
  }

  return (
    <FederatedSearchPage
      scope={{ kind: "zone", zoneUnitId: zone.unitId }}
      initialQuery={initialQuery}
      implicitInitial={implicitInitial}
      initialCategory={initialCategory}
      onCategoryChange={onCategoryChange}
    />
  );
};
