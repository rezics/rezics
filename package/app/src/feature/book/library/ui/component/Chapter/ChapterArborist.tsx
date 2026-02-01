// https://github.com/brimdata/react-arborist

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Tree, TreeApi} from 'react-arborist';
import type {DeleteHandler, MoveHandler, RenameHandler} from 'react-arborist';
// 分离的 Node 渲染器工厂
import {createChapterArboristNode} from './ChapterArboristNode.tsx';
import {ChapterArboristContextMenu} from './ChapterArboristContextMenu.tsx';
import {CreateChapterDialog} from './CreateChapterDialog.tsx';
import {bookMutations} from '@package/api/book/book.mutations';
import {useAlertStore} from '@/global/windowAlertStore.ts';

import {
  findAndAddChild,
  findAndDelete,
  findAndEdit,
  findAndInsert,
  findAndRemove,
} from '@/util/arboristTreeUtil.ts';

import {Button} from '@mui/material';

/** Chapter tree node structure for arborist. */
export type Chapter = {
  id: string | number;
  title: string;
  children?: Chapter[];
};

/** Imperative handle for ChapterArborist component. */
export interface ChapterArboristRefHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

/** Context menu state for chapter tree. */
export type ChapterContextMenuState = {
  x: number;
  y: number;
  node: Chapter & {isOpen: boolean};
} | null;

/** Props for ChapterArborist component. */
interface ChapterArboristProps {
  /** Chapter tree data. */
  chapterTree: Chapter[];
  /** Tree indentation in pixels. */
  treeIndent?: number;
  /** Tree height in pixels. */
  tHeight: number;
  /** Search term for filtering. */
  searchTerm: string;
  /** Currently selected chapter ID. */
  selectedId: string;
  /** Book unit ID for mutations. */
  bookUnitId: string;
  /** Base link for chapter navigation. */
  baseLink: string;
  /** Tree width in pixels. */
  width?: number;
  /** Whether editing is enabled. */
  isEditable?: boolean;
  /** Whether drag-and-drop is enabled. */
  isDraggable?: boolean;
  /** Whether double-click rename is enabled. */
  enableDoubleClickRename?: boolean;
  /** Whether to show the update button. */
  showUpdateButton?: boolean;
  /** Whether in reading mode. */
  readingMode?: boolean;
}

// you can't use chaptersData = {} to give a default value, because it will cause the Maximum update Warning
export const ChapterArborist = forwardRef<
  ChapterArboristRefHandle,
  ChapterArboristProps
>(
  (
    {
      chapterTree,
      treeIndent = 24,
      tHeight,
      searchTerm,
      selectedId,
      bookUnitId,
      baseLink,
      width,
      isEditable = false,
      isDraggable = false,
      enableDoubleClickRename = false,
      showUpdateButton = false,
    },
    ref,
  ) => {
    const treeRef = useRef<TreeApi<Chapter> | null>(null);

    const [treeData, setTreeData] = useState<Chapter[]>([]);
    const [contextMenu, setContextMenu] =
      useState<ChapterContextMenuState>(null);
    const [createChapterDialog, setCreateChapterDialog] =
      useState<boolean>(false);
    const [currentEditParentId, setCurrentEditParentId] = useState<
      string | number | null
    >(null);
    const updateChapterIndexMutation = bookMutations.useUpdateChapterIndex();
    const {show: showAlert} = useAlertStore();

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

    function updateChapter(data: Chapter[]) {
      try {
        updateChapterIndexMutation.mutateAsync({
          bookUnitId,
          chaptersIndex: data,
        });
      } catch (error) {
        showAlert(`创建章节失败: ${error}`);
      }
    }

    function handleCreate({
      parentId,
      newNode,
    }: {
      parentId: string | number;
      newNode: Chapter;
    }) {
      const currentTree = treeData;
      let tmpTreeData;
      if (parentId) {
        tmpTreeData = findAndAddChild(
          currentTree,
          parentId,
          newNode,
        ) as Chapter[];
      } else {
        tmpTreeData = [...currentTree, newNode];
      }
      setTreeData(tmpTreeData);
      updateChapter(tmpTreeData);
    }

    function handlePreCreate(parentId: string | number | null) {
      setCreateChapterDialog(true);
      setCurrentEditParentId(parentId);
    }

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
      <>
        {showUpdateButton && (
          <Button
            variant="contained"
            color="primary"
            className="w-full"
            onClick={() => updateChapter(treeData)}
          >
            Update Chapter
          </Button>
        )}
        {isEditable && treeData.length === 0 && (
          <Button
            variant="outlined"
            color="primary"
            className="w-full mt-4"
            onClick={() => handlePreCreate(null)}
          >
            创建新章节
          </Button>
        )}
        <div
          className="p-2"
          role="presentation"
          onClick={() => setContextMenu(null)}
          onKeyDown={(e: React.KeyboardEvent) => {
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
            indent={treeIndent}
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
              setTreeData={setTreeData}
              handleCreate={handlePreCreate}
            />
          )}
          <CreateChapterDialog
            open={createChapterDialog}
            onClose={() => setCreateChapterDialog(false)}
            handleCreate={handleCreate}
            bookUnitId={bookUnitId}
            currentEditParentId={currentEditParentId}
          />
        </div>
      </>
    );
  },
);

ChapterArborist.displayName = 'ChapterArborist';
