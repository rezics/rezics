import { tagQueries } from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import * as m from "@rezics/i18n/messages";
import { Route as tagUnitRoute } from "@/routes/_mainLayout/tag/$unitId";
import { TagDetailCard } from "../components/TagCards";

export function TagUnitPage() {
  const { unitId } = tagUnitRoute.useParams();
  const { data, isLoading, error } = useQuery(tagQueries.detail(unitId));
  if (isLoading) {
    return (
      <div className="w-11/12 mx-auto mt-16">
        <div className="text-sm text-gray-500">{m.tag_loading()}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-11/12 mx-auto mt-16">
        <div className="text-sm text-red-600">
          {m.common_load_failed()}: {String((error as any)?.message ?? error)}
        </div>
      </div>
    );
  }
  return (
    <div className="w-11/12 mx-auto mt-16">
      <AccentBarWithText text={m.tag_unit_title({ id: unitId })} />
      <div className="mt-4">
        <TagDetailCard tag={data as UnitTagDTO} />
      </div>
    </div>
  );
}
