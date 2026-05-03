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

interface ChapterTreeEditorToolbarProps {
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

export const ChapterTreeEditorToolbar: React.FC<
  ChapterTreeEditorToolbarProps
> = ({
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
            placeholder="Search chapters..."
            className="w-full pl-12 h-12 border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors"
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={onExpandAll}>
              <UnfoldMore className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Expand All</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={onCollapseAll}>
              <UnfoldLess className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Collapse All</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={isSortingMode ? "secondary" : "ghost"}
              onClick={onToggleSortingMode}
              className={isSortingMode ? "text-primary" : undefined}
            >
              <SwapVert className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isSortingMode ? "Exit Sorting Mode" : "Sorting Mode"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={isSelectionMode ? "secondary" : "ghost"}
              onClick={onToggleSelectionMode}
              className={isSelectionMode ? "text-primary" : undefined}
            >
              <CheckBoxIcon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isSelectionMode ? "Exit Selection Mode" : "Select Chapters"}
          </TooltipContent>
        </Tooltip>

        {isSelectionMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkSetRating}
                  disabled={selectedCount === 0}
                  className="h-8"
                >
                  <LabelIcon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">
                    Rate {selectedCount > 0 ? `(${selectedCount})` : ""}
                  </span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Set rating for selected</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={onResyncOverrides}>
              <SyncIcon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Resync index overrides</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" onClick={onNewChapter} className="h-8">
              <Add className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add chapter to last volume</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
