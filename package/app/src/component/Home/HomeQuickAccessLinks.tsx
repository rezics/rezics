import React, { useMemo } from 'react';
import { Chip } from '@mui/material';
import { echoKvGetQuery } from '@package/api/echokv/echokv';
import { useQuery } from '@tanstack/react-query';
import { parseEchoKVResponse } from '@package/api/echokv/util';
import { useTranslation } from 'react-i18next';
import { Link } from '@package/ui/Navigation/Link.tsx';

export type HomeQuickAccessLinksProps = {
  title?: string;
  key?: string;
};

export const HomeQuickAccessLinks: React.FC<HomeQuickAccessLinksProps> = ({
  title,
  key = 'book_search_tag_group_quick',
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('page.home.quick_access.title_quick_entry');

  const { data } = useQuery(echoKvGetQuery(key));
  const items = useMemo(
    () => parseEchoKVResponse<any>(data)?.presetTags ?? [],
    [data],
  );
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">{resolvedTitle}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Array.isArray(items) ? items : []).map(name => (
          <Link key={name} to="/book" search={{ tags: name }}>
            <Chip label={name} variant="filled" clickable />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default HomeQuickAccessLinks;
