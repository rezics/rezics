import {Avatar, Typography} from '@mui/material';
import {compactInteger} from 'humanize-plus';
import {FC} from 'react';

export namespace Small {
  export type Show = {
    name: string;
    subscriber: number;
    avatar: string;
  };

  export const Show: FC<Show> = ({name, subscriber, avatar}) => {
    return (
      <div className="flex flex-row items-center gap-2 max-w-full">
        <Avatar src={avatar} sx={{width: 48, height: 48}}></Avatar>
        <div className="flex flex-col">
          <Typography className="line-clamp-1 text-ellipsis text-xl!">
            {name}
          </Typography>
          <Typography className="text-sm!">
            {compactInteger(subscriber, 1)}
          </Typography>
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

  export const Container: FC<Container> = ({name, subscriber, avatar}) => {
    return <Show name={name} subscriber={subscriber} avatar={avatar} />;
  };
}

export type Small = Small.Container;
export const SmallComponent = Small.Container;
