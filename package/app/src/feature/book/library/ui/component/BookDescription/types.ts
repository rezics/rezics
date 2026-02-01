/**
 * Props for the book description component.
 */
export type BookDescriptionProps = {
  /** Text content of the book description to render. */
  description: string;
  /** Optional click handler for the edit button. */
  onEdit?: () => void;
  /** Optional book id for routing to edit page. */
  bookId?: string;
  /** Whether to show the edit button. */
  showEditButton?: boolean;
};
