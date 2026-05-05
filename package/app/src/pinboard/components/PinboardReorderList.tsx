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
import { Button } from "@rezics/ui/shadcn";
import { useReorderRealmExtraMutation } from "@rezics/api/realm/realm-extra.mutations";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { PinboardEntryView, PinboardListKey } from "../models/types";
import { PinboardEntryCard } from "./PinboardEntryCard";
import { GripVertical as DragIndicatorRoundedIcon } from "lucide-react";

interface SortableRowProps {
  entry: PinboardEntryView;
  stale?: boolean;
  onEdit?: (entry: PinboardEntryView) => void;
  onDelete?: (entry: PinboardEntryView) => void;
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
          <Button
            size="icon"
            variant="ghost"
            className="cursor-grab touch-none"
            {...attributes}
            {...listeners}
            aria-label={t("pinboard.reorder.drag_handle", {
              title: entry.title ?? entry.unitId,
            })}
          >
            <DragIndicatorRoundedIcon className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}

interface PinboardReorderListProps {
  realmUnitId: string;
  pinboardKey: PinboardListKey;
  entries: PinboardEntryView[];
  staleIds?: string[];
  onEdit?: (entry: PinboardEntryView) => void;
  onDelete?: (entry: PinboardEntryView) => void;
  /** Called after a 409 so the parent can re-sync. */
  onConflict?: () => void;
}

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
    () => working ?? entries.map((e) => e.unitId),
    [entries, working],
  );
  const staleSet = useMemo(() => new Set(staleIds ?? []), [staleIds]);
  const byId = useMemo(
    () => new Map(entries.map((e) => [e.unitId, e])),
    [entries],
  );

  const reorder = useReorderRealmExtraMutation();

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
        realmId: realmUnitId,
        key: pinboardKey,
        unitIds: next,
      },
      {
        onError: (err) => {
          const message = err instanceof Error ? err.message : String(err);
          if (/409|conflict/i.test(message)) {
            toast.error(t("pinboard.reorder.conflict"));
            onConflict?.();
          } else {
            toast.error(t("pinboard.reorder.error", { error: message }));
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
        <ul
          className="flex flex-col gap-2"
          aria-label={t("pinboard.reorder.list")}
        >
          {ids.map((id) => {
            const entry = byId.get(id);
            if (!entry) return null;
            return (
              <li key={id}>
                <SortableRow
                  entry={entry}
                  stale={staleSet.has(id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </li>
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
};
