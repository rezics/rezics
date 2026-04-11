import { useCallback } from "react";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useQuery } from "@tanstack/react-query";
import { collectionStatusQuery, useToggleFavoriteMutation } from "@rezics/api/shelf";

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
          <FavoriteIcon fontSize={size} color="error" />
        ) : (
          <FavoriteBorderIcon fontSize={size} />
        )}
      </IconButton>
    </Tooltip>
  );
}
