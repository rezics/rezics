import {
  common_back,
  common_home,
  common_not_found,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Button, Card, CardContent, CardFooter } from "@rezics/ui/shadcn";
import {
  useCanGoBack,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { MapPin as Place } from "lucide-react";
import type React from "react";

const i18nMessages = {
  common_back,
  common_home,
  common_not_found,
};

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
  const m = useMessage(i18nMessages);
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
