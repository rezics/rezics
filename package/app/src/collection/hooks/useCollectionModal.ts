import {
  collectionStatusQuery,
  useCollectMutation,
  userShelvesQuery,
} from "@rezics/api/shelf";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

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

  const collectMutation = useCollectMutation();

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const handleCollect = useCallback(
    async (shelfIds: string[], independent?: boolean) => {
      await collectMutation.mutateAsync({
        targetId: unitId,
        shelfIds,
        independent,
      });
      handleClose();
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
