import {
  collectionStatusQuery,
  type ShelfItemKind,
  type ShelfItemType,
  useAddShelfItemMutation,
  useCollectMutation,
  userShelvesQuery,
} from "@rezics/api/shelf";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useSystemShelfRecoveryToast } from "./useSystemShelfRecoveryToast";

export function useCollectionModal(
  unitId: string,
  options?: {
    variantUnitId?: string;
    targetItemType?: ShelfItemType;
    targetKind?: ShelfItemKind;
  },
) {
  const [open, setOpen] = useState(false);
  const targetItemType = options?.targetItemType ?? "unit";
  const isUnitTarget = targetItemType === "unit";

  const shelvesQuery = useQuery({
    ...userShelvesQuery(),
    enabled: open,
  });

  const statusQuery = useQuery({
    ...collectionStatusQuery(unitId),
    enabled: isUnitTarget && open && !!unitId,
  });

  const recovery = useSystemShelfRecoveryToast();
  const collectMutation = useCollectMutation({
    onError: (error) => {
      recovery.handleError(error);
    },
  });
  const addShelfItemMutation = useAddShelfItemMutation({
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
        if (isUnitTarget) {
          await collectMutation.mutateAsync({
            targetId: unitId,
            variantUnitId: options?.variantUnitId,
            shelfIds,
            independent,
            searchText,
          });
        } else {
          const kind = options?.targetKind ?? targetItemType;
          await Promise.all(
            shelfIds.map((shelfId) =>
              addShelfItemMutation.mutateAsync({
                shelfId,
                input: {
                  itemType: targetItemType,
                  itemId: unitId,
                  kind,
                  searchText,
                },
              }),
            ),
          );
        }
        handleClose();
      } catch {
        // onError surfaces the recovery toast; the user re-opens the modal
        // and re-clicks Save themselves after retry succeeds.
      }
    },
    [
      unitId,
      options?.variantUnitId,
      options?.targetKind,
      targetItemType,
      isUnitTarget,
      collectMutation,
      addShelfItemMutation,
      handleClose,
    ],
  );

  return {
    open,
    handleOpen,
    handleClose,
    handleCollect,
    shelves: shelvesQuery.data ?? [],
    status: statusQuery.data,
    isCollecting: collectMutation.isPending || addShelfItemMutation.isPending,
    isLoading: shelvesQuery.isLoading || statusQuery.isLoading,
  };
}
