import { ToggleGroup, ToggleGroupItem } from "@rezics/ui/shadcn";
import {
  BookmarkPlus,
  CircleCheck,
  Pause,
  PlayCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { TOGGLE_GROUP_STATUSES, type ToggleGroupStatus } from "../models/status";

const STATUS_ICONS: Record<ToggleGroupStatus, React.ComponentType<{ className?: string }>> = {
  BACKLOG: BookmarkPlus,
  ACTIVE: PlayCircle,
  PAUSED: Pause,
  COMPLETED: CircleCheck,
};

const STATUS_I18N: Record<ToggleGroupStatus, { key: string; fallback: string }> = {
  BACKLOG: { key: "book.hero.actions.want_to_read", fallback: "想讀" },
  ACTIVE: { key: "book.hero.actions.reading", fallback: "在讀" },
  PAUSED: { key: "book.hero.actions.paused", fallback: "擱置" },
  COMPLETED: { key: "book.hero.actions.read", fallback: "已讀" },
};

const ITEM_CLASS =
  "rounded-full text-text-muted border border-border-whisper hover:bg-surface-hover data-[state=on]:bg-surface-elevated data-[state=on]:text-text-primary data-[state=on]:border-border text-xs py-1";

type StatusToggleGroupProps = {
  value: ToggleGroupStatus | null;
  onValueChange: (value: ToggleGroupStatus) => void;
  disabled?: boolean;
};

export function StatusToggleGroup({
  value,
  onValueChange,
  disabled,
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
      className="w-full grid grid-cols-2 sm:grid-cols-4"
    >
      {TOGGLE_GROUP_STATUSES.map((status) => {
        const Icon = STATUS_ICONS[status];
        const label = STATUS_I18N[status];
        return (
          <ToggleGroupItem
            key={status}
            value={status}
            className={ITEM_CLASS}
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
