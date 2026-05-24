import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { jsonFull } from "../json/index";
import { markdownFull } from "../markdown/index";
import { Editor } from "../react/Editor";

const meta = {
  title: "Editor/CodeMirror",
  parameters: {
    docs: {
      description: {
        component:
          "CodeMirror-backed editor used in `@rezics/editor`. Smoke-test for cross-package Storybook composition.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Markdown: Story = {
  render: () => {
    const [value, setValue] = useState(
      "# Hello\n\nThis is the **rezics** editor.\n\n- markdown\n- syntax highlighting\n",
    );
    return (
      <div style={{ width: 720, border: "1px solid #ddd", borderRadius: 8 }}>
        <Editor value={value} onChange={setValue} plugins={[markdownFull()]} />
      </div>
    );
  },
};

export const Json: Story = {
  render: () => {
    const [value, setValue] = useState(
      JSON.stringify({ rezics: { brand: "轮回红", hex: "#f4606c" } }, null, 2),
    );
    return (
      <div style={{ width: 720, border: "1px solid #ddd", borderRadius: 8 }}>
        <Editor value={value} onChange={setValue} plugins={[jsonFull()]} />
      </div>
    );
  },
};
