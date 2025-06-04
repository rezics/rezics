import { ButtonGroup, IconButton } from "@mui/material";
import {
    Reply,
    ThumbUpAlt,
    ThumbDownAlt,
    ThumbUpOffAlt,
    ThumbDownOffAlt,
    Star,
    StarOutline,
} from "@mui/icons-material";

export type Reactions = {
    state: {
        up: boolean | null;
        star: boolean;
    };
    event: Partial<{
        onUp: React.MouseEventHandler<HTMLButtonElement>;
        onDown: React.MouseEventHandler<HTMLButtonElement>;
        onStar: React.MouseEventHandler<HTMLButtonElement>;
        onReply: React.MouseEventHandler<HTMLButtonElement>;
    }>;
};

export const Reactions: React.FC<Reactions> = ({ state: { up, star }, event: { onUp, onDown, onStar, onReply } }) => (
    <ButtonGroup>
        <IconButton onClick={onUp}>{up === true ? <ThumbUpAlt /> : <ThumbUpOffAlt />}</IconButton>
        <IconButton onClick={onDown}>{up === false ? <ThumbDownAlt /> : <ThumbDownOffAlt />}</IconButton>
        <IconButton onClick={onStar}>{star ? <Star /> : <StarOutline />}</IconButton>
        <IconButton onClick={onReply}>
            <Reply />
        </IconButton>
    </ButtonGroup>
);
