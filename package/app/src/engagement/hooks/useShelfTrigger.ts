import type { ShelfItemKind, ShelfItemType } from "@rezics/api/shelf";
import type React from "react";
import { useAddToShelfDialog } from "@/shelf";
import { useAuth, useAuthModal } from "@/user";

export type UseShelfTriggerArgs = {
  targetUnitId: string;
  variantUnitId?: string;
  targetItemType?: ShelfItemType;
  targetKind?: ShelfItemKind;
};

export type UseShelfTriggerReturn = {
  isAuthenticated: boolean;
  addToShelf: ReturnType<typeof useAddToShelfDialog>;
  auth: ReturnType<typeof useAuthModal>;
  handleClick: (event: React.MouseEvent) => void;
};

export function useShelfTrigger({
  targetUnitId,
  variantUnitId,
  targetItemType,
  targetKind,
}: UseShelfTriggerArgs): UseShelfTriggerReturn {
  const { isAuthenticated } = useAuth();
  const addToShelf = useAddToShelfDialog();
  const auth = useAuthModal("login");

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      auth.openLogin();
      return;
    }
    addToShelf.handleOpen();
  };

  return {
    isAuthenticated,
    addToShelf,
    auth,
    handleClick,
  };
}
