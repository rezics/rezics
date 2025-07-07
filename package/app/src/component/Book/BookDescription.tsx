import { Typography } from "@mui/material";
import { Box } from "@mui/material";
import { AccentBarWithText } from "@component/Common/AccentBar";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight";

export function BookDescription({ description }: { description: string }) {
    return (
        <div>
            <Box>
                <div className="flex mb-4">
                    <AccentBarWithText text="简介" />
                    <EditButtonFloatRight />
                </div>
                <Typography variant="body1" className="whitespace-pre-line">
                    {description}
                </Typography>
            </Box>
        </div>
    );
}

export function BookDescriptionEdit({
    description,
    updateDescription,
}: {
    description: string;
    updateDescription: (description: string) => void;
}) {
    return (
        <div>
            <h1>{get("pages->book_description_edit")}</h1>
        </div>
    );
}
