// https://github.com/brimdata/react-arborist

import { ChapterTreeNode, ChapterOrderType } from "@/component/Book/ChapterList";
import { buildTree } from "@/util/treeAbstract";
import { useMemo, useState, useEffect } from "react";
import { ChapterArborist } from "@/component/Book/ChapterArborist";

import { useLayoutStore } from "@/global/layoutStore";
import { TextField } from "@mui/material";
import { Chapter, ChapterOrder } from "contract";

interface BookEditorSidebarProps {
    chaptersData: {
        chapters: Chapter[];
        order: ChapterOrder;
    };
    selectedId: string;
    baseLink: string;
    drawerWidth: number;
    isDraggable?: boolean;
    enableDoubleClickRename?: boolean;
}

// you can't use chaptersData = {} to give a default value, because it will cause the Maximum update Warning
export const BookEditorSidebar: React.FC<BookEditorSidebarProps> = ({ chaptersData, selectedId, baseLink, drawerWidth, isDraggable=false, enableDoubleClickRename=false }) => {
    const { sidebarHeightBelow } = useLayoutStore();
    const chapters: ChapterTreeNode[] = chaptersData?.chapters ?? [];
    const orderMap: ChapterOrderType = new Map(Object.entries(chaptersData?.order ?? {}));

    useEffect(() => {
        console.log("chaptersData", chaptersData);
    }, [chaptersData]);
    const chapterTree = useMemo(
        () => buildTree({ nodes: chapters, orders: orderMap }) as unknown as Chapter[],
        [chaptersData],
    );

    const [searchTerm, setSearchTerm] = useState("");

    const [height, setHeight] = useState(sidebarHeightBelow);
    useEffect(() => {
        setHeight(sidebarHeightBelow);
        console.log(selectedId);
    }, [sidebarHeightBelow]);

    return (
        // <div className="overflow-auto no-scrollbar">
        <div>
            <div className="w-11/12 mx-auto">
                <TextField
                    id="standard-basic"
                    label="searchTerm"
                    variant="standard"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {/* <TextField id="standard-basic" label="selectIDTerm" variant="standard" value={selectIDTerm} onChange={(e) => setselectIDTerm(e.target.value)} /> */}
                {/* TODO 添加一個開關以支持拖拽，防止不小心拖拽 */}
            </div>
            <ChapterArborist
                chapterTree={chapterTree}
                tHeight={height}
                searchTerm={searchTerm}
                selectedId={String(selectedId)}
                width={drawerWidth}
                // selectedId={String(selectIDTerm)}
                baseLink={baseLink}
                isDraggable={isDraggable}
                enableDoubleClickRename={enableDoubleClickRename}
            />
        </div>
    );
};
