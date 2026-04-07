/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import type React from "react";
import { v4 as uuidv4 } from "uuid";
import {
  insertSiblingAfter,
  moveSiblingFirst,
  moveSiblingLast,
} from "@/shared/util/arborist-tree";
import type { Chapter, ChapterContextMenuState } from "./ChapterArborist";

/** Props for ChapterArboristContextMenu component. */
interface ChapterArboristContextMenuProps {
  /** Current context menu state with position and node. */
  contextMenu: NonNullable<ChapterContextMenuState>;
  /** Setter to close/update context menu. */
  setContextMenu: (contextMenu: ChapterContextMenuState) => void;
  /** Setter for tree data. */
  setTreeData: React.Dispatch<React.SetStateAction<Chapter[]>>;
  /** Handler for creating new chapter. */
  handleCreate: (parentId: string | number) => void;
}

export const ChapterArboristContextMenu = ({
  contextMenu,
  setContextMenu,
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
          transform: "translateY(-100%)",
          minWidth: 120,
        }}
        onClick={() => setContextMenu(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setContextMenu(null);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* <li
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
        </li> */}
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            setContextMenu(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setContextMenu(null);
            }
          }}
        >
          {contextMenu.node?.isOpen ? "Collapse" : "Expand"}
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            // 新建子节点 (第一个/仅有)
            const parentId = contextMenu.node.id;
            handleCreate(parentId);
            setContextMenu(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              const parentId = contextMenu.node.id;
              handleCreate(parentId);
              setContextMenu(null);
            }
          }}
        >
          新建子节点
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            // 新建后续同级节点
            const newNode: Chapter = {
              id: uuidv4(),
              title: "New Chapter",
            };
            setTreeData(
              (current) =>
                insertSiblingAfter(
                  current,
                  contextMenu.node.id,
                  newNode,
                ) as Chapter[],
            );
            setContextMenu(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              const newNode: Chapter = {
                id: uuidv4(),
                title: "New Chapter",
              };
              setTreeData(
                (current) =>
                  insertSiblingAfter(
                    current,
                    contextMenu.node.id,
                    newNode,
                  ) as Chapter[],
              );
              setContextMenu(null);
            }
          }}
        >
          新建无内容节点
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            setTreeData(
              (current) =>
                moveSiblingFirst(current, contextMenu.node.id) as Chapter[],
            );
            setContextMenu(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTreeData(
                (current) =>
                  moveSiblingFirst(current, contextMenu.node.id) as Chapter[],
              );
              setContextMenu(null);
            }
          }}
        >
          移到同级最前
        </li>
        <li
          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            setTreeData(
              (current) =>
                moveSiblingLast(current, contextMenu.node.id) as Chapter[],
            );
            setContextMenu(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTreeData(
                (current) =>
                  moveSiblingLast(current, contextMenu.node.id) as Chapter[],
              );
              setContextMenu(null);
            }
          }}
        >
          移到同级最后
        </li>
      </ul>
    </div>
  );
};
