import type { ShelfItemKind, ShelfItemType } from "@rezics/api/shelf";
import type React from "react";
import { useCollectionModal } from "@/collection";
import { useAuth, useAuthModal } from "@/user";

export type UseShelfTriggerArgs = {
  targetUnitId: string;
  variantUnitId?: string;
  targetItemType?: ShelfItemType;
  targetKind?: ShelfItemKind;
};

export type UseShelfTriggerReturn = {
  isAuthenticated: boolean;
  collection: ReturnType<typeof useCollectionModal>;
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
  const collection = useCollectionModal(targetUnitId, {
    variantUnitId,
    targetItemType,
    targetKind,
  });
  const auth = useAuthModal("login");

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      auth.openLogin();
      return;
    }
    collection.handleOpen();
  };

  return {
    isAuthenticated,
    collection,
    auth,
    handleClick,
  };
}
