import { Badge } from "@rezics/ui/shadcn";
import { echoKvGetQuery } from "@rezics/api/echokv/echokv";
import { parseEchoKVResponse } from "@rezics/api/echokv/util";
import { Link } from "@/shared/ui/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@rezics/ui/shadcn/carousel.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";

import { DynamicIcon, type IconKey } from "./DynamicIcon";

export type QuickAccessLinksProps = {
  key?: string;
};

type QuickTag = {
  icon: string;
  name: string;
  color: string;
};

export const QuickAccessLinks: React.FC<QuickAccessLinksProps> = ({
  key = "book_search_tag_group_quick",
}) => {
  const { data } = useQuery(echoKvGetQuery(key));

  const items = useMemo(
    () => parseEchoKVResponse<QuickTag[]>(data) ?? [],
    [data],
  );

  if (!items.length) return null;

  return (
    <Carousel
      className="w-full"
      opts={{
        align: "start",
        dragFree: true,
      }}
    >
      <CarouselContent className="-ml-2">
        {items.map(({ name, icon }) => (
          <CarouselItem key={name} className="pl-2 basis-auto">
            <Link to="/book/search" search={{ tags: name }}>
              <Badge
                variant="secondary"
                className="cursor-pointer flex items-center gap-1"
              >
                <DynamicIcon name={icon as IconKey} className="ml-1" />
                {name}
              </Badge>
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
