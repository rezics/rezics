import { Link } from "@/shared/ui/link";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { type NodeRendererProps, Tree, type TreeApi } from "react-arborist";
import { cn } from "@/shared/utils/css-util";
import {
  type BookContentStructureOccurrence,
  EMPTY_CHAPTER_ROUTE_ID,
  encodeBookContentStructurePath,
} from "../../models/bookContentStructurePath";

const CONTENT_ROW_HEIGHT = 64;
const MIN_TREE_HEIGHT = 320;
const VIEWPORT_HEIGHT_GAP = 96;

type ContentChapter = BookContentStructureOccurrence;

export type ContentChapterVirtualTreeHandle = {
  expandAll: () => void;
  collapseAll: () => void;
};

type ContentChapterVirtualTreeProps = {
  bookId: string;
  nodes: ContentChapter[];
};

function createContentChapterNode(bookId: string) {
  return function ContentChapterNode({
    node,
    style,
  }: NodeRendererProps<ContentChapter>) {
    const hasChildren = Boolean(node.children?.length);
    const isSelected = node.state.isSelected;

    const title = (
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-ui text-text-primary">
          {node.data.title}
        </span>
        <span className="mt-1 block truncate text-xs leading-dense text-text-tertiary">
          {hasChildren ? "Section" : "Chapter"}
        </span>
      </div>
    );

    return (
      <div
        role="treeitem"
        tabIndex={0}
        style={{
          ...style,
          height: CONTENT_ROW_HEIGHT,
          boxSizing: "border-box",
        }}
        className="outline-none"
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === "Enter" && hasChildren) node.toggle();
        }}
      >
        <div
          className={cn(
            "group flex h-full w-full min-w-0 items-center gap-2 border-b border-border-whisper px-3 transition-colors hover:bg-surface-subtle",
            isSelected && "bg-surface-subtle",
          )}
          style={{ height: CONTENT_ROW_HEIGHT }}
        >
          <Link
            to="/book/$bookId/read/$chapterId"
            params={{
              bookId,
              chapterId: node.data.chapterUnitId ?? EMPTY_CHAPTER_ROUTE_ID,
            }}
            search={
              node.data.chapterUnitId
                ? undefined
                : {
                    path: encodeBookContentStructurePath(node.data.path),
                    title: node.data.title,
                  }
            }
            className="flex h-full min-w-0 flex-1 items-center"
          >
            {title}
          </Link>

          {hasChildren && (
            <button
              type="button"
              className="flex size-7 flex-none items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary"
              aria-label={node.isOpen ? "Collapse" : "Expand"}
              onClick={(event) => {
                event.stopPropagation();
                node.toggle();
              }}
            >
              {node.isOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };
}

export const ContentChapterVirtualTree = forwardRef<
  ContentChapterVirtualTreeHandle,
  ContentChapterVirtualTreeProps
>(function ContentChapterVirtualTree({ bookId, nodes }, ref) {
  const treeRef = useRef<TreeApi<ContentChapter> | null>(null);
  const [treeHeight, setTreeHeight] = useState(MIN_TREE_HEIGHT);
  const [searchTerm, setSearchTerm] = useState("");

  useImperativeHandle(ref, () => ({
    expandAll: () => treeRef.current?.openAll(),
    collapseAll: () => treeRef.current?.closeAll(),
  }));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const initialPageHeight = window.innerHeight - VIEWPORT_HEIGHT_GAP;
      setTreeHeight(Math.max(MIN_TREE_HEIGHT, Math.floor(initialPageHeight)));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const Node = useMemo(() => createContentChapterNode(bookId), [bookId]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="chapter-content-search">Search</Label>
          <div className="flex h-9 items-center gap-2 rounded-3xl bg-input/50 px-3 focus-within:ring-3 focus-within:ring-ring/30">
            <Search className="size-4 flex-none text-text-tertiary" />
            <Input
              id="chapter-content-search"
              value={searchTerm}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search chapters"
              className="h-full flex-1 border-0 bg-transparent px-0 py-0 focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => treeRef.current?.openAll()}
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => treeRef.current?.closeAll()}
          >
            Collapse All
          </Button>
        </div>
      </div>

      <div className="min-h-0 overflow-hidden" role="presentation">
        <Tree<ContentChapter>
          ref={treeRef}
          data={nodes}
          width="100%"
          height={treeHeight}
          indent={0}
          rowHeight={CONTENT_ROW_HEIGHT}
          overscanCount={4}
          disableDrag={true}
          disableDrop={true}
          openByDefault={true}
          idAccessor={(node) => node.occurrenceId}
          searchTerm={searchTerm}
          searchMatch={(node, term) =>
            node.data.title.toLowerCase().includes(term.toLowerCase())
          }
          childrenAccessor="children"
          className="overflow-auto"
        >
          {Node}
        </Tree>
      </div>
    </div>
  );
});
