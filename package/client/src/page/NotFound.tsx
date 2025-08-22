import { Place } from "@mui/icons-material";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import React from "react";
import { useLocation } from "wouter";

export type NotFoundShowProps = {
    path: string;
    onBack: () => void;
    onHome: () => void;
};

export const NotFoundShow: React.FC<NotFoundShowProps> = ({ path, onBack, onHome }) => {
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

export type NotFoundContainerProps = object;

export const NotFoundContainer: React.FC<NotFoundContainerProps> = () => {
    const [path, navigate] = useLocation();

    const handleBack = () => {
        window.history.back();
    };

    const handleHome = () => {
        navigate("/");
    };

    return <NotFoundShow path={path} onBack={handleBack} onHome={handleHome} />;
};
