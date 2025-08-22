import { apiPost } from "@/api/swr.ts";
import { EditButtonFloatRight } from "@/component/Common/EditButtonFloatRight.tsx";
import { useChapterListStore } from "@/global/page/chapterListStore.ts";
import { buildTree } from "@/util/treeAbstract.ts";
import type { TreeNodeWithChildren } from "@/util/treeAbstract.ts";
import { Button, Tooltip } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import useSWR from "swr";
import { Link } from "wouter";
import { AccentBarWithTextContainer } from "../Common/AccentBar.tsx";

// 扁平结构 + 顺序数组

// type ChapterMapType = Map<number, ChapterTreeNode>;

export type ChapterOrderType = any;

export interface ChapterTreeNode extends TreeNodeWithChildren {
    id: string;
    title: string;
    children?: ChapterTreeNode[];
}

// component props
interface ChapterListProps {
    id: string;
    data: any;
}

export const ChapterList: React.FC<ChapterListProps> = ({ id, data }) => {
    const chapterList = useChapterListStore((s) => s.chapterList[id]);

    const saveExpanded = useCallback((set: Set<string>) => {
        const arr = [...set];
        useChapterListStore.getState().updateChapterList(id, { expandedNodes: JSON.stringify(arr) });
    }, [id]);

    const chapters: ChapterTreeNode[] = Object.values(
        data?.chapters ?? [],
    );
    type ChapterOrderType = Map<string, string[]>;

    const orderMap: ChapterOrderType = useMemo(() => {
        const raw = (data?.order ?? {}) as Record<string, string[]>;
        return new Map(Object.entries(raw));
    }, [data?.order]);

    const chapterTree: any = useMemo(
        () => buildTree({ nodes: chapters, orders: orderMap }),
        [chapters, orderMap],
    );

    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
        chapterList?.expandedNodes ? new Set(JSON.parse(chapterList.expandedNodes)) : new Set(),
    );

    const toggleNode = (id: string) => {
        setExpandedNodes((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            saveExpanded(newSet);
            return newSet;
        });
    };

    const expandAll = useCallback(() => {
        console.log("expandAll", orderMap);
        const allParentIds = new Set(
            Array.from(orderMap.keys())
                .filter((key) => key !== "null")
                .map((key) => String(key)),
        );
        setExpandedNodes(allParentIds);
        saveExpanded(allParentIds);
    }, [orderMap, setExpandedNodes, saveExpanded]);

    const collapseAll = useCallback(() => {
        setExpandedNodes(new Set());
        saveExpanded(new Set());
    }, [saveExpanded]);

    useEffect(() => {
        console.log("ChapterList mounted");
        if (!chapterList) {
            console.log("chapterList is empty, expandAll");
            expandAll();
        }
        return () => {
            console.log("ChapterList unmounted");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ChapterTreeView = ({ nodes }: { nodes: ChapterTreeNode[] }) => (
        <div className="space-y-4">
            {nodes.map((node) => (
                <div key={node.id}>
                    <div className="flex justify-between items-center">
                        <button
                            className="text-xl font-semibold text-gray-800 mb-2 cursor-pointer"
                            onClick={() => toggleNode(node.id)}
                        >
                            {node.title}
                        </button>
                        <Button
                            variant="text"
                            onClick={() => toggleNode(node.id)}
                        >
                            {expandedNodes.has(node.id) ? "Collapse" : "Expand"}
                        </Button>
                    </div>

                    {expandedNodes.has(node.id)
                        && node.children!.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                            {node.children!.map((child: any) => {
                                const name = child.title;
                                const TruncatedLength = 15;
                                const isTruncated = name.length > TruncatedLength;
                                const displayName = isTruncated
                                    ? `${name.slice(0, TruncatedLength)}…`
                                    : name;

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

                                return isTruncated
                                    ? (
                                        <Tooltip
                                            title={name}
                                            key={child.id}
                                            placement="top"
                                            arrow
                                        >
                                            {content}
                                        </Tooltip>
                                    )
                                    : <div key={child.id}>{content}</div>;
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
                <AccentBarWithTextContainer text="目录" />
                <div className="flex justify-end space-x-2 mb-4">
                    <Button
                        variant="contained"
                        onClick={expandAll}
                        className="!mr-2"
                    >
                        Expand All
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={collapseAll}
                        className="!mr-2"
                    >
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

interface ChapterListContainerProps {
    id: string;
}

/**
 * ChapterListContainer
 * Show Chapter List in flat way
 * TODO support user setting initial function
 * @param param0
 * @returns
 */
export const ChapterListContainer: React.FC<ChapterListContainerProps> = ({ id }) => {
    const createChapterListInput = {
        operation: "chapter.list",
        parameter: { bookId: id },
        select: {
            id: true,
            title: true,
        },
    };

    const { data, isLoading, error } = useSWR<any, any>(createChapterListInput, apiPost);

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Oh no... {String(error)}</div>;

    return <ChapterList id={id} data={data} />;
};
