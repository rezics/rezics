// https://github.com/brimdata/react-arborist

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Tree} from 'react-arborist';
import type {DeleteHandler, MoveHandler, RenameHandler} from 'react-arborist';
import {v4 as uuidv4} from 'uuid';
// 分离的 Node 渲染器工厂
import {createChapterArboristNode} from './ChapterArboristNode.tsx';

import {ChapterArboristContextMenu} from './ChapterArboristContextMenu.tsx';

import {
  findAndAddChild,
  findAndDelete,
  findAndEdit,
  findAndInsert,
  findAndRemove,
} from '@/util/arboristTreeUtil.ts';

type Chapter = {
  id: string | number;
  title: string;
  children?: Chapter[];
};

export interface ChapterArboristRefHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

interface ChapterArboristProps {
  chapterTree: any;
  tHeight: number;
  searchTerm: string;
  selectedId: string;
  baseLink: string;
  width?: number;
  isEditable?: boolean;
  isDraggable?: boolean;
  enableDoubleClickRename?: boolean;
}

// you can't use chaptersData = {} to give a default value, because it will cause the Maximum update Warning
export const ChapterArborist = forwardRef<
  ChapterArboristRefHandle,
  ChapterArboristProps
>(
  (
    {
      chapterTree,
      tHeight,
      searchTerm,
      selectedId,
      baseLink,
      width,
      isEditable = false,
      isDraggable = false,
      enableDoubleClickRename = false,
    },
    ref,
  ) => {
    const treeRef: any = useRef(null);

    const [treeData, setTreeData] = useState<Chapter[]>([]);
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      node: any;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      expandAll() {
        treeRef.current?.openAll();
      },
      collapseAll() {
        treeRef.current?.closeAll();
      },
    }));

    useEffect(() => {
      setTreeData(chapterTree);
    }, [chapterTree]);

    function submitTreeData(data: any) {
      console.log('submitTreeData', data);
    }

    // commit side-effect simulation
    useEffect(() => {
      console.log('Tree Data Changed, Submit', treeData);
      submitTreeData(treeData);
    }, [treeData]);

    const onMove: MoveHandler<Chapter> = useCallback(
      ({dragIds, parentId, index}) => {
        setTreeData(currentTree => {
          const removed: Chapter[] = [];
          const treeWithoutDragged = findAndRemove(
            currentTree,
            dragIds,
            removed,
          ) as Chapter[];
          return findAndInsert(
            treeWithoutDragged,
            parentId,
            index,
            removed,
          ) as Chapter[];
        });
      },
      [],
    );

    const onRename: RenameHandler<Chapter> = useCallback(({id, name}) => {
      setTreeData(
        currentTree => findAndEdit(currentTree, String(id), name) as Chapter[],
      );
    }, []);

    const onDelete: DeleteHandler<Chapter> = useCallback(({ids}) => {
      setTreeData(currentTree => findAndDelete(currentTree, ids) as Chapter[]);
    }, []);

    const handleCreate = useCallback((parentId: string | number) => {
      const newNode: Chapter = {id: uuidv4(), title: 'New Chapter'};
      setTreeData(currentTree => {
        if (parentId) {
          return findAndAddChild(currentTree, parentId, newNode) as Chapter[];
        } else {
          return [...currentTree, newNode];
        }
      });
    }, []);

    // 创建带有 contextMenu 能力的 Node 渲染器
    const Node = useMemo(
      () =>
        createChapterArboristNode(
          setContextMenu,
          treeRef,
          isEditable && enableDoubleClickRename,
          isEditable && isDraggable,
          baseLink,
          isEditable,
        ),
      [
        setContextMenu,
        isEditable,
        enableDoubleClickRename,
        isDraggable,
        baseLink,
      ],
    );

    const effectiveDrag = isEditable && isDraggable;

    return (
      <div
        className="p-2"
        role="presentation"
        onClick={() => setContextMenu(null)}
        onKeyDown={(e: any) => {
          if (e.key === 'Escape') setContextMenu(null);
        }}
      >
        <Tree<Chapter>
          ref={treeRef}
          data={treeData}
          onMove={onMove}
          onRename={onRename}
          onDelete={onDelete}
          width={width ?? undefined}
          height={tHeight}
          // indent={24}
          indent={0}
          rowHeight={32}
          disableDrag={!effectiveDrag}
          disableDrop={!effectiveDrag}
          idAccessor="id"
          searchTerm={searchTerm}
          selection={selectedId ?? ''}
          searchMatch={(node, t) =>
            node.data.title.toLowerCase().includes(t.toLowerCase())
          }
          childrenAccessor="children"
          className="overflow-auto"
        >
          {Node}
        </Tree>
        {isEditable && contextMenu && (
          <ChapterArboristContextMenu
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
            treeRef={treeRef}
            setTreeData={setTreeData}
            handleCreate={handleCreate}
          />
        )}
      </div>
    );
  },
);

ChapterArborist.displayName = 'ChapterArborist';
