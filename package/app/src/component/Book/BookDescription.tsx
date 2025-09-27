import { AccentBarWithTextShow } from "@component/Common/AccentBar.tsx";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight.tsx";
import { Box, Button, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

export type BookDescriptionShowProps = {
  description: string;
  onEdit?: () => void;
  showEditButton?: boolean;
  editOpen?: boolean;
  setEditOpen: (open: boolean) => void;
  bookId: string;
};
export const BookDescriptionShow: React.FC<BookDescriptionShowProps> = ({
  description,
  onEdit,
  showEditButton = true,
  editOpen,
  setEditOpen,
  bookId,
}) => {
  let { t } = useTranslation();
  return (
    <div>
      <Box>
        <div className="flex mb-4">
          <AccentBarWithTextShow text={t("book.description")} />{" "}
          {showEditButton && <EditButtonFloatRight.Show onClick={onEdit} />}
        </div>{" "}
        <Typography variant="body1" className="whitespace-pre-line">
          {description}
        </Typography>
      </Box>{" "}
      <BookDescriptionEditContainer
        description={description}
        editOpen={editOpen ?? false}
        setEditOpen={setEditOpen}
        bookId={bookId}
        mode="modal"
      />
    </div>
  );
};
export type BookDescriptionContainerProps = {
  description: string;
  bookId: string;
};
export const BookDescriptionContainer: React.FC<
  BookDescriptionContainerProps
> = ({ description, bookId }) => {
  const [editOpen, setEditOpen] = useState(false);
  const handleEdit = () => {
    setEditOpen(true);
  };
  return (
    <BookDescriptionShow
      description={description}
      onEdit={handleEdit}
      editOpen={editOpen}
      setEditOpen={setEditOpen}
      bookId={bookId}
    />
  );
};

import EasyEditor from "@component/Form/EasyEditor.tsx";
export type BookDescriptionEditShowProps = {
  description: string;
  onUpdate: (description: string) => void;
  setEditOpen: (open: boolean) => void;
  descriptionState: string;
  setDescriptionState: React.Dispatch<React.SetStateAction<string>>;
};

export const BookDescriptionEditShow: React.FC<
  BookDescriptionEditShowProps
> = ({ onUpdate, setEditOpen, descriptionState, setDescriptionState }) => {
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
          <Button onClick={handleUpdate} className="w-full">
            提交
          </Button>
        </div>
      </div>
    </div>
  );
};

import { safeRpcPost } from "@/api/swr-query/rq.ts";
import { useBookPageStore } from "@/global/page/bookPageStore.ts";
import type { Book } from "contract";
import { useEffect, useState } from "react";
import DialogContainer from "../Common/DialogContainer.tsx";

export type BookDescriptionEditContainerProps = {
  description: string;
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  mode?: "modal" | "inline";
  bookId: string;
};

export const BookDescriptionEditContainer: React.FC<
  BookDescriptionEditContainerProps
> = ({ description, editOpen, setEditOpen, mode = "inline", bookId }) => {
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

    const result = await safeRpcPost(updateBookInput);
    if (result === "error") {
      console.error("update book description error", result);
      return;
    }

    useBookPageStore.getState().updateBook(bookId, {
      description: newDesc,
    });
  };

  const content = (
    <BookDescriptionEditShow
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
