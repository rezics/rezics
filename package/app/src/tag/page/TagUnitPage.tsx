import { tagQueries } from "@rezics/api/tag/tag";
import type { TagDetailDTO } from "@rezics/contract";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { tagUnitRoute } from "@/router";
import { TagDetailCard } from "../component/TagCards";

export function TagUnitPage() {
  const { unitId } = tagUnitRoute.useParams();
  const { data, isLoading, error } = useQuery(tagQueries.detail(unitId));
  if (isLoading) {
    return (
      <div className="w-11/12 mx-auto mt-10">
        <div className="text-sm text-gray-500">正在加载标签…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-11/12 mx-auto mt-10">
        <div className="text-sm text-red-600">
          加载失败：{String((error as any)?.message ?? error)}
        </div>
      </div>
    );
  }
  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithText text={data?.name ?? `标签（${unitId}）`} />
      <div className="mt-4">
        <TagDetailCard tag={data as TagDetailDTO} />
      </div>
    </div>
  );
}
