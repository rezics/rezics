/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import {v4 as uuidv4} from 'uuid';
import {
  insertSiblingAfter,
  moveSiblingFirst,
  moveSiblingLast,
} from '@/util/arboristTreeUtil.ts';

interface ChapterArboristContextMenuProps {
  contextMenu: any;
  setContextMenu: (contextMenu: any) => void;
  treeRef: React.RefObject<any>;
  setTreeData: (treeData: any) => void;
  handleCreate: (parentId: string | number) => void;
}

export const ChapterArboristContextMenu = ({
  contextMenu,
  setContextMenu,
  treeRef,
  setTreeData,
  handleCreate,
}: ChapterArboristContextMenuProps) => {
  return (
    <div>
      <ul
        className="fixed z-50 bg-white border rounded shadow"
        style={{
          top: contextMenu.y,
          left: contextMenu.x,
          transform: 'translateY(-100%)',
          minWidth: 120,
        }}
        onClick={() => setContextMenu(null)}
        onContextMenu={e => e.preventDefault()}
      >
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            contextMenu.node?.edit();
            setContextMenu(null);
          }}
        >
          重命名
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            treeRef.current?.delete(contextMenu.node.id);
            setContextMenu(null);
          }}
        >
          删除
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            if (contextMenu.node.isInternal) {
              contextMenu.node.toggle();
            }
            setContextMenu(null);
          }}
        >
          {contextMenu.node?.isOpen ? 'Collapse' : 'Expand'}
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            // 新建子节点 (第一个/仅有)
            const parentId = contextMenu.node.id;
            handleCreate(parentId);
            setContextMenu(null);
          }}
        >
          新建子节点
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            // 新建后续同级节点
            const newNode: any = {
              id: uuidv4(),
              title: 'New Chapter',
            };
            setTreeData(current =>
              insertSiblingAfter(current, contextMenu.node.id, newNode),
            );
            setContextMenu(null);
          }}
        >
          新建同级节点
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            setTreeData(
              current =>
                moveSiblingFirst(current, contextMenu.node.id) as any[],
            );
            setContextMenu(null);
          }}
        >
          移到同级最前
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            setTreeData(
              current => moveSiblingLast(current, contextMenu.node.id) as any[],
            );
            setContextMenu(null);
          }}
        >
          移到同级最后
        </li>
      </ul>
    </div>
  );
};
