import { tags } from "@lezer/highlight";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";

import { createTheme } from "../../core/theme";
import { JsonEditor } from "../JsonEditor";
import { MarkdownEditor } from "../MarkdownEditor";

const markdownContent = `# Theme Preview

Some **bold** and *italic* text with \`inline code\`.

\`\`\`typescript
const greeting: string = "hello";
// A comment
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

> A blockquote to check foreground contrast.

- List item one
- List item two
`;

const invalidJson = `{
  "name": "theme-test",
  "version": "1.0.0",
  "missing_comma": true
  "error_here": false
}`;

type Args = { variant: "light" | "dark" };

function ThemeVariantsRender({ variant }: Args) {
  const theme = useMemo(() => createTheme({ variant }), [variant]);
  return (
    <div
      style={{
        height: "100vh",
        background: variant === "dark" ? "#1e1e1e" : "#ffffff",
      }}
    >
      <MarkdownEditor
        key={variant}
        value={markdownContent}
        preview={false}
        theme={theme}
        className="h-full"
      />
    </div>
  );
}

const meta = {
  title: "Editor/Theme",
  args: { variant: "light" },
  argTypes: {
    variant: { control: "radio", options: ["light", "dark"] },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const ThemeVariants: Story = {
  render: (args) => <ThemeVariantsRender {...args} />,
};

export const CustomColors: Story = {
  render: () => {
    const theme = createTheme({
      variant: "dark",
      settings: {
        background: "#1a1b26",
        foreground: "#a9b1d6",
        caret: "#c0caf5",
        selection: "#33467c",
        lineHighlight: "#292e42",
        gutterBackground: "#1a1b26",
        gutterForeground: "#3b4261",
      },
    });
    return (
      <div style={{ height: "100vh", background: "#1a1b26" }}>
        <MarkdownEditor
          value={markdownContent}
          preview={false}
          theme={theme}
          className="h-full"
        />
      </div>
    );
  },
};

export const CustomSyntaxStyles: Story = {
  render: () => {
    const theme = createTheme({
      variant: "light",
      settings: { background: "#fafafa", foreground: "#383a42" },
      styles: [
        { tag: tags.keyword, color: "#a626a4" },
        { tag: tags.string, color: "#50a14f" },
        { tag: tags.comment, color: "#a0a1a7", fontStyle: "italic" },
        { tag: tags.number, color: "#986801" },
        { tag: tags.function(tags.variableName), color: "#4078f2" },
        { tag: tags.typeName, color: "#c18401" },
      ],
    });
    return (
      <div style={{ height: "100vh", background: "#fafafa" }}>
        <MarkdownEditor
          value={markdownContent}
          preview={false}
          theme={theme}
          className="h-full"
        />
      </div>
    );
  },
};

export const DarkMarkdownWithPreview: Story = {
  render: () => {
    const theme = createTheme({
      variant: "dark",
      settings: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        selection: "#264f78",
        gutterBackground: "#0d1117",
        gutterForeground: "#484f58",
      },
    });
    return (
      <div style={{ height: "100vh", background: "#0d1117" }}>
        <MarkdownEditor
          value={markdownContent}
          preview={true}
          theme={theme}
          className="h-full"
        />
      </div>
    );
  },
};

export const LightJsonWithLint: Story = {
  render: () => {
    const theme = createTheme({
      variant: "light",
      settings: {
        background: "#ffffff",
        foreground: "#24292f",
        lineHighlight: "#f6f8fa",
      },
    });
    return (
      <div style={{ height: "100vh", background: "#ffffff" }}>
        <JsonEditor value={invalidJson} theme={theme} className="h-full" />
      </div>
    );
  },
};
