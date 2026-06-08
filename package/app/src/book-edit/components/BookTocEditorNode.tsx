import type { ContentRating } from "@rezics/contract";
import { RatingBadge } from "@rezics/ui";
import { Badge } from "@rezics/ui/shadcn";
import {
  GripVertical as DragIndicator,
  Eye as Visibility,
  FileText,
  ListTree,
  Move,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type React from "react";
import type { NodeRendererProps, TreeApi } from "react-arborist";
import { TreeEditorRow, type TreeActionItem } from "@/tree-edit";
import { useLongPress } from "../hooks/useLongPress";
import type { Chapter, ChapterContextMenuState } from "./BookTocEditor";

/**
 * Uniform row height — react-arborist (react-window) requires a single number.
 * 统一行高 — react-arborist（react-window）要求单一数值。
 */
export const LEAF_ROW_HEIGHT = 100;

/**
 * Stable hash for seeded random mock values.
 * 用于生成可复现随机 mock 值的稳定哈希。
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// MOCK: word count derived from node id hash — replace with real data when backend is ready
// MOCK：字数由节点 id 哈希派生 — 待后端就绪后替换为真实数据
export function mockWordCount(node: Chapter): number {
  if (node.children?.length) {
    return node.children.reduce((sum, c) => sum + mockWordCount(c), 0);
  }
  if (node.noContent === true) {
    return 0;
  }
  return (hashCode(String(node.id)) % 8000) + 500;
}

/**
 * Format number for display.
 * 格式化数字以供显示。
 */
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
// MOCK：日期由节点 id 哈希派生 — 待替换为真实的 createdAt/updatedAt
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
// MOCK：发布状态由节点 id 哈希派生
function mockPublishStatus(id: string | number): "DRAFT" | "PUBLISHED" {
  return hashCode(String(id)) % 3 === 0 ? "DRAFT" : "PUBLISHED";
}

// MOCK: view count derived from node id hash
// MOCK：浏览量由节点 id 哈希派生
function mockViewCount(id: string | number): number {
  return (hashCode(String(id)) % 5000) + 10;
}

/**
 * Options for the node renderer factory.
 * 节点渲染器工厂的选项。
 */
export interface BookTocEditorNodeOptions {
  setContextMenu: React.Dispatch<React.SetStateAction<ChapterContextMenuState>>;
  treeRef: React.RefObject<TreeApi<Chapter> | null>;
  onEditChapter: (node: Chapter) => void;
  onNavigateToChapter: (node: Chapter) => void;
  isSortingMode: boolean;
  bookRating?: ContentRating;
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (
    id: string,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onCreateChild: (node: Chapter) => void;
  onCreateSiblingAfter: (node: Chapter) => void;
  onDeleteChapter: (node: Chapter) => void;
  onMoveToParent: (node: Chapter) => void;
  onMoveToFirst: (node: Chapter) => void;
  onMoveToLast: (node: Chapter) => void;
}

/**
 * Factory that returns a Node renderer bound to editor state setters.
 * 返回一个绑定到编辑器状态 setter 的节点渲染器的工厂。
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
  onCreateChild,
  onCreateSiblingAfter,
  onDeleteChapter,
  onMoveToParent,
  onMoveToFirst,
  onMoveToLast,
}: BookTocEditorNodeOptions) => {
  return function BookTocEditorNode({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<Chapter>) {
    const hasChildren = !!(node.children && node.children.length > 0);
    const isSectionNode = node.data.noContent === true;
    const wordCount = mockWordCount(node.data);

    const openContextMenuAt = (x: number, y: number) => {
      treeRef.current?.select(String(node.id));
      setContextMenu({ x, y, node });
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenuAt(e.clientX, e.clientY);
    };

    const openContextMenuFromTouch = (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0] ?? e.changedTouches[0];
      if (touch) {
        openContextMenuAt(touch.clientX, touch.clientY);
      }
    };

    const longPress = useLongPress(openContextMenuFromTouch);
    const effectiveRating = node.data.rating ?? bookRating;
    const isOverride = node.data.rating !== undefined;
    const isChecked = selectedIds.has(String(node.id));
    const actions: TreeActionItem[] = [
      {
        key: "edit",
        label: isSectionNode ? "Edit" : "Edit metadata",
        icon: <Pencil className="size-4" aria-hidden />,
        onSelect: () => onEditChapter(node.data),
      },
      {
        key: "moveTo",
        label: "Move to...",
        icon: <Move className="size-4" aria-hidden />,
        onSelect: () => onMoveToParent(node.data),
      },
      {
        key: "moveToFirst",
        label: "Move to first",
        onSelect: () => onMoveToFirst(node.data),
      },
      {
        key: "moveToLast",
        label: "Move to last",
        onSelect: () => onMoveToLast(node.data),
      },
      {
        key: "addChild",
        label: "New child chapter",
        icon: <Plus className="size-4" aria-hidden />,
        separatorBefore: true,
        onSelect: () => onCreateChild(node.data),
      },
      {
        key: "addSiblingAfter",
        label: "New sibling after",
        icon: <Plus className="size-4" aria-hidden />,
        onSelect: () => onCreateSiblingAfter(node.data),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 className="size-4" aria-hidden />,
        separatorBefore: true,
        destructive: true,
        onSelect: () => onDeleteChapter(node.data),
      },
    ];

    const sectionMeta = (
      <span>
        {node.children?.length ?? 0} items · {formatCount(wordCount)} words
      </span>
    );

    const status = mockPublishStatus(node.id);
    const views = mockViewCount(node.id);
    const chapterMeta = (
      <span className="flex flex-wrap items-center gap-2">
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
        <span>Updated {mockDate(node.id)}</span>
        <span>{formatCount(wordCount)} words</span>
        {hasChildren ? <span>{node.children?.length ?? 0} items</span> : null}
        <span className="inline-flex items-center gap-0.5">
          <Visibility size={12} />
          {formatCount(views)}
        </span>
      </span>
    );

    const label = (
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className="truncate">{node.data.title}</span>
        {!isSectionNode && effectiveRating ? (
          <RatingBadge
            rating={effectiveRating}
            size="sm"
            variant={isOverride ? "filled" : "outlined"}
          />
        ) : null}
      </span>
    );

    const activate = (event?: React.MouseEvent | React.KeyboardEvent) => {
      if (isSelectionMode) {
        onToggleSelect(String(node.id), event);
        return;
      }
      if (isSectionNode) {
        onEditChapter(node.data);
        return;
      }
      if (!isSortingMode) onNavigateToChapter(node.data);
    };

    return (
      <div
        role="treeitem"
        tabIndex={0}
        style={{ ...style, paddingLeft: 0 }}
        className="h-full select-none"
        onClick={(event) => activate(event)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") activate(e);
        }}
        onContextMenu={handleContextMenu}
        {...longPress}
      >
        <TreeEditorRow
          label={label}
          meta={isSectionNode ? sectionMeta : chapterMeta}
          leadingIcon={
            isSectionNode ? (
              <ListTree className="size-4" aria-hidden />
            ) : (
              <FileText className="size-4" aria-hidden />
            )
          }
          actions={actions}
          hasChildren={hasChildren}
          expanded={node.isOpen}
          selectable={isSelectionMode}
          selected={isChecked}
          onSelect={(event) => onToggleSelect(String(node.id), event)}
          draggable={isSortingMode}
          dragHandle={isSortingMode ? dragHandle : undefined}
          DragIcon={DragIndicator}
          onToggle={(e?: React.MouseEvent) => {
            e?.stopPropagation();
            node.toggle();
          }}
          className={isChecked ? "outline outline-2 outline-primary" : ""}
        />
      </div>
    );
  };
};
