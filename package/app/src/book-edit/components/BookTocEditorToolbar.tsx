import {
  book_edit_add_chapter_to_last_volume,
  book_edit_collapse_all,
  book_edit_exit_selection_mode,
  book_edit_exit_sorting_mode,
  book_edit_expand_all,
  book_edit_rate_selected,
  book_edit_resync_index_overrides,
  book_edit_search_chapters_placeholder,
  book_edit_select_chapters,
  book_edit_set_rating_for_selected,
  book_edit_sorting_mode,
  common_new,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import {
  Plus as Add,
  SquareCheck as CheckBoxIcon,
  Tag as LabelIcon,
  Search,
  ArrowUpDown as SwapVert,
  RefreshCw as SyncIcon,
  ChevronsDownUp as UnfoldLess,
  ChevronsUpDown as UnfoldMore,
} from "lucide-react";
import type React from "react";

const i18nMessages = {
  book_edit_add_chapter_to_last_volume,
  book_edit_collapse_all,
  book_edit_exit_selection_mode,
  book_edit_exit_sorting_mode,
  book_edit_expand_all,
  book_edit_rate_selected,
  book_edit_resync_index_overrides,
  book_edit_search_chapters_placeholder,
  book_edit_select_chapters,
  book_edit_set_rating_for_selected,
  book_edit_sorting_mode,
  common_new,
};

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
  onResyncOverrides: () => void;
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
  onResyncOverrides,
}) => {
  const m = useMessage(i18nMessages);
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
            placeholder={m.book_edit_search_chapters_placeholder()}
            className="w-full pl-12 h-12 border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors"
          />
        </div>

        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="icon"
                variant="ghost"
                onClick={onExpandAll}
                {...props}
              >
                <UnfoldMore className="w-4 h-4" />
              </Button>
            )}
          />
          <TooltipContent>{m.book_edit_expand_all()}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="icon"
                variant="ghost"
                onClick={onCollapseAll}
                {...props}
              >
                <UnfoldLess className="w-4 h-4" />
              </Button>
            )}
          />
          <TooltipContent>{m.book_edit_collapse_all()}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="icon"
                variant={isSortingMode ? "secondary" : "ghost"}
                onClick={onToggleSortingMode}
                className={isSortingMode ? "text-primary" : undefined}
                {...props}
              >
                <SwapVert className="w-4 h-4" />
              </Button>
            )}
          />
          <TooltipContent>
            {isSortingMode
              ? m.book_edit_exit_sorting_mode()
              : m.book_edit_sorting_mode()}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="icon"
                variant={isSelectionMode ? "secondary" : "ghost"}
                onClick={onToggleSelectionMode}
                className={isSelectionMode ? "text-primary" : undefined}
                {...props}
              >
                <CheckBoxIcon className="w-4 h-4" />
              </Button>
            )}
          />
          <TooltipContent>
            {isSelectionMode
              ? m.book_edit_exit_selection_mode()
              : m.book_edit_select_chapters()}
          </TooltipContent>
        </Tooltip>

        {isSelectionMode && (
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <span {...props}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBulkSetRating}
                    disabled={selectedCount === 0}
                    className="h-8"
                  >
                    <LabelIcon className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">
                      {m.book_edit_rate_selected({
                        count: selectedCount > 0 ? `(${selectedCount})` : "",
                      })}
                    </span>
                  </Button>
                </span>
              )}
            />
            <TooltipContent>
              {m.book_edit_set_rating_for_selected()}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="icon"
                variant="ghost"
                onClick={onResyncOverrides}
                {...props}
              >
                <SyncIcon className="w-4 h-4" />
              </Button>
            )}
          />
          <TooltipContent>
            {m.book_edit_resync_index_overrides()}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="sm"
                onClick={onNewChapter}
                className="h-8"
                {...props}
              >
                <Add className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{m.common_new()}</span>
              </Button>
            )}
          />
          <TooltipContent>
            {m.book_edit_add_chapter_to_last_volume()}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
