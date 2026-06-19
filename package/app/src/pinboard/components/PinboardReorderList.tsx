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
import { useReorderPinboardMutation } from "@rezics/api/pinboard/pinboard.mutations";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { GripVertical as DragIndicatorRoundedIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { PinboardEntryView, PinboardListPlacement } from "../models/types";
import { PinboardEntryCard } from "./PinboardEntryCard";

interface PinboardReorderListProps {
  realmUnitId: string;
  pinboardPlacement: PinboardListPlacement;
  entries: PinboardEntryView[];
  staleIds?: string[];
  onDelete?: (entry: PinboardEntryView) => void;
  /** Called after a 409 so the parent can re-sync. 在 409 之后调用，以便父组件重新同步。 */
  onConflict?: () => void;
}

export const PinboardReorderList: React.FC<PinboardReorderListProps> = ({
  realmUnitId,
  pinboardPlacement,
  entries,
  staleIds,
  onDelete,
  onConflict,
}) => {
  const { t } = useTranslation(["entity"]);
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

  const reorder = useReorderPinboardMutation();

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
        placement: pinboardPlacement,
        unitIds: next,
      },
      {
        onError: (err) => {
          const message = err instanceof Error ? err.message : String(err);
          if (/409|conflict/i.test(message)) {
            toast.error(t("entity:pinboard_reorder_conflict"));
            onConflict?.();
          } else {
            toast.error(t("entity:pinboard_reorder_error", { error: message }));
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
          aria-label={t("entity:pinboard_reorder_list")}
        >
          {ids.map((id) => {
            const entry = byId.get(id);
            if (!entry) return null;
            return (
              <li key={id}>
                <SortableRow
                  entry={entry}
                  stale={staleSet.has(id)}
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

interface SortableRowProps {
  entry: PinboardEntryView;
  stale?: boolean;
  onDelete?: (entry: PinboardEntryView) => void;
}

function SortableRow({ entry, stale, onDelete }: SortableRowProps) {
  const { t } = useTranslation(["entity"]);
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
        openHref={`/unit/${entry.unitId}`}
        onDelete={onDelete}
        dragHandle={
          <Button
            size="icon"
            variant="ghost"
            className="cursor-grab touch-none"
            {...attributes}
            {...listeners}
            aria-label={t("entity:pinboard_reorder_drag_handle", {
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
