import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { alpha, useTheme } from "@mui/material/styles";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type { NodeRendererProps } from "react-arborist";
import type { Chapter } from "./ChapterArborist";

/**
 * Factory that returns a reader-only Node renderer for the chapter tree.
 */
export const createChapterArboristNode = (bookId: string) => {
  return function ChapterArboristNode({
    node,
    style,
  }: NodeRendererProps<Chapter>) {
    const theme = useTheme();
    const hasChildren = !!(node.children && node.children.length > 0);
    const isSelected = node.state.isSelected;
    const selectedBg = alpha(theme.palette.primary.main, 0.08);
    const selectedColor = theme.palette.primary.main;

    return (
      <div
        role="treeitem"
        tabIndex={0}
        style={{
          ...style,
          backgroundColor: isSelected ? selectedBg : "transparent",
          color: isSelected ? selectedColor : undefined,
        }}
        className="flex items-center gap-2 px-2 py-1 cursor-pointer select-none rounded-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {/* Arrow toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => node.toggle()}
            className="w-6 h-6 flex justify-center items-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label={node.isOpen ? "Collapse" : "Expand"}
          >
            {node.isOpen ? (
              <KeyboardArrowDownIcon fontSize="small" />
            ) : (
              <KeyboardArrowRightIcon fontSize="small" />
            )}
          </button>
        ) : null}

        {/* Title with navigation link for leaf nodes */}
        <div className="min-w-0 flex-1">
          {hasChildren ? (
            <span className="truncate">{node.data.title}</span>
          ) : (
            <Link
              to="/book/$bookId/read/$chapterId"
              params={{ bookId, chapterId: String(node.id) }}
            >
              <span className="block truncate">{node.data.title}</span>
            </Link>
          )}
        </div>
      </div>
    );
  };
};
