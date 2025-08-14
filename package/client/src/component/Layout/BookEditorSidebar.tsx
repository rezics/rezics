// https://github.com/brimdata/react-arborist

import {
    ChapterOrderType,
    ChapterTreeNode,
} from "@/component/Book/ChapterList.tsx";
import { buildTree } from "@/util/treeAbstract.ts";
import { useEffect, useMemo, useState } from "react";
import { ChapterArborist } from "@/component/Book/ChapterArborist.tsx";

import { useLayoutStore } from "@/global/layoutStore.ts";
import { Button, Divider, Switch, TextField } from "@mui/material";


interface Chapter {
    id: string;
    title: string;
}

interface ChapterOrder {
    [key: string]: string;
}
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
export const BookEditorSidebar: React.FC<BookEditorSidebarProps> = ({
    chaptersData,
    selectedId,
    baseLink,
    drawerWidth,
    isDraggable = false,
    enableDoubleClickRename = false,
}) => {
    const { sidebarHeightBelow } = useLayoutStore();
    const chapters: ChapterTreeNode[] = chaptersData?.chapters ?? [];
    const orderMap: ChapterOrderType = new Map(
        Object.entries(chaptersData?.order ?? {}),
    );

    useEffect(() => {
        console.log("chaptersData", chaptersData);
    }, [chaptersData]);
    const chapterTree = useMemo(
        () =>
            buildTree({
                nodes: chapters,
                orders: orderMap,
            }) as unknown as Chapter[],
        [chaptersData],
    );

    const [searchTerm, setSearchTerm] = useState("");

    const [height, setHeight] = useState(sidebarHeightBelow);
    useEffect(() => {
        setHeight(sidebarHeightBelow);
        console.log(selectedId);
    }, [sidebarHeightBelow]);

    const [enableDrag, setEnableDrag] = useState(false);

    const dragInsurance = useMemo(() => {
        return enableDrag && isDraggable;
    }, [enableDrag, isDraggable]);

    function updataChapter() {
        console.log("Updata Chapter");
    }

    return (
        // <div className="overflow-auto no-scrollbar">
        <div>
            <div className="mx-auto">
                <div className="space-y-4 mb-6 w-full pl-6 pr-6">
                    <TextField
                        id="standard-basic"
                        label="Search Term"
                        variant="standard"
                        value={searchTerm}
                        onChange={(e: any) => setSearchTerm(e.target.value)}
                        placeholder="Enter search term"
                        className="w-full"
                    />

                    {/* Optional Select ID Field */}
                    {
                        /* <TextField
                        id="select-id-term"
                        label="Select ID"
                        variant="standard"
                        value={selectIDTerm}
                        onChange={(e) => setSelectIDTerm(e.target.value)}
                        placeholder="Select an ID"
                    /> */
                    }

                    <div className="flex items-center space-x-4 mt-3 w-full justify-between">
                        <label className="text-gray-700 font-bold">
                            Enable Drag
                        </label>
                        <Switch
                            checked={enableDrag}
                            onChange={(e: any) => setEnableDrag(e.target.checked)}
                        />
                    </div>
                    <div className="w-full">
                        <Button
                            variant="contained"
                            color="primary"
                            className="w-full"
                            onClick={updataChapter}
                        >
                            Updata Chapter
                        </Button>
                    </div>
                </div>
            </div>
            <Divider />
            <ChapterArborist
                chapterTree={chapterTree}
                tHeight={height}
                searchTerm={searchTerm}
                selectedId={String(selectedId)}
                width={drawerWidth}
                // selectedId={String(selectIDTerm)}
                baseLink={baseLink}
                isDraggable={dragInsurance}
                enableDoubleClickRename={enableDoubleClickRename}
            />
        </div>
    );
};
