import { GripVertical, MoreVertical } from "lucide-react";
import type React from "react";
import type { NodeRendererProps, TreeApi } from "react-arborist";
import type { Chapter, ChapterContextMenuState } from "./ChapterTreeEditor";

/** Uniform row height — react-arborist (react-window) requires a single number. */
export const LEAF_ROW_HEIGHT = 84;

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

    // ─── Parent / section node (compact row) ───
    if (hasChildren) {
      return (
        <div
          role="treeitem"
          tabIndex={0}
          style={style}
          ref={dragHandle}
          className={`group flex items-center gap-1.5 px-2 h-full cursor-default select-none rounded-sm transition-colors ${
            isSelected
              ? "bg-accent text-accent-foreground"
              : "hover:bg-muted/50"
          }`}
          onDoubleClick={() => node.edit()}
          onContextMenu={handleContextMenu}
        >
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing">
            <GripVertical className="size-3.5" />
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              node.toggle();
            }}
            className="flex-shrink-0 w-4 h-4 flex justify-center items-center text-muted-foreground hover:text-foreground"
          >
            <svg
              className={`size-3 transition-transform ${node.isOpen ? "rotate-90" : ""}`}
              viewBox="0 0 6 10"
              fill="currentColor"
            >
              <path d="M1.4 0L0 1.4 3.6 5 0 8.6 1.4 10l5-5z" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            {node.isEditing ? (
              <input
                type="text"
                defaultValue={node.data.title}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => node.reset()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") node.reset();
                  if (e.key === "Enter") {
                    node.submit((e.target as HTMLInputElement).value);
                  }
                }}
                className="w-full px-1.5 py-0.5 text-sm rounded border border-ring bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <span className="block truncate text-sm font-medium">
                {node.data.title}
              </span>
            )}
          </div>

          <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatCount(wordCount)}
          </span>
        </div>
      );
    }

    // ─── Leaf / chapter node (card) ───
    return (
      <div
        role="treeitem"
        tabIndex={0}
        style={style}
        ref={dragHandle}
        className={`group cursor-default select-none transition-colors ${
          isSelected ? "bg-accent/30" : ""
        }`}
        onDoubleClick={() => node.edit()}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`mx-1 rounded-lg border bg-background px-3 py-2.5 transition-shadow hover:shadow-sm ${
            isSelected ? "border-primary/30 shadow-sm" : "border-border"
          }`}
        >
          {node.isEditing ? (
            <input
              type="text"
              defaultValue={node.data.title}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => node.reset()}
              onKeyDown={(e) => {
                if (e.key === "Escape") node.reset();
                if (e.key === "Enter") {
                  node.submit((e.target as HTMLInputElement).value);
                }
              }}
              className="w-full px-1 py-0.5 text-sm rounded border border-ring bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Title row with drag handle */}
                <div className="flex items-center gap-1.5">
                  <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing">
                    <GripVertical className="size-3.5" />
                  </span>
                  <span className="font-medium text-sm truncate">
                    {node.data.title}
                  </span>
                </div>

                {/* Meta line */}
                <div className="flex items-center gap-3 mt-1.5 pl-5.5">
                  <span className="text-xs text-rose-400">
                    {mockDate(node.id)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 pl-5.5">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCount(wordCount)} words
                  </span>
                </div>
              </div>

              {/* Kebab menu */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e);
                }}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <MoreVertical className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };
};
