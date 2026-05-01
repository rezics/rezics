import type { Meta, StoryObj } from "@storybook/react-vite";

import { GreenButton } from "./GreenButton";

const meta = {
  title: "Primitive/Button/GreenButton",
  component: GreenButton,
  args: { label: "Click me" },
} satisfies Meta<typeof GreenButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
