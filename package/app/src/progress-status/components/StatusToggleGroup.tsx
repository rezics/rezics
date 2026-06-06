import { Button, ToggleGroup, ToggleGroupItem } from "@rezics/ui/shadcn";
import { BookmarkPlus, CircleCheck, PlayCircle } from "lucide-react";
import {
  readStatusLabel,
  TOGGLE_GROUP_STATUSES,
  type ToggleGroupStatus,
} from "../models/status";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const STATUS_ICONS: Record<
  ToggleGroupStatus,
  React.ComponentType<{ className?: string }>
> = {
  BACKLOG: BookmarkPlus,
  ACTIVE: PlayCircle,
  COMPLETED: CircleCheck,
};

export const HERO_STATUS_ITEM_CLASS =
  "h-9 w-full min-w-0 shrink rounded-none border-0 bg-transparent px-2 py-1 text-xs text-white/90 hover:bg-white/10 hover:text-white data-[state=on]:bg-white/15 data-[state=on]:text-white";

export const HERO_STATUS_PRIMARY_CLASS =
  "h-9 w-full min-w-0 rounded-none border-0 bg-transparent px-3 py-1 text-xs font-normal text-white/90 hover:bg-white/10 hover:text-white";

const DEFAULT_ITEM_CLASS =
  "h-9 w-full min-w-0 shrink rounded-full border border-border-whisper bg-transparent px-2 py-1 text-xs text-text-secondary hover:bg-muted hover:text-text-primary data-[state=on]:border-border-defined data-[state=on]:bg-muted data-[state=on]:text-text-primary";

type StatusToggleGroupProps = {
  value: ToggleGroupStatus | null;
  onValueChange: (value: ToggleGroupStatus) => void;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
};

export function StatusToggleGroup({
  value,
  onValueChange,
  disabled,
  className,
  itemClassName,
}: StatusToggleGroupProps) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value ?? undefined}
      onValueChange={(picked, eventDetails) => {
        if (!picked) {
          if (value) {
            eventDetails.cancel();
            onValueChange(value);
          }
          return;
        }
        if (TOGGLE_GROUP_STATUSES.includes(picked as ToggleGroupStatus)) {
          onValueChange(picked as ToggleGroupStatus);
        }
      }}
      disabled={disabled}
      className={cx("grid w-full grid-cols-4", className)}
    >
      {TOGGLE_GROUP_STATUSES.map((status) => {
        const Icon = STATUS_ICONS[status];
        const label = readStatusLabel(status);
        return (
          <ToggleGroupItem
            key={status}
            value={status}
            className={itemClassName ?? DEFAULT_ITEM_CLASS}
            aria-label={label}
          >
            <Icon className="w-3.5 h-3.5 mr-1" />
            {label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

type StatusPrimaryActionButtonProps = {
  status: ToggleGroupStatus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function StatusPrimaryActionButton({
  status,
  label,
  onClick,
  disabled,
  className,
}: StatusPrimaryActionButtonProps) {
  const Icon = STATUS_ICONS[status];

  return (
    <Button
      variant="outline"
      size="default"
      disabled={disabled}
      onClick={onClick}
      className={cx(HERO_STATUS_PRIMARY_CLASS, className)}
    >
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      <span className="min-w-0 truncate">{label}</span>
    </Button>
  );
}
