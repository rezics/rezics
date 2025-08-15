import { Typography } from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import { FC } from "react";

export const Layout: FC<{
	title: string;
	onSubmit: React.FormEventHandler<HTMLFormElement>;
	content: React.ReactNode;
	actions: React.ReactNode;
}> = ({ title, onSubmit, content, actions }) => (
	<form
		onSubmit={onSubmit}
		className="w-full h-dvh flex flex-col items-center justify-center"
	>
		<Card className="min-w-md">
			<CardContent className="flex flex-col gap-4">
				<Typography variant="h4">{title}</Typography>
				{content}
			</CardContent>
			<CardActions className="flex flex-row justify-between">
				{actions}
			</CardActions>
		</Card>
	</form>
);
