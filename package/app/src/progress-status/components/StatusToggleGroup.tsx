import { Button, ToggleGroup, ToggleGroupItem } from "@rezics/ui/shadcn";
import { BookmarkPlus, CircleCheck, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
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

const STATUS_I18N: Record<
  ToggleGroupStatus,
  { key: string; fallback: string }
> = {
  BACKLOG: { key: "book.hero.actions.want_to_read", fallback: "想讀" },
  ACTIVE: { key: "book.hero.actions.reading", fallback: "在讀" },
  COMPLETED: { key: "book.hero.actions.read", fallback: "已讀" },
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
  const { t } = useTranslation();
  return (
    <ToggleGroup
      size="sm"
      value={value ? [value] : []}
      onValueChange={(next: string[]) => {
        const picked = next[next.length - 1];
        if (!picked) return;
        onValueChange(picked as ToggleGroupStatus);
      }}
      disabled={disabled}
      className={cx("grid w-full grid-cols-4", className)}
    >
      {TOGGLE_GROUP_STATUSES.map((status) => {
        const Icon = STATUS_ICONS[status];
        const label = STATUS_I18N[status];
        return (
          <ToggleGroupItem
            key={status}
            value={status}
            className={itemClassName ?? DEFAULT_ITEM_CLASS}
            aria-label={t(label.key, label.fallback)}
          >
            <Icon className="w-3.5 h-3.5 mr-1" />
            {t(label.key, label.fallback)}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

type StatusPrimaryActionButtonProps = {
  status: ToggleGroupStatus;
  labelKey: string;
  fallback: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function StatusPrimaryActionButton({
  status,
  labelKey,
  fallback,
  onClick,
  disabled,
  className,
}: StatusPrimaryActionButtonProps) {
  const { t } = useTranslation();
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
      <span className="min-w-0 truncate">{t(labelKey, fallback)}</span>
    </Button>
  );
}
