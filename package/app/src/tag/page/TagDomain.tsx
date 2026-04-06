import { tagQueries } from "@rezics/api/tag/tag";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { tagDomainRoute, tagDomainTitleRoute } from "@/router";
import { TagWrapper } from "../component/TagWrapper";

export function TagDomainPage() {
  // ERROR 不能这么写，会导致错误
  const withTitleMatch = tagDomainTitleRoute.useMatch({ shouldThrow: true });
  const baseMatch = tagDomainRoute.useMatch({ shouldThrow: true });
  const unitId =
    withTitleMatch?.params.unitId ?? baseMatch?.params.unitId ?? "";
  const title = withTitleMatch?.params.title;
  const { data, isLoading, error } = useQuery(
    tagQueries.list({ domainId: unitId }),
  );
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
      <AccentBarWithText text={title ?? `域（${unitId}）`} />
      <TagWrapper filters={{ domainId: unitId }} mode="flat" />
    </div>
  );
}
