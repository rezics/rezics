import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";

import { createTheme } from "../core/theme";
import { CodeEditor } from "./CodeEditor";
import { JsonEditor } from "./JsonEditor";
import { MarkdownEditor } from "./MarkdownEditor";

const sampleContent: Record<string, string> = {
  markdown:
    "# Heading\n\nSome **bold** and *italic* text.\n\n- Item 1\n- Item 2\n",
  json: JSON.stringify({ hello: "world", count: 42 }, null, 2),
  plain: "Plain text editor with no language plugins.",
};

type Args = {
  mode: "markdown" | "json" | "plain";
  themeVariant: "light" | "dark";
};

function Render({ mode, themeVariant }: Args) {
  const theme = useMemo(() => createTheme({ variant: themeVariant }), [
    themeVariant,
  ]);

  const content = sampleContent[mode] ?? "";
  const props = { value: content, theme, className: "h-full" };

  let editor: React.ReactNode;
  switch (mode) {
    case "markdown":
      editor = <MarkdownEditor key={themeVariant} preview={true} {...props} />;
      break;
    case "json":
      editor = <JsonEditor key={themeVariant} {...props} />;
      break;
    default:
      editor = <CodeEditor key={themeVariant} {...props} />;
      break;
  }

  return (
    <div
      style={{
        height: "100vh",
        background: themeVariant === "dark" ? "#1e1e1e" : "#ffffff",
      }}
    >
      {editor}
    </div>
  );
}

const meta = {
  title: "Editor/Options",
  args: { mode: "markdown", themeVariant: "light" },
  argTypes: {
    mode: { control: "radio", options: ["markdown", "json", "plain"] },
    themeVariant: { control: "radio", options: ["light", "dark"] },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => <Render {...args} />,
};
