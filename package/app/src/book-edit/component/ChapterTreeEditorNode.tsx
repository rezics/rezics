import { DragIndicator, ExpandMore, MoreVert } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import type React from "react";
import type { NodeRendererProps, TreeApi } from "react-arborist";
import type { Chapter, ChapterContextMenuState } from "./ChapterTreeEditor";

/** Uniform row height — react-arborist (react-window) requires a single number. */
export const LEAF_ROW_HEIGHT = 80;

/** Stable hash for seeded random mock word count. */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Mock word count — to be replaced with real data later. */
export function mockWordCount(node: Chapter): number {
  if (node.children?.length) {
    return node.children.reduce((sum, c) => sum + mockWordCount(c), 0);
  }
  return (hashCode(String(node.id)) % 8000) + 500;
}

/** Format number for display. */
function formatCount(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}w`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return n.toLocaleString();
}

/** Mock date from node id. */
function mockDate(id: string | number): string {
  const h = hashCode(String(id));
  const year = 2026;
  const month = (h % 12) + 1;
  const day = (h % 28) + 1;
  const hour = h % 24;
  const min = (h * 7) % 60;
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Factory that returns a Node renderer bound to editor state setters.
 */
export const createChapterTreeEditorNode = (
  setContextMenu: React.Dispatch<
    React.SetStateAction<ChapterContextMenuState>
  >,
  treeRef: React.RefObject<TreeApi<Chapter> | null>,
  onEditChapter: (node: Chapter) => void,
) => {
  return function ChapterTreeEditorNode({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<Chapter>) {
    const hasChildren = !!(node.children && node.children.length > 0);
    const isSelected = node.state.isSelected;
    const wordCount = mockWordCount(node.data);

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      treeRef.current?.select(String(node.id));
      setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    // ─── Parent / section node ───
    if (hasChildren) {
      return (
        <div
          role="treeitem"
          tabIndex={0}
          style={style}
          ref={dragHandle}
          className={`group flex items-center gap-2 px-2 h-full cursor-pointer select-none transition-colors duration-150 ${
            isSelected
              ? "bg-primary/8"
              : "hover:bg-muted/40"
          }`}
          onClick={() => node.toggle()}
          onContextMenu={handleContextMenu}
        >
          <span className="flex-shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors">
            <DragIndicator sx={{ fontSize: 16 }} />
          </span>

          <span className="flex-shrink-0 w-5 h-5 flex justify-center items-center text-muted-foreground">
            <ExpandMore
              sx={{
                fontSize: 20,
                transition: "transform 200ms ease",
                transform: node.isOpen ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            />
          </span>

          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold truncate">
              {node.data.title}
            </span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {node.children?.length ?? 0} items
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatCount(wordCount)} words
              </span>
            </div>
          </div>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            sx={{ width: 28, height: 28 }}
          >
            <MoreVert sx={{ fontSize: 18 }} />
          </IconButton>
        </div>
      );
    }

    // ─── Leaf / chapter node ───
    return (
      <div
        role="treeitem"
        tabIndex={0}
        style={style}
        ref={dragHandle}
        className={`group cursor-default select-none transition-colors duration-150 ${
          isSelected ? "bg-primary/6" : ""
        }`}
        onDoubleClick={() => onEditChapter(node.data)}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`mx-1 rounded-lg px-3 py-2 transition-all duration-200 ${
            isSelected
              ? "bg-surface-variant/40 shadow-sm"
              : "hover:bg-muted/30"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* Title row with drag handle */}
              <div className="flex items-center gap-1.5">
                <span className="flex-shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors">
                  <DragIndicator sx={{ fontSize: 14 }} />
                </span>
                <span className="font-medium text-sm truncate">
                  {node.data.title}
                </span>
              </div>

              {/* Meta line */}
              <div className="flex items-center gap-3 mt-1.5 pl-5">
                <span className="text-xs text-muted-foreground">
                  {mockDate(node.id)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCount(wordCount)} words
                </span>
              </div>
            </div>

            {/* Kebab menu */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              sx={{ width: 28, height: 28 }}
            >
              <MoreVert sx={{ fontSize: 18 }} />
            </IconButton>
          </div>
        </div>
      </div>
    );
  };
};
