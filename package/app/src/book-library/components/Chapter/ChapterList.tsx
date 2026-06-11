import { bookQueries } from "@rezics/api/book/book.queries";
import type { BookContentStructureItem } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useChapterListStore } from "@/book-library/states/chapterListStore";
import { QueryErrorDisplay } from "@/core";
import { Link } from "@/shared/ui/link";
import {
  type BookContentStructureOccurrence,
  materializedOrPathId,
  withBookContentStructureOccurrences,
} from "../../models/bookContentStructurePath";
import {
  ContentChapterVirtualTree,
  type ContentChapterVirtualTreeHandle,
} from "./ContentChapterVirtualTree";

export type BookTocTreeHandle = {
  expandAll: () => void;
  collapseAll: () => void;
  toggle: (id: string) => void;
  isExpanded: (id: string) => boolean;
  setExpandedIds: (ids: string[] | Set<string>) => void;
};

type ChapterLeafProps = {
  bookId: string;
  node: BookContentStructureOccurrence;
};

export const ChapterLeaf = React.memo(function ChapterLeaf({
  bookId,
  node,
}: ChapterLeafProps) {
  const name = node.title;

  // const TRUNCATE_LEN = 15;
  // const isTruncated = name.length > TRUNCATE_LEN;
  // const displayName = isTruncated ? `${name.slice(0, TRUNCATE_LEN)}…` : name;
  const isTruncated = true;
  const displayName = name;

  const content = (
    <Link
      to="/book/$bookId/node/$nodeId"
      params={{
        bookId,
        nodeId: node.nodeId ?? "",
      }}
      className="block hover:text-link"
    >
      <p className="truncate p-2 rounded-md transition-colors duration-200">
        {displayName}
      </p>
    </Link>
  );

  return isTruncated ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={content} />
        <TooltipContent side="top">{name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    content
  );
});

function getAllExpandableIds(
  nodes: BookContentStructureOccurrence[],
): Set<string> {
  const set = new Set<string>();
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    const children = n.children ?? [];
    if (children.length > 0) {
      set.add(materializedOrPathId(n));
      for (let i = 0; i < children.length; i++) stack.push(children[i]);
    }
  }
  return set;
}

export type BookTocTreeProps = {
  bookId: string;
  nodes: BookContentStructureOccurrence[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  renderGroupActions?: boolean;
};

const CHAPTER_GRID_CLASS =
  "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1";

/**
 * Render chapter tree items WITHOUT a wrapping layout container.
 * This is important so recursion can keep rendering at the same "root grid level"
 * (no nested grid/indent), while group headers can span full width.
 * 渲染章节树项时不包裹布局容器。
 * 这一点很重要：使递归能持续在同一“根网格层级”渲染（无嵌套网格/缩进），
 * 同时让分组标题可以横跨整行宽度。
 */
const BookTocTreeItems = React.memo(function BookTocTreeItems({
  bookId,
  nodes,
  expanded,
  onToggle,
  renderGroupActions = true,
}: BookTocTreeProps) {
  const { t } = useTranslation("common");
  if (!nodes || nodes.length === 0) return null;

  return (
    <>
      {nodes.map((node) => {
        const children = node.children ?? [];
        const hasChildren = children.length > 0;

        if (!hasChildren) {
          return (
            <ChapterLeaf key={node.occurrenceId} bookId={bookId} node={node} />
          );
        }

        const nodeKey = materializedOrPathId(node);
        const isOpen = expanded.has(nodeKey);

        return (
          <React.Fragment key={node.occurrenceId}>
            <div className="col-span-full flex items-center justify-between">
              <button
                type="button"
                className="text-xl font-semibold mb-2 cursor-pointer text-left"
                onClick={() => onToggle(nodeKey)}
              >
                {node.title}
              </button>

              {renderGroupActions && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggle(nodeKey)}
                >
                  {isOpen ? t("collapse") : t("expand")}
                </Button>
              )}
            </div>

            {isOpen && (
              <BookTocTreeItems
                bookId={bookId}
                nodes={children}
                expanded={expanded}
                onToggle={onToggle}
                renderGroupActions={renderGroupActions}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
});

const BookTocTreeInner = React.memo(function BookTocTreeInner({
  bookId,
  nodes,
  expanded,
  onToggle,
  renderGroupActions = true,
}: BookTocTreeProps) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <div className={CHAPTER_GRID_CLASS}>
      <BookTocTreeItems
        bookId={bookId}
        nodes={nodes}
        expanded={expanded}
        onToggle={onToggle}
        renderGroupActions={renderGroupActions}
      />
    </div>
  );
});

type BookTocTreeViewProps = {
  bookId: string;
  nodes: BookContentStructureOccurrence[];
  /**
   * Optional: persist expanded ids externally (e.g. Zustand store).
   * If provided, component will read initial expanded ids from it once on mount,
   * and call it on every change.
   * 可选：将展开的 id 持久化到外部（例如 Zustand store）。
   * 若提供，组件会在挂载时从中读取一次初始展开的 id，并在每次变化时回调写入。
   */
  storageKey?: string;
  defaultExpandAll?: boolean;
};

export const BookTocTreeView = forwardRef<
  BookTocTreeHandle,
  BookTocTreeViewProps
>(function BookTocTreeView(
  { bookId, nodes, storageKey, defaultExpandAll = true },
  ref,
) {
  const persisted = useChapterListStore((s) =>
    storageKey ? s.chapterList[storageKey]?.expandedNodes : undefined,
  );

  const initialExpanded = useMemo(() => {
    // from store if exists
    // 若存在则取自 store
    if (persisted) {
      try {
        const arr = JSON.parse(persisted) as string[];
        return new Set(arr.map(String));
      } catch {
        // ignore malformed storage
        // 忽略格式错误的存储数据
      }
    }
    // otherwise default
    // 否则使用默认值
    return defaultExpandAll ? getAllExpandableIds(nodes) : new Set<string>();
  }, [persisted, defaultExpandAll, nodes]);

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  // If nodes change drastically (e.g. fetch reload), keep current expanded when possible,
  // but ensure ids still valid; optionally expand all if empty & defaultExpandAll.
  // 当 nodes 发生大幅变化时（例如重新拉取），尽量保留当前展开状态，
  // 但需确保 id 仍然有效；若结果为空且 defaultExpandAll 为真，则可选地展开全部。
  useEffect(() => {
    const expandable = getAllExpandableIds(nodes);
    setExpanded((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (expandable.has(id)) next.add(id);
      if (next.size === 0 && defaultExpandAll) return expandable;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, defaultExpandAll]);

  const persistExpanded = useCallback(
    (set: Set<string>) => {
      if (!storageKey) return;
      const arr = [...set];
      useChapterListStore.getState().updateChapterList(storageKey, {
        expandedNodes: JSON.stringify(arr),
      });
    },
    [storageKey],
  );

  const setExpandedSafe = useCallback(
    (next: Set<string>) => {
      setExpanded(next);
      persistExpanded(next);
    },
    [persistExpanded],
  );

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        persistExpanded(next);
        return next;
      });
    },
    [persistExpanded],
  );

  const expandAll = useCallback(() => {
    const all = getAllExpandableIds(nodes);
    setExpandedSafe(all);
  }, [nodes, setExpandedSafe]);

  const collapseAll = useCallback(() => {
    setExpandedSafe(new Set());
  }, [setExpandedSafe]);

  const isExpanded = useCallback(
    (id: string) => expanded.has(String(id)),
    [expanded],
  );

  const setExpandedIds = useCallback(
    (ids: string[] | Set<string>) => {
      const next =
        ids instanceof Set
          ? new Set([...ids].map(String))
          : new Set(ids.map(String));
      setExpandedSafe(next);
    },
    [setExpandedSafe],
  );

  useImperativeHandle(
    ref,
    () => ({
      expandAll,
      collapseAll,
      toggle,
      isExpanded,
      setExpandedIds,
    }),
    [expandAll, collapseAll, toggle, isExpanded, setExpandedIds],
  );

  return (
    <BookTocTreeInner
      bookId={bookId}
      nodes={nodes}
      expanded={expanded}
      onToggle={toggle}
    />
  );
});

/** Props for ChapterList component. ChapterList 组件的属性。 */
export interface ChapterListProps {
  /** Book unit ID. 书籍 Unit ID。 */
  id: string;
}

/**
 * Chapter List - Displays a lightweight virtualized chapter tree.
 *
 * Fetches chapter data and renders using BookTocTreeView.
 * 章节列表 — 展示一个轻量级的虚拟化章节树。
 *
 * 拉取章节数据并通过 BookTocTreeView 渲染。
 */
export const ChapterList: React.FC<ChapterListProps> = ({ id }) => {
  const { t } = useTranslation(["book", "common"]);
  const { data, isLoading, error } = useQuery(bookQueries.contentStructure(id));

  const bookTocTree: BookContentStructureItem[] = useMemo(
    () => data?.nodes ?? [],
    [data],
  );
  const chapterOccurrences = useMemo(
    () => withBookContentStructureOccurrences(bookTocTree),
    [bookTocTree],
  );

  const treeRef = React.useRef<ContentChapterVirtualTreeHandle>(null);

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <AccentBarWithText text={t("book:toc")} />
      </div>

      <ContentChapterVirtualTree
        key={id}
        ref={treeRef}
        bookId={id}
        nodes={chapterOccurrences}
      />
    </div>
  );
};
