import type { EditorView } from "@codemirror/view";
import { createContext, useContext } from "react";

export const EditorContext = createContext<EditorView | null>(null);

export function useEditorContext(): EditorView | null {
  return useContext(EditorContext);
}
