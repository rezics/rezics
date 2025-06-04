import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useLocation } from "wouter";
import { Place } from "@mui/icons-material";

export const NotFound = () => {
    const [path] = useLocation();
    return (
        <Card className="min-w-md max-w-lg">
            <CardContent className="flex flex-col gap-4">
                <Typography variant="h4">Page Not Found</Typography>
                <div>
                    <Place></Place> {path}
                </div>
            </CardContent>
            <CardActions className="flex flex-row justify-between">
                <Button onClick={window.history.back}>Back</Button>
                <Button slot="a" href="/">
                    Home
                </Button>
            </CardActions>
        </Card>
    );
};
