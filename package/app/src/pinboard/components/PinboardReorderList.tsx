import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import { IconButton, Stack } from "@mui/material";
import { useReorderPinboard } from "@rezics/api/pinboard";
import type { PinboardKey } from "@rezics/contract";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { PinboardEntryDTO } from "../models/types";
import { PinboardEntryCard } from "./PinboardEntryCard";

interface SortableRowProps {
  entry: PinboardEntryDTO;
  stale?: boolean;
  onEdit?: (entry: PinboardEntryDTO) => void;
  onDelete?: (entry: PinboardEntryDTO) => void;
}

function SortableRow({ entry, stale, onEdit, onDelete }: SortableRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.unitId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PinboardEntryCard
        entry={entry}
        variant="adminRow"
        stale={stale}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandle={
          <IconButton
            size="small"
            sx={{ cursor: "grab", touchAction: "none" }}
            {...attributes}
            {...listeners}
            aria-label={t("pinboard.reorder.drag_handle", {
              title: entry.title ?? entry.unitId,
            })}
          >
            <DragIndicatorRoundedIcon fontSize="small" />
          </IconButton>
        }
      />
    </div>
  );
}

interface PinboardReorderListProps {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  entries: PinboardEntryDTO[];
  staleIds?: string[];
  onEdit?: (entry: PinboardEntryDTO) => void;
  onDelete?: (entry: PinboardEntryDTO) => void;
  /** Called with the refetch fn after a 409 so the parent can re-sync. */
  onConflict?: () => void;
}

/**
 * dnd-kit sortable list for pinboard admin. Supports pointer + keyboard
 * drag (arrow keys via `sortableKeyboardCoordinates`). 409 responses
 * trigger a non-blocking toast; the upstream query invalidation restores
 * the authoritative order.
 */
export const PinboardReorderList: React.FC<PinboardReorderListProps> = ({
  realmUnitId,
  pinboardKey,
  entries,
  staleIds,
  onEdit,
  onDelete,
  onConflict,
}) => {
  const { t } = useTranslation();
  const [working, setWorking] = useState<string[] | null>(null);
  const ids = useMemo(
    () => (working ?? entries.map((e) => e.unitId)),
    [entries, working],
  );
  const staleSet = useMemo(() => new Set(staleIds ?? []), [staleIds]);
  const byId = useMemo(
    () => new Map(entries.map((e) => [e.unitId, e])),
    [entries],
  );

  const reorder = useReorderPinboard();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    setWorking(next);
    reorder.mutate(
      {
        realmUnitId,
        pinboardKey,
        input: { orderedUnitIds: next },
      },
      {
        onError: (err) => {
          const message = err instanceof Error ? err.message : String(err);
          if (/409|conflict/i.test(message)) {
            toast.error(t("pinboard.reorder.conflict"));
            onConflict?.();
          } else {
            toast.error(
              t("pinboard.reorder.error", { error: message }),
            );
          }
          setWorking(null);
        },
        onSuccess: () => {
          setWorking(null);
        },
      },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Stack spacing={1} role="list" aria-label={t("pinboard.reorder.list")}>
          {ids.map((id) => {
            const entry = byId.get(id);
            if (!entry) return null;
            return (
              <div key={id} role="listitem">
                <SortableRow
                  entry={entry}
                  stale={staleSet.has(id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            );
          })}
        </Stack>
      </SortableContext>
    </DndContext>
  );
};
