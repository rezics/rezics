import { Add, Search, UnfoldLess, UnfoldMore } from "@mui/icons-material";
import { Button, IconButton, Tooltip } from "@mui/material";
import type React from "react";

interface ChapterTreeEditorToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onNewChapter: () => void;
}

export const ChapterTreeEditorToolbar: React.FC<
  ChapterTreeEditorToolbarProps
> = ({
  searchTerm,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  onNewChapter,
}) => {
  return (
    <div className="flex items-center gap-2 pb-3">
      <div className="relative flex-1">
        <Search sx={{ fontSize: 16 }} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onSearchChange(e.target.value)
          }
          placeholder="Search chapters..."
          className="w-full pl-8 h-8 border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors"
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
