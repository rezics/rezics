import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useLocation } from "wouter";
import { Place } from "@mui/icons-material";
import { get } from "@locale";

export const NotFound = () => {
    const [path, navigate] = useLocation();
    return (
        <div className="min-h-screen flex items-center justify-center">
            <Card className="min-w-md max-w-lg">
                <CardContent className="flex flex-col gap-4">
                    <Typography variant="h4">{get("pages->not_found")}</Typography>
                    <div>
                        <Place></Place> {path}
                    </div>
                </CardContent>
                <CardActions className="flex flex-row justify-between">
                    <Button onClick={() => history.back()}>{get("common->back")}</Button>
                    <Button onClick={() => navigate("/")}>{get("common->home")}</Button>
                </CardActions>
            </Card>
        </div>
    );
};
