import { useRestoreContentStructureNodes } from "@rezics/api/content-structure";
import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation(["book"]);
  const restore = useRestoreContentStructureNodes(bookUnitId);

  return (
    <div className="w-full mx-auto p-4 max-w-prose">
      <h1 className="text-2xl font-bold mb-2">
        {t("book:read_deleted_title")}
      </h1>
      <p className="text-text-secondary leading-relaxed">
        {t("book:read_deleted_description")}
      </p>
      {canEdit && (
        <Button
          type="button"
          variant="secondary"
          className="mt-5"
          disabled={restore.isPending}
          onClick={() => restore.mutate([nodeId])}
        >
          {restore.isPending
            ? t("book:read_deleted_restoring")
            : t("book:read_deleted_restore")}
        </Button>
      )}
    </div>
  );
};
