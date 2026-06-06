import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";

import { Button } from "./button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Save" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Link: Story = { args: { variant: "link" } };
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};

export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Icon: Story = {
  args: { size: "icon", "aria-label": "Add", children: <Plus /> },
};

export const WithLeadingIcon: Story = {
  render: (args) => (
    <Button {...args}>
      <Plus />
      New chapter
    </Button>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
