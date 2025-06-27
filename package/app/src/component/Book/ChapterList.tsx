import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "urql";
import { ChapterListQuery } from "@/graphql/bookinfo";
import { Button, Tooltip, Typography } from "@mui/material";
import { AccentBar } from "../Common/AccentBar";

// 扁平结构 + 顺序数组

interface Chapter {
    id: number;
    ParentId: number;
    ChapterName: string;
    NoContent: boolean;
}

interface ChapterOrder {
    parentId: number;
    childIds: number[];
}

interface ChapterMap {
    [id: number]: Chapter;
}

interface ChapterListProps {
    id: string;
}

interface ChapterTreeNode {
    id: number;
    title: string;
    children: ChapterTreeNode[];
}

export const ChapterList: React.FC<ChapterListProps> = ({ id }) => {
    const [{ data, fetching, error }] = useQuery({
        query: ChapterListQuery,
        variables: { id },
    });

    const chapters: Chapter[] = data?.chapters ?? [];
    const orderList: ChapterOrder[] = data?.chapterOrders ?? [];

    // console.log(chapters, orderList);

    const { chapterMap, orderMap } = useMemo(() => {
        const newChapterMap: ChapterMap = {};

        // 直接映射章节（扁平）
        chapters.forEach((ch: Chapter) => {
            newChapterMap[ch.id] = ch;
        });

        return { chapterMap: newChapterMap, orderMap: orderList };
    }, [chapters, orderList]);
    // console.log("映射结果:", { chapterMap, orderMap });

    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
    
    const toggleNode = (id: number) => {
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
            Object.keys(orderMap)
                .filter((key) => key !== "null") // 注意是 "null"（字符串）
                .map(Number),
        );
        setExpandedNodes(allParentIds);
    };

    const collapseAll = () => {
        setExpandedNodes(new Set());
    };

    const hasExpandedInit = useRef(false);
    useLayoutEffect(() => {
        if (!hasExpandedInit.current && Object.keys(orderMap).length > 0) {
            expandAll();
            hasExpandedInit.current = true;
        }
    }, [orderMap]);

    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;

    const buildChapterTree = (
        orderMap: any,
        chapterMap: Record<number, Chapter>,
        rootId: number | string = "null",
    ): Chapter[] => {
        const childIds = rootId ? (orderMap[rootId] ? orderMap[rootId] : []) : [];

        return childIds
            .map((id: number) => {
                const chapter = chapterMap[id];
                if (!chapter) return null;

                return {
                    ...chapter,
                    children: buildChapterTree(orderMap, chapterMap, id),
                };
            })
            .filter((chapter: any) => chapter !== null);
    };

    const chapterTree: any = buildChapterTree(orderMap, chapterMap);

    // console.log(chapterTree);

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

                    {expandedNodes.has(node.id) && node.children.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                            {node.children.map((child: any) => {
                                const name = child.title;
                                const TruncatedLength = 15;
                                const isTruncated = name.length > TruncatedLength;
                                const displayName = isTruncated ? `${name.slice(0, TruncatedLength)}…` : name;

                                const content = (
                                    // use target="_blank" to open link in new tab
                                    <a href="#" className="text-gray-700 hover:text-blue-500 block">
                                        <p className="truncate p-2 rounded-md hover:bg-gray-100 transition-colors duration-200">
                                            {displayName}
                                        </p>
                                    </a>
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
            <div className="flex justify-between items-center">
                <Typography variant="h5" className="font-bold !mb-4">
                    <AccentBar />
                    目录
                </Typography>
                <div className="flex justify-end space-x-2 mb-4">
                    <Button variant="contained" onClick={expandAll} className="!mr-2">
                        Expand All
                    </Button>
                    <Button variant="outlined" onClick={collapseAll}>
                        Collapse All
                    </Button>
                </div>
            </div>
            <ChapterTreeView nodes={chapterTree} />
        </div>
    );
};
