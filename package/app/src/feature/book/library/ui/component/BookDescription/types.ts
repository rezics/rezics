import type React from 'react';
/**
 * Props for the show-only book description component.
 */
export type BookDescriptionShowProps = {
  /** Text content of the book description to render. */
  description: string;
  /** Optional click handler for the edit button. */
  onEdit?: () => void;
  /** Whether to show the edit button; defaults to true. */
  showEditButton?: boolean;
};

/**
 * Props for the container that orchestrates show + editor modal.
 */
export type BookDescriptionContainerProps = {
  /** Current description value. */
  description: string;
  /** Book identifier used for updates. */
  bookId: string;
};

/**
 * Props for the edit form UI (pure view without data fetching).
 */
export type BookDescriptionEditShowProps = {
  /** Initial description; may be used for display only. */
  description: string;
  /** Callback when user submits the updated description. */
  onUpdate: (description: string) => void;
  /** Control function to open/close editor (no-op for inline usage). */
  setEditOpen: (open: boolean) => void;
  /** Local state value of description being edited. */
  descriptionState: string;
  /** Setter for the local description state. */
  setDescriptionState: React.Dispatch<React.SetStateAction<string>>;
};

/**
 * Props for the edit container.
 * - Manages local editing state and triggers mutation + store update.
 * - Can render in 'modal' or 'inline' modes.
 */
export type BookDescriptionEditContainerProps = {
  /** Current description value. */
  description: string;
  /** Whether the modal editor is open. Ignored in inline mode. */
  editOpen: boolean;
  /** Setter for modal open state. Ignored in inline mode. */
  setEditOpen: (open: boolean) => void;
  /** Render mode for the editor. */
  mode?: 'modal' | 'inline';
  /** Book identifier used for updates. */
  bookId: string;
};

/**
 * Props for the modal editor wrapper.
 */
export type BookDescriptionEditorModalProps = Omit<
  BookDescriptionEditContainerProps,
  'mode'
>;

/**
 * Props for the inline editor wrapper.
 */
export type BookDescriptionEditorInlineProps = Pick<
  BookDescriptionEditContainerProps,
  'description' | 'bookId'
> & {
  /** Optional callback when editing completes. */
  onDone?: () => void;
};
