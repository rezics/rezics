import type { JsonEditorProps } from "@rezics/editor/editor";
import { JsonEditor } from "@rezics/editor/editor";
import { formatJson } from "@rezics/editor/json";
import { useCallback, useRef } from "react";
import { Button } from "@/shadcn/button";
import { EditorPanel } from "./panel/EditorPanel";
import "./editor.css";

export interface RezicsJsonEditorProps
  extends Omit<JsonEditorProps, "viewRef"> {
  onSubmit?: () => void;
  onCancel?: () => void;
}

export function RezicsJsonEditor({
  onSubmit,
  onCancel,
  ...editorProps
}: RezicsJsonEditorProps) {
  const viewRef = useRef<any>(null);

  const handleViewRef = useCallback((view: any) => {
    viewRef.current = view;
  }, []);

  const handleFormat = useCallback(() => {
    if (viewRef.current) {
      formatJson(viewRef.current);
    }
  }, []);

  return (
    <div className="rezics-editor-wrapper">
      <JsonEditor {...editorProps} viewRef={handleViewRef} />
      <EditorPanel
        right={
          <>
            <Button variant="ghost" size="sm" onClick={handleFormat}>
              Format JSON
            </Button>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onSubmit && (
              <Button size="sm" onClick={onSubmit}>
                Submit
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
