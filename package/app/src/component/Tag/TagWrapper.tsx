import React, {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {tagQueries} from '@/api/tag/tag';
import type {TagFilters, TagDTO, TagDetailDTO} from '@/api/tag/tag';
import TagList from './TagList';

import {RouterLink} from '@/component/Common/RouterLink';

type Mode = 'flat' | 'grouped';

export type TagWrapperProps = {
  filters?: TagFilters;
  mode?: Mode; // 默认不分组
  domainIds?: string[]; // 可选：指定要分组展示的 domain
  className?: string;
};

/**
 * 构建标签的分组与域元数据（不发起额外请求）
 *
 * 说明：
 * - 遍历每个标签的 domains 字段（为 Unit 对象数组，含 id 与 title）
 * - 根据可选的 domainIds 进行过滤；若提供则仅归入这些域
 * - 没有任何域的标签会被归入 'NO_DOMAIN'
 * - 返回去重后的分组 Map 以及域标题映射 Map
 */
function buildGroupsAndDomainTitles(
  tags: TagDTO[],
  domainIds?: string[],
): {
  groups: Map<string | 'NO_DOMAIN', TagDTO[]>;
  domainTitleMap: Map<string, string>;
} {
  const groups = new Map<string | 'NO_DOMAIN', TagDTO[]>();
  const domainTitleMap = new Map<string, string>();
  const allowed = domainIds?.length ? new Set(domainIds) : undefined;

  for (const tag of tags) {
    const domainObjs: any[] = Array.isArray((tag as any).domains)
      ? ((tag as any).domains as any[])
      : [];

    // 无域：直接归入 NO_DOMAIN
    if (domainObjs.length === 0) {
      groups.set('NO_DOMAIN', [...(groups.get('NO_DOMAIN') ?? []), tag]);
      continue;
    }

    // 有域：按域归入，必要时做过滤
    for (const d of domainObjs) {
      const id = d && (d.id ?? d.unitId) ? String(d.id ?? d.unitId) : null;
      if (!id) continue;
      if (allowed && !allowed.has(id)) continue;
      const title = d && d.title ? String(d.title) : id;
      groups.set(id, [...(groups.get(id) ?? []), tag]);
      if (!domainTitleMap.has(id)) domainTitleMap.set(id, title);
    }
  }

  return {groups, domainTitleMap};
}

/**
 * TagWrapper – 负责数据获取与包装渲染
 * - mode = 'flat': 直接渲染全部标签列表
 * - mode = 'grouped': 按 domain 分组渲染，每个 domain 显示其 unit.title 并可跳转
 */
export const TagWrapper: React.FC<TagWrapperProps> = ({
  filters,
  mode = 'flat',
  domainIds,
  className,
}) => {
  const {data, isLoading, error} = useQuery(tagQueries.list(filters));
  const tags: TagDTO[] = useMemo(() => data?.tags ?? [], [data]);

  const memo = useMemo(() => {
    if (mode !== 'grouped') {
      return {
        groups: null as unknown as Map<string | 'NO_DOMAIN', TagDTO[]>,
        domainTitleMap: new Map<string, string>(),
      };
    }
    return buildGroupsAndDomainTitles(tags, domainIds);
  }, [tags, mode, domainIds]);
  const groups = memo.groups;
  const domainTitleMap = memo.domainTitleMap;

  if (isLoading) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500">正在加载标签…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-sm text-red-600">
          加载失败：{String((error as any)?.message ?? error)}
        </div>
      </div>
    );
  }

  if (mode === 'flat') {
    return (
      <div className={className}>
        <TagList tags={tags as unknown as TagDetailDTO[]} />
      </div>
    );
  }

  // grouped
  return (
    <div className={className}>
      <div className="space-y-6">
        {[...(groups ?? new Map()).entries()].map(([domId, items]) => (
          <div key={domId + Math.random()} className="space-y-2">
            <div className="flex items-center gap-2">
              {domId === 'NO_DOMAIN' ? (
                <span className="text-sm font-semibold text-gray-700">
                  未分组
                </span>
              ) : (
                <RouterLink
                  href={`/tag/domain/${domId}/title/${
                    domainTitleMap.get(domId as string) ?? String(domId)
                  }`}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  {domainTitleMap.get(domId as string) ?? String(domId)}
                </RouterLink>
              )}
            </div>
            <TagList tags={items as unknown as TagDetailDTO[]} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagWrapper;
