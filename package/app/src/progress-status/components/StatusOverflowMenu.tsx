import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { MoreHorizontal, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

type StatusOverflowMenuProps = {
  onSelectDropped: () => void;
  onRemoveProgress: () => void;
  disabled?: boolean;
};

export function StatusOverflowMenu({
  onSelectDropped,
  onRemoveProgress,
  disabled,
}: StatusOverflowMenuProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("progress_status.overflow.aria", "更多狀態選項")}
            disabled={disabled}
            className="rounded-full"
            {...props}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onSelectDropped}>
          <X className="w-4 h-4 mr-2" />
          {t("progress_status.overflow.dropped", "棄")}
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
