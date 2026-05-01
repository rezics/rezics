import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Welcome/Overview",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Welcome: Story = {
  render: () => (
    <div
      style={{
        maxWidth: 640,
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.55,
      }}
    >
      <h1 style={{ fontWeight: 500 }}>rezics design system</h1>
      <p>
        This is the host Storybook. It composes per-package Storybooks via{" "}
        <code>refs</code>:
      </p>
      <ul>
        <li>
          <strong>UI · Foundation</strong> — tokens, MUI theme, primitives
          (port 6001)
        </li>
        <li>
          <strong>Editor · CodeMirror</strong> — markdown / json editors
          (port 6002)
        </li>
      </ul>
      <p>
        Boot the package storybooks first, then run <code>bun run storybook</code>{" "}
        from the repo root.
      </p>
    </div>
  ),
};
