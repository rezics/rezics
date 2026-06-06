import type { Meta, StoryObj } from "@storybook/react-vite";

import { ColorfulButton } from "./ColorfulButton";

const meta = {
  title: "Primitive/Button/ColorfulButton",
  component: ColorfulButton,
  args: { label: "Click me", color: "green" },
} satisfies Meta<typeof ColorfulButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Green: Story = {};

export const Orange: Story = {
  args: { color: "orange" },
};

export const Rose: Story = {
  args: { color: "rose" },
};

export const Disabled: Story = {
  args: { color: "green", disabled: true },
};
