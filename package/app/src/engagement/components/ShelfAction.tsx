import { Button } from "@mui/material";
import { BookmarkPlus } from "lucide-react";
import type React from "react";
import { CollectionModal } from "@/collection/components/CollectionModal";
import { useShelfTrigger } from "../hooks/useShelfTrigger";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type ShelfActionProps = {
  targetUnitId: string;
  /** Override the size from context. Rarely needed; prefer setting on the bar. */
  size?: EngagementSize;
  /** When the target is a review, the collection modal surfaces the review-specific dual-mode UI. */
  isReview?: boolean;
};

function sizeToIconPx(size: EngagementSize): number {
  switch (size) {
    case "sm":
      return 16;
    case "lg":
      return 22;
    default:
      return 18;
  }
}

export const ShelfAction: React.FC<ShelfActionProps> = ({
  targetUnitId,
  size: sizeProp,
  isReview,
}) => {
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const isPill = ctx.variant === "pill";
  const { isAuthenticated, collection, auth, handleClick } = useShelfTrigger({
    targetUnitId,
  });

  return (
    <>
      <Button
        variant="text"
        size={size === "lg" ? "medium" : "small"}
        onClick={handleClick}
        startIcon={<BookmarkPlus size={sizeToIconPx(size)} strokeWidth={2} />}
        sx={{
          color: "text.secondary",
          textTransform: "none",
          fontSize:
            size === "sm" ? "0.75rem" : size === "lg" ? "0.95rem" : "0.875rem",
          minWidth: 0,
          px: size === "sm" ? 1 : 1.25,
          ...(isPill && {
            borderRadius: "var(--rezics-radius-pill, 999px)",
            bgcolor: (theme: { palette: { mode: string } }) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.04)"
                : "rgba(0, 0, 0, 0.04)",
          }),
          "&:hover": {
            bgcolor: (theme: { palette: { mode: string } }) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.08)",
            color: "text.primary",
          },
        }}
      >
        Shelf
      </Button>
      {isAuthenticated ? (
        <CollectionModal
          open={collection.open}
          onClose={collection.handleClose}
          onCollect={collection.handleCollect}
          shelves={collection.shelves}
          status={collection.status}
          isCollecting={collection.isCollecting}
          isLoading={collection.isLoading}
          isReview={isReview}
        />
      ) : (
        auth.AuthModal({})
      )}
    </>
  );
};
