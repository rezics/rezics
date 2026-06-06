import { useRestoreContentStructureNodes } from "@rezics/api/content-structure";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";

type DeletedNodeViewProps = {
  bookUnitId: string;
  nodeId: string;
  canEdit: boolean;
};

export const DeletedNodeView: React.FC<DeletedNodeViewProps> = ({
  bookUnitId,
  nodeId,
  canEdit,
}) => {
  const restore = useRestoreContentStructureNodes(bookUnitId);

  return (
    <div className="w-11/12 mx-auto p-4 max-w-prose">
      <h1 className="text-2xl font-bold mb-2">This entry was deleted</h1>
      <p className="text-text-secondary leading-relaxed">
        The TOC entry you opened has been removed. Its original placement is
        preserved and can be restored.
      </p>
      {canEdit && (
        <Button
          type="button"
          variant="secondary"
          className="mt-5"
          disabled={restore.isPending}
          onClick={() => restore.mutate([nodeId])}
        >
          {restore.isPending ? "Restoring…" : "Restore this entry"}
        </Button>
      )}
    </div>
  );
};
