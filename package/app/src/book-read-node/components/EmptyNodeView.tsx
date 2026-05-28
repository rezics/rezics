import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { useEnsureChapterUnit } from "@/book-library/hooks/useEnsureChapterUnit";

type EmptyNodeViewProps = {
  bookUnitId: string;
  nodeId: string;
  title: string;
  path: number[];
  canEdit: boolean;
  onMaterialized: (contentUnitId: string) => void;
};

export const EmptyNodeView: React.FC<EmptyNodeViewProps> = ({
  bookUnitId,
  title,
  path,
  canEdit,
  onMaterialized,
}) => {
  const ensure = useEnsureChapterUnit(bookUnitId);
  const [pending, setPending] = useState(false);

  const handleCreate = async () => {
    setPending(true);
    try {
      const contentUnitId = await ensure({
        title,
        path,
        contentUnitId: undefined,
      });
      onMaterialized(contentUnitId);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-11/12 mx-auto p-4 max-w-prose">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-text-secondary leading-relaxed">
        This entry doesn't have a chapter yet.
      </p>
      {canEdit && (
        <Button
          type="button"
          variant="secondary"
          className="mt-5"
          disabled={pending}
          onClick={handleCreate}
        >
          {pending ? "Creating…" : "Create chapter"}
        </Button>
      )}
    </div>
  );
};
