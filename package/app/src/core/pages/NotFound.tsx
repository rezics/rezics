import { Button, Card, CardContent, CardFooter } from "@rezics/ui/shadcn";
import * as m from "@rezics/i18n/messages";
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
          <h4 className="text-2xl font-medium m-0">{m.common_not_found()}</h4>
          <div className="flex items-center gap-2">
            <Place /> {path}
          </div>
        </CardContent>
        <CardFooter className="flex flex-row justify-between">
          {canGoBack ? (
            <Button variant="ghost" onClick={onBack}>
              {m.common_back()}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onHome}>
            {m.common_home()}
          </Button>
        </CardFooter>
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
