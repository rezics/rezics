import { createContext, useContext } from 'react';
import type { EditorView } from '@codemirror/view';

export const EditorContext = createContext<EditorView | null>(null);

export function useEditorContext(): EditorView | null {
  return useContext(EditorContext);
}
