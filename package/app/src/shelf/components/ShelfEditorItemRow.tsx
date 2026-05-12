import type { ShelfView } from "@rezics/api/shelf";
import { Button } from "@rezics/ui/shadcn";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoveRight, Trash2 } from "lucide-react";
import type { ShelfStreamEntry } from "../models/shelfStream";
import { ShelfItemRenderer } from "./ShelfItemRenderer";

interface ShelfEditorItemRowProps {
  entry: ShelfStreamEntry;
  rowId: string;
  itemRef: string;
  viewMode: ShelfView;
  sortable: boolean;
  canMoveCrossPage: boolean;
  canDelete: boolean;
  onDelete: (itemRef: string) => void;
  onMoveCrossPage: (itemRef: string) => void;
}

export function ShelfEditorItemRow({
  entry,
  rowId,
  itemRef,
  viewMode,
  sortable,
  canMoveCrossPage,
  canDelete,
  onDelete,
  onMoveCrossPage,
}: ShelfEditorItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowId, disabled: !sortable });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };
  const hasControls = sortable || canMoveCrossPage || canDelete;

  const controls = (
    <>
      {sortable && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="p-1 rounded text-text-secondary hover:text-text-primary cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {canMoveCrossPage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Move to another page"
          onClick={() => onMoveCrossPage(itemRef)}
        >
          <MoveRight className="h-4 w-4" />
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Delete"
          onClick={() => onDelete(itemRef)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </>
  );

  return (
    <div ref={setNodeRef} style={style} className="py-1">
      <ShelfItemRenderer
        entry={entry}
        viewMode={viewMode}
        editControls={hasControls ? controls : undefined}
        editing
      />
    </div>
  );
}
