import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bold } from "lucide-react";

import { Toggle } from "./toggle";

const meta = {
  title: "Primitives/Toggle",
  component: Toggle,
  args: {
    "aria-label": "Toggle bold",
    children: <Bold />,
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Outline: Story = { args: { variant: "outline" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };

export const WithText: Story = {
  args: {
    children: (
      <>
        <Bold /> Bold
      </>
    ),
  },
};

export const Disabled: Story = { args: { disabled: true } };
