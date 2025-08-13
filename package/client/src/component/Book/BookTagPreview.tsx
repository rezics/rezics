import React, { useState } from "react";
import { Box } from "@mui/material";
import { AccentBarWithText } from "@component/Common/AccentBar.tsx";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight.tsx";
import { ArrowForwardIcon } from "../Common/ArrowForwardIcon.tsx";

import { BookTagList } from "@component/Tag/BookTagList.tsx";
import { BookTagEdit } from "../Tag/BookTagEdit.tsx";

export namespace BookTagView {
    export type Show = {
        tagObjects: any[];
        onEdit?: () => void;
        showEditButton?: boolean;
        bookId: string;
        editOpen?: boolean;
        setEditOpen?: (open: boolean) => void;
    };

    export const Show: React.FC<Show> = ({
        tagObjects,
        onEdit,
        showEditButton = true,
        bookId,
        editOpen,
        setEditOpen,
    }) => {
        return (
            <Box>
                <div className="flex mb-4">
                    <ArrowForwardIcon.Container
                        size={16}
                        to={`/tag/book/${bookId}`}
                    >
                        <AccentBarWithText.Show text="标签" />
                    </ArrowForwardIcon.Container>
                    {showEditButton && (
                        <EditButtonFloatRight.Show onClick={onEdit} />
                    )}
                </div>
                <BookTagList.Container tagGroups={tagObjects} />
                <BookTagEdit.Container
                    tagObjects={tagObjects}
                    editOpen={editOpen ?? false}
                    setEditOpen={setEditOpen ?? (() => {})}
                    updateTagObjects={() => {}}
                    mode="modal"
                />
                {/* <BookTag.Show tagObjects={tagObjects} /> */}
            </Box>
        );
    };

    export type Container = {
        tagObjects?: any[] | undefined;
        bookId: string;
    };

    export const Container: React.FC<Container> = ({ tagObjects, bookId }) => {
        const [editOpen, setEditOpen] = useState(false);
        const handleEdit = () => {
            console.log("Edit clicked");
            setEditOpen(true);
        };

        const trueTagObjects = [
            {
                id: "tag1",
                name: "User",
                tags: ["奇幻", "冒险", "平行世界"],
            },
            {
                id: "tag2",
                name: "AI",
                tags: [
                    "标签2-1",
                    "标签2-2",
                    "标签2-3",
                    "标签2-4",
                    "标签2-5",
                    "标签2-6",
                    "标签2-7",
                    "标签2-8",
                    "标签2-9",
                    "标签2-10",
                    "标签2-11",
                    "标签2-12",
                    "标签2-13",
                    "标签2-14",
                    "标签2-15",
                    "标签2-16",
                    "标签2-17",
                    "标签2-18",
                    "标签2-19",
                    "标签2-20",
                    "标签2-21",
                    "标签2-22",
                    "标签2-23",
                    "标签2-24",
                    "标签2-25",
                    "标签2-26",
                    "标签2-27",
                    "标签2-28",
                    "标签2-29",
                    "标签2-30",
                ],
            },
        ];

        return (
            <Show
                tagObjects={tagObjects || trueTagObjects}
                onEdit={handleEdit}
                bookId={bookId}
                editOpen={editOpen}
                setEditOpen={setEditOpen}
            />
        );
    };
}
