import type { ContentRating } from "@rezics/contract";
import { RatingBadge } from "@rezics/ui";
import { Badge, Button, Card, CardContent, Checkbox } from "@rezics/ui/shadcn";
import {
  GripVertical as DragIndicator,
  ChevronDown as ExpandMore,
  EllipsisVertical as MoreVert,
  Eye as Visibility,
} from "lucide-react";
import type React from "react";
import type { NodeRendererProps, TreeApi } from "react-arborist";
import { useLongPress } from "../hooks/useLongPress";
import type { Chapter, ChapterContextMenuState } from "./BookTocEditor";

/** Uniform row height — react-arborist (react-window) requires a single number. */
export const LEAF_ROW_HEIGHT = 100;

/** Stable hash for seeded random mock values. */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// MOCK: word count derived from node id hash — replace with real data when backend is ready
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

// MOCK: date from node id hash — replace with real createdAt/updatedAt
function mockDate(id: string | number): string {
  const h = hashCode(String(id));
  const year = 2026;
  const month = (h % 12) + 1;
  const day = (h % 28) + 1;
  const hour = h % 24;
  const min = (h * 7) % 60;
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// MOCK: publish status derived from node id hash
function mockPublishStatus(id: string | number): "DRAFT" | "PUBLISHED" {
  return hashCode(String(id)) % 3 === 0 ? "DRAFT" : "PUBLISHED";
}

// MOCK: view count derived from node id hash
function mockViewCount(id: string | number): number {
  return (hashCode(String(id)) % 5000) + 10;
}

/** Options for the node renderer factory. */
export interface BookTocEditorNodeOptions {
  setContextMenu: React.Dispatch<React.SetStateAction<ChapterContextMenuState>>;
  treeRef: React.RefObject<TreeApi<Chapter> | null>;
  onEditChapter: (node: Chapter) => void;
  onNavigateToChapter: (node: Chapter) => void;
  isSortingMode: boolean;
  bookRating?: ContentRating;
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

/**
 * Factory that returns a Node renderer bound to editor state setters.
 */
export const createBookTocEditorNode = ({
  setContextMenu,
  treeRef,
  onEditChapter,
  onNavigateToChapter,
  isSortingMode,
  bookRating,
  isSelectionMode,
  selectedIds,
  onToggleSelect,
}: BookTocEditorNodeOptions) => {
  return function BookTocEditorNode({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<Chapter>) {
    const hasChildren = !!(node.children && node.children.length > 0);
    const wordCount = mockWordCount(node.data);

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      treeRef.current?.select(String(node.id));
      setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    const openContextMenuFromTouch = (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0] ?? e.changedTouches[0];
      if (touch) {
        treeRef.current?.select(String(node.id));
        setContextMenu({
          x: touch.clientX,
          y: touch.clientY,
          node,
        });
      }
    };

    const longPress = useLongPress(openContextMenuFromTouch);

    // ─── Parent / section node ───
    if (hasChildren) {
      return (
        <div
          role="treeitem"
          tabIndex={0}
          style={style}
          ref={isSortingMode ? dragHandle : undefined}
          className="group flex h-full cursor-pointer select-none items-center gap-2 px-2 transition-colors duration-150 hover:bg-surface-subtle active:bg-surface-subtle"
          onClick={() => node.toggle()}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter") node.toggle();
          }}
          onContextMenu={handleContextMenu}
          {...longPress}
        >
          {isSortingMode && (
            <span className="flex-shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors">
              <DragIndicator size={16} />
            </span>
          )}

          <span className="flex-shrink-0 w-6 h-6 flex justify-center items-center text-muted-foreground">
            <ExpandMore
              size={20}
              style={{
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

          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e);
            }}
            className="w-7 h-7"
          >
            <MoreVert size={18} />
          </Button>
        </div>
      );
    }

    // ─── Leaf / chapter node ───
    // MOCK: publish status and view count
    const status = mockPublishStatus(node.id);
    const views = mockViewCount(node.id);
    const effectiveRating = node.data.rating ?? bookRating;
    const isOverride = node.data.rating !== undefined;
    const isChecked = selectedIds.has(String(node.id));

    const handleLeafClick = () => {
      if (isSelectionMode) {
        onToggleSelect(String(node.id));
        return;
      }
      if (!isSortingMode) {
        onNavigateToChapter(node.data);
      }
    };

    return (
      <div
        role="treeitem"
        tabIndex={0}
        style={style}
        ref={isSortingMode ? dragHandle : undefined}
        className={`group select-none ${
          isSortingMode ? "cursor-default" : "cursor-pointer"
        }`}
        onClick={handleLeafClick}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") handleLeafClick();
        }}
        onDoubleClick={
          isSortingMode ? () => onEditChapter(node.data) : undefined
        }
        onContextMenu={handleContextMenu}
        {...longPress}
      >
        <Card
          surface="plain"
          className={`mx-2 mr-4 mt-px gap-0 py-0 transition-colors hover:bg-surface-subtle ${
            isChecked ? "outline outline-2 outline-primary" : ""
          }`}
          style={{ height: "calc(100% - 2px)" }}
        >
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-2">
              {isSelectionMode && (
                <Checkbox
                  checked={isChecked}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => onToggleSelect(String(node.id))}
                  className="mt-1"
                />
              )}
              <div className="min-w-0 flex-1">
                {/* Title row */}
                <div className="flex items-center gap-1.5">
                  {isSortingMode && (
                    <span className="flex-shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors">
                      <DragIndicator size={14} />
                    </span>
                  )}
                  <span className="font-medium text-sm truncate">
                    {node.data.title}
                  </span>
                  {effectiveRating && (
                    <RatingBadge
                      rating={effectiveRating}
                      size="sm"
                      variant={isOverride ? "filled" : "outlined"}
                    />
                  )}
                </div>

                {/* Status & date line */}
                <div
                  className={`flex items-center gap-3 mt-2 ${isSortingMode ? "pl-6" : "pl-0"}`}
                >
                  {/* MOCK: publish status chip */}
                  <Badge
                    variant="outline"
                    className={`h-5 text-[0.675rem] ${
                      status === "PUBLISHED"
                        ? "border-success-fill text-success-text"
                        : ""
                    }`}
                  >
                    {status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Updated {mockDate(node.id)}
                  </span>
                </div>

                {/* Stats line */}
                <div
                  className={`flex items-center gap-3 mt-1 ${isSortingMode ? "pl-6" : "pl-0"}`}
                >
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCount(wordCount)} words
                  </span>
                  {/* MOCK: view count */}
                  <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-0.5">
                    <Visibility size={12} />
                    {formatCount(views)}
                  </span>
                </div>
              </div>

              {/* Kebab menu — always visible */}
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e);
                }}
                className="w-7 h-7"
              >
                <MoreVert size={18} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
};
