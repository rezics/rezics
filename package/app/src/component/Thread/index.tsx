import React, { FC, memo } from "react";
import { Rating } from "@mui/material";
import { CollapsibleText } from "@component/Common/CollapsibleText";
import { Small } from "@component/User";
import { Reactions } from "./lib/Reactions";


export namespace Thread {
    export type Show = {
        user: Small;
        rating: number;
        create_at: Date;
        children: string;
        reactions: Reactions;
    };

    export const Show: FC<Show> = memo(({ user, children, rating, create_at, reactions }) => {
        return (
            <div className="flex my-4 space-x-2">
                <div className="flex-shrink-0">
                    <Small {...user}></Small>
                </div>
                <div className="flex-1">
                    <div className="flex items-center">
                        <Rating value={rating} precision={0.5} readOnly />
                        <span className="ml-2 text-sm text-gray-500">{create_at.toString()}</span>
                    </div>
                    <CollapsibleText.Container content={children} threshold={300} />
                    <Reactions.Container {...reactions} />
                </div>
            </div>
        );
    });

    export type Container = {
        id: string;
    };

    export const Container: FC<Container> = ({ id }) => {
        return <></>;
    };
}
