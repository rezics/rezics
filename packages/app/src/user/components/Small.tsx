import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import { compactInteger } from "humanize-plus";
import type { FC } from "react";

export namespace Small {
  export type Show = {
    name: string;
    subscriber: number;
    avatar: string;
  };

  export const Show: FC<Show> = ({ name, subscriber, avatar }) => {
    return (
      <div className="flex flex-row items-center gap-2 max-w-full">
        <Avatar className="w-12 h-12">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback>{name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="line-clamp-1 text-ellipsis text-xl">{name}</span>
          <span className="text-sm">{compactInteger(subscriber, 1)}</span>
        </div>
      </div>
    );
  };

  export type Container = {
    id: string;
    name: string;
    subscriber: number;
    avatar: string;
  };

  export const Container: FC<Container> = ({ name, subscriber, avatar }) => {
    return <Show name={name} subscriber={subscriber} avatar={avatar} />;
  };
}

export type Small = Small.Container;
export const SmallComponent = Small.Container;
