import {useQuery} from '@tanstack/react-query';
import type {TagDetailDTO} from '@package/contract';
import {tagQueries} from '@/api/tag/tag';
import {AccentBarWithTextShow} from '@/component/Common/Navigation/AccentBar';
import {TagDetailCard} from '@/component/Tag/TagCards';

export function TagUnitPage({unitId}: {unitId: string}) {
  const {data, isLoading, error} = useQuery(tagQueries.detail(unitId));
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
      <AccentBarWithTextShow text={data?.name ?? `标签（${unitId}）`} />
      <div className="mt-4">
        <TagDetailCard tag={data as TagDetailDTO} />
      </div>
    </div>
  );
}
