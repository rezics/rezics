import { LibraryAdd } from "@mui/icons-material";
import { Button } from "@mui/material";
import type React from "react";
import { CollectionModal } from "@/collection/components/CollectionModal";
import { useCollectionModal } from "@/collection/hooks/useCollectionModal";
import { useAuth } from "@/user/pages/useAuth";
import { useAuthModal } from "@/user/components/useAuthModal";
import type { EngagementSize } from "../types";

export type ShelfActionProps = {
  targetUnitId: string;
  size?: EngagementSize;
  /** When the target is a review, the collection modal surfaces the review-specific dual-mode UI. */
  isReview?: boolean;
};

function sizeToIconFontSize(size: EngagementSize): string {
  switch (size) {
    case "sm":
      return "1rem";
    case "lg":
      return "1.375rem";
    default:
      return "1.125rem";
  }
}

export const ShelfAction: React.FC<ShelfActionProps> = ({
  targetUnitId,
  size = "md",
  isReview,
}) => {
  const { isAuthenticated } = useAuth();
  const collection = useCollectionModal(targetUnitId);
  const auth = useAuthModal("login");

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      auth.openLogin();
      return;
    }
    collection.handleOpen();
  };

  return (
    <>
      <Button
        size={size === "lg" ? "medium" : "small"}
        onClick={handleClick}
        startIcon={<LibraryAdd sx={{ fontSize: sizeToIconFontSize(size) }} />}
        sx={{
          color: "text.secondary",
          textTransform: "none",
          fontSize:
            size === "sm" ? "0.75rem" : size === "lg" ? "0.95rem" : "0.875rem",
          minWidth: 0,
          px: size === "sm" ? 0.75 : 1,
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
