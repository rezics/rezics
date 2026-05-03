import type { Meta, StoryObj } from "@storybook/react-vite";

import { Spinner } from "./Spinner";

const meta = {
  title: "Primitive/Feedback/Spinner",
  component: Spinner,
  args: {
    size: "md",
    label: "Loading",
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: "sm" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const InlineWithText: Story = {
  render: (args) => (
    <span className="inline-flex items-center gap-2 text-[var(--rezics-color-text-secondary)]">
      <Spinner {...args} />
      Loading reviews…
    </span>
  ),
};
