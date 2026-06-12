import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import {
  Plus as Add,
  ChevronDown,
  ListTree,
  MoreHorizontal,
  SquareCheck as CheckBoxIcon,
  Tag as LabelIcon,
  Search,
  ArrowUpDown as SwapVert,
  RefreshCw as SyncIcon,
  ChevronsDownUp as UnfoldLess,
  ChevronsUpDown as UnfoldMore,
} from "lucide-react";
import type React from "react";

interface BookTocEditorToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onNewChapter: () => void;
  isSortingMode: boolean;
  onToggleSortingMode: () => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  onBulkSetRating: () => void;
  onBulkMoveTo: () => void;
  onBulkMoveToFirst: () => void;
  onBulkMoveToLast: () => void;
  onResyncOverrides: () => void;
}

type ToolbarTooltipButtonProps = React.ComponentProps<typeof Button> & {
  tooltip: React.ReactNode;
};

function ToolbarTooltipButton({
  tooltip,
  children,
  ...buttonProps
}: ToolbarTooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <span {...props} className="inline-flex">
            <Button {...buttonProps}>{children}</Button>
          </span>
        )}
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export const BookTocEditorToolbar: React.FC<BookTocEditorToolbarProps> = ({
  searchTerm,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  onNewChapter,
  isSortingMode,
  onToggleSortingMode,
  isSelectionMode,
  onToggleSelectionMode,
  selectedCount,
  onBulkSetRating,
  onBulkMoveTo,
  onBulkMoveToFirst,
  onBulkMoveToLast,
  onResyncOverrides,
}) => {
  const { t } = useTranslation(["book", "common"]);
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 pb-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onSearchChange(e.target.value)
            }
            placeholder={t("book:edit_search_chapters_placeholder")}
            className="w-full pl-12 h-12 border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors"
          />
        </div>

        <ToolbarTooltipButton
          size="icon"
          variant="ghost"
          onClick={onExpandAll}
          tooltip={t("book:edit_expand_all")}
        >
          <UnfoldMore className="w-4 h-4" />
        </ToolbarTooltipButton>

        <ToolbarTooltipButton
          size="icon"
          variant="ghost"
          onClick={onCollapseAll}
          tooltip={t("book:edit_collapse_all")}
        >
          <UnfoldLess className="w-4 h-4" />
        </ToolbarTooltipButton>

        <ToolbarTooltipButton
          size="icon"
          variant={isSortingMode ? "secondary" : "ghost"}
          onClick={onToggleSortingMode}
          className={isSortingMode ? "text-primary" : undefined}
          tooltip={
            isSortingMode
              ? t("book:edit_exit_sorting_mode")
              : t("book:edit_sorting_mode")
          }
        >
          <SwapVert className="w-4 h-4" />
        </ToolbarTooltipButton>

        <ToolbarTooltipButton
          size="icon"
          variant={isSelectionMode ? "secondary" : "ghost"}
          onClick={onToggleSelectionMode}
          className={isSelectionMode ? "text-primary" : undefined}
          tooltip={
            isSelectionMode
              ? t("book:edit_exit_selection_mode")
              : t("book:edit_select_chapters")
          }
        >
          <CheckBoxIcon className="w-4 h-4" />
        </ToolbarTooltipButton>

        {isSelectionMode && (
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton
              render={(props) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selectedCount === 0}
                  className="h-8"
                  {...props}
                >
                  <MoreHorizontal className="w-4 h-4 mr-2" aria-hidden />
                  <span className="hidden sm:inline">
                    {t("book:edit_selection_options")}
                    {selectedCount > 0 ? ` (${selectedCount})` : ""}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-1" aria-hidden />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onBulkSetRating}>
                <LabelIcon className="size-4" aria-hidden />
                {t("book:edit_rate_selected", {
                  count: selectedCount,
                })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBulkMoveTo}>
                <ListTree className="size-4" aria-hidden />
                {t("book:chapter_move_dialog_title")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBulkMoveToFirst}>
                {t("book:chapter_move_to_first")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBulkMoveToLast}>
                {t("book:chapter_move_to_last")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ToolbarTooltipButton
          size="icon"
          variant="ghost"
          onClick={onResyncOverrides}
          tooltip={t("book:edit_resync_index_overrides")}
        >
          <SyncIcon className="w-4 h-4" />
        </ToolbarTooltipButton>

        <ToolbarTooltipButton
          size="sm"
          onClick={onNewChapter}
          className="h-8"
          tooltip={t("book:edit_add_chapter_to_last_volume")}
        >
          <Add className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">{t("common:new")}</span>
        </ToolbarTooltipButton>
      </div>
    </TooltipProvider>
  );
};
