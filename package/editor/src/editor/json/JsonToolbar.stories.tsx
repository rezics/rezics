import type { Meta, StoryObj } from "@storybook/react-vite";

import { JsonEditor } from "../JsonEditor";

const sampleJson = JSON.stringify(
  { hello: "world", count: 42, nested: { key: "value" } },
  null,
  2,
);

const meta = {
  title: "Editor/JSON/Toolbar",
  component: JsonEditor,
} satisfies Meta<typeof JsonEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultToolbar: Story = {
  render: () => <JsonEditor value={sampleJson} className="h-screen" />,
};

export const CustomFormatIcon: Story = {
  render: () => (
    <JsonEditor
      value={sampleJson}
      toolbar={{
        icons: {
          format: (
            <span style={{ fontSize: 14, fontFamily: "monospace" }}>
              {"{}"}
            </span>
          ),
        },
      }}
      className="h-screen"
    />
  ),
};

export const NoToolbar: Story = {
  render: () => (
    <JsonEditor value={sampleJson} toolbar={false} className="h-screen" />
  ),
};
