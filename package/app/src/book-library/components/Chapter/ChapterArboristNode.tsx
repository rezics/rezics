import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import {
  ChevronDown as KeyboardArrowDownIcon,
  ChevronRight as KeyboardArrowRightIcon,
} from "lucide-react";
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
    const hasChildren = !!(node.children && node.children.length > 0);
    const isSelected = node.state.isSelected;

    return (
      <div
        role="treeitem"
        tabIndex={0}
        style={style}
        className={`flex items-center gap-2 px-2 py-1 cursor-pointer select-none rounded-sm transition-colors hover:bg-surface-subtle ${
          isSelected
            ? "bg-[color-mix(in_srgb,var(--colors-brand-fill)_8%,transparent)] text-brand-fill"
            : ""
        }`}
      >
        {/* Arrow toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => node.toggle()}
            className="w-6 h-6 flex justify-center items-center text-text-tertiary hover:text-text-primary"
            aria-label={node.isOpen ? "Collapse" : "Expand"}
          >
            {node.isOpen ? (
              <KeyboardArrowDownIcon className="w-4 h-4" />
            ) : (
              <KeyboardArrowRightIcon className="w-4 h-4" />
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
