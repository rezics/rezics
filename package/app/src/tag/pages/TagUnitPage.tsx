import { tagQueries } from "@rezics/api/tag/tag";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { QueryBoundary } from "@/core/components/QueryBoundary";
import { Route as tagUnitRoute } from "@/routes/_mainLayout/tag/$unitId";
import { TagDetailCard } from "../components/TagCards";

export function TagUnitPage() {
  const { t } = useTranslation(["common", "community"]);
  const { unitId } = tagUnitRoute.useParams();
  const query = useQuery(tagQueries.detail(unitId));

  return (
    <div className="w-full px-4 mt-16">
      <AccentBarWithText text={t("community:tag_unit_title", { id: unitId })} />
      <QueryBoundary query={query}>
        {(data) => (
          <div className="mt-4">
            <TagDetailCard tag={data} />
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
