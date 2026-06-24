import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Primitives/Label",
  component: Label,
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="label-input">Display name</Label>
      <Input id="label-input" placeholder="Your name" />
    </div>
  ),
};

export const WithCheckbox: Story = {
  render: () => (
    <Label htmlFor="label-cb">
      <Checkbox id="label-cb" />
      Receive weekly digest
    </Label>
  ),
};
