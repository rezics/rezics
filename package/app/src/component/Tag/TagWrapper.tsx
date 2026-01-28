import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tagQueries } from '@package/api/tag/tag';
import type { TagFilters, TagDTO, TagDetailDTO } from '@package/api/tag/tag';
import TagList from './TagList';

import { RouterLink } from '@/component/Navigation/RouterLink';

import { useIsMobile } from '@/util/useMediaQueryUtil';
import { useTranslation } from 'react-i18next';

type Mode = 'flat' | 'grouped';

export type TagWrapperProps = {
  filters?: TagFilters;
  mode?: Mode;
  domainIds?: string[];
  className?: string;
  renderAll?: boolean;
};

interface buildGroupsAndDomainTitlesProps {
  tags: TagDTO[];
  domainIds?: string[];
  isMobile?: boolean;
}

interface buildGroupsAndDomainTitlesResult {
  groups: Map<string | 'NO_DOMAIN', TagDTO[]>;
  domainTitleMap: Map<string, string>;
}

/**
 * Build groups and domain titles
 *
 * Notes:
 * - No domain: directly add to NO_DOMAIN
 * - With domain: add to domain, filter if necessary
 */
function buildGroupsAndDomainTitles({
  tags,
  domainIds,
  isMobile = false,
}: buildGroupsAndDomainTitlesProps): buildGroupsAndDomainTitlesResult {
  const groups = new Map<string | 'NO_DOMAIN', TagDTO[]>();
  const domainTitleMap = new Map<string, string>();
  const allowed = domainIds?.length ? new Set(domainIds) : undefined;

  for (const tag of tags) {
    const domainObjs: any[] = Array.isArray((tag as any).domains)
      ? ((tag as any).domains as any[])
      : [];

    // No domain: directly add to NO_DOMAIN
    if (domainObjs.length === 0) {
      groups.set('NO_DOMAIN', [...(groups.get('NO_DOMAIN') ?? []), tag]);
      continue;
    }

    // With domain: add to domain, filter if necessary
    for (const d of domainObjs) {
      const id = d && (d.id ?? d.unitId) ? String(d.id ?? d.unitId) : null;
      if (!id) continue;
      if (allowed && !allowed.has(id)) continue;
      const title = d && d.title ? String(d.title) : id;
      groups.set(id, [...(groups.get(id) ?? []), tag]);
      if (!domainTitleMap.has(id)) domainTitleMap.set(id, title);
    }
  }

  if (isMobile) {
    // mobile: return max 2 groups
    const maxGroups = 2;
    const sortedGroups = Array.from(groups.entries()).sort(
      (a, b) => b[1].length - a[1].length,
    );
    return { groups: new Map(sortedGroups.slice(0, maxGroups)), domainTitleMap };
  }

  return { groups, domainTitleMap };
}

/**
 * TagWrapper
 * - mode = 'flat': render all tags list
 * - mode = 'grouped': render tags grouped by domain, each domain displays its unit.title and can be redirected
 */
export const TagWrapper: React.FC<TagWrapperProps> = ({
  filters,
  mode = 'flat',
  renderAll = false,
  domainIds,
  className,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(tagQueries.list(filters));
  const tags: TagDTO[] = useMemo(() => data?.tags ?? [], [data]);
  const isMobile = useIsMobile();

  const memo = useMemo(() => {
    const cutGroupFlag = !renderAll && isMobile;
    if (mode !== 'grouped') {
      return {
        groups: null as unknown as Map<string | 'NO_DOMAIN', TagDTO[]>,
        domainTitleMap: new Map<string, string>(),
      };
    }
    return buildGroupsAndDomainTitles({
      tags,
      domainIds,
      isMobile: cutGroupFlag,
    });
  }, [tags, mode, domainIds, isMobile, renderAll]);
  const groups = memo.groups;
  const domainTitleMap = memo.domainTitleMap;

  if (isLoading) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500">{t('tag.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-sm text-red-600">
          {t('tag.load_failed', {
            error: String((error as any)?.message ?? error),
          })}
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
                  {t('tag.ungrouped')}
                </span>
              ) : (
                <RouterLink
                  to={`/tag/domain/${domId}/title/${domainTitleMap.get(domId as string) ?? String(domId)
                    }`}
                  className="text-sm font-semibold"
                >
                  {domainTitleMap.get(domId as string) ?? String(domId)}
                </RouterLink>
              )}
            </div>
            <TagList tags={items as unknown as TagDetailDTO[]} />
          </div>
        ))}
      </div>
      {!renderAll && isMobile && (
        <div className="mt-4 text-sm text-gray-500">
          {t('tag.showing_top_tags')} ·
          <RouterLink to={`/tag/book/${filters?.objectId}/tag`}>
            {t('common.view_all')} →
          </RouterLink>
        </div>
      )}
    </div>
  );
};

export default TagWrapper;
