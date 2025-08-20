import { useApiPost } from "@/api/swr.ts";
import { useBookPageStore } from "@/global/page/bookPageStore.ts";
import { AccentBarWithText } from "@component/Common/AccentBar.tsx";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight.tsx";
import EasyEditor from "@component/Form/EasyEditor.tsx";
import { Button, Typography } from "@mui/material";
import { Box } from "@mui/material";
import { Book } from "contract";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogContainer from "../Common/DialogContainer.tsx";

export namespace BookDescription {
    export type Show = {
        description: string;
        onEdit?: () => void;
        showEditButton?: boolean;
        editOpen?: boolean;
        setEditOpen?: (open: boolean) => void;
        bookId: string;
    };

    export const Show: React.FC<Show> = (
        {
            description,
            onEdit,
            showEditButton = true,
            editOpen,
            setEditOpen,
            bookId,
        },
    ) => {
        let { t } = useTranslation();
        return (
            <div>
                <Box>
                    <div className="flex mb-4">
                        <AccentBarWithText.Show text={t("book.description")} />
                        {showEditButton && <EditButtonFloatRight.Show onClick={onEdit} />}
                    </div>
                    <Typography
                        variant="body1"
                        className="whitespace-pre-line"
                    >
                        {description}
                    </Typography>
                </Box>
                <BookDescriptionEdit.Container
                    description={description}
                    editOpen={editOpen ?? false}
                    setEditOpen={setEditOpen}
                    bookId={bookId}
                    mode="modal"
                />
            </div>
        );
    };

    export type Container = {
        description: string;
        bookId: string;
    };

    export const Container: React.FC<Container> = ({ description, bookId }) => {
        const [editOpen, setEditOpen] = useState(false);
        const handleEdit = () => {
            setEditOpen(true);
        };

        return (
            <Show
                description={description}
                onEdit={handleEdit}
                editOpen={editOpen}
                setEditOpen={setEditOpen}
                bookId={bookId}
            />
        );
    };
}

export namespace BookDescriptionEdit {
    export type ShowProps = {
        description: string;
        onUpdate: (description: string) => void;
        setEditOpen: (open: boolean) => void;
        descriptionState: string;
        setDescriptionState: React.Dispatch<React.SetStateAction<string>>;
    };

    export const Show: React.FC<ShowProps> = (
        { onUpdate, setEditOpen, descriptionState, setDescriptionState },
    ) => {
        const handleUpdate = () => {
            onUpdate(descriptionState);
            setEditOpen(false);
        };

        return (
            <div>
                <EasyEditor
                    value={descriptionState}
                    onChange={setDescriptionState}
                />
                <div className="w-full">
                    <div className="w-1/2 float-right">
                        <Button
                            onClick={handleUpdate}
                            className="w-full"
                        >
                            提交
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    export type ContainerProps = {
        description: string;
        editOpen: boolean;
        // setEditOpen: (open: boolean) => void;
        setEditOpen: any;
        mode?: "modal" | "inline"; // 'modal' wraps with Dialog, 'inline' renders directly
        bookId: string;
    };

    export const Container: React.FC<ContainerProps> = (
        { description, editOpen, setEditOpen, mode = "inline", bookId },
    ) => {
        const [descriptionState, setDescriptionState] = useState(description);

        useEffect(() => {
            setDescriptionState(description);
        }, [description]);

        const onUpdate = async (newDesc: string) => {
            const updateBookInput = {
                operation: "book.update",
                parameter: { id: bookId, description: newDesc },
                select: {
                    id: true,
                    description: true,
                },
            } satisfies Book.Input.Update;
            // const result: Book.Output.Read<{ id: true; description: true }> =
            // 	await apiPost(updateBookInput);

            const result = await useApiPost(updateBookInput);

            if (result === "error") {
                console.error("update book description error", result);
                return;
            }
            // const data: Book.Output.Read<typeof updateBookInput.select> = result;
            const data = descriptionState;
            useBookPageStore.getState().updateBook(bookId, {
                description: data ?? description,
            });
            // setTimeout(() => {
            // 	console.log("update Store", useBookPageStore.getState().books[bookId])
            // }, 1000);
        };

        const content = (
            <Show
                description={description}
                onUpdate={onUpdate}
                setEditOpen={setEditOpen}
                descriptionState={descriptionState}
                setDescriptionState={setDescriptionState}
            />
        );

        if (mode === "modal") {
            return (
                <DialogContainer
                    open={editOpen}
                    onClose={() => setEditOpen(false)}
                    title="编辑书籍描述"
                >
                    {content}
                </DialogContainer>
            );
        }

        return content;
    };
}
