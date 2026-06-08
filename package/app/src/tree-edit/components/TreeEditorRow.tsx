import { Button, Checkbox } from "@rezics/ui/shadcn";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import type React from "react";
import { TreeActionMenu } from "./TreeActionMenu";
import type { TreeActionItem } from "../models/types";

interface TreeEditorRowProps {
  label: React.ReactNode;
  meta?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  actions: readonly TreeActionItem[];
  hasChildren?: boolean;
  expanded?: boolean;
  selected?: boolean;
  selectable?: boolean;
  draggable?: boolean;
  dragHandle?: React.Ref<HTMLSpanElement>;
  onToggle?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSelect?: (event?: React.MouseEvent | React.KeyboardEvent) => void;
  onActivate?: () => void;
  className?: string;
  actionLabel?: string;
  DragIcon?: LucideIcon;
}

export function TreeEditorRow({
  label,
  meta,
  leadingIcon,
  actions,
  hasChildren = false,
  expanded = false,
  selected = false,
  selectable = false,
  draggable = false,
  dragHandle,
  onToggle,
  onSelect,
  onActivate,
  className,
  actionLabel,
  DragIcon = GripVertical,
}: TreeEditorRowProps) {
  const toggleLabel = hasChildren
    ? expanded
      ? "Collapse"
      : "Expand"
    : "No children";

  return (
    <div
      className={`group flex h-full min-w-0 items-center gap-2 border-b border-border-whisper bg-surface-base px-2 text-sm leading-dense text-text-primary hover:bg-surface-subtle ${className ?? ""}`}
      onDoubleClick={onActivate}
    >
      {selectable ? (
        <span
          className="flex size-8 items-center justify-center"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect?.(event);
            }}
            onKeyDown={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              event.stopPropagation();
              onSelect?.(event);
            }}
            aria-label="Select row"
          />
        </span>
      ) : null}
      {draggable ? (
        <span
          ref={dragHandle}
          className="flex size-8 cursor-grab items-center justify-center rounded-sm text-text-tertiary active:cursor-grabbing"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <DragIcon className="size-4" aria-hidden />
        </span>
      ) : null}
      {leadingIcon ? (
        <span className="flex size-8 items-center justify-center rounded-sm bg-surface-subtle text-text-tertiary">
          {leadingIcon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium leading-ui text-text-primary">
          {label}
        </span>
        {meta ? (
          <span className="truncate text-xs leading-dense text-text-tertiary">
            {meta}
          </span>
        ) : null}
      </div>
      <span
        className="shrink-0"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <TreeActionMenu actions={actions} label={actionLabel} />
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0"
        onClick={(event) => {
          event.stopPropagation();
          onToggle?.(event);
        }}
        disabled={!hasChildren}
        aria-label={toggleLabel}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="size-4" aria-hidden />
          ) : (
            <ChevronRight className="size-4" aria-hidden />
          )
        ) : (
          <span className="size-4" />
        )}
      </Button>
    </div>
  );
}
