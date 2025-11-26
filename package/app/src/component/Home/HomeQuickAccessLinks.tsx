import React, {useMemo} from 'react';
import {Chip} from '@mui/material';
import {Link} from 'wouter';
import {echoKvGetQuery} from '@/api/echokv/echokv';
import {useQuery} from '@tanstack/react-query';
import {parseEchoKVResponse} from '@/api/echokv/util';

export type HomeQuickAccessLinksProps = {
  title?: string;
  key?: string;
};

export const HomeQuickAccessLinks: React.FC<HomeQuickAccessLinksProps> = ({
  title = '快速入口',
  key = 'book_search_tag_group_quick',
}) => {
  const {data} = useQuery(echoKvGetQuery(key));
  const items = useMemo(
    () => parseEchoKVResponse<any>(data)?.presetTags ?? [],
    [data],
  );
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Array.isArray(items) ? items : []).map(name => (
          <Link key={name} href={`/book?tags=${name}`}>
            <Chip label={name} variant="filled" clickable />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default HomeQuickAccessLinks;
