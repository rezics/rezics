import type { Meta, StoryObj } from "@storybook/react-vite";

import { JsonEditor } from "../JsonEditor";

const validJson = JSON.stringify(
  {
    name: "@rezics/editor",
    version: "1.0.50",
    type: "module",
    published: true,
    tags: ["markdown", "json", "plugins", "toolbar"],
    dependencies: {
      "@codemirror/state": "^6.6.0",
      "@codemirror/view": "^6.40.0",
    },
    config: {
      nested: {
        deep: { value: null, count: 42, enabled: false },
      },
    },
  },
  null,
  2,
);

const invalidJson = `{
  "name": "@rezics/editor",
  "version": "1.0.50",
  "missing_comma": true
  "this_will_error": false
}`;

const largeJson = JSON.stringify(
  {
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      title: `Item ${i + 1}`,
      description: `Description for item ${i + 1} with some details.`,
      metadata: {
        created: "2025-01-15T10:00:00Z",
        tags: ["tag-a", "tag-b"],
        active: i % 3 !== 0,
      },
    })),
  },
  null,
  2,
);

const meta = {
  title: "Editor/JSON/Editor",
  component: JsonEditor,
} satisfies Meta<typeof JsonEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <JsonEditor value={validJson} className="h-screen" />,
};

export const WithLintErrors: Story = {
  render: () => <JsonEditor value={invalidJson} className="h-screen" />,
};

export const NoLint: Story = {
  render: () => (
    <JsonEditor value={invalidJson} lint={false} className="h-screen" />
  ),
};

export const LargeDocument: Story = {
  render: () => <JsonEditor value={largeJson} className="h-screen" />,
};
