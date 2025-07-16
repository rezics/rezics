import { Typography } from "@mui/material";
import { Box } from "@mui/material";
import { AccentBarWithText } from "@component/Common/AccentBar";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight";
import { useTranslation } from "react-i18next";
export namespace BookDescription {
    export type Show = {
        description: string;
        onEdit?: () => void;
        showEditButton?: boolean;
    };

    export const Show: React.FC<Show> = ({ description, onEdit, showEditButton = true }) => {
        let { t } = useTranslation();
        return (
            <div>
                <Box>
                    <div className="flex mb-4">
                        <AccentBarWithText.Show text={t("book.description")} />
                        {showEditButton && <EditButtonFloatRight.Show onClick={onEdit} />}
                    </div>
                    <Typography variant="body1" className="whitespace-pre-line">
                        {description}
                    </Typography>
                </Box>
            </div>
        );
    };

    export type Container = {
        description: string;
    };

    export const Container: React.FC<Container> = ({ description }) => {
        const handleEdit = () => {
            console.log("Edit clicked");
        };

        return <Show description={description} onEdit={handleEdit} />;
    };
}

export namespace BookDescriptionEdit {
    export type Show = {
        description: string;
        onUpdate: (description: string) => void;
    };

    export const Show: React.FC<Show> = ({ description, onUpdate }) => {
        return (
            <div>
                <h1>简介</h1>
                {/* Add editing UI here */}
            </div>
        );
    };

    export type Container = {
        description: string;
        updateDescription: (description: string) => void;
    };

    export const Container: React.FC<Container> = ({ description, updateDescription }) => {
        return <Show description={description} onUpdate={updateDescription} />;
    };
}
