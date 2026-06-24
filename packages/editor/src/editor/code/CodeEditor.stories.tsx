import type { Meta, StoryObj } from "@storybook/react-vite";

import { CodeEditor } from "../CodeEditor";

const sampleText = `The editor with no language plugins acts as a plain text / code input.

You can type freely here. This is useful as a base-level test
of the core editor functionality: cursor movement, selection,
undo/redo, and basic keybindings.

Multiple lines of content help verify scroll behavior
and line wrapping in the plain text editor.
`;

const meta = {
  title: "Editor/Code/Editor",
  component: CodeEditor,
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <CodeEditor value={sampleText} className="h-screen" />,
};

export const WithCustomPlugin: Story = {
  render: () => (
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
