import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ShelfView } from "@rezics/api/shelf";
import {
  common_delete,
  shelf_drag_to_reorder,
  shelf_move_to_another_page,
  shelf_select_for_bulk_action,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Button, Checkbox } from "@rezics/ui/shadcn";
import { GripVertical, MoveRight, Trash2 } from "lucide-react";
import type { ShelfStreamEntry } from "../models/shelfStream";
import { ShelfItemRenderer } from "./ShelfItemRenderer";

const i18nMessages = {
  common_delete,
  shelf_drag_to_reorder,
  shelf_move_to_another_page,
  shelf_select_for_bulk_action,
};

interface ShelfEditorItemRowProps {
  entry: ShelfStreamEntry;
  rowId: string;
  unitId: string;
  viewMode: ShelfView;
  sortable: boolean;
  canMoveCrossPage: boolean;
  canDelete: boolean;
  onDelete: (unitId: string) => void;
  onMoveCrossPage: (unitId: string) => void;
  multiSelect?: boolean;
  selected?: boolean;
  onToggleSelected?: (unitId: string) => void;
  preview?: boolean;
}

export function ShelfEditorItemRow({
  entry,
  rowId,
  unitId,
  viewMode,
  sortable,
  canMoveCrossPage,
  canDelete,
  onDelete,
  onMoveCrossPage,
  multiSelect,
  selected,
  onToggleSelected,
  preview,
}: ShelfEditorItemRowProps) {
  const m = useMessage(i18nMessages);
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

  if (preview) {
    return (
      <div ref={setNodeRef} style={style} className="py-1">
        <ShelfItemRenderer entry={entry} viewMode={viewMode} />
      </div>
    );
  }

  let controls: React.ReactNode;
  if (multiSelect) {
    controls = (
      <div className="flex h-8 w-8 items-center justify-center">
        <Checkbox
          aria-label={m.shelf_select_for_bulk_action()}
          checked={selected ?? false}
          onCheckedChange={() => onToggleSelected?.(unitId)}
        />
      </div>
    );
  } else {
    controls = (
      <>
        {sortable && (
          <button
            type="button"
            aria-label={m.shelf_drag_to_reorder()}
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
            aria-label={m.shelf_move_to_another_page()}
            onClick={() => onMoveCrossPage(unitId)}
          >
            <MoveRight className="h-4 w-4" />
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={m.common_delete()}
            onClick={() => onDelete(unitId)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </>
    );
  }

  const hasControls = multiSelect || sortable || canMoveCrossPage || canDelete;

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
