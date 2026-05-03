import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import {
  useCanGoBack,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import type React from "react";
import { MapPin as Place } from "lucide-react";

export type NotFoundShowProps = {
  path: string;
  onBack: () => void;
  onHome: () => void;
};

export const NotFoundShow: React.FC<NotFoundShowProps> = ({
  path,
  onBack,
  onHome,
}) => {
  const canGoBack = useCanGoBack();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="min-w-md max-w-lg">
        <CardContent className="flex flex-col gap-4">
          <Typography variant="h4">Not Found</Typography>
          <div>
            <Place /> {path}
          </div>
        </CardContent>
        <CardActions className="flex flex-row justify-between">
          {canGoBack ? <Button onClick={onBack}>Back</Button> : null}
          <Button onClick={onHome}>Home</Button>
        </CardActions>
      </Card>
    </div>
  );
};

export type NotFoundContainerProps = object;

export const NotFoundContainer: React.FC<NotFoundContainerProps> = () => {
  const navigate = useNavigate();
  const router = useRouter();
  const path = useRouterState({
    select: (s) => s.location.href,
  });

  const handleBack = () => {
    router.history.back();
  };

  const handleHome = () => {
    navigate({ to: "/" });
  };

  return <NotFoundShow path={path} onBack={handleBack} onHome={handleHome} />;
};
