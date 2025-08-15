import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useLocation } from "wouter";
import { Place } from "@mui/icons-material";

export namespace NotFound {
	export type Show = {
		path: string;
		onBack: () => void;
		onHome: () => void;
	};

	export const Show: React.FC<Show> = ({ path, onBack, onHome }) => {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Card className="min-w-md max-w-lg">
					<CardContent className="flex flex-col gap-4">
						<Typography variant="h4">Not Found</Typography>
						<div>
							<Place></Place> {path}
						</div>
					</CardContent>
					<CardActions className="flex flex-row justify-between">
						<Button onClick={onBack}>Back</Button>
						<Button onClick={onHome}>Home</Button>
					</CardActions>
				</Card>
			</div>
		);
	};

	export type Container = {};

	export const Container: React.FC<Container> = () => {
		const [path, navigate] = useLocation();

		const handleBack = () => {
			history.back();
		};

		const handleHome = () => {
			navigate("/");
		};

		return <Show path={path} onBack={handleBack} onHome={handleHome} />;
	};
}
