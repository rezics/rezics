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

interface FavoriteButtonProps {
  unitId: string;
  size?: "small" | "medium" | "large";
  color?: string;
}

function iconSize(size: "small" | "medium" | "large"): number {
  return size === "small" ? 18 : size === "large" ? 28 : 22;
}

export function FavoriteButton({
  unitId,
  size = "small",
  color,
}: FavoriteButtonProps) {
  const statusQuery = useQuery(collectionStatusQuery(unitId));
  const toggleMutation = useToggleFavoriteMutation();

  const isFavorited = statusQuery.data?.isFavorited ?? false;

  const handleToggle = useCallback(() => {
    toggleMutation.mutate(unitId);
  }, [unitId, toggleMutation]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleToggle}
            disabled={toggleMutation.isPending}
            style={color ? { color } : undefined}
            aria-label={
              isFavorited ? "Remove from favorites" : "Add to favorites"
            }
          >
            {isFavorited ? (
              <Heart
                size={iconSize(size)}
                fill="currentColor"
                color="var(--rezics-sys-color-error-fill)"
              />
            ) : (
              <Heart size={iconSize(size)} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isFavorited ? "Remove from favorites" : "Add to favorites"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
