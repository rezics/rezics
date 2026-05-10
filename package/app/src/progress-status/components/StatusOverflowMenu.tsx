import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { MoreHorizontal, Pause, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  READ_STATUS_I18N_KEYS,
  READ_STATUS_LABELS_ZH_HANT,
} from "../models/status";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type StatusOverflowMenuProps = {
  onSelectPaused: () => void;
  onSelectDropped: () => void;
  onRemoveProgress: () => void;
  disabled?: boolean;
  isActive?: boolean;
  className?: string;
};

export function StatusOverflowMenu({
  onSelectPaused,
  onSelectDropped,
  onRemoveProgress,
  disabled,
  isActive,
  className,
}: StatusOverflowMenuProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="outline"
            size="default"
            aria-label={t("progress_status.overflow.aria", "更多狀態選項")}
            disabled={disabled}
            className={cx(
              "h-9 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-white/90 hover:bg-white/10 hover:text-white aria-expanded:bg-white/15 aria-expanded:text-white",
              isActive && "bg-white/15 text-white",
              className,
            )}
            {...props}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onSelectPaused}>
          <Pause className="w-4 h-4 mr-2" />
          {t(READ_STATUS_I18N_KEYS.PAUSED, READ_STATUS_LABELS_ZH_HANT.PAUSED)}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSelectDropped}>
          <X className="w-4 h-4 mr-2" />
          {t(READ_STATUS_I18N_KEYS.DROPPED, READ_STATUS_LABELS_ZH_HANT.DROPPED)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRemoveProgress}>
          <Trash2 className="w-4 h-4 mr-2" />
          {t("progress_status.overflow.remove_progress", "移除進度")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
