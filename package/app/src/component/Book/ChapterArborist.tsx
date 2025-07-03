// https://github.com/brimdata/react-arborist

import { ChapterTreeNode, ChapterOrderType } from "@/component/Book/ChapterList";
import { buildTree } from "@/util/treeAbstract";
import { useMemo, useState, useEffect, useCallback, CSSProperties, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Tree } from "react-arborist";
import type { MoveHandler, RenameHandler, DeleteHandler } from "react-arborist";
// MUI
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
// 分离的 Node 渲染器工厂
import { createChapterArboristNode } from "./ChapterArboristNode";

import { findAndRemove, findAndInsert, findAndEdit, findAndDelete, findAndAddChild, insertSiblingAfter, moveSiblingFirst, moveSiblingLast } from "@/util/arboristTreeUtil";

type Chapter = {
    id: string | number;
    title: string;
    children?: Chapter[];
};

/* Helper functions for immutable tree manipulation */



interface ChapterArboristProps {
    chapterTree: any;
    isDraggable: boolean;
    enableDoubleClickRename: boolean;
    tHeight: number;
    searchTerm: string;
    selectedId: string;
    baseLink: string;
}

// you can't use chaptersData = {} to give a default value, because it will cause the Maximum update Warning
export const ChapterArborist: React.FC<ChapterArboristProps> = ({ chapterTree, isDraggable, enableDoubleClickRename, tHeight, searchTerm, selectedId, baseLink }) => {
    const treeRef: any = useRef(null);

    const [treeData, setTreeData] = useState<Chapter[]>([]);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        node: any;
    } | null>(null);

    useEffect(() => {
        setTreeData(chapterTree);
    }, [chapterTree]);

    function submitTreeData(data: any) {
        console.log("submitTreeData", data);
    }

    // commit side-effect simulation
    useEffect(() => {
        console.log("假装提交", treeData);
        submitTreeData(treeData);
    }, [treeData]);

    const onMove: MoveHandler<Chapter> = useCallback(({ dragIds, parentId, index }) => {
        setTreeData((currentTree) => {
            const removed: Chapter[] = [];
            const treeWithoutDragged = findAndRemove(currentTree, dragIds, removed);
            return findAndInsert(treeWithoutDragged, parentId, index, removed);
        });
    }, []);

    const onRename: RenameHandler<Chapter> = useCallback(({ id, name }) => {
        setTreeData((currentTree) => findAndEdit(currentTree, String(id), name));
    }, []);

    const onDelete: DeleteHandler<Chapter> = useCallback(({ ids }) => {
        setTreeData((currentTree) => findAndDelete(currentTree, ids));
    }, []);

    const handleCreate = useCallback((parentId: string | number) => {
        const newNode: Chapter = { id: uuidv4(), title: "New Chapter" };
        setTreeData((currentTree) => {
            if (parentId) {
                return findAndAddChild(currentTree, parentId, newNode);
            } else {
                return [...currentTree, newNode];
            }
        });
    }, []);

    // 创建带有 contextMenu 能力的 Node 渲染器
    const Node = useMemo(
        () => createChapterArboristNode(setContextMenu, treeRef, enableDoubleClickRename, isDraggable, baseLink),
        [setContextMenu, enableDoubleClickRename, isDraggable, baseLink],
    );

    return (
        <div className="p-4" onClick={() => setContextMenu(null)}>
            <Tree<Chapter>
                ref={treeRef}
                data={treeData}
                onMove={onMove}
                onRename={onRename}
                onDelete={onDelete}
                // width="100%"
                height={tHeight}
                // indent={24}
                indent={0}
                rowHeight={32}
                disableDrag={!isDraggable}
                disableDrop={!isDraggable}
                idAccessor="id"
                searchTerm={searchTerm}
                selection={selectedId ?? ''}
                searchMatch={(node, t) => node.data.title.toLowerCase().includes(t.toLowerCase())}
                childrenAccessor="children"
                className="overflow-auto no-scrollbar"
            >
                {Node}
            </Tree>
            {contextMenu && (
                <ul
                    className="fixed z-50 bg-white border rounded shadow"
                    style={{ top: contextMenu.y, left: contextMenu.x, minWidth: 120 }}
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
                        {contextMenu.node?.isOpen ? "折叠" : "展开"}
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
                            const newNode: Chapter = { id: uuidv4(), title: "New Chapter" };
                            setTreeData((current) => insertSiblingAfter(current, contextMenu.node.id, newNode));
                            setContextMenu(null);
                        }}
                    >
                        新建同级节点
                    </li>
                    <li
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                            setTreeData((current) => moveSiblingFirst(current, contextMenu.node.id));
                            setContextMenu(null);
                        }}
                    >
                        移到同级最前
                    </li>
                    <li
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                            setTreeData((current) => moveSiblingLast(current, contextMenu.node.id));
                            setContextMenu(null);
                        }}
                    >
                        移到同级最后
                    </li>
                </ul>
            )}
        </div>
    );
};
