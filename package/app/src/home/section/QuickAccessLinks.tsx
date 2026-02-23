import React, {useMemo} from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@package/ui/shadcn/carousel.tsx';

import {Chip, type ChipProps} from '@mui/material';
import {echoKvGetQuery} from '@package/api/echokv/echokv';
import {useQuery} from '@tanstack/react-query';
import {parseEchoKVResponse} from '@package/api/echokv/util';
import {Link} from '@package/ui/primitive/link/Link.tsx';

import {DynamicIcon, type IconKey} from './DynamicIcon';

export type QuickAccessLinksProps = {
  key?: string;
};

type QuickTag = {
  icon: string;
  name: string;
  color: string;
};

export const QuickAccessLinks: React.FC<QuickAccessLinksProps> = ({
  key = 'book_search_tag_group_quick',
}) => {
  const {data} = useQuery(echoKvGetQuery(key));

  const items = useMemo(
    () => parseEchoKVResponse<QuickTag[]>(data) ?? [],
    [data],
  );

  if (!items.length) return null;

  return (
    <Carousel
      className="w-full"
      opts={{
        align: 'start',
        dragFree: true,
      }}
    >
      <CarouselContent className="-ml-2">
        {items.map(({name, icon, color}) => (
          <CarouselItem key={name} className="pl-2 basis-auto">
            <Link to="/book" search={{tags: name}}>
              <Chip
                icon={<DynamicIcon name={icon as IconKey} className="ml-1" />}
                label={name}
                clickable
                size="small"
                color={color as ChipProps['color']}
              />
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>

      {/* <CarouselPrevious variant="ghost" className="hidden sm:flex" />
      <CarouselNext variant="ghost" className="hidden sm:flex" /> */}
    </Carousel>
  );
};

export default QuickAccessLinks;
