import React, { useMemo } from 'react';
import { echoKvGetQuery } from '@package/api/echokv/echokv';
import { useQuery } from '@tanstack/react-query';
import { parseEchoKVResponse } from '@package/api/echokv/util';
import { useTranslation } from 'react-i18next';
import { Link } from '@/component/Navigation/Link';

export type MobileHomeQuickAccessProps = {
  title?: string;
  kvKey?: string;
};

export const MobileHomeQuickAccess: React.FC<MobileHomeQuickAccessProps> = ({
  title,
  kvKey = 'book_search_tag_group_quick',
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('page.home.quick_access.title_fast_explore');

  const { data } = useQuery(echoKvGetQuery(kvKey));
  const items = useMemo(
    () => parseEchoKVResponse<any>(data)?.presetTags ?? [],
    [data],
  );

  if (!items.length) return null;

  return (
    <div className="w-full space-y-2">
      {resolvedTitle && (
        <div className="text-xs font-medium text-muted-foreground px-1">
          {resolvedTitle}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
        {(Array.isArray(items) ? items : []).map(name => (
          <Link key={name} to="/book" search={{ tags: name }}>
            <div className="whitespace-nowrap rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary transition-colors border border-transparent hover:border-primary/20">
              {name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
