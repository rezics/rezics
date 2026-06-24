import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Primitives/Input",
  component: Input,
  args: { placeholder: "Search your library…" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="input-email">Email</Label>
      <Input
        {...args}
        id="input-email"
        type="email"
        placeholder="you@example.com"
      />
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true, value: "Locked" } };

export const Invalid: Story = {
  render: (args) => (
    <Input
      {...args}
      aria-invalid="true"
      defaultValue="Not a valid email"
      className="w-72"
    />
  ),
};
