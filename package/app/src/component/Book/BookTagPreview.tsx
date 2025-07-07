import React from "react";
import { Box, Typography, Chip, Stack } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import { AccentBarWithText } from "@component/Common/AccentBar";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight";
import { get } from "@locale";

interface TagGroupObject {
    key: string;
    name: string;
    tags: string[];
}

interface BookTagProps {
    tagObjects?: TagGroupObject[] | undefined;
}

const state = proxy({
    tagObjects: [] as TagGroupObject[],
});

export const BookTag: React.FC<BookTagProps> = ({ tagObjects: propTagObjects }) => {
    state.tagObjects = propTagObjects || [
        {
            key: "tag1",
            name: "User",
            tags: ["奇幻", "冒险", "平行世界"],
        },
        {
            key: "tag2",
            name: "AI",
            tags: ["标签2-1", "标签2-2", "标签2-3"],
        },
    ];

    const snap = useSnapshot(state);

    return (
        <Box>
            {snap.tagObjects.map((tagObject) => (
                <Box key={tagObject.key} sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight="bold">
                        {tagObject.name}
                    </Typography>
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                            mt: 2,
                            flexWrap: "wrap",
                            gap: 1,
                        }}
                    >
                        {tagObject.tags.map((tag) => (
                            <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                sx={{
                                    bgcolor: "grey.100",
                                    color: "primary.main",
                                    "&:hover": {
                                        bgcolor: "grey.200",
                                    },
                                }}
                            />
                        ))}
                    </Stack>
                </Box>
            ))}
        </Box>
    );
};

export function BookTagEdit({}: {
    tagObjects: TagGroupObject[];
    updateTagObjects: (tagObjects: TagGroupObject[]) => void;
}) {
    return (
        <div>
            <h1>{get("pages->book_tag_edit")}</h1>
        </div>
    );
}

export const BookTagView: React.FC<BookTagProps> = ({ tagObjects }) => {
    return (
        <Box>
            <div className="flex mb-4">
                <AccentBarWithText text="标签" />
                <EditButtonFloatRight />
            </div>
            <BookTag tagObjects={tagObjects} />
        </Box>
    );
};
