import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import {
  BookmarkPlus,
  CircleCheck,
  MoreHorizontal,
  Pause,
  PlayCircle,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  READ_STATUS_I18N_KEYS,
  READ_STATUS_LABELS_ZH_HANT,
  type ReadStatus,
} from "../models/status";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type StatusOverflowMenuProps = {
  onSelectBacklog?: () => void;
  onSelectActive?: () => void;
  onSelectCompleted?: () => void;
  onSelectPaused: () => void;
  onSelectDropped: () => void;
  onRemoveProgress: () => void;
  disabled?: boolean;
  currentStatus?: ReadStatus | null;
  isActive?: boolean;
  showPrimaryStatuses?: boolean;
  className?: string;
};

export function StatusOverflowMenu({
  onSelectBacklog,
  onSelectActive,
  onSelectCompleted,
  onSelectPaused,
  onSelectDropped,
  onRemoveProgress,
  disabled,
  currentStatus,
  isActive,
  showPrimaryStatuses = false,
  className,
}: StatusOverflowMenuProps) {
  const { t } = useTranslation();
  const renderStatusMarker = (status: ReadStatus) => (
    <span
      aria-hidden="true"
      className={cx(
        "h-1.5 w-1.5 rounded-full bg-transparent",
        currentStatus === status && "bg-brand-fill",
      )}
    />
  );
  const statusIconClass = (status: ReadStatus) =>
    cx(
      "w-4 h-4 mr-2",
      currentStatus === status && "text-text-brand",
    );

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
        {showPrimaryStatuses && (
          <>
            <DropdownMenuItem
              aria-current={currentStatus === "BACKLOG" ? "true" : undefined}
              onClick={onSelectBacklog}
            >
              {renderStatusMarker("BACKLOG")}
              <BookmarkPlus className={statusIconClass("BACKLOG")} />
              {t(
                READ_STATUS_I18N_KEYS.BACKLOG,
                READ_STATUS_LABELS_ZH_HANT.BACKLOG,
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              aria-current={currentStatus === "ACTIVE" ? "true" : undefined}
              onClick={onSelectActive}
            >
              {renderStatusMarker("ACTIVE")}
              <PlayCircle className={statusIconClass("ACTIVE")} />
              {t(
                READ_STATUS_I18N_KEYS.ACTIVE,
                READ_STATUS_LABELS_ZH_HANT.ACTIVE,
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              aria-current={
                currentStatus === "COMPLETED" ? "true" : undefined
              }
              onClick={onSelectCompleted}
            >
              {renderStatusMarker("COMPLETED")}
              <CircleCheck className={statusIconClass("COMPLETED")} />
              {t(
                READ_STATUS_I18N_KEYS.COMPLETED,
                READ_STATUS_LABELS_ZH_HANT.COMPLETED,
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          aria-current={currentStatus === "PAUSED" ? "true" : undefined}
          onClick={onSelectPaused}
        >
          {renderStatusMarker("PAUSED")}
          <Pause className={statusIconClass("PAUSED")} />
          {t(READ_STATUS_I18N_KEYS.PAUSED, READ_STATUS_LABELS_ZH_HANT.PAUSED)}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-current={currentStatus === "DROPPED" ? "true" : undefined}
          onClick={onSelectDropped}
        >
          {renderStatusMarker("DROPPED")}
          <X className={statusIconClass("DROPPED")} />
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
