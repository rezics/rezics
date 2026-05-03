import { Button, IconButton, Tooltip } from "@mui/material";
import type React from "react";
import { Plus as Add, SquareCheck as CheckBoxIcon, Tag as LabelIcon, Search, ArrowUpDown as SwapVert, RefreshCw as SyncIcon, ChevronsDownUp as UnfoldLess, ChevronsUpDown as UnfoldMore } from "lucide-react";

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

      <Tooltip title="Expand All">
        <IconButton size="small" onClick={onExpandAll}>
          <UnfoldMore fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Collapse All">
        <IconButton size="small" onClick={onCollapseAll}>
          <UnfoldLess fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title={isSortingMode ? "Exit Sorting Mode" : "Sorting Mode"}>
        <IconButton
          size="small"
          onClick={onToggleSortingMode}
          sx={{
            bgcolor: isSortingMode ? "action.selected" : "transparent",
            color: isSortingMode ? "primary.main" : undefined,
          }}
        >
          <SwapVert fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip
        title={isSelectionMode ? "Exit Selection Mode" : "Select Chapters"}
      >
        <IconButton
          size="small"
          onClick={onToggleSelectionMode}
          sx={{
            bgcolor: isSelectionMode ? "action.selected" : "transparent",
            color: isSelectionMode ? "primary.main" : undefined,
          }}
        >
          <CheckBoxIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {isSelectionMode && (
        <Tooltip title="Set rating for selected">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LabelIcon fontSize="small" />}
              onClick={onBulkSetRating}
              disabled={selectedCount === 0}
              sx={{ height: 32 }}
            >
              <span className="hidden sm:inline">
                Rate {selectedCount > 0 ? `(${selectedCount})` : ""}
              </span>
            </Button>
          </span>
        </Tooltip>
      )}

      <Tooltip title="Resync index overrides">
        <IconButton size="small" onClick={onResyncOverrides}>
          <SyncIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Add chapter to last volume">
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={onNewChapter}
          sx={{ height: 32 }}
        >
          <span className="hidden sm:inline">New</span>
        </Button>
      </Tooltip>
    </div>
  );
};
