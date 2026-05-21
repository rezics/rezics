import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tree, type TreeApi } from "react-arborist";
import type { BookContentStructureOccurrence } from "../../models/bookContentStructurePath";
import { createChapterArboristNode } from "./ChapterArboristNode.tsx";

/** Chapter tree node structure for arborist. */
export type Chapter = BookContentStructureOccurrence;

/** Imperative handle for ChapterArborist component. */
export interface ChapterArboristRefHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

/** Props for ChapterArborist component (reader-only). */
interface ChapterArboristProps {
  /** Chapter tree data. */
  bookTocTree: Chapter[];
  /** Tree indentation in pixels. */
  treeIndent?: number;
  /** Tree height in pixels. */
  tHeight: number;
  /** Search term for filtering. */
  searchTerm: string;
  /** Currently selected chapter ID. */
  selectedId: string;
  /** Book unit ID. */
  bookUnitId: string;
  /** Base link for chapter navigation. */
  baseLink: string;
  /** Tree width in pixels. */
  width?: number;
}

export const ChapterArborist = forwardRef<
  ChapterArboristRefHandle,
  ChapterArboristProps
>(
  (
    {
      bookTocTree,
      treeIndent = 24,
      tHeight,
      searchTerm,
      selectedId,
      baseLink,
      width,
    },
    ref,
  ) => {
    const treeRef = useRef<TreeApi<Chapter> | null>(null);
    const [treeData, setTreeData] = useState<Chapter[]>([]);

    useImperativeHandle(ref, () => ({
      expandAll() {
        treeRef.current?.openAll();
      },
      collapseAll() {
        treeRef.current?.closeAll();
      },
    }));

    useEffect(() => {
      setTreeData(bookTocTree);
    }, [bookTocTree]);

    const Node = useMemo(() => createChapterArboristNode(baseLink), [baseLink]);

    return (
      <div className="p-2" role="presentation">
        <Tree<Chapter>
          ref={treeRef}
          data={treeData}
          width={width ?? undefined}
          height={tHeight}
          indent={treeIndent}
          rowHeight={64}
          disableDrag={true}
          disableDrop={true}
          idAccessor={(node) => node.occurrenceId}
          searchTerm={searchTerm}
          selection={selectedId ?? ""}
          searchMatch={(node, t) =>
            node.data.title.toLowerCase().includes(t.toLowerCase())
          }
          childrenAccessor="children"
          className="overflow-auto"
        >
          {Node}
        </Tree>
      </div>
    );
  },
);

ChapterArborist.displayName = "ChapterArborist";
