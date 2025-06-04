import { Avatar, Typography } from "@mui/material";
import { FC } from "react";
import { compactInteger } from "humanize-plus";

export type Small = {
    id: string;
    name: string;
    subscriber: number;
    avatar: string;
};

export const Small: FC<Small> = ({ name, subscriber, avatar }) => {
    return (
        <div className="flex flex-row items-center gap-2 max-w-full">
            <Avatar src={avatar} sx={{ width: 48, height: 48 }}></Avatar>
            <div className="flex flex-col">
                <Typography className="line-clamp-1 text-ellipsis text-xl!">{name}</Typography>
                <Typography className="text-sm!">{compactInteger(subscriber, 1)}</Typography>
            </div>
        </div>
    );
};
