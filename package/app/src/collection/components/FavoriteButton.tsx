import {
  collectionStatusQuery,
  useToggleFavoriteMutation,
} from "@rezics/api/shelf";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useCallback } from "react";
import { useSystemShelfRecoveryToast } from "@/collection/hooks/useSystemShelfRecoveryToast";
import { useAuth, useAuthModal } from "@/user";

interface FavoriteButtonProps {
  unitId: string;
  size?: "small" | "medium" | "large";
  color?: string;
}

export function FavoriteButton({
  unitId,
  size = "small",
  color,
}: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");
  const statusQuery = useQuery(collectionStatusQuery(unitId));
  const recovery = useSystemShelfRecoveryToast();
  const toggleMutation = useToggleFavoriteMutation({
    onError: (error) => {
      // If the favorites shelf is missing, surface the recovery toast.
      // The user retriggers the heart click themselves after retry succeeds.
      // 若收藏书架缺失，则弹出恢复提示。
      // 用户在重试成功后自行再次点击爱心。
      recovery.handleError(error);
    },
  });

  const isFavorited = statusQuery.data?.isFavorited ?? false;

  const handleToggle = useCallback(() => {
    // Prompt sign-in before favoriting; the toggle needs a member session, so
    // an anonymous click would otherwise hit a server auth error.
    // 收藏前先引导登录；切换收藏需要成员会话，否则匿名点击会在服务端因鉴权失败而报错。
    if (!isAuthenticated) {
      auth.openLogin();
      return;
    }
    toggleMutation.mutate(unitId);
  }, [unitId, toggleMutation, isAuthenticated, auth.openLogin]);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleToggle}
                disabled={toggleMutation.isPending}
                style={color ? { color } : undefined}
                aria-label={
                  isFavorited ? "Remove from favorites" : "Add to favorites"
                }
                {...props}
              >
                {isFavorited ? (
                  <Heart
                    size={iconSize(size)}
                    fill="currentColor"
                    color="var(--colors-semantic-error-fill)"
                  />
                ) : (
                  <Heart size={iconSize(size)} />
                )}
              </Button>
            )}
          />
          <TooltipContent>
            {isFavorited ? "Remove from favorites" : "Add to favorites"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {!isAuthenticated && auth.AuthModal({})}
    </>
  );
}

function iconSize(size: "small" | "medium" | "large"): number {
  return size === "small" ? 18 : size === "large" ? 28 : 22;
}
