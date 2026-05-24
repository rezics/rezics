import {
  ChevronDown as KeyboardArrowDownIcon,
  ChevronRight as KeyboardArrowRightIcon,
} from "lucide-react";
import type { NodeRendererProps } from "react-arborist";
import { Link } from "@/shared/ui/link";
import {
  EMPTY_CHAPTER_ROUTE_ID,
  encodeBookContentStructurePath,
} from "../../models/bookContentStructurePath";
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
        <div className="min-w-0 flex-1">
          {hasChildren ? (
            <span className="truncate">{node.data.title}</span>
          ) : (
            <Link
              to="/book/$bookId/read/$chapterId"
              params={{
                bookId,
                chapterId: node.data.chapterUnitId ?? EMPTY_CHAPTER_ROUTE_ID,
              }}
              search={
                node.data.chapterUnitId
                  ? { path: undefined, title: undefined }
                  : {
                      path: encodeBookContentStructurePath(node.data.path),
                      title: node.data.title,
                    }
              }
            >
              <span className="block truncate">{node.data.title}</span>
            </Link>
          )}
        </div>

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
      </div>
    );
  };
};
