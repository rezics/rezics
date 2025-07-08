import React from "react";
import { Box, Typography, Chip, Stack } from "@mui/material";
import { useMemo } from "react";
import { AccentBarWithText } from "@component/Common/AccentBar";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight";
import { t } from "@component/Text";

interface TagGroupObject {
    key: string;
    name: string;
    tags: string[];
}

export namespace BookTag {
    export type Show = {
        tagObjects: TagGroupObject[];
    };

    export const Show: React.FC<Show> = ({ tagObjects }) => {
        return (
            <Box>
                {tagObjects.map((tagObject) => (
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

    export type Container = {
        tagObjects?: TagGroupObject[] | undefined;
    };

    export const Container: React.FC<Container> = ({ tagObjects: propTagObjects }) => {
        const tagObjects = useMemo(
            () =>
                propTagObjects || [
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
                ],
            [propTagObjects],
        );

        return <Show tagObjects={tagObjects} />;
    };
}

export namespace BookTagEdit {
    export type Show = {
        tagObjects: TagGroupObject[];
        onUpdate: (tagObjects: TagGroupObject[]) => void;
    };

    export const Show: React.FC<Show> = ({ tagObjects, onUpdate }) => {
        return (
            <div>
                <h1>{t("pages->book_tag_edit")}</h1>
                {/* Add editing UI here */}
            </div>
        );
    };

    export type Container = {
        tagObjects: TagGroupObject[];
        updateTagObjects: (tagObjects: TagGroupObject[]) => void;
    };

    export const Container: React.FC<Container> = ({ tagObjects, updateTagObjects }) => {
        return <Show tagObjects={tagObjects} onUpdate={updateTagObjects} />;
    };
}

export namespace BookTagView {
    export type Show = {
        tagObjects: TagGroupObject[];
        onEdit?: () => void;
        showEditButton?: boolean;
    };

    export const Show: React.FC<Show> = ({ tagObjects, onEdit, showEditButton = true }) => {
        return (
            <Box>
                <div className="flex mb-4">
                    <AccentBarWithText.Show text="标签" />
                    {showEditButton && <EditButtonFloatRight.Show onClick={onEdit} />}
                </div>
                <BookTag.Show tagObjects={tagObjects} />
            </Box>
        );
    };

    export type Container = {
        tagObjects?: TagGroupObject[] | undefined;
    };

    export const Container: React.FC<Container> = ({ tagObjects }) => {
        const handleEdit = () => {
            console.log("Edit clicked");
        };

        return <Show tagObjects={tagObjects || []} onEdit={handleEdit} />;
    };
}
