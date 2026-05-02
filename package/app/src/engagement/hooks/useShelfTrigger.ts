import type React from "react";
import { useCollectionModal } from "@/collection/hooks/useCollectionModal";
import { useAuthModal } from "@/user/components/useAuthModal";
import { useAuth } from "@/user/pages/useAuth";

export type UseShelfTriggerArgs = {
  targetUnitId: string;
};

export type UseShelfTriggerReturn = {
  isAuthenticated: boolean;
  collection: ReturnType<typeof useCollectionModal>;
  auth: ReturnType<typeof useAuthModal>;
  handleClick: (event: React.MouseEvent) => void;
};

export function useShelfTrigger({
  targetUnitId,
}: UseShelfTriggerArgs): UseShelfTriggerReturn {
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

  return {
    isAuthenticated,
    collection,
    auth,
    handleClick,
  };
}
