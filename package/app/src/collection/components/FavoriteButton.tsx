import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import {
  collectionStatusQuery,
  useToggleFavoriteMutation,
} from "@rezics/api/shelf";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Heart } from "lucide-react";

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
    <Tooltip title={isFavorited ? "Remove from favorites" : "Add to favorites"}>
      <IconButton
        size={size}
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        sx={{ color }}
      >
        {isFavorited ? (
          <Heart size={iconSize(size)} fill="currentColor" color="var(--rezics-color-status-error-fill)" />
        ) : (
          <Heart size={iconSize(size)} />
        )}
      </IconButton>
    </Tooltip>
  );
}
