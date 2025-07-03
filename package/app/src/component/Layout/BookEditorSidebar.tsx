// https://github.com/brimdata/react-arborist

import { ChapterTreeNode, ChapterOrderType } from "@/component/Book/ChapterList";
import { buildTree } from "@/util/treeAbstract";
import { useMemo, useState, useEffect, useCallback, CSSProperties, useRef } from "react";
import { ChapterArborist } from "@/component/Book/ChapterArborist";

import { useLayoutStore } from "@/global/layoutStore";
import useMeasure from "react-use-measure";

type Chapter = {
    id: string | number;
    title: string;
    children?: Chapter[];
};

interface BookEditorSidebarProps {
    chaptersData: any;
}

// you can't use chaptersData = {} to give a default value, because it will cause the Maximum update Warning
export const BookEditorSidebar: React.FC<BookEditorSidebarProps> = ({ chaptersData }) => {
    const { sidebarHeightBelow } = useLayoutStore();
    const chapters: ChapterTreeNode[] = chaptersData?.chapters ?? [];
    const orderMap: ChapterOrderType = new Map(Object.entries(chaptersData?.chapterOrders ?? {}));
    const chapterTree = useMemo(
        () => buildTree({ nodes: chapters, orders: orderMap }) as unknown as Chapter[],
        [chaptersData],
    );

    const [isDraggable, setIsDraggable] = useState(false);
    const [enableDoubleClickRename, setEnableDoubleClickRename] = useState(false);

    const [height, setHeight] = useState(sidebarHeightBelow);
    useEffect(() => {
        setHeight(sidebarHeightBelow);
    }, [sidebarHeightBelow]);

    return (
        <div className="overflow-auto no-scrollbar">
            {/* <div className="flex items-center mb-4 gap-6">
                <label htmlFor="drag-switch" className="mr-2">
                    Enable Drag to Reorder
                </label>
                <input
                    id="drag-switch"
                    type="checkbox"
                    checked={isDraggable}
                    onChange={(e) => setIsDraggable(e.target.checked)}
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={enableDoubleClickRename}
                            onChange={(e) => setEnableDoubleClickRename(e.target.checked)}
                        />
                    }
                    label="双击重命名"
                />
            </div> */}
            <ChapterArborist chapterTree={chapterTree} isDraggable={false} enableDoubleClickRename={false} tHeight={height} />
        </div>
    );
};
