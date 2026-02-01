import React, {useState} from 'react';
import {BookDescriptionShow} from './BookDescriptionShow';
import {BookDescriptionEditorModal} from './BookDescriptionEditContainer';
import type {BookDescriptionContainerProps} from './types';

/**
 * Orchestrates the book description display and the modal editor.
 * - Keeps `editOpen` state and passes handlers to child components.
 * - Use this when you want a show + modal edit experience.
 */
export const BookDescriptionContainer: React.FC<
  BookDescriptionContainerProps
> = ({description, bookId}) => {
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = () => setEditOpen(true);

  return (
    <>
      <BookDescriptionShow description={description} onEdit={handleEdit} />
      <BookDescriptionEditorModal
        description={description}
        editOpen={editOpen}
        setEditOpen={setEditOpen}
        bookId={bookId}
      />
    </>
  );
};
