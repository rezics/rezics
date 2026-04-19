import type { BookDTO } from "@rezics/contract";

/**
 * Props for the book description component.
 */
export type BookDescriptionProps = {
  /** Text content of the book description to render. */
  description: string;
  /** Optional click handler for the edit button — overrides default navigation. */
  onEdit?: () => void;
  /** The book the description belongs to; used for the edit-permission check and default navigation. */
  book?: BookDTO;
};
