import React, {useEffect, useState} from 'react';
import DialogContainer from '../../Common/Overlay/DialogContainer.tsx';
import {useBookPageStore} from '@/global/page/bookPageStore.ts';
import {useUpdateBookMutation} from '@/api/book/book.mutations';
import type {UpdateBookInput} from '@package/contract';
import {BookDescriptionEditShow} from './BookDescriptionEditShow';
import type {
  BookDescriptionEditContainerProps,
  BookDescriptionEditorInlineProps,
  BookDescriptionEditorModalProps,
} from './types';

/**
 * Container for editing a book description.
 * - Holds local editing state and synchronizes updates via mutation & store.
 * - Supports 'modal' and 'inline' modes based on the `mode` prop.
 */
export const BookDescriptionEditContainer: React.FC<
  BookDescriptionEditContainerProps
> = ({description, editOpen, setEditOpen, mode = 'inline', bookId}) => {
  const [descriptionState, setDescriptionState] = useState(description);

  useEffect(() => {
    setDescriptionState(description);
  }, [description]);

  const updateBook = useUpdateBookMutation();

  const onUpdate = async (newDesc: string) => {
    const updates: UpdateBookInput = {description: newDesc};
    updateBook.mutate({postId: bookId, input: updates});

    // Optimistic local update on the page store
    useBookPageStore.getState().updateBook(bookId, {description: newDesc});
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

  if (mode === 'modal') {
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

/**
 * Modal editor wrapper for convenience.
 */
export const BookDescriptionEditorModal: React.FC<
  BookDescriptionEditorModalProps
> = props => {
  return <BookDescriptionEditContainer {...props} mode="modal" />;
};

/**
 * Inline editor wrapper for convenience.
 * - Renders the editor inline without any modal.
 */
export const BookDescriptionEditorInline: React.FC<
  BookDescriptionEditorInlineProps
> = ({description, bookId}) => {
  // Inline mode does not require explicit open state; always render.
  const noop = () => {};
  return (
    <BookDescriptionEditContainer
      description={description}
      editOpen={true}
      setEditOpen={noop}
      bookId={bookId}
      mode="inline"
    />
  );
};
