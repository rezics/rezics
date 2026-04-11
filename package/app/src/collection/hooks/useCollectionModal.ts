import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  collectionStatusQuery,
  useCollectMutation,
  userKeywordsQuery,
  userShelvesQuery,
} from "@rezics/api/shelf";

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

  const keywordsQuery = useQuery({
    ...userKeywordsQuery(),
    enabled: open,
  });

  const collectMutation = useCollectMutation();

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const handleCollect = useCallback(
    async (shelfIds: string[], keywords: string[], independent?: boolean) => {
      await collectMutation.mutateAsync({
        targetId: unitId,
        shelfIds,
        keywords,
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
    userKeywords: keywordsQuery.data ?? [],
    isCollecting: collectMutation.isPending,
    isLoading: shelvesQuery.isLoading || statusQuery.isLoading,
  };
}
