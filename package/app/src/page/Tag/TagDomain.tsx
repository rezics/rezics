import { useQuery } from '@tanstack/react-query';
import { tagQueries } from '@package/api/tag/tag';
import { AccentBarWithTextShow } from '@/component/Common/Navigation/AccentBar';
import { TagWrapper } from '@/component/Tag/TagWrapper';
import { tagDomainRoute, tagDomainTitleRoute } from '@/router';

export function TagDomainPage() {
  const withTitleMatch = tagDomainTitleRoute.useMatch({ shouldThrow: false });
  const baseMatch = tagDomainRoute.useMatch({ shouldThrow: false });
  const unitId = withTitleMatch?.params.unitId ?? baseMatch?.params.unitId ?? '';
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
      <AccentBarWithTextShow text={title ?? `域（${unitId}）`} />
      <TagWrapper filters={{ domainId: unitId }} mode="flat" />
    </div>
  );
}
