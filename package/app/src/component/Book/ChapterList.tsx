import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Tooltip } from "@mui/material";
import { AccentBarWithText } from "../Common/AccentBar";

import { buildTree, OrderMap, TreeNodeWithChildren } from "@/util/treeAbstract";
import { useLocation, Link } from "wouter";
import { EditButtonFloatRight } from "@/component/Common/EditButtonFloatRight";
import { tsr } from "@/api/tsr";
// 扁平结构 + 顺序数组

// type ChapterMapType = Map<number, ChapterTreeNode>;

export type ChapterOrderType = OrderMap;

export interface ChapterTreeNode extends TreeNodeWithChildren {
    id: string;
    title: string;
    noContent?: boolean;
    children?: ChapterTreeNode[];
}

// component props
interface ChapterListProps {
    id: string;
}

export const ChapterList: React.FC<ChapterListProps> = ({ id }) => {
    const [,] = useLocation();

    const ChapterListQueryKey = ["chapters", id];

    const { data, isLoading, error } = tsr.books.chapters.list.useQuery({
        queryKey: ChapterListQueryKey,
        queryData: {
            params: {
                bookId: id,
            },
        },
    });

    const chapters: ChapterTreeNode[] = Object.values(data?.body?.chapters ?? []);
    const orderMap: ChapterOrderType = new Map(Object.entries(data?.body?.order ?? []));

    // console.log(orderMap, typeof orderMap);
    // const chapterTree: any = buildTree({nodes: chapters, orders: orderMap}, new Map([["isExpend", true]]));
    // use individual state to store the expanded nodes
    const chapterTree: any = useMemo(() => buildTree({ nodes: chapters, orders: orderMap }), [chapters, orderMap]);

    useEffect(() => {
        console.log("chapterTree", chapterTree, chapters, orderMap);
    }, [chapterTree]);

    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const toggleNode = (id: string) => {
        setExpandedNodes((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const expandAll = () => {
        const allParentIds = new Set(
            Array.from(orderMap.keys())
                .filter((key) => key !== "null") // 过滤掉字符串 "null"
                .map((key) => String(key)),
        );
        setExpandedNodes(allParentIds);
    };

    const collapseAll = () => {
        setExpandedNodes(new Set());
    };

    const hasExpandedInit = useRef(false);
    useLayoutEffect(() => {
        if (!hasExpandedInit.current && orderMap.size > 0) {
            console.log("expandAllInit");
            expandAll();
            hasExpandedInit.current = true;
        }
    }, [orderMap]);

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Oh no... {String(error)}</div>;

    console.log(data);

    // const chapterTree: any = buildTree({nodes: chapters, orders: orderMap});

    // console.log(chapterTree[0].children);

    // 渲染组件（递归）
    const ChapterTreeView = ({ nodes }: { nodes: ChapterTreeNode[] }) => (
        <div className="space-y-4">
            {nodes.map((node) => (
                <div key={node.id}>
                    <div className="flex justify-between items-center">
                        <div
                            className="text-xl font-semibold text-gray-800 mb-2 cursor-pointer"
                            onClick={() => toggleNode(node.id)}
                        >
                            {node.title}
                        </div>
                        <Button variant="text" onClick={() => toggleNode(node.id)}>
                            {expandedNodes.has(node.id) ? "Collapse" : "Expand"}
                        </Button>
                    </div>

                    {expandedNodes.has(node.id) && node.children!.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                            {node.children!.map((child: any) => {
                                const name = child.title;
                                const TruncatedLength = 15;
                                const isTruncated = name.length > TruncatedLength;
                                const displayName = isTruncated ? `${name.slice(0, TruncatedLength)}…` : name;

                                const content = (
                                    // use target="_blank" to open link in new tab
                                    <Link
                                        to={`/book/${id}/read/${child.id}`}
                                        className="text-gray-700 hover:text-blue-500 block cursor-default hover:cursor-pointer"
                                    >
                                        <p className="truncate p-2 rounded-md hover:bg-gray-100 transition-colors duration-200">
                                            {displayName}
                                        </p>
                                    </Link>
                                );

                                return isTruncated ? (
                                    <Tooltip title={name} key={child.id} placement="top" arrow>
                                        {content}
                                    </Tooltip>
                                ) : (
                                    <div key={child.id}>{content}</div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    // Rander Component
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <AccentBarWithText.Container text="目录" />
                <div className="flex justify-end space-x-2 mb-4">
                    <Button variant="contained" onClick={expandAll} className="!mr-2">
                        Expand All
                    </Button>
                    <Button variant="outlined" onClick={collapseAll} className="!mr-2">
                        Collapse All
                    </Button>
                    {/* This need to be a condition render, if someone maintain the book, only show the edit button to the maintainer */}
                    <EditButtonFloatRight.Container />
                </div>
            </div>
            <ChapterTreeView nodes={chapterTree} />
        </div>
    );
};
