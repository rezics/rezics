import {
  collectionStatusQuery,
  useCollectMutation,
  userShelvesQuery,
} from "@rezics/api/shelf";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useSystemShelfRecoveryToast } from "./useSystemShelfRecoveryToast";

export function useCollectionModal(unitId: string) {
  const [open, setOpen] = useState(false);

  const shelvesQuery = useQuery({
    ...userShelvesQuery(),
    enabled: open,
  });

  const statusQuery = useQuery({
    ...collectionStatusQuery(unitId),
    enabled: open && !!unitId,
  });

  const recovery = useSystemShelfRecoveryToast();
  const collectMutation = useCollectMutation({
    onError: (error) => {
      recovery.handleError(error);
    },
  });

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const handleCollect = useCallback(
    async (
      shelfIds: string[],
      independent?: boolean,
      searchText?: string | null,
    ) => {
      try {
        await collectMutation.mutateAsync({
          targetId: unitId,
          shelfIds,
          independent,
          searchText,
        });
        handleClose();
      } catch {
        // onError surfaces the recovery toast; the user re-opens the modal
        // and re-clicks Save themselves after retry succeeds.
      }
    },
    [unitId, collectMutation, handleClose],
  );

  return {
    open,
    handleOpen,
    handleClose,
    handleCollect,
    shelves: shelvesQuery.data ?? [],
    status: statusQuery.data,
    isCollecting: collectMutation.isPending,
    isLoading: shelvesQuery.isLoading || statusQuery.isLoading,
  };
}
