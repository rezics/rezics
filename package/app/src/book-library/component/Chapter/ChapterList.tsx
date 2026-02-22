import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {Button, Tooltip} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';

import {bookQueries} from '@package/api/book/book.queries';
import {AccentBarWithTextContainer} from '@component/Common/Navigation/AccentBar.tsx';
import {useChapterListStore} from '@/global/page/chapterListStore';
import {Link} from '@package/ui/primitive/link/Link.tsx';

import type {ChapterTreeItem} from '@package/contract';

export type ChapterTreeHandle = {
  expandAll: () => void;
  collapseAll: () => void;
  toggle: (id: string) => void;
  isExpanded: (id: string) => boolean;
  setExpandedIds: (ids: string[] | Set<string>) => void;
};

type ChapterLeafProps = {
  bookId: string;
  node: ChapterTreeItem;
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
      to="/book/$bookId/read/$chapterId"
      params={{bookId, chapterId: node.id}}
      className="block hover:text-[var(--mui-palette-primary-main)]"
    >
      <p className="truncate p-2 rounded-md transition-colors duration-200">
        {displayName}
      </p>
    </Link>
  );

  return isTruncated ? (
    <Tooltip title={name} placement="top" arrow>
      {content}
    </Tooltip>
  ) : (
    content
  );
});

function getAllExpandableIds(nodes: ChapterTreeItem[]): Set<string> {
  const set = new Set<string>();
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    const children = n.children ?? [];
    if (children.length > 0) {
      set.add(String(n.id));
      for (let i = 0; i < children.length; i++) stack.push(children[i]);
    }
  }
  return set;
}

type ChapterTreeProps = {
  bookId: string;
  nodes: ChapterTreeItem[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  renderGroupActions?: boolean;
};

const CHAPTER_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1';

/**
 * Render chapter tree items WITHOUT a wrapping layout container.
 * This is important so recursion can keep rendering at the same "root grid level"
 * (no nested grid/indent), while group headers can span full width.
 */
const ChapterTreeItems = React.memo(function ChapterTreeItems({
  bookId,
  nodes,
  expanded,
  onToggle,
  renderGroupActions = true,
}: ChapterTreeProps) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <>
      {nodes.map(node => {
        const children = node.children ?? [];
        const hasChildren = children.length > 0;

        if (!hasChildren) {
          return <ChapterLeaf key={node.id} bookId={bookId} node={node} />;
        }

        const isOpen = expanded.has(String(node.id));

        return (
          <React.Fragment key={node.id}>
            <div className="col-span-full flex items-center justify-between">
              <button
                type="button"
                className="text-xl font-semibold mb-2 cursor-pointer text-left"
                onClick={() => onToggle(String(node.id))}
              >
                {node.title}
              </button>

              {renderGroupActions && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => onToggle(String(node.id))}
                >
                  {isOpen ? 'Collapse' : 'Expand'}
                </Button>
              )}
            </div>

            {isOpen && (
              <ChapterTreeItems
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

const ChapterTreeInner = React.memo(function ChapterTreeInner({
  bookId,
  nodes,
  expanded,
  onToggle,
  renderGroupActions = true,
}: ChapterTreeProps) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <div className={CHAPTER_GRID_CLASS}>
      <ChapterTreeItems
        bookId={bookId}
        nodes={nodes}
        expanded={expanded}
        onToggle={onToggle}
        renderGroupActions={renderGroupActions}
      />
    </div>
  );
});

type ChapterTreeViewProps = {
  bookId: string;
  nodes: ChapterTreeItem[];
  /**
   * Optional: persist expanded ids externally (e.g. Zustand store).
   * If provided, component will read initial expanded ids from it once on mount,
   * and call it on every change.
   */
  storageKey?: string;
  defaultExpandAll?: boolean;
};

export const ChapterTreeView = forwardRef<
  ChapterTreeHandle,
  ChapterTreeViewProps
>(function ChapterTreeView(
  {bookId, nodes, storageKey, defaultExpandAll = true},
  ref,
) {
  const persisted = useChapterListStore(s =>
    storageKey ? s.chapterList[storageKey]?.expandedNodes : undefined,
  );

  const initialExpanded = useMemo(() => {
    // from store if exists
    if (persisted) {
      try {
        const arr = JSON.parse(persisted) as string[];
        return new Set(arr.map(String));
      } catch {
        // ignore malformed storage
      }
    }
    // otherwise default
    return defaultExpandAll ? getAllExpandableIds(nodes) : new Set<string>();
  }, [persisted, defaultExpandAll, nodes]);

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  // If nodes change drastically (e.g. fetch reload), keep current expanded when possible,
  // but ensure ids still valid; optionally expand all if empty & defaultExpandAll.
  useEffect(() => {
    const expandable = getAllExpandableIds(nodes);
    setExpanded(prev => {
      const next = new Set<string>();
      for (const id of prev) if (expandable.has(id)) next.add(id);
      if (next.size === 0 && defaultExpandAll) return expandable;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

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
      setExpanded(prev => {
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
    <ChapterTreeInner
      bookId={bookId}
      nodes={nodes}
      expanded={expanded}
      onToggle={toggle}
    />
  );
});

/** Props for ChapterList component. */
interface ChapterListProps {
  /** Book unit ID. */
  id: string;
}

/**
 * Chapter List - Displays chapter tree with expand/collapse controls.
 *
 * Fetches chapter data and renders using ChapterTreeView.
 */
export const ChapterList: React.FC<ChapterListProps> = ({id}) => {
  const {t} = useTranslation();
  const {data, isLoading, error} = useQuery(bookQueries.chapterIndex(id));

  const chapterTree: ChapterTreeItem[] = useMemo(
    () => data?.index ?? [],
    [data],
  );

  const treeRef = React.useRef<ChapterTreeHandle>(null);

  if (isLoading) return <div>{t('common.loading')}</div>;
  if (error)
    return (
      <div>
        {t('common.error_generic')} {String(error)}
      </div>
    );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <AccentBarWithTextContainer text={t('book.toc')} />

        <div className="flex justify-end gap-2">
          <Button
            variant="contained"
            onClick={() => treeRef.current?.expandAll()}
          >
            {t('common.expand_all')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => treeRef.current?.collapseAll()}
          >
            {t('common.collapse_all')}
          </Button>
        </div>
      </div>

      <ChapterTreeView
        ref={treeRef}
        bookId={id}
        nodes={chapterTree}
        storageKey={id}
        defaultExpandAll={true}
      />
    </div>
  );
};

// Legacy export for backward compatibility
export {ChapterList as ChapterListContainer};
