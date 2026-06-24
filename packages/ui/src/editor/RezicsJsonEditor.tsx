import { type Diagnostic, linter } from "@codemirror/lint";
import type { EditorPlugin } from "@rezics/editor";
import type { JsonEditorProps } from "@rezics/editor/editor";
import { JsonEditor } from "@rezics/editor/editor";
import { formatJson } from "@rezics/editor/json";
import { useCallback, useMemo, useRef } from "react";
import { Button } from "#/shadcn/button";
import { EditorPanel } from "./panel/EditorPanel";
import "./editor.css";

export type RezicsJsonDiagnostic = {
  message: string;
  from?: number;
  to?: number;
};

export interface RezicsJsonEditorProps
  extends Omit<JsonEditorProps, "viewRef"> {
  onSubmit?: () => void;
  onCancel?: () => void;
  diagnostics?: (value: string) => RezicsJsonDiagnostic[];
}

export function RezicsJsonEditor({
  onSubmit,
  onCancel,
  diagnostics,
  plugins,
  ...editorProps
}: RezicsJsonEditorProps) {
  const viewRef = useRef<any>(null);

  const diagnosticsPlugin = useMemo<EditorPlugin | null>(() => {
    if (!diagnostics) return null;
    return {
      name: "rezics-json-diagnostics",
      extensions: linter((view) => {
        const length = view.state.doc.length;
        return diagnostics(view.state.doc.toString()).map(
          (diagnostic): Diagnostic => ({
            from: Math.max(0, Math.min(diagnostic.from ?? 0, length)),
            to: Math.max(0, Math.min(diagnostic.to ?? length, length)),
            severity: "error",
            message: diagnostic.message,
          }),
        );
      }),
    };
  }, [diagnostics]);

  const resolvedPlugins = useMemo(
    () =>
      diagnosticsPlugin ? [...(plugins ?? []), diagnosticsPlugin] : plugins,
    [diagnosticsPlugin, plugins],
  );

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
      <JsonEditor
        {...editorProps}
        plugins={resolvedPlugins}
        viewRef={handleViewRef}
      />
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
