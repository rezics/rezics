import { Card, CardContent, Box, CardActions } from "@mui/material";
import { CollapsibleText } from "@component/Common/CollapsibleText";
import { FC, memo } from "react";
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
            <Card>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-row gap-2">
                        <Small {...user}></Small>
                    </div>

                    <Box>
                        <CollapsibleText content={children} threshold={300} />
                    </Box>
                </CardContent>

                <CardActions>
                    <Reactions {...reactions}></Reactions>
                </CardActions>
            </Card>
        );
    });

    export type Container = {
        id: string;
    };

    export const Container: FC<Container> = ({ id }) => {
        return <></>;
    };
}
