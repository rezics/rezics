import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "#/shadcn/button";

const meta = {
  title: "Foundation/Tokens",
  parameters: {
    docs: {
      description: {
        component:
          "Smoke-test of token wiring: surfaces, brand, text, and motion tokens resolve through CSS variables.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Surfaces: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <h2 className="text-3xl font-bold">Surfaces</h2>
      <div className="flex flex-row gap-4">
        {(
          [
            ["canvas", "var(--colors-surface-canvas)"],
            ["base", "var(--colors-surface-base)"],
            ["raised", "var(--colors-surface-elevated)"],
            ["sunken", "var(--colors-surface-sunken)"],
          ] as const
        ).map(([name, value]) => (
          <div
            key={name}
            className="p-6 min-w-[140px] rounded-md border border-border-whisper"
            style={{ backgroundColor: value }}
          >
            <p className="text-xs uppercase tracking-wide">{name}</p>
            <p className="text-xs text-rezics-fg-muted">{value}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <h2 className="text-3xl font-bold">Buttons</h2>
      <div className="flex flex-row gap-4">
        <Button variant="default">Save</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="ghost">More</Button>
      </div>
    </div>
  ),
};

export const Typography_: Story = {
  name: "Typography",
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">Heading 1</h1>
      <h2 className="text-3xl font-bold">Heading 2</h2>
      <h3 className="text-2xl font-bold">Heading 3</h3>
      <p className="text-base">
        Body 1 — Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </p>
      <p className="text-sm text-rezics-fg-muted">
        Body 2 secondary — supporting text in muted token.
      </p>
      <p className="text-xs text-rezics-fg-muted">Caption — 3 days ago</p>
    </div>
  ),
};
