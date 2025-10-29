export {BookDescriptionShow as Show} from './BookDescriptionShow';
export {BookDescriptionContainer as Container} from './BookDescriptionContainer';
export {
  BookDescriptionEditContainer as EditContainer,
  BookDescriptionEditorModal as EditorModal,
  BookDescriptionEditorInline as EditorInline,
} from './BookDescriptionEditContainer';

export type {
  BookDescriptionShowProps,
  BookDescriptionContainerProps,
  BookDescriptionEditShowProps,
  BookDescriptionEditContainerProps,
  BookDescriptionEditorModalProps,
  BookDescriptionEditorInlineProps,
} from './types';

// Aggregated object-style export for ergonomics: BookDescription.Show/Container/Editor
import {BookDescriptionShow as _Show} from './BookDescriptionShow';
import {BookDescriptionContainer as _Container} from './BookDescriptionContainer';
import {
  BookDescriptionEditorModal as _EditorModal,
  BookDescriptionEditorInline as _EditorInline,
} from './BookDescriptionEditContainer';

export const BookDescription = {
  Show: _Show,
  Container: _Container,
  Editor: {
    Modal: _EditorModal,
    Inline: _EditorInline,
  },
};
