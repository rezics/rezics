import { CodeEditor } from "../CodeEditor";

const sampleText = `The editor with no language plugins acts as a plain text / code input.

You can type freely here. This is useful as a base-level test
of the core editor functionality: cursor movement, selection,
undo/redo, and basic keybindings.

Multiple lines of content help verify scroll behavior
and line wrapping in the plain text editor.
`;

export default {
  Default: () => <CodeEditor value={sampleText} className="h-screen" />,

  WithCustomPlugin: () => (
    <CodeEditor
      value={sampleText}
      plugins={[
        {
          name: "custom-noop",
          toolbar: [
            {
              name: "custom-btn",
              label: "Custom Button",
              icon: "★",
              action: () => {},
            },
          ],
        },
      ]}
      className="h-screen"
    />
  ),
};
