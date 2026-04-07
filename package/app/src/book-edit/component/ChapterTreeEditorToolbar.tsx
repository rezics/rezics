import { ChevronsDownUp, ChevronsUpDown, Plus, Search } from "lucide-react";
import type React from "react";
import { Button } from "@rezics/ui/shadcn/button.tsx";
import { Input } from "@rezics/ui/shadcn/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn/tooltip.tsx";

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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onSearchChange(e.target.value)
          }
          placeholder="Search chapters..."
          className="pl-8 h-8"
        />
      </div>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onExpandAll}>
              <ChevronsUpDown className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Expand All</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onCollapseAll}>
              <ChevronsDownUp className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Collapse All</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="default" size="sm" className="h-8" onClick={onNewChapter}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add chapter to last volume</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
