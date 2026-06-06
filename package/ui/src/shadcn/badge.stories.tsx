import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./badge";

const meta = {
  title: "Primitives/Badge",
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Badge>New</Badge>,
};

export const Secondary: Story = {
  render: () => <Badge variant="secondary">Draft</Badge>,
};

export const Destructive: Story = {
  render: () => <Badge variant="destructive">Failed</Badge>,
};

export const Outline: Story = {
  render: () => <Badge variant="outline">Beta</Badge>,
};

export const InsideText: Story = {
  render: () => (
    <p className="text-sm">
      Chapter 4 <Badge variant="secondary">draft</Badge> is ready for review.
    </p>
  ),
};
