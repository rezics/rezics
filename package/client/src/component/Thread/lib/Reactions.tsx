import { ButtonGroup, IconButton } from "@mui/material";
import {
	Reply,
	Star,
	StarOutline,
	ThumbDownAlt,
	ThumbDownOffAlt,
	ThumbUpAlt,
	ThumbUpOffAlt,
} from "@mui/icons-material";

export namespace Reactions {
	export type Show = {
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

	export const Show: React.FC<Show> = (
		{ state: { up, star }, event: { onUp, onDown, onStar, onReply } },
	) => (
		<ButtonGroup>
			<IconButton onClick={onUp}>
				{up === true ? <ThumbUpAlt /> : <ThumbUpOffAlt />}
			</IconButton>
			<IconButton onClick={onDown}>
				{up === false ? <ThumbDownAlt /> : <ThumbDownOffAlt />}
			</IconButton>
			<IconButton onClick={onStar}>
				{star ? <Star /> : <StarOutline />}
			</IconButton>
			<IconButton onClick={onReply}>
				<Reply />
			</IconButton>
		</ButtonGroup>
	);

	export type Container = Show;
	export const Container: React.FC<Container> = (props) => {
		return <Show {...props} />;
	};
}
