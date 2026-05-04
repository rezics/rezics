import type { Meta, StoryObj } from "@storybook/react-vite";

import { Separator } from "./separator";

const meta = {
  title: "Primitives/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-72 space-y-2">
      <div className="text-sm font-medium">Library</div>
      <Separator />
      <div className="text-sm text-text-secondary">23 unread items</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-4 text-sm">
      <span>Library</span>
      <Separator orientation="vertical" />
      <span>Highlights</span>
      <Separator orientation="vertical" />
      <span>Settings</span>
    </div>
  ),
};
