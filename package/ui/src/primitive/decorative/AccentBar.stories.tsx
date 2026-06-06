import type { Meta, StoryObj } from "@storybook/react-vite";

import { AccentBar } from "./AccentBar";

const meta = {
  title: "Primitive/Decorative/AccentBar",
  component: AccentBar,
  args: { height: 24 },
} satisfies Meta<typeof AccentBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
