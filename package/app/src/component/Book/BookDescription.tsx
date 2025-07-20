import { Button, Typography } from "@mui/material";
import { Box } from "@mui/material";
import { AccentBarWithText } from "@component/Common/AccentBar";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import DialogContainer from "../Common/DialogContainer";
import EasyEditor from "@component/Form/EasyEditor";

export namespace BookDescription {
    export type Show = {
        description: string;
        onEdit?: () => void;
        showEditButton?: boolean;
        editOpen?: boolean;
        setEditOpen?: (open: boolean) => void;
    };

    export const Show: React.FC<Show> = ({ description, onEdit, showEditButton = true, editOpen, setEditOpen }) => {
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
                <BookDescriptionEdit.Container
                    description={description}
                    editOpen={editOpen ?? false}
                    setEditOpen={setEditOpen}
                />
            </div>
        );
    };

    export type Container = {
        description: string;
    };

    export const Container: React.FC<Container> = ({ description }) => {
        const [editOpen, setEditOpen] = useState(false);
        const handleEdit = () => {
            setEditOpen(true);
        };

        return <Show description={description} onEdit={handleEdit} editOpen={editOpen} setEditOpen={setEditOpen} />;
    };
}

export namespace BookDescriptionEdit {
    export type Show = {
        description: string;
        onUpdate: (description: string) => void;
        editOpen: boolean;
        setEditOpen: any;
    };

    export const Show: React.FC<Show> = ({ description, onUpdate, editOpen, setEditOpen }) => {
        const handleUpdate = () => {
            onUpdate(description);
            setEditOpen(false);
        };
        const [descriptionState, setDescriptionState] = useState(description);
        useEffect(() => {
            setDescriptionState(description);
        }, [description]);
        return (
            <div>
                <DialogContainer
                    open={editOpen}
                    onClose={() => {
                        setEditOpen(false);
                    }}
                    title="编辑书籍描述"
                >
                    <EasyEditor value={descriptionState} onChange={setDescriptionState} />
                    <div className="w-full">
                        <div className="w-1/2 float-right">
                            <Button onClick={handleUpdate} className="w-full">提交</Button>
                        </div>
                    </div>
                </DialogContainer>
            </div>
        );
    };

    export type Container = {
        description: string;
        editOpen: boolean;
        setEditOpen: any;
    };

    export const Container: React.FC<Container> = ({ description, editOpen, setEditOpen }) => {
        function onUpdate(description: string) {
            console.log("update", description);
        }
        return <Show description={description} onUpdate={onUpdate} editOpen={editOpen} setEditOpen={setEditOpen} />;
    };
}
